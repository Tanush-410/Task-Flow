import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireEmployee: vi.fn(),
  listMyAssignmentsWithTasks: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/modules/members/queries', () => ({
  requireEmployee: mocks.requireEmployee,
}));
vi.mock('@/modules/assignments/queries', () => ({
  listMyAssignmentsWithTasks: mocks.listMyAssignmentsWithTasks,
}));

import MyDayPage from '@/app/(app)/my-day/page';

describe('MyDayPage', () => {
  it('requires an employee membership before rendering', async () => {
    mocks.requireEmployee.mockResolvedValue({
      organizationId: 'org',
      role: 'employee',
      userId: 'user',
    });
    mocks.listMyAssignmentsWithTasks.mockResolvedValue([]);

    await MyDayPage();

    expect(mocks.requireEmployee).toHaveBeenCalledOnce();
  });
});
