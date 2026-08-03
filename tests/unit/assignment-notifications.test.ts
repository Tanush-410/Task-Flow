import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createServerSupabase: vi.fn(),
  requireAdmin: vi.fn(),
  requireMembership: vi.fn(),
  listOrganizationAdmins: vi.fn(),
  queueTaskNotifications: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabase: mocks.createServerSupabase,
}));
vi.mock('@/modules/members/queries', () => ({
  requireAdmin: mocks.requireAdmin,
  requireMembership: mocks.requireMembership,
  listOrganizationAdmins: mocks.listOrganizationAdmins,
}));
vi.mock('@/modules/notifications/actions', () => ({
  queueTaskNotifications: mocks.queueTaskNotifications,
}));

import {
  changeAssignmentStatus,
  reopenAssignment,
} from '@/modules/assignments/actions';

const ADMIN_ONE = '11111111-1111-4111-8111-111111111111';
const ADMIN_TWO = '22222222-2222-4222-8222-222222222222';
const ASSIGNEE = '33333333-3333-4333-8333-333333333333';
const ASSIGNMENT_ID = '44444444-4444-4444-8444-444444444444';

function buildSupabase({
  updateResult,
  taskResult = { data: { title: 'Ship the report' }, error: null },
  profileResult = { data: { display_name: 'Priya Employee' }, error: null },
}: {
  updateResult: { data: unknown; error: unknown };
  taskResult?: { data: unknown; error: unknown };
  profileResult?: { data: unknown; error: unknown };
}) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'task_assignments') {
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue(updateResult),
              }),
            }),
          }),
        };
      }

      if (table === 'tasks') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue(taskResult),
            }),
          }),
        };
      }

      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue(profileResult),
          }),
        }),
      };
    }),
  };
}

describe('changeAssignmentStatus notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireMembership.mockResolvedValue({
      organizationId: 'org-1',
      userId: ASSIGNEE,
      role: 'employee',
    });
    mocks.listOrganizationAdmins.mockResolvedValue([ADMIN_ONE, ADMIN_TWO]);
  });

  it('notifies every admin when an assignment is completed', async () => {
    mocks.createServerSupabase.mockResolvedValue(
      buildSupabase({
        updateResult: {
          data: {
            id: ASSIGNMENT_ID,
            task_id: 'task-1',
            organization_id: 'org-1',
            assignee_id: ASSIGNEE,
          },
          error: null,
        },
      }),
    );

    const result = await changeAssignmentStatus({
      assignmentId: ASSIGNMENT_ID,
      status: 'completed',
    });

    expect(result).toEqual({
      ok: true,
      data: { assignmentId: ASSIGNMENT_ID },
    });
    expect(mocks.listOrganizationAdmins).toHaveBeenCalledWith('org-1');
    expect(mocks.queueTaskNotifications).toHaveBeenCalledWith([
      expect.objectContaining({
        recipientId: ADMIN_ONE,
        notificationType: 'assignment_completed',
        body: expect.stringContaining('Priya Employee has completed'),
      }),
      expect.objectContaining({
        recipientId: ADMIN_TWO,
        notificationType: 'assignment_completed',
      }),
    ]);
  });

  it('notifies every admin with the reason when an assignment is delayed', async () => {
    mocks.createServerSupabase.mockResolvedValue(
      buildSupabase({
        updateResult: {
          data: {
            id: ASSIGNMENT_ID,
            task_id: 'task-1',
            organization_id: 'org-1',
            assignee_id: ASSIGNEE,
          },
          error: null,
        },
      }),
    );

    await changeAssignmentStatus({
      assignmentId: ASSIGNMENT_ID,
      status: 'delayed',
      reason: 'Waiting on client feedback',
    });

    expect(mocks.queueTaskNotifications).toHaveBeenCalledWith([
      expect.objectContaining({
        recipientId: ADMIN_ONE,
        notificationType: 'assignment_delayed',
        body: expect.stringContaining('Waiting on client feedback'),
      }),
      expect.objectContaining({ recipientId: ADMIN_TWO }),
    ]);
  });

  it('does not notify admins for a plain in-progress transition', async () => {
    mocks.createServerSupabase.mockResolvedValue(
      buildSupabase({
        updateResult: {
          data: {
            id: ASSIGNMENT_ID,
            task_id: 'task-1',
            organization_id: 'org-1',
            assignee_id: ASSIGNEE,
          },
          error: null,
        },
      }),
    );

    await changeAssignmentStatus({
      assignmentId: ASSIGNMENT_ID,
      status: 'in_progress',
    });

    expect(mocks.listOrganizationAdmins).not.toHaveBeenCalled();
    expect(mocks.queueTaskNotifications).not.toHaveBeenCalled();
  });
});

describe('reopenAssignment notification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({
      organizationId: 'org-1',
      userId: ADMIN_ONE,
      role: 'admin',
    });
  });

  it('notifies the assignee with the reopen reason', async () => {
    mocks.createServerSupabase.mockResolvedValue(
      buildSupabase({
        updateResult: {
          data: {
            id: ASSIGNMENT_ID,
            task_id: 'task-1',
            assignee_id: ASSIGNEE,
          },
          error: null,
        },
      }),
    );

    const result = await reopenAssignment({
      assignmentId: ASSIGNMENT_ID,
      reason: 'Client requested one more revision',
    });

    expect(result).toEqual({
      ok: true,
      data: { assignmentId: ASSIGNMENT_ID },
    });
    expect(mocks.queueTaskNotifications).toHaveBeenCalledWith([
      expect.objectContaining({
        recipientId: ASSIGNEE,
        notificationType: 'assignment_status_changed',
        body: expect.stringContaining('Client requested one more revision'),
      }),
    ]);
  });
});
