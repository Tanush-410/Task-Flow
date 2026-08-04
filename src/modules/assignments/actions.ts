'use server';

import { randomUUID } from 'node:crypto';

import type { ActionResult } from '@/lib/result';
import { createServerSupabase } from '@/lib/supabase/server';

import { listOrganizationAdmins, requireMembership } from '../members/queries';
import { queueTaskNotifications } from '../notifications/actions';
import {
  type AssignmentStatus,
  assignmentCreateSchema,
  assignmentProgressSchema,
  assignmentRemoveSchema,
  assignmentReopenSchema,
  assignmentStatusChangeSchema,
} from './schemas';

const ASSIGNMENT_CREATE_ERROR = {
  code: 'ASSIGNMENT_CREATE_FAILED',
  message: 'The assignment could not be created.',
} as const;
const ASSIGNMENT_UPDATE_ERROR = {
  code: 'ASSIGNMENT_UPDATE_FAILED',
  message: 'The assignment could not be updated.',
} as const;

export async function createAssignment(
  input: unknown,
): Promise<ActionResult<{ assignmentId: string }>> {
  const traceId = randomUUID();
  const parsed = assignmentCreateSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'INVALID_ASSIGNMENT',
        message: 'Check the assignment details.',
        traceId,
        fields: parsed.error.flatten().fieldErrors,
      },
    };
  }

  try {
    const membership = await requireMembership();
    const supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from('task_assignments')
      .insert({
        organization_id: membership.organizationId,
        task_id: parsed.data.taskId,
        assignee_id: parsed.data.assigneeId,
        assigned_by: membership.userId,
        status: 'not_started',
        progress: 0,
      })
      .select('id')
      .single();

    if (error || !data) {
      console.error('createAssignment insert failed', traceId, error);
      return { ok: false, error: { ...ASSIGNMENT_CREATE_ERROR, traceId } };
    }

    const { data: task } = await supabase
      .from('tasks')
      .select('title')
      .eq('id', parsed.data.taskId)
      .maybeSingle();

    await queueTaskNotifications([
      {
        organizationId: membership.organizationId,
        recipientId: parsed.data.assigneeId,
        taskId: parsed.data.taskId,
        assignmentId: data.id,
        notificationType: 'assignment_created',
        title: 'New task assigned',
        body: `You have been assigned a task: ${task?.title ?? 'a task'}`,
      },
    ]);

    return { ok: true, data: { assignmentId: data.id } };
  } catch (caught) {
    console.error('createAssignment threw', traceId, caught);
    return { ok: false, error: { ...ASSIGNMENT_CREATE_ERROR, traceId } };
  }
}

export async function removeAssignment(
  input: unknown,
): Promise<ActionResult<null>> {
  const traceId = randomUUID();
  const parsed = assignmentRemoveSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'INVALID_ASSIGNMENT',
        message: 'Check the assignment details.',
        traceId,
        fields: parsed.error.flatten().fieldErrors,
      },
    };
  }

  try {
    const membership = await requireMembership();
    const supabase = await createServerSupabase();
    const { data: assignment } = await supabase
      .from('task_assignments')
      .select('task_id,assignee_id')
      .eq('id', parsed.data.assignmentId)
      .maybeSingle();

    const { error } = await supabase
      .from('task_assignments')
      .delete()
      .eq('id', parsed.data.assignmentId);

    if (error) {
      console.error('removeAssignment delete failed', traceId, error);
      return { ok: false, error: { ...ASSIGNMENT_UPDATE_ERROR, traceId } };
    }

    if (assignment && assignment.assignee_id !== membership.userId) {
      const { data: task } = await supabase
        .from('tasks')
        .select('title')
        .eq('id', assignment.task_id)
        .maybeSingle();

      await queueTaskNotifications([
        {
          organizationId: membership.organizationId,
          recipientId: assignment.assignee_id,
          taskId: assignment.task_id,
          notificationType: 'assignment_status_changed',
          title: 'Removed from task',
          body: `You were removed from: ${task?.title ?? 'a task'}`,
        },
      ]);
    }

    return { ok: true, data: null };
  } catch (caught) {
    console.error('removeAssignment threw', traceId, caught);
    return { ok: false, error: { ...ASSIGNMENT_UPDATE_ERROR, traceId } };
  }
}

export async function updateAssignmentProgress(
  input: unknown,
): Promise<ActionResult<{ assignmentId: string }>> {
  const traceId = randomUUID();
  const parsed = assignmentProgressSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'INVALID_ASSIGNMENT',
        message: 'Check the assignment details.',
        traceId,
        fields: parsed.error.flatten().fieldErrors,
      },
    };
  }

  try {
    await requireMembership();
    const supabase = await createServerSupabase();
    const now = new Date().toISOString();
    const patch: Partial<{
      progress: number;
      status: AssignmentStatus;
      started_at: string;
      completed_at: string;
      delay_reason: string | null;
      override_reason: string | null;
      updated_at: string;
    }> = {
      progress: parsed.data.progress,
    };

    if (parsed.data.progress === 100) {
      patch.status = 'completed';
      patch.completed_at = now;
    } else if (parsed.data.progress > 0) {
      patch.status = 'in_progress';
      patch.started_at = now;
    }

    const { data, error } = await supabase
      .from('task_assignments')
      .update(patch)
      .eq('id', parsed.data.assignmentId)
      .select('id')
      .single();

    if (error || !data) {
      return { ok: false, error: { ...ASSIGNMENT_UPDATE_ERROR, traceId } };
    }

    return { ok: true, data: { assignmentId: data.id } };
  } catch {
    return { ok: false, error: { ...ASSIGNMENT_UPDATE_ERROR, traceId } };
  }
}

export async function changeAssignmentStatus(
  input: unknown,
): Promise<ActionResult<{ assignmentId: string }>> {
  const traceId = randomUUID();
  const parsed = assignmentStatusChangeSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'INVALID_ASSIGNMENT',
        message: 'Check the assignment details.',
        traceId,
        fields: parsed.error.flatten().fieldErrors,
      },
    };
  }

  if (parsed.data.status === 'delayed' && !parsed.data.reason) {
    return {
      ok: false,
      error: {
        code: 'INVALID_ASSIGNMENT',
        message: 'A delay reason is required.',
        traceId,
      },
    };
  }

  if (parsed.data.status === 'not_started') {
    return {
      ok: false,
      error: {
        code: 'INVALID_ASSIGNMENT',
        message: 'Assignments cannot be moved back to not started.',
        traceId,
      },
    };
  }

  try {
    await requireMembership();
    const supabase = await createServerSupabase();
    const now = new Date().toISOString();
    const patch: Partial<{
      status: AssignmentStatus;
      progress: number;
      started_at: string;
      completed_at: string;
      delay_reason: string | null;
      override_reason: string | null;
      updated_at: string;
    }> = { status: parsed.data.status };

    if (parsed.data.status === 'in_progress') {
      patch.started_at = now;
      patch.progress = 25;
      patch.delay_reason = null;
    }

    if (parsed.data.status === 'delayed') {
      patch.delay_reason = parsed.data.reason;
    }

    if (parsed.data.status === 'completed') {
      patch.progress = 100;
      patch.completed_at = now;
      patch.delay_reason = null;
    }

    const { data, error } = await supabase
      .from('task_assignments')
      .update(patch)
      .eq('id', parsed.data.assignmentId)
      .select('id,task_id,organization_id,assignee_id')
      .single();

    if (error || !data) {
      return { ok: false, error: { ...ASSIGNMENT_UPDATE_ERROR, traceId } };
    }

    if (
      parsed.data.status === 'completed' ||
      parsed.data.status === 'delayed'
    ) {
      await notifyAdminsOfAssignmentChange(supabase, {
        organizationId: data.organization_id,
        taskId: data.task_id,
        assignmentId: data.id,
        assigneeId: data.assignee_id,
        status: parsed.data.status,
        reason: parsed.data.reason,
      });
    }

    return { ok: true, data: { assignmentId: data.id } };
  } catch {
    return { ok: false, error: { ...ASSIGNMENT_UPDATE_ERROR, traceId } };
  }
}

async function notifyAdminsOfAssignmentChange(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  input: {
    organizationId: string;
    taskId: string;
    assignmentId: string;
    assigneeId: string;
    status: 'completed' | 'delayed';
    reason?: string;
  },
) {
  const [{ data: task }, { data: assignee }, adminIds] = await Promise.all([
    supabase.from('tasks').select('title').eq('id', input.taskId).maybeSingle(),
    supabase
      .from('profiles')
      .select('display_name')
      .eq('id', input.assigneeId)
      .maybeSingle(),
    listOrganizationAdmins(input.organizationId),
  ]);

  const taskTitle = task?.title ?? 'a task';
  const assigneeName = assignee?.display_name ?? 'An employee';
  const body =
    input.status === 'completed'
      ? `${assigneeName} has completed: ${taskTitle}`
      : `${assigneeName} reported a delay on: ${taskTitle}${
          input.reason ? ` — ${input.reason}` : ''
        }`;

  await queueTaskNotifications(
    adminIds.map((adminId) => ({
      organizationId: input.organizationId,
      recipientId: adminId,
      taskId: input.taskId,
      assignmentId: input.assignmentId,
      notificationType:
        input.status === 'completed'
          ? 'assignment_completed'
          : 'assignment_delayed',
      title: input.status === 'completed' ? 'Task completed' : 'Task delayed',
      body,
    })),
  );
}

export async function reopenAssignment(
  input: unknown,
): Promise<ActionResult<{ assignmentId: string }>> {
  const traceId = randomUUID();
  const parsed = assignmentReopenSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'INVALID_ASSIGNMENT',
        message: 'Check the assignment details.',
        traceId,
        fields: parsed.error.flatten().fieldErrors,
      },
    };
  }

  try {
    const membership = await requireMembership();
    const supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from('task_assignments')
      .update({
        status: 'in_progress',
        progress: parsed.data.progress,
        started_at: new Date().toISOString(),
        completed_at: null,
        override_reason: parsed.data.reason,
      })
      .eq('id', parsed.data.assignmentId)
      .select('id,task_id,assignee_id')
      .single();

    if (error || !data) {
      return { ok: false, error: { ...ASSIGNMENT_UPDATE_ERROR, traceId } };
    }

    if (data.assignee_id !== membership.userId) {
      const { data: task } = await supabase
        .from('tasks')
        .select('title')
        .eq('id', data.task_id)
        .maybeSingle();

      await queueTaskNotifications([
        {
          organizationId: membership.organizationId,
          recipientId: data.assignee_id,
          taskId: data.task_id,
          assignmentId: data.id,
          notificationType: 'assignment_status_changed',
          title: 'Task reopened',
          body: `Your completed task was reopened: ${task?.title ?? 'a task'} — ${parsed.data.reason}`,
        },
      ]);
    }

    return { ok: true, data: { assignmentId: data.id } };
  } catch {
    return { ok: false, error: { ...ASSIGNMENT_UPDATE_ERROR, traceId } };
  }
}
