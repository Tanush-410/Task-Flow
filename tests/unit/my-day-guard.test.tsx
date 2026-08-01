import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireEmployee: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/modules/members/queries', () => ({
  requireEmployee: mocks.requireEmployee,
}));

import MyDayPage from '@/app/(app)/my-day/page';

describe('MyDayPage', () => {
  it('requires an employee membership before rendering', async () => {
    mocks.requireEmployee.mockResolvedValue({
      organizationId: 'org',
      role: 'employee',
      userId: 'user',
    });

    await MyDayPage();

    expect(mocks.requireEmployee).toHaveBeenCalledOnce();
  });
});
