'use server';

import { randomUUID } from 'node:crypto';

import type { ActionResult } from '@/lib/result';
import { createServerSupabase } from '@/lib/supabase/server';

import { requireMembership } from '../members/queries';
import { queueTaskNotifications } from '../notifications/actions';
import { commentCreateSchema, commentDeleteSchema } from './schemas';

const COMMENT_CREATE_ERROR = {
  code: 'COMMENT_CREATE_FAILED',
  message: 'The comment could not be posted.',
} as const;
const COMMENT_DELETE_ERROR = {
  code: 'COMMENT_DELETE_FAILED',
  message: 'The comment could not be deleted.',
} as const;

export async function createComment(
  input: unknown,
): Promise<ActionResult<{ commentId: string }>> {
  const traceId = randomUUID();
  const parsed = commentCreateSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'INVALID_COMMENT',
        message: 'Check your comment.',
        traceId,
        fields: parsed.error.flatten().fieldErrors,
      },
    };
  }

  try {
    const membership = await requireMembership();
    const supabase = await createServerSupabase();

    const { data: comment, error } = await supabase
      .from('task_comments')
      .insert({
        organization_id: membership.organizationId,
        task_id: parsed.data.taskId,
        author_id: membership.userId,
        body: parsed.data.body,
      })
      .select('id')
      .single();

    if (error || !comment) {
      return { ok: false, error: { ...COMMENT_CREATE_ERROR, traceId } };
    }

    const [{ data: task }, { data: assignments }] = await Promise.all([
      supabase
        .from('tasks')
        .select('title')
        .eq('id', parsed.data.taskId)
        .maybeSingle(),
      supabase
        .from('task_assignments')
        .select('assignee_id')
        .eq('task_id', parsed.data.taskId),
    ]);

    const recipientIds = Array.from(
      new Set((assignments ?? []).map((row) => row.assignee_id)),
    ).filter((id) => id !== membership.userId);

    await queueTaskNotifications(
      recipientIds.map((recipientId) => ({
        organizationId: membership.organizationId,
        recipientId,
        taskId: parsed.data.taskId,
        notificationType: 'comment_added',
        title: 'New comment',
        body: `New comment on: ${task?.title ?? 'a task'}`,
      })),
    );

    return { ok: true, data: { commentId: comment.id } };
  } catch {
    return { ok: false, error: { ...COMMENT_CREATE_ERROR, traceId } };
  }
}

export async function deleteComment(
  input: unknown,
): Promise<ActionResult<null>> {
  const traceId = randomUUID();
  const parsed = commentDeleteSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'INVALID_COMMENT',
        message: 'Check the comment details.',
        traceId,
        fields: parsed.error.flatten().fieldErrors,
      },
    };
  }

  try {
    await requireMembership();
    const supabase = await createServerSupabase();
    const { error } = await supabase
      .from('task_comments')
      .delete()
      .eq('id', parsed.data.commentId);

    if (error) {
      return { ok: false, error: { ...COMMENT_DELETE_ERROR, traceId } };
    }

    return { ok: true, data: null };
  } catch {
    return { ok: false, error: { ...COMMENT_DELETE_ERROR, traceId } };
  }
}
