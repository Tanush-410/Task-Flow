import 'server-only';

import type { z } from 'zod';

import { EntraError } from '../auth/entra';

const PROFILE_ROOT = 'https://app.vssps.visualstudio.com';
const SERVICES_ROOT = 'https://dev.azure.com';
const API_VERSION = '7.1';
const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_PAGES = 25;
const BODY_CANCEL_TIMEOUT_MS = 25;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;
const ORGANIZATION_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,48}[A-Za-z0-9])?$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type AzureTokenProvider = {
  getAccessToken(signal: AbortSignal): Promise<string>;
  refreshAccessToken(signal: AbortSignal): Promise<string>;
};

export type AzureDevOpsClientOptions = {
  readonly tokenProvider: AzureTokenProvider;
  readonly fetch?: typeof fetch;
  readonly timeoutMs?: number;
  readonly signal?: AbortSignal;
};

export type AzurePage<T> = { readonly value: readonly T[] };

export type AzureDevOpsClient = {
  getProfile<T>(schema: z.ZodType<T>): Promise<T>;
  listAccounts<T>(
    memberId: string,
    schema: z.ZodType<AzurePage<T>>,
  ): Promise<readonly T[]>;
  listProjects<T>(
    organizationSlug: string,
    schema: z.ZodType<AzurePage<T>>,
  ): Promise<readonly T[]>;
  listTeams<T>(
    organizationSlug: string,
    projectId: string,
    schema: z.ZodType<AzurePage<T>>,
  ): Promise<readonly T[]>;
};

export type AzureDevOpsErrorCode =
  | 'AZURE_UNAVAILABLE'
  | 'AZURE_RECONNECT_REQUIRED'
  | 'AZURE_PERMISSION_DENIED'
  | 'AZURE_NOT_FOUND'
  | 'AZURE_RESPONSE_INVALID';

export class AzureDevOpsError extends Error {
  constructor(readonly code: AzureDevOpsErrorCode) {
    super(
      code === 'AZURE_UNAVAILABLE'
        ? 'Azure DevOps is temporarily unavailable.'
        : code === 'AZURE_RECONNECT_REQUIRED'
          ? 'The Azure DevOps connection must be renewed.'
          : code === 'AZURE_PERMISSION_DENIED'
            ? 'Azure DevOps denied permission for this request.'
            : code === 'AZURE_NOT_FOUND'
              ? 'The requested Azure DevOps resource was not found.'
              : 'Azure DevOps returned an invalid response.',
    );
    this.name = 'AzureDevOpsError';
  }
}

function invalidResponse(): never {
  throw new AzureDevOpsError('AZURE_RESPONSE_INVALID');
}

export function isValidAzureOrganizationSlug(value: unknown): value is string {
  return typeof value === 'string' && ORGANIZATION_PATTERN.test(value);
}

function validateOrganization(value: unknown): asserts value is string {
  if (!isValidAzureOrganizationSlug(value)) {
    invalidResponse();
  }
}

function validateUuid(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) invalidResponse();
}

function validateToken(value: unknown): asserts value is string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > 16_384 ||
    CONTROL_CHARACTER_PATTERN.test(value)
  ) {
    throw new AzureDevOpsError('AZURE_RECONNECT_REQUIRED');
  }
}

function timeoutMilliseconds(value: number | undefined): number {
  if (value === undefined) return DEFAULT_TIMEOUT_MS;
  if (!Number.isSafeInteger(value) || value <= 0 || value > 60_000) {
    invalidResponse();
  }
  return value;
}

function combinedSignal(
  callerSignal: AbortSignal | undefined,
  timeoutMs: number,
): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  if (callerSignal?.aborted) controller.abort();
  else callerSignal?.addEventListener('abort', onAbort, { once: true });
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer);
      callerSignal?.removeEventListener('abort', onAbort);
    },
  };
}

function classifyStatus(status: number): never {
  if (status === 401) throw new AzureDevOpsError('AZURE_RECONNECT_REQUIRED');
  if (status === 403) throw new AzureDevOpsError('AZURE_PERMISSION_DENIED');
  if (status === 404) throw new AzureDevOpsError('AZURE_NOT_FOUND');
  if (status === 408 || status === 429 || status >= 500) {
    throw new AzureDevOpsError('AZURE_UNAVAILABLE');
  }
  invalidResponse();
}

function pageToken(response: Response): string | null {
  const value = response.headers.get('x-ms-continuationtoken');
  if (value === null) return null;
  if (
    value.length === 0 ||
    value.length > 1_024 ||
    CONTROL_CHARACTER_PATTERN.test(value)
  ) {
    invalidResponse();
  }
  return value;
}

export function createAzureDevOpsClient(
  options: AzureDevOpsClientOptions,
): AzureDevOpsClient {
  if (
    !options ||
    !options.tokenProvider ||
    typeof options.tokenProvider.getAccessToken !== 'function' ||
    typeof options.tokenProvider.refreshAccessToken !== 'function'
  ) {
    invalidResponse();
  }
  const fetchImpl = options.fetch ?? fetch;
  const timeoutMs = timeoutMilliseconds(options.timeoutMs);
  const callerSignal = options.signal;
  const getAccessToken = options.tokenProvider.getAccessToken.bind(
    options.tokenProvider,
  );
  const refreshAccessToken = options.tokenProvider.refreshAccessToken.bind(
    options.tokenProvider,
  );

  function unavailable(): AzureDevOpsError {
    return new AzureDevOpsError('AZURE_UNAVAILABLE');
  }

  function raceWithSignal<T>(
    operation: () => Promise<T>,
    signal: AbortSignal,
    mapRejection: (error: unknown) => AzureDevOpsError,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      let settled = false;
      const finish = (callback: () => void) => {
        if (settled) return;
        settled = true;
        signal.removeEventListener('abort', onAbort);
        callback();
      };
      const onAbort = () => finish(() => reject(unavailable()));

      if (signal.aborted) {
        onAbort();
        return;
      }
      signal.addEventListener('abort', onAbort, { once: true });
      Promise.resolve()
        .then(operation)
        .then(
          (value) => finish(() => resolve(value)),
          (error: unknown) =>
            finish(() =>
              reject(signal.aborted ? unavailable() : mapRejection(error)),
            ),
        );
    });
  }

  function providerError(error: unknown): AzureDevOpsError {
    if (error instanceof EntraError) {
      return new AzureDevOpsError(
        error.code === 'ENTRA_UNAVAILABLE'
          ? 'AZURE_UNAVAILABLE'
          : 'AZURE_RECONNECT_REQUIRED',
      );
    }
    if (
      error instanceof AzureDevOpsError &&
      ['AZURE_UNAVAILABLE', 'AZURE_RECONNECT_REQUIRED'].includes(error.code)
    ) {
      return error;
    }
    return new AzureDevOpsError('AZURE_RECONNECT_REQUIRED');
  }

  async function cancelResponseBody(
    response: Response,
    signal: AbortSignal,
  ): Promise<void> {
    if (!response.body) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let onAbort: (() => void) | undefined;
    try {
      await Promise.race([
        Promise.resolve()
          .then(() => response.body?.cancel())
          .catch(() => undefined),
        new Promise<void>((resolve) => {
          timer = setTimeout(resolve, BODY_CANCEL_TIMEOUT_MS);
          onAbort = () => resolve();
          if (signal.aborted) resolve();
          else signal.addEventListener('abort', onAbort, { once: true });
        }),
      ]);
    } catch {
      // Cancellation is best effort and must not replace the safe error.
    } finally {
      if (timer) clearTimeout(timer);
      if (onAbort) signal.removeEventListener('abort', onAbort);
    }
  }

  async function fetchOnce(
    url: string,
    token: string,
    signal: AbortSignal,
  ): Promise<Response> {
    validateToken(token);
    return raceWithSignal(
      () =>
        fetchImpl(url, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
          redirect: 'manual',
          signal,
        }),
      signal,
      () => unavailable(),
    );
  }

  function requireTime(signal: AbortSignal): void {
    if (signal.aborted) throw unavailable();
  }

  async function request<T>(
    url: string,
    schema: z.ZodType<T>,
    signal: AbortSignal,
  ): Promise<{ data: T; continuationToken: string | null }> {
    let token = await raceWithSignal(
      () => getAccessToken(signal),
      signal,
      providerError,
    );
    let response = await fetchOnce(url, token, signal);
    requireTime(signal);

    if (response.status === 401) {
      await cancelResponseBody(response, signal);
      requireTime(signal);
      token = await raceWithSignal(
        () => refreshAccessToken(signal),
        signal,
        providerError,
      );
      response = await fetchOnce(url, token, signal);
      requireTime(signal);
      if (response.status === 401) {
        await cancelResponseBody(response, signal);
        requireTime(signal);
        throw new AzureDevOpsError('AZURE_RECONNECT_REQUIRED');
      }
    }

    if (!response.ok) {
      await cancelResponseBody(response, signal);
      requireTime(signal);
      classifyStatus(response.status);
    }
    const body = await raceWithSignal(
      () => response.json(),
      signal,
      () => new AzureDevOpsError('AZURE_RESPONSE_INVALID'),
    );
    requireTime(signal);
    try {
      const result = schema.safeParse(body);
      if (!result.success) invalidResponse();
      const continuationToken = pageToken(response);
      requireTime(signal);
      return { data: result.data, continuationToken };
    } catch (error) {
      if (error instanceof AzureDevOpsError) throw error;
      invalidResponse();
    }
  }

  async function withDeadline<T>(
    operation: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    const deadline = combinedSignal(callerSignal, timeoutMs);
    try {
      return await operation(deadline.signal);
    } finally {
      deadline.cleanup();
    }
  }

  async function get<T>(
    url: string,
    schema: z.ZodType<T>,
    signal: AbortSignal,
  ): Promise<T> {
    return (await request(url, schema, signal)).data;
  }

  async function paginate<T>(
    baseUrl: string,
    schema: z.ZodType<AzurePage<T>>,
    signal: AbortSignal,
  ): Promise<readonly T[]> {
    const values: T[] = [];
    const seenTokens = new Set<string>();
    let continuationToken: string | null = null;

    for (let page = 0; page < MAX_PAGES; page += 1) {
      const url = new URL(baseUrl);
      if (continuationToken !== null) {
        url.searchParams.set('continuationToken', continuationToken);
      }
      const result = await request(url.toString(), schema, signal);
      values.push(...result.data.value);

      continuationToken = result.continuationToken;
      if (continuationToken === null) return Object.freeze(values);
      if (seenTokens.has(continuationToken)) invalidResponse();
      seenTokens.add(continuationToken);
    }
    invalidResponse();
  }

  return Object.freeze({
    getProfile<T>(schema: z.ZodType<T>): Promise<T> {
      return withDeadline((signal) =>
        get(
          `${PROFILE_ROOT}/_apis/profile/profiles/me?api-version=${API_VERSION}`,
          schema,
          signal,
        ),
      );
    },

    listAccounts<T>(
      memberId: string,
      schema: z.ZodType<AzurePage<T>>,
    ): Promise<readonly T[]> {
      validateUuid(memberId);
      const url = new URL('/_apis/accounts', PROFILE_ROOT);
      url.searchParams.set('memberId', memberId);
      url.searchParams.set('api-version', API_VERSION);
      return withDeadline((signal) => paginate(url.toString(), schema, signal));
    },

    listProjects<T>(
      organizationSlug: string,
      schema: z.ZodType<AzurePage<T>>,
    ): Promise<readonly T[]> {
      validateOrganization(organizationSlug);
      return withDeadline((signal) =>
        paginate(
          `${SERVICES_ROOT}/${encodeURIComponent(organizationSlug)}/_apis/projects?api-version=${API_VERSION}`,
          schema,
          signal,
        ),
      );
    },

    listTeams<T>(
      organizationSlug: string,
      projectId: string,
      schema: z.ZodType<AzurePage<T>>,
    ): Promise<readonly T[]> {
      validateOrganization(organizationSlug);
      validateUuid(projectId);
      return withDeadline((signal) =>
        paginate(
          `${SERVICES_ROOT}/${encodeURIComponent(organizationSlug)}/_apis/projects/${encodeURIComponent(projectId)}/teams?api-version=${API_VERSION}`,
          schema,
          signal,
        ),
      );
    },
  });
}
