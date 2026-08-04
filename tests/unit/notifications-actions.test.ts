import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createServerSupabase: vi.fn(),
  createAdminSupabase: vi.fn(),
  requireMembership: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabase: mocks.createServerSupabase,
}));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabase: mocks.createAdminSupabase,
}));
vi.mock('@/modules/members/queries', () => ({
  requireMembership: mocks.requireMembership,
}));

import {
  markAllNotificationsRead,
  markNotificationRead,
  queueTaskNotifications,
} from '@/modules/notifications/actions';

const consoleErrorSpy = vi
  .spyOn(console, 'error')
  .mockImplementation(() => undefined);

describe('queueTaskNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireMembership.mockResolvedValue({
      organizationId: 'org-1',
      userId: 'user-1',
      role: 'admin',
    });
    mocks.createAdminSupabase.mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({ data: [] }),
        }),
      }),
    });
  });

  it('does nothing and never opens a database client for an empty batch', async () => {
    await queueTaskNotifications([]);

    expect(mocks.createServerSupabase).not.toHaveBeenCalled();
  });

  it('inserts one row per notification entry', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    mocks.createServerSupabase.mockResolvedValue({
      from: vi.fn().mockReturnValue({ insert }),
    });

    await queueTaskNotifications([
      {
        organizationId: 'org-1',
        recipientId: 'user-2',
        taskId: 'task-1',
        assignmentId: 'assignment-1',
        notificationType: 'assignment_created',
        title: 'New task assigned',
        body: 'You have been assigned a new task: Ship it',
      },
    ]);

    expect(insert).toHaveBeenCalledWith([
      expect.objectContaining({
        organization_id: 'org-1',
        recipient_id: 'user-2',
        task_id: 'task-1',
        assignment_id: 'assignment-1',
        notification_type: 'assignment_created',
        title: 'New task assigned',
        body: 'You have been assigned a new task: Ship it',
      }),
    ]);
  });

  it('drops entries whose recipient has muted that task', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    mocks.createServerSupabase.mockResolvedValue({
      from: vi.fn().mockReturnValue({ insert }),
    });
    mocks.createAdminSupabase.mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({
            data: [{ task_id: 'task-1', user_id: 'user-2' }],
          }),
        }),
      }),
    });

    await queueTaskNotifications([
      {
        organizationId: 'org-1',
        recipientId: 'user-2',
        taskId: 'task-1',
        notificationType: 'comment_added',
        title: 'New comment',
        body: 'New comment on: Ship it',
      },
      {
        organizationId: 'org-1',
        recipientId: 'user-3',
        taskId: 'task-1',
        notificationType: 'comment_added',
        title: 'New comment',
        body: 'New comment on: Ship it',
      },
    ]);

    expect(insert).toHaveBeenCalledWith([
      expect.objectContaining({ recipient_id: 'user-3' }),
    ]);
  });

  it('never throws when the insert fails, so the source action is not rolled back', async () => {
    const insert = vi
      .fn()
      .mockResolvedValue({ error: new Error('sensitive db detail') });
    mocks.createServerSupabase.mockResolvedValue({
      from: vi.fn().mockReturnValue({ insert }),
    });

    await expect(
      queueTaskNotifications([
        {
          organizationId: 'org-1',
          recipientId: 'user-2',
          notificationType: 'assignment_completed',
          title: 'Task completed',
          body: 'Done',
        },
      ]),
    ).resolves.toBeUndefined();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });
});

describe('markNotificationRead', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireMembership.mockResolvedValue({
      organizationId: 'org-1',
      userId: 'user-1',
      role: 'admin',
    });
  });

  it('returns the updated notification id on success', async () => {
    const single = vi
      .fn()
      .mockResolvedValue({ data: { id: 'note-1' }, error: null });
    const select = vi.fn().mockReturnValue({ single });
    const eq = vi.fn().mockReturnValue({ select });
    const update = vi.fn().mockReturnValue({ eq });
    mocks.createServerSupabase.mockResolvedValue({
      from: vi.fn().mockReturnValue({ update }),
    });

    const result = await markNotificationRead('note-1');

    expect(result).toEqual({ ok: true, data: { notificationId: 'note-1' } });
  });

  it('returns a safe traced error on failure', async () => {
    const single = vi
      .fn()
      .mockResolvedValue({ data: null, error: new Error('db detail') });
    const select = vi.fn().mockReturnValue({ single });
    const eq = vi.fn().mockReturnValue({ select });
    const update = vi.fn().mockReturnValue({ eq });
    mocks.createServerSupabase.mockResolvedValue({
      from: vi.fn().mockReturnValue({ update }),
    });

    const result = await markNotificationRead('note-1');

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'NOTIFICATION_UPDATE_FAILED' },
    });
  });
});

describe('markAllNotificationsRead', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireMembership.mockResolvedValue({
      organizationId: 'org-1',
      userId: 'user-1',
      role: 'employee',
    });
  });

  it('marks every unread notification for the current user as read', async () => {
    const isFn = vi.fn().mockResolvedValue({ error: null });
    const eq = vi.fn().mockReturnValue({ is: isFn });
    const update = vi.fn().mockReturnValue({ eq });
    mocks.createServerSupabase.mockResolvedValue({
      from: vi.fn().mockReturnValue({ update }),
    });

    const result = await markAllNotificationsRead();

    expect(eq).toHaveBeenCalledWith('recipient_id', 'user-1');
    expect(isFn).toHaveBeenCalledWith('read_at', null);
    expect(result).toEqual({ ok: true, data: null });
  });
});
