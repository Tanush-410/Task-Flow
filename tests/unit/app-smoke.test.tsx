import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getMembershipAccess: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));
vi.mock('@/modules/members/queries', () => ({
  getMembershipAccess: mocks.getMembershipAccess,
}));

import Home from '@/app/page';

describe('application smoke test', () => {
  it('routes an authenticated admin to the admin landing page', async () => {
    mocks.getMembershipAccess.mockResolvedValue({
      kind: 'membership',
      membership: {
        organizationId: 'org',
        userId: 'user',
        role: 'admin',
      },
    });

    await Home();

    expect(mocks.redirect).toHaveBeenCalledWith('/dashboard');
  });
});
