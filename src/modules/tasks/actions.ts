'use server';

import { randomUUID } from 'node:crypto';

import type { ActionResult } from '@/lib/result';
import { createServerSupabase } from '@/lib/supabase/server';

import { requireAdmin } from '../members/queries';
import {
  type TaskPriority,
  type TaskStatus,
  taskArchiveSchema,
  taskCreateSchema,
  taskPublishSchema,
  taskUpdateSchema,
} from './schemas';

const TASK_CREATE_ERROR = {
  code: 'TASK_CREATE_FAILED',
  message: 'The task could not be created.',
} as const;
const TASK_UPDATE_ERROR = {
  code: 'TASK_UPDATE_FAILED',
  message: 'The task could not be updated.',
} as const;

export async function createTask(
  input: unknown,
): Promise<ActionResult<{ taskId: string }>> {
  const traceId = randomUUID();
  const parsed = taskCreateSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'INVALID_TASK',
        message: 'Check the task details.',
        traceId,
        fields: parsed.error.flatten().fieldErrors,
      },
    };
  }

  try {
    const membership = await requireAdmin();
    const supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        organization_id: membership.organizationId,
        created_by: membership.userId,
        title: parsed.data.title,
        description: parsed.data.description,
        priority: parsed.data.priority,
        due_at: parsed.data.dueAt ?? null,
        start_at: parsed.data.startAt ?? null,
        acknowledgement_required: parsed.data.acknowledgementRequired,
        status: 'draft',
      })
      .select('id')
      .single();

    if (error || !data) {
      return { ok: false, error: { ...TASK_CREATE_ERROR, traceId } };
    }

    return { ok: true, data: { taskId: data.id } };
  } catch {
    return { ok: false, error: { ...TASK_CREATE_ERROR, traceId } };
  }
}

export async function updateTask(
  input: unknown,
): Promise<ActionResult<{ taskId: string }>> {
  const traceId = randomUUID();
  const parsed = taskUpdateSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'INVALID_TASK',
        message: 'Check the task details.',
        traceId,
        fields: parsed.error.flatten().fieldErrors,
      },
    };
  }

  const { taskId, ...mutable } = parsed.data;
  const patch: Partial<{
    title: string;
    description: string;
    priority: TaskPriority;
    status: TaskStatus;
    due_at: string | null;
    start_at: string | null;
    acknowledgement_required: boolean;
  }> = {};

  if (mutable.title !== undefined) patch.title = mutable.title;
  if (mutable.description !== undefined)
    patch.description = mutable.description;
  if (mutable.priority !== undefined) patch.priority = mutable.priority;
  if (mutable.status !== undefined) patch.status = mutable.status;
  if (mutable.dueAt !== undefined) patch.due_at = mutable.dueAt;
  if (mutable.startAt !== undefined) patch.start_at = mutable.startAt;
  if (mutable.acknowledgementRequired !== undefined) {
    patch.acknowledgement_required = mutable.acknowledgementRequired;
  }

  if (Object.keys(patch).length === 0) {
    return {
      ok: false,
      error: {
        code: 'INVALID_TASK',
        message: 'Provide at least one task field to update.',
        traceId,
      },
    };
  }

  try {
    await requireAdmin();
    const supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from('tasks')
      .update(patch)
      .eq('id', taskId)
      .select('id')
      .single();

    if (error || !data) {
      return { ok: false, error: { ...TASK_UPDATE_ERROR, traceId } };
    }

    return { ok: true, data: { taskId: data.id } };
  } catch {
    return { ok: false, error: { ...TASK_UPDATE_ERROR, traceId } };
  }
}

export async function publishTask(
  input: unknown,
): Promise<ActionResult<{ taskId: string }>> {
  const traceId = randomUUID();
  const parsed = taskPublishSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'INVALID_TASK',
        message: 'Check the task details.',
        traceId,
        fields: parsed.error.flatten().fieldErrors,
      },
    };
  }

  try {
    await requireAdmin();
    const supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from('tasks')
      .update({
        status: 'published',
        published_at: parsed.data.publishedAt ?? new Date().toISOString(),
      })
      .eq('id', parsed.data.taskId)
      .select('id')
      .single();

    if (error || !data) {
      return { ok: false, error: { ...TASK_UPDATE_ERROR, traceId } };
    }

    return { ok: true, data: { taskId: data.id } };
  } catch {
    return { ok: false, error: { ...TASK_UPDATE_ERROR, traceId } };
  }
}

export async function archiveTask(
  input: unknown,
): Promise<ActionResult<{ taskId: string }>> {
  const traceId = randomUUID();
  const parsed = taskArchiveSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'INVALID_TASK',
        message: 'Check the task details.',
        traceId,
        fields: parsed.error.flatten().fieldErrors,
      },
    };
  }

  try {
    await requireAdmin();
    const supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from('tasks')
      .update({
        status: 'archived',
        archived_at: parsed.data.archivedAt ?? new Date().toISOString(),
      })
      .eq('id', parsed.data.taskId)
      .select('id')
      .single();

    if (error || !data) {
      return { ok: false, error: { ...TASK_UPDATE_ERROR, traceId } };
    }

    return { ok: true, data: { taskId: data.id } };
  } catch {
    return { ok: false, error: { ...TASK_UPDATE_ERROR, traceId } };
  }
}
