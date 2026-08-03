'use server';

import { randomUUID } from 'node:crypto';

import type { ActionResult } from '@/lib/result';
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
export async function queueTaskNotifications(
  entries: TaskNotificationInput[],
): Promise<void> {
  if (entries.length === 0) {
    return;
  }

  try {
    const supabase = await createServerSupabase();
    const now = new Date().toISOString();
    const { error } = await supabase.from('task_notifications').insert(
      entries.map((entry) => ({
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
