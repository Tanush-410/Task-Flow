import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createServerSupabase: vi.fn(),
  requireAdmin: vi.fn(),
  queueTaskNotifications: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabase: mocks.createServerSupabase,
}));
vi.mock('@/modules/members/queries', () => ({
  requireAdmin: mocks.requireAdmin,
}));
vi.mock('@/modules/notifications/actions', () => ({
  queueTaskNotifications: mocks.queueTaskNotifications,
}));

import { createAndAssignTask } from '@/modules/tasks/actions';

const ASSIGNEE_ONE = '11111111-1111-4111-8111-111111111111';
const ASSIGNEE_TWO = '22222222-2222-4222-8222-222222222222';

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Ship the report',
    description: 'Finish the weekly client report',
    priority: 'high',
    assigneeIds: [ASSIGNEE_ONE, ASSIGNEE_TWO],
    ...overrides,
  };
}

function buildSupabase({
  taskResult,
  assignmentResult,
}: {
  taskResult: { data: unknown; error: unknown };
  assignmentResult: { data: unknown; error: unknown };
}) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'tasks') {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue(taskResult),
            }),
          }),
        };
      }

      return {
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue(assignmentResult),
        }),
      };
    }),
  };
}

describe('createAndAssignTask', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({
      organizationId: 'org-1',
      userId: 'admin-1',
      role: 'admin',
    });
    mocks.queueTaskNotifications.mockResolvedValue(undefined);
  });

  it('returns field errors without opening a database client', async () => {
    const result = await createAndAssignTask(validInput({ assigneeIds: [] }));

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: 'INVALID_TASK',
        fields: { assigneeIds: expect.any(Array) },
      },
    });
    expect(mocks.createServerSupabase).not.toHaveBeenCalled();
  });

  it('creates the task, assigns every employee, and notifies them', async () => {
    mocks.createServerSupabase.mockResolvedValue(
      buildSupabase({
        taskResult: {
          data: { id: 'task-1', title: 'Ship the report' },
          error: null,
        },
        assignmentResult: {
          data: [
            { id: 'assignment-1', assignee_id: ASSIGNEE_ONE },
            { id: 'assignment-2', assignee_id: ASSIGNEE_TWO },
          ],
          error: null,
        },
      }),
    );

    const result = await createAndAssignTask(validInput());

    expect(result).toEqual({ ok: true, data: { taskId: 'task-1' } });
    expect(mocks.queueTaskNotifications).toHaveBeenCalledWith([
      expect.objectContaining({
        recipientId: ASSIGNEE_ONE,
        taskId: 'task-1',
        assignmentId: 'assignment-1',
        notificationType: 'assignment_created',
      }),
      expect.objectContaining({
        recipientId: ASSIGNEE_TWO,
        taskId: 'task-1',
        assignmentId: 'assignment-2',
        notificationType: 'assignment_created',
      }),
    ]);
  });

  it('does not queue notifications when the task insert fails', async () => {
    mocks.createServerSupabase.mockResolvedValue(
      buildSupabase({
        taskResult: { data: null, error: new Error('sensitive db detail') },
        assignmentResult: { data: null, error: null },
      }),
    );

    const result = await createAndAssignTask(validInput());

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'TASK_ASSIGN_FAILED' },
    });
    expect(JSON.stringify(result)).not.toContain('sensitive db detail');
    expect(mocks.queueTaskNotifications).not.toHaveBeenCalled();
  });

  it('does not queue notifications when assignment creation fails', async () => {
    mocks.createServerSupabase.mockResolvedValue(
      buildSupabase({
        taskResult: {
          data: { id: 'task-1', title: 'Ship the report' },
          error: null,
        },
        assignmentResult: { data: null, error: new Error('db detail') },
      }),
    );

    const result = await createAndAssignTask(validInput());

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'TASK_ASSIGN_FAILED' },
    });
    expect(mocks.queueTaskNotifications).not.toHaveBeenCalled();
  });
});
