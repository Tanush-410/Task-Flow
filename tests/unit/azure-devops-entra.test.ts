import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  createEntraAuthorizationUrl,
  exchangeEntraCode,
  refreshEntraTokens,
  shouldRefreshToken,
  type EntraDependencies,
} from '@/modules/azure-devops/auth/entra';

const config = {
  appOrigin: 'https://tasks.example',
  tenantId: 'tenant/name',
  clientId: '4f86df7a-4c57-4da8-b838-09c9441b35d2',
  clientSecret: 'client-secret',
  scope:
    'openid profile offline_access 499b84ac-1321-427f-aa17-267ca6975798/.default',
};
const state = Buffer.alloc(32, 7).toString('base64url');
const codeChallenge = Buffer.alloc(32, 8).toString('base64url');
const codeVerifier = 'v'.repeat(43);
const now = new Date('2026-08-12T10:00:00.000Z');

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function dependencies(fetchImpl: typeof fetch): EntraDependencies {
  return { config, fetch: fetchImpl, now: () => now, timeoutMs: 100 };
}

describe('Azure DevOps Entra OAuth', () => {
  it('builds the exact v2 authorization request from the configured origin', () => {
    const url = new URL(
      createEntraAuthorizationUrl({ state, codeChallenge }, { config }),
    );

    expect(url.origin).toBe('https://login.microsoftonline.com');
    expect(url.pathname).toBe('/tenant%2Fname/oauth2/v2.0/authorize');
    expect([...url.searchParams.entries()]).toEqual([
      ['client_id', config.clientId],
      ['response_type', 'code'],
      ['response_mode', 'query'],
      [
        'redirect_uri',
        'https://tasks.example/api/integrations/azure-devops/callback',
      ],
      ['scope', config.scope],
      ['state', state],
      ['code_challenge', codeChallenge],
      ['code_challenge_method', 'S256'],
    ]);
  });

  it.each([
    ['short state', state.slice(1), codeChallenge],
    ['padded state', `${state}=`, codeChallenge],
    ['short challenge', state, 'x'.repeat(42)],
    ['challenge control', state, `${'x'.repeat(42)}\n`],
  ])('rejects %s', (_name, invalidState, invalidChallenge) => {
    expect(() =>
      createEntraAuthorizationUrl(
        { state: invalidState, codeChallenge: invalidChallenge },
        { config },
      ),
    ).toThrowError(expect.objectContaining({ code: 'ENTRA_RESPONSE_INVALID' }));
  });

  it.each([
    'http://localhost:3000',
    'http://127.0.0.1:4312',
    'http://[::1]:8080',
  ])('allows the HTTP loopback development origin %s', (appOrigin) => {
    const url = new URL(
      createEntraAuthorizationUrl(
        { state, codeChallenge },
        { config: { ...config, appOrigin } },
      ),
    );

    expect(url.searchParams.get('redirect_uri')).toBe(
      `${appOrigin}/api/integrations/azure-devops/callback`,
    );
  });

  it.each([
    'http://tasks.example',
    'http://0.0.0.0:3000',
    'http://localhost.example:3000',
    'http://user:pass@localhost:3000',
    'http://localhost:3000/path',
    'http://localhost:3000?query=1',
  ])('rejects the unsafe HTTP application origin %s', (appOrigin) => {
    expect(() =>
      createEntraAuthorizationUrl(
        { state, codeChallenge },
        { config: { ...config, appOrigin } },
      ),
    ).toThrowError(expect.objectContaining({ code: 'ENTRA_RESPONSE_INVALID' }));
  });

  it('posts the exact authorization-code form and maps the token response', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        token_type: 'bearer',
        expires_in: 3600,
        scope: 'scope.one scope.two scope.one',
      }),
    );

    const result = await exchangeEntraCode(
      { code: 'authorization-code', codeVerifier },
      dependencies(fetchImpl),
    );

    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe(
      'https://login.microsoftonline.com/tenant%2Fname/oauth2/v2.0/token',
    );
    expect(init?.method).toBe('POST');
    expect(init?.redirect).toBe('manual');
    expect(init?.headers).toEqual({
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    });
    expect(new URLSearchParams(init?.body as string).entries()).toEqual(
      new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        grant_type: 'authorization_code',
        code: 'authorization-code',
        redirect_uri:
          'https://tasks.example/api/integrations/azure-devops/callback',
        scope: config.scope,
        code_verifier: codeVerifier,
      }).entries(),
    );
    expect(result).toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: '2026-08-12T11:00:00.000Z',
      grantedScopes: ['scope.one', 'scope.two'],
    });
  });

  it('posts the exact refresh form and requires a rotated refresh token', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({
          access_token: 'new-access',
          refresh_token: 'new-refresh',
          token_type: 'Bearer',
          expires_in: 120,
          scope: 'scope.one',
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          access_token: 'new-access',
          token_type: 'Bearer',
          expires_in: 120,
          scope: 'scope.one',
        }),
      );

    await refreshEntraTokens(
      { refreshToken: 'old-refresh' },
      dependencies(fetchImpl),
    );

    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe(
      'https://login.microsoftonline.com/tenant%2Fname/oauth2/v2.0/token',
    );
    expect(init?.redirect).toBe('manual');
    expect(new URLSearchParams(init?.body as string).entries()).toEqual(
      new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        grant_type: 'refresh_token',
        refresh_token: 'old-refresh',
        scope: config.scope,
      }).entries(),
    );
    await expect(
      refreshEntraTokens(
        { refreshToken: 'old-refresh' },
        dependencies(fetchImpl),
      ),
    ).rejects.toMatchObject({ code: 'ENTRA_RESPONSE_INVALID' });
  });

  it('uses a 60-second early refresh window without changing provider expiry', () => {
    const expiry = '2026-08-12T10:10:00.000Z';

    expect(shouldRefreshToken(expiry, new Date('2026-08-12T10:08:59Z'))).toBe(
      false,
    );
    expect(shouldRefreshToken(expiry, new Date('2026-08-12T10:09:00Z'))).toBe(
      true,
    );
    expect(shouldRefreshToken(expiry, new Date('2026-08-12T10:10:01Z'))).toBe(
      true,
    );
  });

  it.each([
    ['empty code', { code: '', codeVerifier }],
    ['code control', { code: 'secret\ncode', codeVerifier }],
    ['long code', { code: 'x'.repeat(4097), codeVerifier }],
    ['bad verifier', { code: 'code', codeVerifier: 'x'.repeat(42) }],
  ])('rejects bounded OAuth input: %s', async (_name, input) => {
    const fetchImpl = vi.fn<typeof fetch>();

    await expect(
      exchangeEntraCode(input, dependencies(fetchImpl)),
    ).rejects.toMatchObject({ code: 'ENTRA_RESPONSE_INVALID' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    [408, 'ENTRA_UNAVAILABLE'],
    [429, 'ENTRA_UNAVAILABLE'],
    [503, 'ENTRA_UNAVAILABLE'],
    [400, 'ENTRA_AUTH_REJECTED'],
    [401, 'ENTRA_AUTH_REJECTED'],
    [418, 'ENTRA_AUTH_REJECTED'],
    [302, 'ENTRA_RESPONSE_INVALID'],
  ])(
    'classifies an HTTP %i without exposing provider data',
    async (status, code) => {
      const providerSecret = 'provider-secret-description';
      const fetchImpl = vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          jsonResponse({ error_description: providerSecret }, status),
        );

      const thrown = await exchangeEntraCode(
        { code: 'authorization-code', codeVerifier },
        dependencies(fetchImpl),
      ).catch((error: unknown) => error);

      expect(thrown).toMatchObject({ code });
      expect(String(thrown)).not.toContain(providerSecret);
      expect(JSON.stringify(thrown)).not.toContain(providerSecret);
      expect(String(thrown)).not.toContain('authorization-code');
      expect(String(thrown)).not.toContain(config.clientSecret);
    },
  );

  it('does not hang when cancelling an oversized OAuth error body', async () => {
    const reader = {
      read: vi.fn().mockResolvedValue({
        done: false,
        value: new Uint8Array(4_097),
      }),
      cancel: vi.fn(() => new Promise(() => undefined)),
      releaseLock: vi.fn(),
    };
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue({
      ok: false,
      status: 400,
      body: { getReader: () => reader },
    } as unknown as Response);

    const outcome = await Promise.race([
      exchangeEntraCode(
        { code: 'authorization-code', codeVerifier },
        { ...dependencies(fetchImpl), timeoutMs: 100 },
      ).catch((error: unknown) => error),
      new Promise((resolve) => setTimeout(() => resolve('still-pending'), 40)),
    ]);

    expect(outcome).toMatchObject({ code: 'ENTRA_AUTH_REJECTED' });
    expect(reader.cancel).toHaveBeenCalledOnce();
    expect(reader.releaseLock).toHaveBeenCalledOnce();
  });

  it('prefers timeout classification while cancelling an oversized OAuth error', async () => {
    const reader = {
      read: vi.fn().mockResolvedValue({
        done: false,
        value: new Uint8Array(4_097),
      }),
      cancel: vi.fn(() => new Promise(() => undefined)),
      releaseLock: vi.fn(),
    };
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue({
      ok: false,
      status: 400,
      body: { getReader: () => reader },
    } as unknown as Response);

    await expect(
      exchangeEntraCode(
        { code: 'authorization-code', codeVerifier },
        { ...dependencies(fetchImpl), timeoutMs: 5 },
      ),
    ).rejects.toMatchObject({ code: 'ENTRA_UNAVAILABLE' });
    expect(reader.cancel).toHaveBeenCalledOnce();
    expect(reader.releaseLock).toHaveBeenCalledOnce();
  });

  it.each([
    ['temporarily_unavailable', 'ENTRA_UNAVAILABLE'],
    ['server_error', 'ENTRA_UNAVAILABLE'],
    ['invalid_grant', 'ENTRA_AUTH_REJECTED'],
    ['invalid_client', 'ENTRA_AUTH_REJECTED'],
  ])(
    'classifies OAuth error %s without exposing its description',
    async (providerCode, expectedCode) => {
      const providerSecret = 'sensitive provider diagnostics';
      const fetchImpl = vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          jsonResponse(
            { error: providerCode, error_description: providerSecret },
            400,
          ),
        );

      const thrown = await exchangeEntraCode(
        { code: 'authorization-code', codeVerifier },
        dependencies(fetchImpl),
      ).catch((error: unknown) => error);

      expect(thrown).toMatchObject({ code: expectedCode });
      expect(String(thrown)).not.toContain(providerSecret);
      expect(JSON.stringify(thrown)).not.toContain(providerSecret);
    },
  );

  it('classifies network failures and aborts timed-out requests safely', async () => {
    const networkFetch = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error('network leaked token'));
    const hangingFetch = vi.fn<typeof fetch>().mockImplementation(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          );
        }),
    );

    const networkError = await exchangeEntraCode(
      { code: 'authorization-code', codeVerifier },
      dependencies(networkFetch),
    ).catch((error: unknown) => error);
    const timeoutError = await exchangeEntraCode(
      { code: 'authorization-code', codeVerifier },
      { ...dependencies(hangingFetch), timeoutMs: 5 },
    ).catch((error: unknown) => error);

    expect(networkError).toMatchObject({ code: 'ENTRA_UNAVAILABLE' });
    expect(String(networkError)).not.toContain('network leaked token');
    expect(timeoutError).toMatchObject({ code: 'ENTRA_UNAVAILABLE' });
    expect(hangingFetch.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
  });

  it('times out a fetch implementation that ignores abort', async () => {
    const neverSettlingFetch = vi
      .fn<typeof fetch>()
      .mockImplementation(() => new Promise(() => undefined));

    const outcome = await Promise.race([
      exchangeEntraCode(
        { code: 'authorization-code', codeVerifier },
        { ...dependencies(neverSettlingFetch), timeoutMs: 5 },
      ).catch((error: unknown) => error),
      new Promise((resolve) => setTimeout(() => resolve('still-pending'), 30)),
    ]);

    expect(outcome).toMatchObject({ code: 'ENTRA_UNAVAILABLE' });
  });

  it('times out response JSON parsing that ignores abort', async () => {
    const neverSettlingJson = vi.fn(() => new Promise(() => undefined));
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      status: 200,
      json: neverSettlingJson,
    } as unknown as Response);

    const outcome = await Promise.race([
      exchangeEntraCode(
        { code: 'authorization-code', codeVerifier },
        { ...dependencies(fetchImpl), timeoutMs: 5 },
      ).catch((error: unknown) => error),
      new Promise((resolve) => setTimeout(() => resolve('still-pending'), 30)),
    ]);

    expect(outcome).toMatchObject({ code: 'ENTRA_UNAVAILABLE' });
  });

  it('best-effort cancels an unread terminal response body', async () => {
    const response = jsonResponse({ secret: 'do-not-read' }, 503);
    const cancel = vi
      .spyOn(response.body!, 'cancel')
      .mockRejectedValue(new Error('cancellation failed'));
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response);

    await expect(
      exchangeEntraCode(
        { code: 'authorization-code', codeVerifier },
        dependencies(fetchImpl),
      ),
    ).rejects.toMatchObject({ code: 'ENTRA_UNAVAILABLE' });
    expect(cancel).toHaveBeenCalledOnce();
  });

  it('keeps the timeout active while reading the token response body', async () => {
    let signal: AbortSignal | null = null;
    const slowBodyFetch = vi
      .fn<typeof fetch>()
      .mockImplementation((_input, init) => {
        signal = init?.signal ?? null;
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            new Promise((resolve) => setTimeout(() => resolve({}), 25)),
        } as Response);
      });

    await expect(
      exchangeEntraCode(
        { code: 'authorization-code', codeVerifier },
        { ...dependencies(slowBodyFetch), timeoutMs: 5 },
      ),
    ).rejects.toMatchObject({ code: 'ENTRA_UNAVAILABLE' });
    expect((signal as AbortSignal | null)?.aborted).toBe(true);
  });

  it.each([
    ['not JSON', new Response('secret malformed body')],
    [
      'wrong token type',
      jsonResponse({
        access_token: 'access',
        refresh_token: 'refresh',
        token_type: 'MAC',
        expires_in: 3600,
        scope: 'scope',
      }),
    ],
    [
      'excessive expiry',
      jsonResponse({
        access_token: 'access',
        refresh_token: 'refresh',
        token_type: 'Bearer',
        expires_in: 86401,
        scope: 'scope',
      }),
    ],
  ])('rejects malformed token response: %s', async (_name, response) => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response);

    await expect(
      exchangeEntraCode(
        { code: 'authorization-code', codeVerifier },
        dependencies(fetchImpl),
      ),
    ).rejects.toMatchObject({ code: 'ENTRA_RESPONSE_INVALID' });
  });
});
