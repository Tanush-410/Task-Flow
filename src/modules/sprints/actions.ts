'use server';

import { randomUUID } from 'node:crypto';

import { revalidatePath } from 'next/cache';

import type { ActionResult } from '@/lib/result';
import { createServerSupabase } from '@/lib/supabase/server';
import { requireMembership } from '@/modules/members/queries';

import {
  sprintCreateSchema,
  sprintDeleteSchema,
  sprintStatusUpdateSchema,
  sprintUpdateSchema,
} from './schemas';

export type SprintActionCode =
  | 'INVALID_SPRINT'
  | 'SPRINT_FORBIDDEN'
  | 'SPRINT_CONFLICT'
  | 'SPRINT_SAVE_FAILED';

const ERROR_MESSAGES = {
  INVALID_SPRINT: 'Check the sprint details.',
  SPRINT_FORBIDDEN: 'You cannot make that sprint change.',
  SPRINT_CONFLICT: 'This team already has an active sprint.',
  SPRINT_SAVE_FAILED: 'The sprint could not be saved.',
} satisfies Record<SprintActionCode, string>;

function failure(
  code: SprintActionCode,
  traceId: string,
  fields?: Record<string, string[]>,
): ActionResult<never> {
  return {
    ok: false,
    error: {
      code,
      message: ERROR_MESSAGES[code],
      traceId,
      ...(fields ? { fields } : {}),
    },
  };
}

function isConflict(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === '23505'
  );
}

function revalidatePlanning(): void {
  revalidatePath('/planning', 'layout');
}

async function requirePlannerOrAdmin(teamId: string): Promise<boolean> {
  const supabase = await createServerSupabase();
  const { data: isPlanner } = await supabase.rpc('is_planning_team_planner', {
    target_team_id: teamId,
  });
  return isPlanner === true;
}

export async function createSprint(
  input: unknown,
): Promise<ActionResult<{ sprintId: string }>> {
  const traceId = randomUUID();
  const parsed = sprintCreateSchema.safeParse(input);
  if (!parsed.success) {
    return failure(
      'INVALID_SPRINT',
      traceId,
      parsed.error.flatten().fieldErrors,
    );
  }

  try {
    const membership = await requireMembership();
    if (!(await requirePlannerOrAdmin(parsed.data.planningTeamId))) {
      return failure('SPRINT_FORBIDDEN', traceId);
    }

    const supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from('sprints')
      .insert({
        organization_id: membership.organizationId,
        planning_team_id: parsed.data.planningTeamId,
        created_by: membership.userId,
        name: parsed.data.name,
        start_date: parsed.data.startDate,
        end_date: parsed.data.endDate,
      })
      .select('id')
      .single();

    if (error || !data) {
      return failure(
        isConflict(error) ? 'SPRINT_CONFLICT' : 'SPRINT_SAVE_FAILED',
        traceId,
      );
    }

    revalidatePlanning();
    return { ok: true, data: { sprintId: data.id } };
  } catch {
    return failure('SPRINT_SAVE_FAILED', traceId);
  }
}

export async function updateSprint(
  input: unknown,
): Promise<ActionResult<{ sprintId: string }>> {
  const traceId = randomUUID();
  const parsed = sprintUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return failure(
      'INVALID_SPRINT',
      traceId,
      parsed.error.flatten().fieldErrors,
    );
  }

  try {
    await requireMembership();
    const supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from('sprints')
      .update({
        name: parsed.data.name,
        start_date: parsed.data.startDate,
        end_date: parsed.data.endDate,
      })
      .eq('id', parsed.data.sprintId)
      .select('id')
      .single();

    if (error || !data) {
      return failure(
        isConflict(error) ? 'SPRINT_CONFLICT' : 'SPRINT_FORBIDDEN',
        traceId,
      );
    }

    revalidatePlanning();
    return { ok: true, data: { sprintId: data.id } };
  } catch {
    return failure('SPRINT_SAVE_FAILED', traceId);
  }
}

export async function updateSprintStatus(
  input: unknown,
): Promise<ActionResult<{ sprintId: string }>> {
  const traceId = randomUUID();
  const parsed = sprintStatusUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return failure(
      'INVALID_SPRINT',
      traceId,
      parsed.error.flatten().fieldErrors,
    );
  }

  try {
    await requireMembership();
    const supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from('sprints')
      .update({ status: parsed.data.status })
      .eq('id', parsed.data.sprintId)
      .select('id')
      .single();

    if (error || !data) {
      return failure(
        isConflict(error) ? 'SPRINT_CONFLICT' : 'SPRINT_FORBIDDEN',
        traceId,
      );
    }

    revalidatePlanning();
    return { ok: true, data: { sprintId: data.id } };
  } catch {
    return failure('SPRINT_SAVE_FAILED', traceId);
  }
}

export async function deleteSprint(
  input: unknown,
): Promise<ActionResult<null>> {
  const traceId = randomUUID();
  const parsed = sprintDeleteSchema.safeParse(input);
  if (!parsed.success) {
    return failure(
      'INVALID_SPRINT',
      traceId,
      parsed.error.flatten().fieldErrors,
    );
  }

  try {
    await requireMembership();
    const supabase = await createServerSupabase();
    const { error } = await supabase
      .from('sprints')
      .delete()
      .eq('id', parsed.data.sprintId);

    if (error) return failure('SPRINT_FORBIDDEN', traceId);

    revalidatePlanning();
    return { ok: true, data: null };
  } catch {
    return failure('SPRINT_SAVE_FAILED', traceId);
  }
}
