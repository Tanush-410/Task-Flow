'use server';

import { randomUUID } from 'node:crypto';

import type { ActionResult } from '@/lib/result';
import { createServerSupabase } from '@/lib/supabase/server';

import { requireAdmin, requireMembership } from '../members/queries';
import { queueTaskNotifications } from '../notifications/actions';
import {
  type TaskPriority,
  type TaskStatus,
  taskArchiveSchema,
  taskCreateSchema,
  taskCreateWithAssigneesSchema,
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
const TASK_ASSIGN_ERROR = {
  code: 'TASK_ASSIGN_FAILED',
  message: 'The task could not be created and assigned.',
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

export async function createAndAssignTask(
  input: unknown,
): Promise<ActionResult<{ taskId: string }>> {
  const traceId = randomUUID();
  const parsed = taskCreateWithAssigneesSchema.safeParse(input);

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
    const membership = await requireMembership();
    const supabase = await createServerSupabase();
    const now = new Date().toISOString();

    const { data: task, error: taskError } = await supabase
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
        status: 'published',
        published_at: now,
      })
      .select('id,title')
      .single();

    if (taskError || !task) {
      return { ok: false, error: { ...TASK_ASSIGN_ERROR, traceId } };
    }

    const assigneeIds = Array.from(new Set(parsed.data.assigneeIds));
    const { data: assignments, error: assignmentError } = await supabase
      .from('task_assignments')
      .insert(
        assigneeIds.map((assigneeId) => ({
          organization_id: membership.organizationId,
          task_id: task.id,
          assignee_id: assigneeId,
          assigned_by: membership.userId,
          status: 'not_started' as const,
          progress: 0,
        })),
      )
      .select('id,assignee_id');

    if (assignmentError || !assignments) {
      return { ok: false, error: { ...TASK_ASSIGN_ERROR, traceId } };
    }

    await queueTaskNotifications(
      assignments.map((assignment) => ({
        organizationId: membership.organizationId,
        recipientId: assignment.assignee_id,
        taskId: task.id,
        assignmentId: assignment.id,
        notificationType: 'assignment_created',
        title: 'New task assigned',
        body: `You have been assigned a new task: ${task.title}`,
      })),
    );

    return { ok: true, data: { taskId: task.id } };
  } catch {
    return { ok: false, error: { ...TASK_ASSIGN_ERROR, traceId } };
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

export type TaskSearchResult = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueAt: string | null;
};

/**
 * Scoped entirely by RLS, not by branching on role here: admins match
 * tasks_select_admins_by_org (every org task), everyone else matches
 * tasks_view_participants / tasks_select_creator (their own tasks).
 */
export async function searchTasks(query: string): Promise<TaskSearchResult[]> {
  const trimmed = query.trim();

  if (trimmed.length < 2) {
    return [];
  }

  await requireMembership();
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('tasks')
    .select('id,title,status,priority,due_at')
    .ilike('title', `%${trimmed}%`)
    .neq('status', 'archived')
    .order('due_at', { ascending: true, nullsFirst: false })
    .limit(8);

  if (error || !data) {
    return [];
  }

  return data.map((task) => ({
    id: task.id,
    title: task.title,
    status: task.status,
    priority: task.priority,
    dueAt: task.due_at,
  }));
}
