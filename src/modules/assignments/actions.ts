'use server';

import { randomUUID } from 'node:crypto';

import type { ActionResult } from '@/lib/result';
import { createServerSupabase } from '@/lib/supabase/server';

import { requireAdmin, requireMembership } from '../members/queries';
import {
  type AssignmentStatus,
  assignmentCreateSchema,
  assignmentProgressSchema,
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
    const membership = await requireAdmin();
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
      return { ok: false, error: { ...ASSIGNMENT_CREATE_ERROR, traceId } };
    }

    return { ok: true, data: { assignmentId: data.id } };
  } catch {
    return { ok: false, error: { ...ASSIGNMENT_CREATE_ERROR, traceId } };
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
    await requireAdmin();
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
