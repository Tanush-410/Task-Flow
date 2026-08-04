'use server';

import { randomUUID } from 'node:crypto';

import type { ActionResult } from '@/lib/result';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { createServerSupabase } from '@/lib/supabase/server';

import { requireMembership } from '../members/queries';
import type { TaskNotificationInput } from './queries';

const NOTIFICATION_ERROR = {
  code: 'NOTIFICATION_UPDATE_FAILED',
  message: 'The notification could not be updated.',
} as const;

/**
 * Best-effort notification fan-out used by other modules (tasks,
 * assignments). Never throws: a failed insert here must not roll back the
 * task/assignment mutation that triggered it, matching the durability rule
 * in the platform design spec (notification failures are logged and
 * retried without undoing the source action).
 */
/**
 * Drops entries whose recipient has muted that specific task. Uses the
 * service-role client because the actor triggering a notification (e.g.
 * an admin completing someone else's assignment) has no RLS access to
 * other users' task_mutes rows — task_mutes only lets you read your own.
 */
async function filterMutedEntries(
  entries: TaskNotificationInput[],
): Promise<TaskNotificationInput[]> {
  const taskScoped = entries.filter((entry) => entry.taskId);
  if (taskScoped.length === 0) {
    return entries;
  }

  const admin = createAdminSupabase();
  const { data: mutes } = await admin
    .from('task_mutes')
    .select('task_id,user_id')
    .in(
      'task_id',
      Array.from(new Set(taskScoped.map((entry) => entry.taskId as string))),
    );

  if (!mutes || mutes.length === 0) {
    return entries;
  }

  const mutedPairs = new Set(
    mutes.map((row) => `${row.task_id}:${row.user_id}`),
  );

  return entries.filter(
    (entry) =>
      !entry.taskId || !mutedPairs.has(`${entry.taskId}:${entry.recipientId}`),
  );
}

export async function queueTaskNotifications(
  entries: TaskNotificationInput[],
): Promise<void> {
  if (entries.length === 0) {
    return;
  }

  try {
    const deliverable = await filterMutedEntries(entries);
    if (deliverable.length === 0) {
      return;
    }

    const supabase = await createServerSupabase();
    const now = new Date().toISOString();
    const { error } = await supabase.from('task_notifications').insert(
      deliverable.map((entry) => ({
        organization_id: entry.organizationId,
        recipient_id: entry.recipientId,
        task_id: entry.taskId ?? null,
        assignment_id: entry.assignmentId ?? null,
        notification_type: entry.notificationType,
        title: entry.title,
        body: entry.body,
        delivered_at: now,
      })),
    );

    if (error) {
      console.error('queueTaskNotifications failed', error);
    }
  } catch (error) {
    console.error('queueTaskNotifications failed', error);
  }
}

export async function markNotificationRead(
  notificationId: string,
): Promise<ActionResult<{ notificationId: string }>> {
  const traceId = randomUUID();

  try {
    await requireMembership();
    const supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from('task_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId)
      .select('id')
      .single();

    if (error || !data) {
      return { ok: false, error: { ...NOTIFICATION_ERROR, traceId } };
    }

    return { ok: true, data: { notificationId: data.id } };
  } catch {
    return { ok: false, error: { ...NOTIFICATION_ERROR, traceId } };
  }
}

export async function toggleTaskMute(
  taskId: string,
): Promise<ActionResult<{ muted: boolean }>> {
  const traceId = randomUUID();

  try {
    const membership = await requireMembership();
    const supabase = await createServerSupabase();
    const { data: existing } = await supabase
      .from('task_mutes')
      .select('id')
      .eq('task_id', taskId)
      .eq('user_id', membership.userId)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from('task_mutes')
        .delete()
        .eq('id', existing.id);

      if (error) {
        return { ok: false, error: { ...NOTIFICATION_ERROR, traceId } };
      }

      return { ok: true, data: { muted: false } };
    }

    const { error } = await supabase.from('task_mutes').insert({
      organization_id: membership.organizationId,
      task_id: taskId,
      user_id: membership.userId,
    });

    if (error) {
      return { ok: false, error: { ...NOTIFICATION_ERROR, traceId } };
    }

    return { ok: true, data: { muted: true } };
  } catch {
    return { ok: false, error: { ...NOTIFICATION_ERROR, traceId } };
  }
}

export async function markAllNotificationsRead(): Promise<ActionResult<null>> {
  const traceId = randomUUID();

  try {
    const membership = await requireMembership();
    const supabase = await createServerSupabase();
    const { error } = await supabase
      .from('task_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('recipient_id', membership.userId)
      .is('read_at', null);

    if (error) {
      return { ok: false, error: { ...NOTIFICATION_ERROR, traceId } };
    }

    return { ok: true, data: null };
  } catch {
    return { ok: false, error: { ...NOTIFICATION_ERROR, traceId } };
  }
}
