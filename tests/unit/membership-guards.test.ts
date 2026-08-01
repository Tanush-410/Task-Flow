import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createServerSupabase: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabase: mocks.createServerSupabase,
}));

import { requireEmployee } from '@/modules/members/queries';

function serverClient(role: 'admin' | 'employee') {
  const membershipResult = {
    data: [{ organization_id: 'org', role, user_id: 'user' }],
    error: null,
  };
  const statusQuery = vi.fn().mockResolvedValue(membershipResult);
  const userQuery = vi.fn(() => ({ eq: statusQuery }));
  const select = vi.fn(() => ({ eq: userQuery }));

  return {
    auth: {
      getClaims: vi.fn().mockResolvedValue({
        data: { claims: { sub: 'user' } },
        error: null,
      }),
    },
    from: vi.fn(() => ({ select })),
  };
}

describe('requireEmployee', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a verified employee membership', async () => {
    mocks.createServerSupabase.mockResolvedValue(serverClient('employee'));

    await expect(requireEmployee()).resolves.toMatchObject({
      organizationId: 'org',
      role: 'employee',
      userId: 'user',
    });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it('redirects an admin to the admin dashboard', async () => {
    mocks.createServerSupabase.mockResolvedValue(serverClient('admin'));

    await requireEmployee();

    expect(mocks.redirect).toHaveBeenCalledWith('/dashboard');
  });
});
