import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  consumeOAuthAttempt: vi.fn(),
  createAdminSupabase: vi.fn(),
  createAzureDevOpsClient: vi.fn(),
  createEntraAuthorizationUrl: vi.fn(),
  createOAuthAttempt: vi.fn(),
  exchangeEntraCode: vi.fn(),
  getAzureDevOpsAdminAccess: vi.fn(),
  getAzureProfile: vi.fn(),
  serverEnv: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/server-env', () => ({ serverEnv: mocks.serverEnv }));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabase: mocks.createAdminSupabase,
}));
vi.mock('@/modules/azure-devops/auth/oauth-state', () => ({
  consumeOAuthAttempt: mocks.consumeOAuthAttempt,
  createOAuthAttempt: mocks.createOAuthAttempt,
}));
vi.mock('@/modules/azure-devops/auth/entra', () => ({
  createEntraAuthorizationUrl: mocks.createEntraAuthorizationUrl,
  exchangeEntraCode: mocks.exchangeEntraCode,
}));
vi.mock('@/modules/azure-devops/client/http', () => ({
  createAzureDevOpsClient: mocks.createAzureDevOpsClient,
}));
vi.mock('@/modules/azure-devops/client/discovery', () => ({
  getAzureProfile: mocks.getAzureProfile,
}));
vi.mock('@/modules/azure-devops/connections/access', () => ({
  getAzureDevOpsAdminAccess: mocks.getAzureDevOpsAdminAccess,
}));

import * as callbackRoute from '@/app/api/integrations/azure-devops/callback/route';
import * as connectRoute from '@/app/api/integrations/azure-devops/connect/route';

const settingsPath = '/settings/integrations/azure-devops';
const appOrigin = 'https://taskflow.example';
const organizationId = '10000000-0000-4000-8000-000000000001';
const userId = '20000000-0000-4000-8000-000000000002';
const secondAdminId = '21000000-0000-4000-8000-000000000002';
const connectionId = '30000000-0000-4000-8000-000000000003';
const authorizedUserId = '50000000-0000-4000-8000-000000000005';
const state = 'A'.repeat(43);
const code = 'safe-authorization-code';
const accessToken = 'access-token-plain-secret';
const refreshToken = 'refresh-token-plain-secret';
const nowIso = '2026-08-12T10:30:00.000Z';

const membership = {
  organizationId,
  userId,
  role: 'admin' as const,
};

const environment = {
  APP_ORIGIN: appOrigin,
  SUPABASE_SERVICE_ROLE_KEY: 'service-role',
  AZURE_DEVOPS_ENTRA_TENANT_ID: 'tenant-id',
  AZURE_DEVOPS_ENTRA_CLIENT_ID: '60000000-0000-4000-8000-000000000006',
  AZURE_DEVOPS_ENTRA_CLIENT_SECRET: 'client-secret',
  AZURE_DEVOPS_OAUTH_SCOPES:
    'offline_access 499b84ac-1321-427f-aa17-267ca6975798/.default',
  AZURE_DEVOPS_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
  AZURE_DEVOPS_TOKEN_KEY_ID: 'azure.key-1',
};

const tokenSet = {
  accessToken,
  refreshToken,
  expiresAt: '2026-08-12T11:30:00.000Z',
  grantedScopes: [
    'offline_access',
    '499b84ac-1321-427f-aa17-267ca6975798/.default',
  ],
};

const profile = {
  id: authorizedUserId,
  displayName: 'Ada Azure',
  email: 'ada.azure@example.test',
};

function makeAdmin(
  options: {
    data?: unknown;
    error?: unknown;
  } = {},
) {
  const rpc = vi.fn().mockResolvedValue({
    data:
      options.data === undefined
        ? [
            {
              connection_id: connectionId,
              connection_status: 'pending',
              was_existing: false,
              credentials_applied: true,
            },
          ]
        : options.data,
    error: options.error ?? null,
  });
  const admin = { rpc };
  mocks.createAdminSupabase.mockReturnValue(admin);
  return { admin, rpc };
}

function connectRequest(body?: BodyInit, contentType?: string) {
  return new NextRequest(
    'https://attacker.example/api/integrations/azure-devops/connect',
    {
      method: 'POST',
      body,
      headers: {
        host: 'attacker.example',
        origin: 'https://attacker.example',
        ...(contentType ? { 'content-type': contentType } : {}),
      },
    },
  );
}

function callbackRequest(search: string) {
  return new NextRequest(
    `https://attacker.example/api/integrations/azure-devops/callback${search}`,
    {
      headers: {
        host: 'attacker.example',
        origin: 'https://attacker.example',
      },
    },
  );
}

async function callbackLocation(search: string) {
  const response = await callbackRoute.GET(callbackRequest(search));
  expect(response.status).toBe(303);
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(response.headers.get('pragma')).toBe('no-cache');
  expect(response.headers.get('referrer-policy')).toBe('no-referrer');
  return response.headers.get('location');
}

function expectPrivateRedirectHeaders(response: Response) {
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(response.headers.get('pragma')).toBe('no-cache');
  expect(response.headers.get('referrer-policy')).toBe('no-referrer');
}

describe('POST /api/integrations/azure-devops/connect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAzureDevOpsAdminAccess.mockResolvedValue({
      kind: 'allowed',
      membership,
    });
    mocks.serverEnv.mockReturnValue(environment);
    mocks.createOAuthAttempt.mockResolvedValue({
      state,
      codeChallenge: 'B'.repeat(43),
    });
    mocks.createEntraAuthorizationUrl.mockReturnValue(
      `https://login.microsoftonline.com/tenant/oauth2/v2.0/authorize?state=${state}`,
    );
  });

  it('exports POST only, with no GET handler', () => {
    expect(connectRoute.POST).toBeTypeOf('function');
    expect('GET' in connectRoute).toBe(false);
  });

  it('authorizes first, creates an exactly scoped attempt, and redirects to Entra with 303', async () => {
    const events: string[] = [];
    mocks.getAzureDevOpsAdminAccess.mockImplementation(async () => {
      events.push('guard');
      return { kind: 'allowed', membership };
    });
    mocks.createOAuthAttempt.mockImplementation(async () => {
      events.push('attempt');
      return { state, codeChallenge: 'B'.repeat(43) };
    });
    mocks.createEntraAuthorizationUrl.mockImplementation(() => {
      events.push('authorization-url');
      return `https://login.microsoftonline.com/tenant/oauth2/v2.0/authorize?state=${state}`;
    });

    const response = await connectRoute.POST(connectRequest());

    expect(response.status).toBe(303);
    expectPrivateRedirectHeaders(response);
    expect(response.headers.get('location')).toBe(
      `https://login.microsoftonline.com/tenant/oauth2/v2.0/authorize?state=${state}`,
    );
    expect(events).toEqual(['guard', 'attempt', 'authorization-url']);
    expect(mocks.createOAuthAttempt).toHaveBeenCalledWith({
      organizationId,
      userId,
      returnPath: settingsPath,
    });
    expect(mocks.createEntraAuthorizationUrl).toHaveBeenCalledWith({
      state,
      codeChallenge: 'B'.repeat(43),
    });
  });

  it('ignores hostile host headers and untrusted return-path bodies', async () => {
    const response = await connectRoute.POST(
      connectRequest(
        JSON.stringify({ returnPath: 'https://attacker.example/phish' }),
        'application/json',
      ),
    );

    expect(response.headers.get('location')).not.toContain('attacker.example');
    expect(mocks.createOAuthAttempt).toHaveBeenCalledWith(
      expect.objectContaining({ returnPath: settingsPath }),
    );
  });

  it.each(['/login', '/settings', '/my-day'] as const)(
    'returns a route-owned secure redirect for denied access %s',
    async (location) => {
      const events: string[] = [];
      mocks.serverEnv.mockImplementation(() => {
        events.push('env');
        return environment;
      });
      mocks.getAzureDevOpsAdminAccess.mockImplementation(async () => {
        events.push('access');
        return { kind: 'redirect', location };
      });

      const response = await connectRoute.POST(connectRequest());

      expect(response.status).toBe(303);
      expect(response.headers.get('location')).toBe(`${appOrigin}${location}`);
      expectPrivateRedirectHeaders(response);
      expect(events).toEqual(['env', 'access']);
      expect(mocks.createOAuthAttempt).not.toHaveBeenCalled();
      expect(mocks.createEntraAuthorizationUrl).not.toHaveBeenCalled();
    },
  );

  it.each([
    [
      'attempt persistence',
      () =>
        mocks.createOAuthAttempt.mockRejectedValue(
          new Error('state=secret-state'),
        ),
    ],
    [
      'authorization creation',
      () =>
        mocks.createEntraAuthorizationUrl.mockReturnValue(
          'https://login.microsoftonline.com.evil.example/steal?state=secret',
        ),
    ],
  ])('redirects %s failures to a safe redacted URL', async (_label, fail) => {
    fail();

    const response = await connectRoute.POST(connectRequest());
    const location = response.headers.get('location') ?? '';

    expect(response.status).toBe(303);
    expectPrivateRedirectHeaders(response);
    expect(location).toBe(`${appOrigin}${settingsPath}?result=connect_failed`);
    expect(location).not.toContain('secret');
    expect(location).not.toContain('attacker.example');
  });
});

describe('GET /api/integrations/azure-devops/callback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(nowIso));
    mocks.getAzureDevOpsAdminAccess.mockResolvedValue({
      kind: 'allowed',
      membership,
    });
    mocks.serverEnv.mockReturnValue(environment);
    mocks.consumeOAuthAttempt.mockResolvedValue({
      codeVerifier: 'v'.repeat(43),
      returnPath: `${settingsPath}?tab=connection`,
    });
    mocks.exchangeEntraCode.mockResolvedValue(tokenSet);
    mocks.createAzureDevOpsClient.mockImplementation((options) => ({
      tokenProvider: options.tokenProvider,
    }));
    mocks.getAzureProfile.mockImplementation(async (client) => {
      await client.tokenProvider.getAccessToken(new AbortController().signal);
      return profile;
    });
    makeAdmin();
  });

  it.each(['/login', '/settings', '/my-day'] as const)(
    'returns a route-owned secure redirect before callback work for %s',
    async (location) => {
      const events: string[] = [];
      mocks.serverEnv.mockImplementation(() => {
        events.push('env');
        return environment;
      });
      mocks.getAzureDevOpsAdminAccess.mockImplementation(async () => {
        events.push('access');
        return { kind: 'redirect', location };
      });

      const response = await callbackRoute.GET(
        callbackRequest(`?code=${code}&state=${state}&state=duplicate`),
      );

      expect(response.status).toBe(303);
      expect(response.headers.get('location')).toBe(`${appOrigin}${location}`);
      expectPrivateRedirectHeaders(response);
      expect(events).toEqual(['env', 'access']);
      expect(mocks.consumeOAuthAttempt).not.toHaveBeenCalled();
      expect(mocks.exchangeEntraCode).not.toHaveBeenCalled();
      expect(mocks.createAdminSupabase).not.toHaveBeenCalled();
    },
  );

  it('runs the success flow in exact order and atomically persists encrypted credentials', async () => {
    const events: string[] = [];
    mocks.getAzureDevOpsAdminAccess.mockImplementation(async () => {
      events.push('guard');
      return { kind: 'allowed', membership };
    });
    mocks.consumeOAuthAttempt.mockImplementation(async () => {
      events.push('consume');
      return {
        codeVerifier: 'v'.repeat(43),
        returnPath: `${settingsPath}?tab=connection`,
      };
    });
    mocks.exchangeEntraCode.mockImplementation(async () => {
      events.push('exchange');
      return tokenSet;
    });
    mocks.createAzureDevOpsClient.mockImplementation((options) => {
      events.push('azure-client');
      return { tokenProvider: options.tokenProvider };
    });
    mocks.getAzureProfile.mockImplementation(async (client) => {
      events.push('profile');
      expect(
        await client.tokenProvider.getAccessToken(new AbortController().signal),
      ).toBe(accessToken);
      return profile;
    });
    const fake = makeAdmin();
    mocks.createAdminSupabase.mockImplementation(() => {
      events.push('admin-client');
      return fake.admin;
    });
    fake.rpc.mockImplementation(async () => {
      events.push('persist-rpc');
      return {
        data: [
          {
            connection_id: connectionId,
            connection_status: 'pending',
            was_existing: false,
            credentials_applied: true,
          },
        ],
        error: null,
      };
    });

    const location = await callbackLocation(`?code=${code}&state=${state}`);

    expect(location).toBe(
      `${appOrigin}${settingsPath}?tab=connection&result=connected`,
    );
    expect(events).toEqual([
      'guard',
      'consume',
      'exchange',
      'azure-client',
      'profile',
      'admin-client',
      'persist-rpc',
    ]);
    expect(mocks.consumeOAuthAttempt).toHaveBeenCalledWith({
      state,
      organizationId,
      userId,
    });
    expect(mocks.exchangeEntraCode).toHaveBeenCalledWith({
      code,
      codeVerifier: 'v'.repeat(43),
    });
    expect(fake.rpc).toHaveBeenCalledWith(
      'persist_azure_devops_oauth_connection',
      {
        target_access_token_ciphertext: expect.stringMatching(/^v1\./),
        target_actor_id: userId,
        target_authorized_user_display_name: profile.displayName,
        target_authorized_user_email: profile.email,
        target_authorized_user_id: profile.id,
        target_granted_scopes: tokenSet.grantedScopes,
        target_organization_id: organizationId,
        target_refresh_token_ciphertext: expect.stringMatching(/^v1\./),
        target_tenant_id: environment.AZURE_DEVOPS_ENTRA_TENANT_ID,
        target_token_expires_at: tokenSet.expiresAt,
      },
    );
    const persisted = fake.rpc.mock.calls[0]![1];
    expect(persisted.target_access_token_ciphertext).not.toBe(accessToken);
    expect(persisted.target_refresh_token_ciphertext).not.toBe(refreshToken);
    expect(persisted.target_access_token_ciphertext).not.toBe(
      persisted.target_refresh_token_ciphertext,
    );
    expect(JSON.stringify(persisted)).not.toContain(accessToken);
    expect(JSON.stringify(persisted)).not.toContain(refreshToken);
  });

  it.each([true, false])(
    'redirects every existing connection as reconnected when credentials_applied=%s',
    async (credentialsApplied) => {
      makeAdmin({
        data: [
          {
            connection_id: connectionId,
            connection_status: credentialsApplied ? 'configured' : 'pending',
            was_existing: true,
            credentials_applied: credentialsApplied,
          },
        ],
      });

      await expect(
        callbackLocation(`?code=${code}&state=${state}`),
      ).resolves.toBe(
        `${appOrigin}${settingsPath}?tab=connection&result=reconnected`,
      );
    },
  );

  it('scopes atomic persistence to the reconnecting admin and authoritative profile', async () => {
    mocks.getAzureDevOpsAdminAccess.mockResolvedValue({
      kind: 'allowed',
      membership: { ...membership, userId: secondAdminId },
    });
    const sanitizedProfile = {
      id: '70000000-0000-4000-8000-000000000007',
      displayName: 'Validated Profile',
      email: null,
    };
    mocks.getAzureProfile.mockResolvedValue(sanitizedProfile);
    const fake = makeAdmin();

    await callbackLocation(`?code=${code}&state=${state}`);

    expect(mocks.consumeOAuthAttempt).toHaveBeenCalledWith(
      expect.objectContaining({ userId: secondAdminId }),
    );
    expect(fake.rpc).toHaveBeenCalledWith(
      'persist_azure_devops_oauth_connection',
      expect.objectContaining({
        target_actor_id: secondAdminId,
        target_authorized_user_id: sanitizedProfile.id,
        target_authorized_user_display_name: sanitizedProfile.displayName,
      }),
    );
    expect(fake.rpc.mock.calls[0]![1]).not.toHaveProperty(
      'target_authorized_user_email',
    );
  });

  it.each([
    ['RPC error', { data: null, error: { message: 'private detail' } }],
    ['missing row', { data: [], error: null }],
    [
      'multiple rows',
      {
        data: [
          {
            connection_id: connectionId,
            connection_status: 'pending',
            was_existing: false,
            credentials_applied: true,
          },
          {
            connection_id: connectionId,
            connection_status: 'pending',
            was_existing: false,
            credentials_applied: true,
          },
        ],
        error: null,
      },
    ],
    [
      'malformed row',
      {
        data: [
          {
            connection_id: 'ada.azure@example.test',
            connection_status: 'configured',
            was_existing: 'yes',
            credentials_applied: true,
          },
        ],
        error: null,
      },
    ],
  ])(
    'fails safely for a %s response from persistence',
    async (_label, result) => {
      makeAdmin(result);

      const location = await callbackLocation(`?code=${code}&state=${state}`);

      expect(location).toBe(
        `${appOrigin}${settingsPath}?tab=connection&result=callback_failed`,
      );
      expect(location).not.toContain('ada.azure');
      expect(location).not.toContain(connectionId);
    },
  );

  it('consumes denial state exactly once after authorization, then redirects without token exchange', async () => {
    const events: string[] = [];
    mocks.getAzureDevOpsAdminAccess.mockImplementation(async () => {
      events.push('guard');
      return { kind: 'allowed', membership };
    });
    mocks.consumeOAuthAttempt.mockImplementation(async () => {
      events.push('consume');
      return {
        codeVerifier: 'unused-verifier',
        returnPath: settingsPath,
      };
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const location = await callbackLocation(
      `?error=access_denied&error_description=secret+tenant+detail&state=${state}`,
    );

    expect(location).toBe(`${appOrigin}${settingsPath}?result=consent_denied`);
    expect(location).not.toContain('secret');
    expect(location).not.toContain(state);
    expect(events).toEqual(['guard', 'consume']);
    expect(mocks.consumeOAuthAttempt).toHaveBeenCalledOnce();
    expect(mocks.consumeOAuthAttempt).toHaveBeenCalledWith({
      state,
      organizationId,
      userId,
    });
    expect(mocks.exchangeEntraCode).not.toHaveBeenCalled();
    expect(mocks.createAdminSupabase).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
    logSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('returns invalid_state when denial state cannot be consumed', async () => {
    mocks.consumeOAuthAttempt.mockRejectedValue(new Error('private state'));

    const location = await callbackLocation(
      `?error=access_denied&state=${state}`,
    );

    expect(location).toBe(`${appOrigin}${settingsPath}?result=invalid_state`);
    expect(mocks.consumeOAuthAttempt).toHaveBeenCalledOnce();
    expect(mocks.exchangeEntraCode).not.toHaveBeenCalled();
    expect(mocks.createAdminSupabase).not.toHaveBeenCalled();
  });

  it.each([
    ['', 'missing code and state'],
    [`?code=&state=${state}`, 'blank code'],
    [`?code=${code}&state=`, 'blank state'],
    [`?code=+++&state=${state}`, 'whitespace-only code'],
    [`?code=${code}&code=duplicate&state=${state}`, 'duplicate code'],
    [`?code=${code}&state=${state}&state=${state}`, 'duplicate state'],
    [`?code=${code}%00&state=${state}`, 'control character'],
    [`?code=${'c'.repeat(4097)}&state=${state}`, 'overlong code'],
    [`?code=${code}&state=${'A'.repeat(44)}`, 'overlong state'],
    [
      `?code=${code}&state=${state}&error=access_denied`,
      'mixed success and denial fields',
    ],
    [
      `?code=${code}&state=${state}&error_description=unexpected`,
      'provider description on success',
    ],
    [`?error=access_denied`, 'provider error without state'],
    [`?error=access_denied&state=opaque`, 'provider error with invalid state'],
    [
      `?error=access_denied&state=${state}&code=${code}`,
      'provider denial with code',
    ],
    [
      `?error=access_denied&state=${state}&state=${state}`,
      'duplicate denial state',
    ],
    [
      `?error=access_denied&error=again&state=${state}`,
      'duplicate provider error',
    ],
    [`?error=+++&state=${state}`, 'whitespace-only provider error'],
    [
      `?error=access_denied&state=${state}&error_description=one&error_description=two`,
      'duplicate provider description',
    ],
  ])('rejects %s as an invalid callback', async (search) => {
    const location = await callbackLocation(search);

    expect(location).toBe(
      `${appOrigin}${settingsPath}?result=invalid_callback`,
    );
    expect(mocks.consumeOAuthAttempt).not.toHaveBeenCalled();
    expect(mocks.exchangeEntraCode).not.toHaveBeenCalled();
    expect(mocks.createAdminSupabase).not.toHaveBeenCalled();
  });

  it('ignores unrelated query parameters and hostile headers', async () => {
    const location = await callbackLocation(
      `?code=${code}&state=${state}&next=https%3A%2F%2Fattacker.example%2Fphish&token=browser-secret`,
    );

    expect(location).toBe(
      `${appOrigin}${settingsPath}?tab=connection&result=connected`,
    );
    expect(location).not.toContain('attacker.example');
    expect(location).not.toContain('browser-secret');
  });

  it('maps reused, missing, or malformed consumed state to invalid_state', async () => {
    mocks.consumeOAuthAttempt.mockRejectedValue(
      new Error('state hash and database detail'),
    );

    const location = await callbackLocation(`?code=${code}&state=${state}`);

    expect(location).toBe(`${appOrigin}${settingsPath}?result=invalid_state`);
    expect(location).not.toContain(state);
    expect(location).not.toContain('database');
    expect(mocks.exchangeEntraCode).not.toHaveBeenCalled();
    expect(mocks.createAdminSupabase).not.toHaveBeenCalled();
  });

  it.each([
    [
      'token exchange',
      () =>
        mocks.exchangeEntraCode.mockRejectedValue(
          new Error(`code=${code}&token=${accessToken}`),
        ),
    ],
    [
      'Azure profile',
      () =>
        mocks.getAzureProfile.mockRejectedValue(
          new Error(`token=${accessToken}`),
        ),
    ],
    [
      'persistence RPC',
      () => makeAdmin({ error: { message: 'private db detail' } }),
    ],
  ])('redacts %s failures as callback_failed', async (_label, fail) => {
    fail();

    const location = await callbackLocation(`?code=${code}&state=${state}`);

    expect(location).toBe(
      `${appOrigin}${settingsPath}?tab=connection&result=callback_failed`,
    );
    expect(location).not.toContain(code);
    expect(location).not.toContain(accessToken);
    expect(location).not.toContain(state);
    expect(location).not.toContain('private');
  });

  it('never opens the admin client or stores one token when token encryption cannot complete', async () => {
    mocks.exchangeEntraCode.mockResolvedValue({
      ...tokenSet,
      refreshToken: '',
    });

    const location = await callbackLocation(`?code=${code}&state=${state}`);

    expect(location).toBe(
      `${appOrigin}${settingsPath}?tab=connection&result=callback_failed`,
    );
    expect(mocks.createAdminSupabase).not.toHaveBeenCalled();
  });

  it('falls back from a hostile consumed return path before appending result', async () => {
    mocks.consumeOAuthAttempt.mockResolvedValue({
      codeVerifier: 'v'.repeat(43),
      returnPath: 'https://attacker.example/phish?result=stolen',
    });

    const location = await callbackLocation(`?code=${code}&state=${state}`);

    expect(location).toBe(`${appOrigin}${settingsPath}?result=connected`);
  });
});
