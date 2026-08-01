import {
  AuthApiError,
  AuthInvalidCredentialsError,
  AuthRetryableFetchError,
} from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createServerSupabase: vi.fn(),
  getMembershipAccess: vi.fn(),
  redirect: vi.fn(),
  signInWithPassword: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabase: mocks.createServerSupabase,
}));
vi.mock('@/modules/members/queries', () => ({
  getMembershipAccess: mocks.getMembershipAccess,
}));

import { login } from '@/modules/auth/actions';

function loginData(email: string, password: string) {
  const data = new FormData();
  data.set('email', email);
  data.set('password', password);
  return data;
}

describe('login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createServerSupabase.mockResolvedValue({
      auth: { signInWithPassword: mocks.signInWithPassword },
    });
  });

  it('returns safe field errors without calling the provider', async () => {
    const result = await login(null, loginData('not-an-email', 'short'));

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: 'INVALID_LOGIN',
        message: 'Enter a valid email and password.',
        fields: { email: expect.any(Array), password: expect.any(Array) },
        traceId: expect.any(String),
      },
    });
    expect(mocks.signInWithPassword).not.toHaveBeenCalled();
  });

  it.each([
    new AuthInvalidCredentialsError('provider credential detail'),
    new AuthApiError('provider credential detail', 400, 'invalid_credentials'),
  ])('returns generic invalid credentials for %s', async (providerError) => {
    mocks.signInWithPassword.mockResolvedValue({ error: providerError });

    const result = await login(
      null,
      loginData('person@example.com', 'password123'),
    );

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: 'INVALID_LOGIN',
        message: 'Email or password is incorrect.',
        traceId: expect.any(String),
      },
    });
    expect(JSON.stringify(result)).not.toContain('provider credential detail');
  });

  it.each([
    new AuthRetryableFetchError('sensitive network detail', 0),
    new AuthApiError('sensitive server detail', 503, 'unexpected_failure'),
    new AuthApiError('sensitive rate limit detail', 429, undefined),
    new AuthApiError(
      'sensitive request limit detail',
      400,
      'over_request_rate_limit',
    ),
    new AuthApiError(
      'sensitive email limit detail',
      400,
      'over_email_send_rate_limit',
    ),
    new AuthApiError(
      'sensitive SMS limit detail',
      400,
      'over_sms_send_rate_limit',
    ),
  ])('returns safe unavailable state for %s', async (providerError) => {
    mocks.signInWithPassword.mockResolvedValue({ error: providerError });

    const result = await login(
      null,
      loginData('person@example.com', 'password123'),
    );

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: 'LOGIN_UNAVAILABLE',
        message: 'We could not complete sign in. Please try again.',
        traceId: expect.any(String),
      },
    });
    expect(JSON.stringify(result)).not.toContain('sensitive');
  });

  it('returns a safe traced error when the auth service is unavailable', async () => {
    mocks.createServerSupabase.mockRejectedValueOnce(
      new Error('sensitive connection detail'),
    );

    const result = await login(
      null,
      loginData('person@example.com', 'password123'),
    );

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: 'LOGIN_UNAVAILABLE',
        message: 'We could not complete sign in. Please try again.',
        traceId: expect.any(String),
      },
    });
    expect(JSON.stringify(result)).not.toContain('sensitive connection');
  });

  it('returns a safe traced error when membership verification fails', async () => {
    mocks.signInWithPassword.mockResolvedValue({ error: null });
    mocks.getMembershipAccess.mockRejectedValue(
      new Error('sensitive membership detail'),
    );

    const result = await login(
      null,
      loginData('person@example.com', 'password123'),
    );

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: 'LOGIN_UNAVAILABLE',
        message: 'We could not complete sign in. Please try again.',
        traceId: expect.any(String),
      },
    });
    expect(JSON.stringify(result)).not.toContain('sensitive membership');
  });

  it('uses verified membership context for the role landing page', async () => {
    mocks.signInWithPassword.mockResolvedValue({ error: null });
    mocks.getMembershipAccess.mockResolvedValue({
      kind: 'membership',
      membership: {
        organizationId: 'org',
        userId: 'user',
        role: 'employee',
      },
    });

    await login(null, loginData(' PERSON@EXAMPLE.COM ', 'password123'));

    expect(mocks.signInWithPassword).toHaveBeenCalledWith({
      email: 'person@example.com',
      password: 'password123',
    });
    expect(mocks.getMembershipAccess).toHaveBeenCalledOnce();
    expect(mocks.redirect).toHaveBeenCalledWith('/my-day');
  });

  it('continues only to a local fixed-shape invitation path after sign in', async () => {
    mocks.signInWithPassword.mockResolvedValue({ error: null });
    const data = loginData('person@example.com', 'password123');
    data.set('next', `/invite/${'a'.repeat(43)}`);

    await login(null, data);

    expect(mocks.redirect).toHaveBeenCalledWith(`/invite/${'a'.repeat(43)}`);
    expect(mocks.getMembershipAccess).not.toHaveBeenCalled();
  });
});
