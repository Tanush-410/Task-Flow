import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireEmployee: vi.fn(),
  getCurrentProfile: vi.fn(),
  listMyAssignmentsWithTasks: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/modules/members/queries', () => ({
  requireEmployee: mocks.requireEmployee,
  getCurrentProfile: mocks.getCurrentProfile,
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
    mocks.getCurrentProfile.mockResolvedValue({
      displayName: 'Test User',
      role: 'employee',
    });

    await MyDayPage();

    expect(mocks.requireEmployee).toHaveBeenCalledOnce();
  });
});
