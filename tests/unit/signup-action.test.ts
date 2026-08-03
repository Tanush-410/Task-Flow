import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createServerSupabase: vi.fn(),
  redirect: vi.fn(),
  signUp: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabase: mocks.createServerSupabase,
}));

import { signUp } from '@/modules/auth/actions';

function adminSignupData(overrides: Record<string, string> = {}) {
  const data = new FormData();
  data.set('role', 'admin');
  data.set('displayName', 'Asha Admin');
  data.set('email', 'asha@example.com');
  data.set('password', 'password123');
  data.set('organizationName', 'Acme Inc.');
  for (const [key, value] of Object.entries(overrides)) {
    data.set(key, value);
  }
  return data;
}

function employeeSignupData(overrides: Record<string, string> = {}) {
  const data = new FormData();
  data.set('role', 'employee');
  data.set('displayName', 'Priya Employee');
  data.set('email', 'priya@example.com');
  data.set('password', 'password123');
  data.set('organizationId', '11111111-1111-4111-8111-111111111111');
  for (const [key, value] of Object.entries(overrides)) {
    data.set(key, value);
  }
  return data;
}

describe('signUp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createServerSupabase.mockResolvedValue({
      auth: { signUp: mocks.signUp },
      rpc: mocks.rpc,
    });
    mocks.signUp.mockResolvedValue({
      data: { session: { access_token: 'token' } },
      error: null,
    });
    mocks.rpc.mockResolvedValue({ data: 'org-1', error: null });
  });

  it('returns field errors without calling the provider when role is missing', async () => {
    const data = adminSignupData();
    data.delete('role');

    const result = await signUp(null, data);

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'INVALID_SIGNUP', message: 'Check the account details.' },
    });
    expect(mocks.signUp).not.toHaveBeenCalled();
  });

  it('returns field errors for an invalid admin payload', async () => {
    const result = await signUp(
      null,
      adminSignupData({ email: 'not-an-email' }),
    );

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: 'INVALID_SIGNUP',
        fields: { email: expect.any(Array) },
      },
    });
    expect(mocks.signUp).not.toHaveBeenCalled();
  });

  it('registers a new organization for an admin sign up', async () => {
    await signUp(null, adminSignupData());

    expect(mocks.signUp).toHaveBeenCalledWith({
      email: 'asha@example.com',
      password: 'password123',
      options: { data: { display_name: 'Asha Admin' } },
    });
    expect(mocks.rpc).toHaveBeenCalledWith('register_organization_admin', {
      organization_name: 'Acme Inc.',
      organization_timezone: 'Asia/Kolkata',
    });
    expect(mocks.redirect).toHaveBeenCalledWith('/dashboard');
  });

  it('joins an existing organization for an employee sign up', async () => {
    await signUp(null, employeeSignupData());

    expect(mocks.rpc).toHaveBeenCalledWith('join_organization_as_employee', {
      target_organization_id: '11111111-1111-4111-8111-111111111111',
    });
    expect(mocks.redirect).toHaveBeenCalledWith('/my-day');
  });

  it('returns a safe error when the email is already registered', async () => {
    mocks.signUp.mockResolvedValue({
      data: { session: null },
      error: new AuthApiError(
        'sensitive duplicate detail',
        422,
        'user_already_exists',
      ),
    });

    const result = await signUp(null, adminSignupData());

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: 'EMAIL_IN_USE',
        message: 'An account with that email already exists.',
      },
    });
    expect(JSON.stringify(result)).not.toContain('sensitive duplicate');
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('returns a safe unavailable state for operational provider errors', async () => {
    mocks.signUp.mockResolvedValue({
      data: { session: null },
      error: new AuthRetryableFetchError('sensitive network detail', 0),
    });

    const result = await signUp(null, adminSignupData());

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: 'SIGNUP_UNAVAILABLE',
        message: 'We could not complete sign up. Please try again.',
      },
    });
    expect(JSON.stringify(result)).not.toContain('sensitive network');
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('reports registration failure without deleting the created account', async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: new Error('sensitive rpc detail'),
    });

    const result = await signUp(null, adminSignupData());

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'REGISTRATION_FAILED' },
    });
    expect(JSON.stringify(result)).not.toContain('sensitive rpc');
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
