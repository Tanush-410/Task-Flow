import { z } from 'zod';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  AzureDevOpsError,
  createAzureDevOpsClient,
  type AzureTokenProvider,
} from '@/modules/azure-devops/client/http';
import { EntraError } from '@/modules/azure-devops/auth/entra';
import {
  getAzureProfile,
  listAzureAccounts,
  listAzureProjects,
  listAzureTeams,
} from '@/modules/azure-devops/client/discovery';

const memberId = '11111111-1111-4111-8111-111111111111';
const projectId = '22222222-2222-4222-8222-222222222222';
const tokenProvider = (): AzureTokenProvider => ({
  getAccessToken: vi.fn().mockResolvedValue('access-token'),
  refreshAccessToken: vi.fn().mockResolvedValue('refreshed-token'),
});

function jsonResponse(
  body: unknown,
  status = 200,
  headers?: HeadersInit,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

function client(fetchImpl: typeof fetch, provider = tokenProvider()) {
  return {
    client: createAzureDevOpsClient({
      tokenProvider: provider,
      fetch: fetchImpl,
      timeoutMs: 100,
    }),
    provider,
  };
}

describe('Azure DevOps HTTP client', () => {
  it('sends the bearer token only in headers to the fixed profile endpoint', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ id: memberId }));
    const { client: azureClient } = client(fetchImpl);

    await azureClient.getProfile(z.object({ id: z.string() }));

    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe(
      'https://app.vssps.visualstudio.com/_apis/profile/profiles/me?api-version=7.1',
    );
    expect(init?.headers).toEqual({
      Accept: 'application/json',
      Authorization: 'Bearer access-token',
    });
    expect(init?.redirect).toBe('manual');
    expect(String(url)).not.toContain('access-token');
  });

  it('refreshes once on 401 and retries once with the new token', async () => {
    const unauthorized = jsonResponse({}, 401);
    const cancel = vi.spyOn(unauthorized.body!, 'cancel');
    const provider = tokenProvider();
    const refresh = provider.refreshAccessToken as ReturnType<typeof vi.fn>;
    refresh.mockImplementation(async () => {
      expect(cancel).toHaveBeenCalledOnce();
      return 'refreshed-token';
    });
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(unauthorized)
      .mockResolvedValueOnce(jsonResponse({ id: memberId }));
    const { client: azureClient } = client(fetchImpl, provider);

    await expect(
      azureClient.getProfile(z.object({ id: z.string() })),
    ).resolves.toEqual({ id: memberId });
    expect(provider.refreshAccessToken).toHaveBeenCalledOnce();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[1]?.[1]?.headers).toEqual({
      Accept: 'application/json',
      Authorization: 'Bearer refreshed-token',
    });
    expect(
      fetchImpl.mock.calls.every(([, init]) => init?.redirect === 'manual'),
    ).toBe(true);
  });

  it('requires reconnect after the retried request also returns 401', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ secret: 'body-secret' }, 401));
    const provider = tokenProvider();
    const { client: azureClient } = client(fetchImpl, provider);

    const thrown = await azureClient
      .getProfile(z.object({ id: z.string() }))
      .catch((error: unknown) => error);

    expect(thrown).toMatchObject({ code: 'AZURE_RECONNECT_REQUIRED' });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(provider.refreshAccessToken).toHaveBeenCalledOnce();
    expect(String(thrown)).not.toContain('body-secret');
    expect(String(thrown)).not.toContain('access-token');
  });

  it.each([
    [408, 'AZURE_UNAVAILABLE'],
    [403, 'AZURE_PERMISSION_DENIED'],
    [404, 'AZURE_NOT_FOUND'],
    [429, 'AZURE_UNAVAILABLE'],
    [500, 'AZURE_UNAVAILABLE'],
    [302, 'AZURE_RESPONSE_INVALID'],
  ])('classifies HTTP %i with a stable safe error', async (status, code) => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ secret: 'provider body' }, status));
    const { client: azureClient } = client(fetchImpl);

    const thrown = await azureClient
      .getProfile(z.object({ id: z.string() }))
      .catch((error: unknown) => error);

    expect(thrown).toMatchObject({ code });
    expect(String(thrown)).not.toContain('provider body');
    expect(JSON.stringify(thrown)).not.toContain('provider body');
  });

  it('best-effort cancels unread terminal Azure response bodies', async () => {
    const response = jsonResponse({ secret: 'do-not-read' }, 403);
    const cancel = vi
      .spyOn(response.body!, 'cancel')
      .mockRejectedValue(new Error('cancellation failed'));
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response);

    await expect(
      client(fetchImpl).client.getProfile(z.object({ id: z.string() })),
    ).rejects.toMatchObject({ code: 'AZURE_PERMISSION_DENIED' });
    expect(cancel).toHaveBeenCalledOnce();
  });

  it('classifies network failures and request timeouts as unavailable', async () => {
    const networkFetch = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error('network URL and token leak'));
    const hangingFetch = vi.fn<typeof fetch>().mockImplementation(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          );
        }),
    );

    const networkError = await client(networkFetch)
      .client.getProfile(z.object({ id: z.string() }))
      .catch((error: unknown) => error);
    const timeoutClient = createAzureDevOpsClient({
      tokenProvider: tokenProvider(),
      fetch: hangingFetch,
      timeoutMs: 5,
    });
    const timeoutError = await timeoutClient
      .getProfile(z.object({ id: z.string() }))
      .catch((error: unknown) => error);

    expect(networkError).toMatchObject({ code: 'AZURE_UNAVAILABLE' });
    expect(String(networkError)).not.toContain('network URL and token leak');
    expect(timeoutError).toMatchObject({ code: 'AZURE_UNAVAILABLE' });
    expect(hangingFetch.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
  });

  it('keeps the timeout active while validating the response body', async () => {
    let signal: AbortSignal | null = null;
    const slowBodyFetch = vi
      .fn<typeof fetch>()
      .mockImplementation((_input, init) => {
        signal = init?.signal ?? null;
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: () =>
            new Promise((resolve) => setTimeout(() => resolve({}), 25)),
        } as Response);
      });
    const slowClient = createAzureDevOpsClient({
      tokenProvider: tokenProvider(),
      fetch: slowBodyFetch,
      timeoutMs: 5,
    });

    await expect(
      slowClient.getProfile(z.object({ id: z.string() })),
    ).rejects.toMatchObject({ code: 'AZURE_UNAVAILABLE' });
    expect((signal as AbortSignal | null)?.aborted).toBe(true);
  });

  it('times out while waiting for a non-signal-aware token provider', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const hangingProvider: AzureTokenProvider = {
      getAccessToken: () => new Promise(() => undefined),
      refreshAccessToken: vi.fn().mockResolvedValue('unused'),
    };
    const azureClient = createAzureDevOpsClient({
      tokenProvider: hangingProvider,
      fetch: fetchImpl,
      timeoutMs: 5,
    });

    const outcome = await Promise.race([
      azureClient
        .getProfile(z.object({ id: z.string() }))
        .catch((error: unknown) => error),
      new Promise((resolve) => setTimeout(() => resolve('still-pending'), 30)),
    ]);

    expect(outcome).toMatchObject({ code: 'AZURE_UNAVAILABLE' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('times out while waiting for a non-signal-aware refresh provider', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({}, 401));
    const hangingProvider: AzureTokenProvider = {
      getAccessToken: vi.fn().mockResolvedValue('access-token'),
      refreshAccessToken: () => new Promise(() => undefined),
    };
    const azureClient = createAzureDevOpsClient({
      tokenProvider: hangingProvider,
      fetch: fetchImpl,
      timeoutMs: 5,
    });

    const outcome = await Promise.race([
      azureClient
        .getProfile(z.object({ id: z.string() }))
        .catch((error: unknown) => error),
      new Promise((resolve) => setTimeout(() => resolve('still-pending'), 30)),
    ]);

    expect(outcome).toMatchObject({ code: 'AZURE_UNAVAILABLE' });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('shares one deadline across a near-deadline 401 refresh and retry', async () => {
    vi.useFakeTimers();
    try {
      const signals: AbortSignal[] = [];
      const fetchImpl = vi
        .fn<typeof fetch>()
        .mockImplementationOnce(
          (_input, init) =>
            new Promise((resolve) => {
              signals.push(init?.signal as AbortSignal);
              setTimeout(() => resolve(jsonResponse({}, 401)), 15);
            }),
        )
        .mockImplementationOnce(
          (_input, init) =>
            new Promise((_resolve, reject) => {
              const signal = init?.signal as AbortSignal;
              signals.push(signal);
              signal.addEventListener('abort', () =>
                reject(new DOMException('aborted', 'AbortError')),
              );
            }),
        );
      const azureClient = createAzureDevOpsClient({
        tokenProvider: tokenProvider(),
        fetch: fetchImpl,
        timeoutMs: 20,
      });
      const request = azureClient
        .getProfile(z.object({ id: z.string() }))
        .catch((error: unknown) => error);

      await vi.advanceTimersByTimeAsync(21);
      const outcome = await Promise.race([request, Promise.resolve('pending')]);

      expect(outcome).toMatchObject({ code: 'AZURE_UNAVAILABLE' });
      expect(fetchImpl).toHaveBeenCalledTimes(2);
      expect(signals[1]).toBe(signals[0]);
      expect(signals[0]?.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('shares one deadline across every page of a paginated operation', async () => {
    vi.useFakeTimers();
    try {
      const signals: AbortSignal[] = [];
      const fetchImpl = vi
        .fn<typeof fetch>()
        .mockImplementationOnce(
          (_input, init) =>
            new Promise((resolve) => {
              signals.push(init?.signal as AbortSignal);
              setTimeout(
                () =>
                  resolve(
                    jsonResponse({ value: [{ id: 'one' }] }, 200, {
                      'x-ms-continuationtoken': 'next',
                    }),
                  ),
                15,
              );
            }),
        )
        .mockImplementationOnce(
          (_input, init) =>
            new Promise((_resolve, reject) => {
              const signal = init?.signal as AbortSignal;
              signals.push(signal);
              signal.addEventListener('abort', () =>
                reject(new DOMException('aborted', 'AbortError')),
              );
            }),
        );
      const azureClient = createAzureDevOpsClient({
        tokenProvider: tokenProvider(),
        fetch: fetchImpl,
        timeoutMs: 20,
      });
      const operation = azureClient
        .listProjects(
          'acme',
          z.object({ value: z.array(z.object({ id: z.string() })) }),
        )
        .catch((error: unknown) => error);

      await vi.advanceTimersByTimeAsync(21);
      const outcome = await Promise.race([
        operation,
        Promise.resolve('still-pending'),
      ]);

      expect(outcome).toMatchObject({ code: 'AZURE_UNAVAILABLE' });
      expect(fetchImpl).toHaveBeenCalledTimes(2);
      expect(signals[1]).toBe(signals[0]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('passes the shared operation signal to snapshotted token functions', async () => {
    const observedSignals: AbortSignal[] = [];
    const originalGet = vi.fn(async (signal: AbortSignal) => {
      observedSignals.push(signal);
      return 'access-token';
    });
    const originalRefresh = vi.fn(async (signal: AbortSignal) => {
      observedSignals.push(signal);
      return 'refreshed-token';
    });
    const provider: AzureTokenProvider = {
      getAccessToken: originalGet,
      refreshAccessToken: originalRefresh,
    };
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({}, 401))
      .mockResolvedValueOnce(jsonResponse({ id: memberId }));
    const azureClient = createAzureDevOpsClient({
      tokenProvider: provider,
      fetch: fetchImpl,
      timeoutMs: 100,
    });
    provider.getAccessToken = vi.fn().mockResolvedValue('mutated-token');
    provider.refreshAccessToken = vi.fn().mockResolvedValue('mutated-refresh');

    await azureClient.getProfile(z.object({ id: z.string() }));

    expect(originalGet).toHaveBeenCalledOnce();
    expect(originalRefresh).toHaveBeenCalledOnce();
    expect(observedSignals[0]).toBeInstanceOf(AbortSignal);
    expect(observedSignals[1]).toBe(observedSignals[0]);
    expect(fetchImpl.mock.calls[0]?.[1]?.signal).toBe(observedSignals[0]);
  });

  it.each([
    [new EntraError('ENTRA_UNAVAILABLE'), 'AZURE_UNAVAILABLE'],
    [new EntraError('ENTRA_AUTH_REJECTED'), 'AZURE_RECONNECT_REQUIRED'],
    [new EntraError('ENTRA_RESPONSE_INVALID'), 'AZURE_RECONNECT_REQUIRED'],
    [new AzureDevOpsError('AZURE_UNAVAILABLE'), 'AZURE_UNAVAILABLE'],
    [
      new AzureDevOpsError('AZURE_RECONNECT_REQUIRED'),
      'AZURE_RECONNECT_REQUIRED',
    ],
    [new Error('unknown provider failure'), 'AZURE_RECONNECT_REQUIRED'],
  ])(
    'maps a token-provider failure to %s',
    async (providerError, expectedCode) => {
      const provider: AzureTokenProvider = {
        getAccessToken: vi.fn().mockRejectedValue(providerError),
        refreshAccessToken: vi.fn().mockResolvedValue('unused'),
      };
      const fetchImpl = vi.fn<typeof fetch>();

      await expect(
        client(fetchImpl, provider).client.getProfile(
          z.object({ id: z.string() }),
        ),
      ).rejects.toMatchObject({ code: expectedCode });
      expect(fetchImpl).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['non-JSON', new Response('not json')],
    ['schema mismatch', jsonResponse({ wrong: true })],
  ])('rejects a malformed success response: %s', async (_name, response) => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response);
    const { client: azureClient } = client(fetchImpl);

    await expect(
      azureClient.getProfile(z.object({ id: z.string() })),
    ).rejects.toMatchObject({ code: 'AZURE_RESPONSE_INVALID' });
  });

  it('paginates in order and URL-encodes continuation tokens', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({ value: [{ id: 'one' }] }, 200, {
          'x-ms-continuationtoken': 'next/token + value',
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ value: [{ id: 'two' }] }));
    const { client: azureClient } = client(fetchImpl);
    const pageSchema = z.object({
      value: z.array(z.object({ id: z.string() })),
    });

    await expect(
      azureClient.listProjects('acme-org', pageSchema),
    ).resolves.toEqual([{ id: 'one' }, { id: 'two' }]);
    expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual([
      'https://dev.azure.com/acme-org/_apis/projects?api-version=7.1',
      'https://dev.azure.com/acme-org/_apis/projects?api-version=7.1&continuationToken=next%2Ftoken+%2B+value',
    ]);
  });

  it('rejects repeated continuation tokens and stops at 25 pages', async () => {
    const repeatingFetch = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({ value: [{ id: 'one' }] }, 200, {
        'x-ms-continuationtoken': 'same',
      }),
    );
    const cappedFetch = vi.fn<typeof fetch>().mockImplementation(() =>
      Promise.resolve(
        jsonResponse({ value: [] }, 200, {
          'x-ms-continuationtoken': crypto.randomUUID(),
        }),
      ),
    );
    const pageSchema = z.object({
      value: z.array(z.object({ id: z.string() })),
    });

    await expect(
      client(repeatingFetch).client.listProjects('acme', pageSchema),
    ).rejects.toMatchObject({ code: 'AZURE_RESPONSE_INVALID' });
    await expect(
      client(cappedFetch).client.listProjects('acme', pageSchema),
    ).rejects.toMatchObject({ code: 'AZURE_RESPONSE_INVALID' });
    expect(repeatingFetch).toHaveBeenCalledTimes(2);
    expect(cappedFetch).toHaveBeenCalledTimes(25);
  });
});

describe('Azure DevOps discovery', () => {
  it('maps the profile DTO from the exact endpoint response', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        id: memberId,
        displayName: 'Ada Lovelace',
        emailAddress: 'ada@example.com',
        ignoredSecret: 'discard-me',
      }),
    );
    const { client: azureClient } = client(fetchImpl);

    await expect(getAzureProfile(azureClient)).resolves.toEqual({
      id: memberId,
      displayName: 'Ada Lovelace',
      email: 'ada@example.com',
    });
  });

  it.each([
    ['https://vssps.dev.azure.com/acme-org/', 'acme-org'],
    ['https://legacy-org.vssps.visualstudio.com:443/', 'legacy-org'],
  ])(
    'maps documented account URI %s to a canonical Azure Services URL',
    async (accountUri, slug) => {
      const accountId = '33333333-3333-4333-8333-333333333333';
      const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
        jsonResponse({
          count: 1,
          value: [
            {
              accountId,
              accountName: 'Acme',
              accountUri,
            },
          ],
        }),
      );
      const { client: azureClient } = client(fetchImpl);

      await expect(listAzureAccounts(azureClient, memberId)).resolves.toEqual([
        { id: accountId, name: 'Acme', url: `https://dev.azure.com/${slug}` },
      ]);
      expect(fetchImpl.mock.calls[0]?.[0]).toBe(
        `https://app.vssps.visualstudio.com/_apis/accounts?memberId=${memberId}&api-version=7.1`,
      );
    },
  );

  it.each([
    'http://vssps.dev.azure.com/acme/',
    'https://evil.example/acme/',
    'https://vssps.dev.azure.com/acme/extra',
    'https://vssps.dev.azure.com/acme%2Fother/',
    'https://vssps.dev.azure.com/acme.example/',
    'https://vssps.dev.azure.com/acme-/',
    'https://acme.vssps.visualstudio.com.evil.example/',
    'https://acme.evil.visualstudio.com/',
    'https://acme.vssps.visualstudio.com/path/',
    'https://acme.vssps.visualstudio.com:444/',
    'https://user@acme.vssps.visualstudio.com/',
    'https://acme-.vssps.visualstudio.com/',
    'https://acm%65.vssps.visualstudio.com/',
    'https://acme.vssps.visualstudio.com/%2e',
    'https://acme。vssps.visualstudio.com/',
    'https://vssps.dev.azure.com/acme/../evil/',
    'https://vssps.dev.azure.com/acme/./',
    'https://vssps.dev.azure.com/acme//',
  ])('rejects malicious or noncanonical account URI %s', async (accountUri) => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        count: 1,
        value: [
          {
            accountId: '33333333-3333-4333-8333-333333333333',
            accountName: 'Acme',
            accountUri,
          },
        ],
      }),
    );

    await expect(
      listAzureAccounts(client(fetchImpl).client, memberId),
    ).rejects.toMatchObject({ code: 'AZURE_RESPONSE_INVALID' });
  });

  it('uses exact project and team endpoints and returns minimal DTOs', async () => {
    const projectResponse = {
      count: 1,
      value: [{ id: projectId, name: 'Core', extra: 'discard' }],
    };
    const teamId = '44444444-4444-4444-8444-444444444444';
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(projectResponse))
      .mockResolvedValueOnce(
        jsonResponse({
          count: 1,
          value: [{ id: teamId, name: 'Platform', extra: 'discard' }],
        }),
      );
    const { client: azureClient } = client(fetchImpl);

    await expect(listAzureProjects(azureClient, 'acme-org')).resolves.toEqual([
      { id: projectId, name: 'Core' },
    ]);
    await expect(
      listAzureTeams(azureClient, 'acme-org', projectId),
    ).resolves.toEqual([{ id: teamId, name: 'Platform' }]);
    expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual([
      'https://dev.azure.com/acme-org/_apis/projects?api-version=7.1',
      `https://dev.azure.com/acme-org/_apis/projects/${projectId}/teams?api-version=7.1`,
    ]);
  });

  it.each([
    ['bad member', () => listAzureAccounts, 'not-a-uuid'],
    ['bad organization', () => listAzureProjects, 'acme/other'],
    ['encoded separator', () => listAzureProjects, 'acme%2Fother'],
    ['dot in organization', () => listAzureProjects, 'acme.example'],
    ['trailing hyphen', () => listAzureProjects, 'acme-'],
  ])('rejects %s without making a request', async (_name, getFn, value) => {
    const fetchImpl = vi.fn<typeof fetch>();
    const azureClient = client(fetchImpl).client;
    const fn = getFn();
    const promise =
      fn === listAzureAccounts
        ? listAzureAccounts(azureClient, value)
        : listAzureProjects(azureClient, value);

    await expect(promise).rejects.toMatchObject({
      code: 'AZURE_RESPONSE_INVALID',
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('rejects a non-UUID team project ID before URL construction', async () => {
    const fetchImpl = vi.fn<typeof fetch>();

    await expect(
      listAzureTeams(client(fetchImpl).client, 'acme', '../secret'),
    ).rejects.toMatchObject({ code: 'AZURE_RESPONSE_INVALID' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    [
      'duplicate account IDs',
      () => ({
        count: 2,
        value: [
          {
            accountId: '33333333-3333-4333-8333-333333333333',
            accountName: 'One',
            accountUri: 'https://vssps.dev.azure.com/one/',
          },
          {
            accountId: '33333333-3333-4333-8333-333333333333',
            accountName: 'Two',
            accountUri: 'https://vssps.dev.azure.com/two/',
          },
        ],
      }),
      'accounts',
    ],
    [
      'duplicate project IDs',
      () => ({
        count: 2,
        value: [
          { id: projectId, name: 'One' },
          { id: projectId, name: 'Two' },
        ],
      }),
      'projects',
    ],
  ])('rejects %s consistently', async (_name, body, kind) => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse(body()));
    const azureClient = client(fetchImpl).client;

    await expect(
      kind === 'accounts'
        ? listAzureAccounts(azureClient, memberId)
        : listAzureProjects(azureClient, 'acme'),
    ).rejects.toMatchObject({ code: 'AZURE_RESPONSE_INVALID' });
  });
});
