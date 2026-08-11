import 'server-only';

import { z } from 'zod';

import { serverEnv } from '@/lib/server-env';

const CALLBACK_PATH = '/api/integrations/azure-devops/callback';
const ENTRA_ORIGIN = 'https://login.microsoftonline.com';
const AZURE_DEVOPS_DEFAULT_SCOPE =
  '499b84ac-1321-427f-aa17-267ca6975798/.default';
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;
const PKCE_PATTERN = /^[A-Za-z0-9._~-]{43,128}$/;
const DEFAULT_TIMEOUT_MS = 10_000;
const REFRESH_SKEW_MS = 60_000;
const MAX_OAUTH_ERROR_BYTES = 4_096;
const BODY_CANCEL_TIMEOUT_MS = 25;

export type EntraConfig = {
  readonly appOrigin: string;
  readonly tenantId: string;
  readonly clientId: string;
  readonly clientSecret: string;
  readonly scope: string;
};

export type EntraDependencies = {
  readonly config?: EntraConfig;
  readonly fetch?: typeof fetch;
  readonly now?: () => Date;
  readonly timeoutMs?: number;
};

export type EntraTokenSet = {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresAt: string;
  readonly grantedScopes: readonly string[];
};

export type ExchangeEntraCodeInput = {
  readonly code: string;
  readonly codeVerifier: string;
  readonly signal?: AbortSignal;
};

export type RefreshEntraTokensInput = {
  readonly refreshToken: string;
  readonly signal?: AbortSignal;
};

export type EntraErrorCode =
  'ENTRA_UNAVAILABLE' | 'ENTRA_AUTH_REJECTED' | 'ENTRA_RESPONSE_INVALID';

export class EntraError extends Error {
  constructor(readonly code: EntraErrorCode) {
    super(
      code === 'ENTRA_UNAVAILABLE'
        ? 'Microsoft sign-in is temporarily unavailable.'
        : code === 'ENTRA_AUTH_REJECTED'
          ? 'Microsoft rejected the authorization request.'
          : 'Microsoft returned an invalid authorization response.',
    );
    this.name = 'EntraError';
  }
}

const originSchema = z.string().transform((value, context) => {
  try {
    const url = new URL(value);
    if (
      (url.protocol !== 'https:' &&
        !(
          url.protocol === 'http:' &&
          ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
        )) ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    ) {
      throw new Error('invalid origin');
    }
    return url.origin;
  } catch {
    context.addIssue({
      code: 'custom',
      message: 'Invalid application origin.',
    });
    return z.NEVER;
  }
});

const safeString = (maximum: number) =>
  z
    .string()
    .min(1)
    .max(maximum)
    .refine((value) => !CONTROL_CHARACTER_PATTERN.test(value));

const configSchema = z.object({
  appOrigin: originSchema,
  tenantId: safeString(256).refine((value) => value !== '.' && value !== '..'),
  clientId: z.uuid(),
  clientSecret: safeString(8_192),
  scope: safeString(2_048).transform((value, context) => {
    const scopes = value.split(/\s+/).filter(Boolean);
    if (
      !scopes.includes('offline_access') ||
      !scopes.includes(AZURE_DEVOPS_DEFAULT_SCOPE)
    ) {
      context.addIssue({ code: 'custom', message: 'Invalid OAuth scope.' });
      return z.NEVER;
    }
    return [...new Set(scopes)].join(' ');
  }),
});

const tokenResponseSchema = z.object({
  access_token: safeString(16_384),
  refresh_token: safeString(16_384),
  token_type: z.string().refine((value) => value.toLowerCase() === 'bearer'),
  expires_in: z.number().int().positive().max(86_400),
  scope: safeString(4_096),
});

const oauthErrorSchema = z.object({
  error: safeString(256),
});

function invalidResponse(): never {
  throw new EntraError('ENTRA_RESPONSE_INVALID');
}

function environmentConfig(): EntraConfig {
  const env = serverEnv();
  return {
    appOrigin: env.APP_ORIGIN,
    tenantId: env.AZURE_DEVOPS_ENTRA_TENANT_ID,
    clientId: env.AZURE_DEVOPS_ENTRA_CLIENT_ID,
    clientSecret: env.AZURE_DEVOPS_ENTRA_CLIENT_SECRET,
    scope: env.AZURE_DEVOPS_OAUTH_SCOPES,
  };
}

function resolveConfig(
  config: EntraConfig | undefined,
): z.infer<typeof configSchema> {
  const parsed = configSchema.safeParse(config ?? environmentConfig());
  if (!parsed.success) invalidResponse();
  return parsed.data;
}

function canonicalState(value: unknown): value is string {
  if (
    typeof value !== 'string' ||
    value.length !== 43 ||
    !BASE64URL_PATTERN.test(value)
  ) {
    return false;
  }
  const bytes = Buffer.from(value, 'base64url');
  return bytes.byteLength === 32 && bytes.toString('base64url') === value;
}

function tenantEndpoint(
  tenantId: string,
  endpoint: 'authorize' | 'token',
): string {
  const segment = encodeURIComponent(tenantId);
  return `${ENTRA_ORIGIN}/${segment}/oauth2/v2.0/${endpoint}`;
}

function callbackUrl(config: z.infer<typeof configSchema>): string {
  return `${config.appOrigin}${CALLBACK_PATH}`;
}

function validNow(now: () => Date): Date {
  const value = now();
  if (!(value instanceof Date) || Number.isNaN(value.valueOf()))
    invalidResponse();
  return value;
}

function timeoutMilliseconds(value: number | undefined): number {
  if (value === undefined) {
    return DEFAULT_TIMEOUT_MS;
  }
  if (!Number.isSafeInteger(value) || value <= 0 || value > 60_000) {
    invalidResponse();
  }
  return value;
}

function requestSignal(
  callerSignal: AbortSignal | undefined,
  timeoutMs: number,
): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  const onCallerAbort = () => controller.abort();
  if (callerSignal?.aborted) controller.abort();
  else callerSignal?.addEventListener('abort', onCallerAbort, { once: true });
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer);
      callerSignal?.removeEventListener('abort', onCallerAbort);
    },
  };
}

function unavailable(): EntraError {
  return new EntraError('ENTRA_UNAVAILABLE');
}

function requireRequestTime(signal: AbortSignal): void {
  if (signal.aborted) throw unavailable();
}

function raceWithSignal<T>(
  operation: () => Promise<T>,
  signal: AbortSignal,
  rejectionCode: EntraErrorCode,
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
        () =>
          finish(() =>
            reject(
              signal.aborted ? unavailable() : new EntraError(rejectionCode),
            ),
          ),
      );
  });
}

async function settleBestEffort(
  operation: () => Promise<unknown>,
  signal: AbortSignal,
): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort: (() => void) | undefined;
  try {
    await Promise.race([
      Promise.resolve()
        .then(operation)
        .catch(() => undefined),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, BODY_CANCEL_TIMEOUT_MS);
        onAbort = () => resolve();
        if (signal.aborted) resolve();
        else signal.addEventListener('abort', onAbort, { once: true });
      }),
    ]);
  } catch {
    // Cancellation is best effort and must never replace the safe error.
  } finally {
    if (timer) clearTimeout(timer);
    if (onAbort) signal.removeEventListener('abort', onAbort);
  }
}

async function cancelResponseBody(
  response: Response,
  signal: AbortSignal,
): Promise<void> {
  if (!response.body) return;
  await settleBestEffort(() => response.body!.cancel(), signal);
}

async function readOAuthError(
  response: Response,
  signal: AbortSignal,
): Promise<{ error: string } | null> {
  if (!response.body) return null;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const part = await raceWithSignal(
        () => reader.read(),
        signal,
        'ENTRA_RESPONSE_INVALID',
      );
      if (part.done) break;
      total += part.value.byteLength;
      if (total > MAX_OAUTH_ERROR_BYTES) {
        await settleBestEffort(() => reader.cancel(), signal);
        return null;
      }
      chunks.push(part.value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    const parsed = oauthErrorSchema.safeParse(JSON.parse(decoded));
    return parsed.success ? parsed.data : null;
  } catch (error) {
    if (error instanceof EntraError && error.code === 'ENTRA_UNAVAILABLE') {
      throw error;
    }
    return null;
  } finally {
    reader.releaseLock();
  }
}

function tokenSet(value: unknown, now: () => Date): EntraTokenSet {
  const parsed = tokenResponseSchema.safeParse(value);
  if (!parsed.success) invalidResponse();
  const currentTime = validNow(now);
  const expiresAt = new Date(
    currentTime.valueOf() + parsed.data.expires_in * 1_000,
  );

  return Object.freeze({
    accessToken: parsed.data.access_token,
    refreshToken: parsed.data.refresh_token,
    expiresAt: expiresAt.toISOString(),
    grantedScopes: Object.freeze([
      ...new Set(parsed.data.scope.split(/\s+/).filter(Boolean)),
    ]),
  });
}

async function requestTokens(
  form: URLSearchParams,
  inputSignal: AbortSignal | undefined,
  dependencies: EntraDependencies,
): Promise<EntraTokenSet> {
  const config = resolveConfig(dependencies.config);
  const fetchImpl = dependencies.fetch ?? fetch;
  const now = dependencies.now ?? (() => new Date());
  const request = requestSignal(
    inputSignal,
    timeoutMilliseconds(dependencies.timeoutMs),
  );

  try {
    const response = await raceWithSignal(
      () =>
        fetchImpl(tenantEndpoint(config.tenantId, 'token'), {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          redirect: 'manual',
          body: form.toString(),
          signal: request.signal,
        }),
      request.signal,
      'ENTRA_UNAVAILABLE',
    );

    if (
      response.status === 408 ||
      response.status === 429 ||
      response.status >= 500
    ) {
      await cancelResponseBody(response, request.signal);
      requireRequestTime(request.signal);
      throw unavailable();
    }
    if (response.status >= 400 && response.status < 500) {
      const oauthError = await readOAuthError(response, request.signal);
      requireRequestTime(request.signal);
      if (
        oauthError?.error === 'temporarily_unavailable' ||
        oauthError?.error === 'server_error'
      ) {
        throw unavailable();
      }
      throw new EntraError('ENTRA_AUTH_REJECTED');
    }
    if (!response.ok) {
      await cancelResponseBody(response, request.signal);
      requireRequestTime(request.signal);
      invalidResponse();
    }
    const body = await raceWithSignal(
      () => response.json(),
      request.signal,
      'ENTRA_RESPONSE_INVALID',
    );
    return tokenSet(body, now);
  } finally {
    request.cleanup();
  }
}

export function createEntraAuthorizationUrl(
  input: { readonly state: string; readonly codeChallenge: string },
  dependencies: Pick<EntraDependencies, 'config'> = {},
): string {
  const config = resolveConfig(dependencies.config);
  if (
    !input ||
    !canonicalState(input.state) ||
    typeof input.codeChallenge !== 'string' ||
    !PKCE_PATTERN.test(input.codeChallenge)
  ) {
    invalidResponse();
  }

  const query = new URLSearchParams([
    ['client_id', config.clientId],
    ['response_type', 'code'],
    ['response_mode', 'query'],
    ['redirect_uri', callbackUrl(config)],
    ['scope', config.scope],
    ['state', input.state],
    ['code_challenge', input.codeChallenge],
    ['code_challenge_method', 'S256'],
  ]);
  return `${tenantEndpoint(config.tenantId, 'authorize')}?${query}`;
}

export async function exchangeEntraCode(
  input: ExchangeEntraCodeInput,
  dependencies: EntraDependencies = {},
): Promise<EntraTokenSet> {
  const config = resolveConfig(dependencies.config);
  if (
    !input ||
    !safeString(4_096).safeParse(input.code).success ||
    !PKCE_PATTERN.test(input.codeVerifier)
  ) {
    invalidResponse();
  }
  const form = new URLSearchParams([
    ['client_id', config.clientId],
    ['client_secret', config.clientSecret],
    ['grant_type', 'authorization_code'],
    ['code', input.code],
    ['redirect_uri', callbackUrl(config)],
    ['scope', config.scope],
    ['code_verifier', input.codeVerifier],
  ]);
  return requestTokens(form, input.signal, { ...dependencies, config });
}

export async function refreshEntraTokens(
  input: RefreshEntraTokensInput,
  dependencies: EntraDependencies = {},
): Promise<EntraTokenSet> {
  const config = resolveConfig(dependencies.config);
  if (!input || !safeString(16_384).safeParse(input.refreshToken).success) {
    invalidResponse();
  }
  const form = new URLSearchParams([
    ['client_id', config.clientId],
    ['client_secret', config.clientSecret],
    ['grant_type', 'refresh_token'],
    ['refresh_token', input.refreshToken],
    ['scope', config.scope],
  ]);
  return requestTokens(form, input.signal, { ...dependencies, config });
}

export function shouldRefreshToken(
  expiresAt: string,
  now: Date = new Date(),
): boolean {
  const expiry = new Date(expiresAt);
  if (
    typeof expiresAt !== 'string' ||
    Number.isNaN(expiry.valueOf()) ||
    !(now instanceof Date) ||
    Number.isNaN(now.valueOf())
  ) {
    return true;
  }
  return expiry.valueOf() - now.valueOf() <= REFRESH_SKEW_MS;
}
