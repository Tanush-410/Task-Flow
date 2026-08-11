'use server';

import { randomUUID } from 'node:crypto';

import { revalidatePath } from 'next/cache';

import type { ActionResult } from '@/lib/result';
import { createServerSupabase } from '@/lib/supabase/server';
import { requireAdmin, requireMembership } from '@/modules/members/queries';

import {
  planningTeamArchiveSchema,
  planningTeamCreateSchema,
  planningTeamMembersSchema,
  planningTeamUpdateSchema,
} from './schemas';

export type TeamActionCode =
  | 'INVALID_PLANNING_TEAM'
  | 'PLANNING_TEAM_FORBIDDEN'
  | 'PLANNING_TEAM_CONFLICT'
  | 'PLANNING_TEAM_SAVE_FAILED';

const ERROR_MESSAGES = {
  INVALID_PLANNING_TEAM: 'Check the planning team details.',
  PLANNING_TEAM_FORBIDDEN: 'You cannot make that planning team change.',
  PLANNING_TEAM_CONFLICT: 'A planning team with that name already exists.',
  PLANNING_TEAM_SAVE_FAILED: 'The planning team could not be saved.',
} satisfies Record<TeamActionCode, string>;

function failure(
  code: TeamActionCode,
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

function hasDatabaseCode(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === code
  );
}

function revalidatePlanning(): void {
  revalidatePath('/planning', 'layout');
}

export async function createPlanningTeam(
  input: unknown,
): Promise<ActionResult<{ teamId: string }>> {
  const traceId = randomUUID();
  const parsed = planningTeamCreateSchema.safeParse(input);

  if (!parsed.success) {
    return failure(
      'INVALID_PLANNING_TEAM',
      traceId,
      parsed.error.flatten().fieldErrors,
    );
  }

  try {
    const membership = await requireAdmin();
    const supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from('planning_teams')
      .insert({
        organization_id: membership.organizationId,
        created_by: membership.userId,
        name: parsed.data.name,
        description: parsed.data.description,
        default_sprint_length_days: parsed.data.defaultSprintLengthDays,
      })
      .select('id')
      .single();

    if (error || !data) {
      return failure(
        isConflict(error)
          ? 'PLANNING_TEAM_CONFLICT'
          : 'PLANNING_TEAM_SAVE_FAILED',
        traceId,
      );
    }

    revalidatePlanning();
    return { ok: true, data: { teamId: data.id } };
  } catch {
    return failure('PLANNING_TEAM_SAVE_FAILED', traceId);
  }
}

export async function updatePlanningTeam(
  input: unknown,
): Promise<ActionResult<{ teamId: string }>> {
  const traceId = randomUUID();
  const parsed = planningTeamUpdateSchema.safeParse(input);

  if (!parsed.success) {
    return failure(
      'INVALID_PLANNING_TEAM',
      traceId,
      parsed.error.flatten().fieldErrors,
    );
  }

  try {
    const membership = await requireMembership();
    const supabase = await createServerSupabase();
    const { data: team, error: teamError } = await supabase
      .from('planning_teams')
      .select('organization_id')
      .eq('id', parsed.data.teamId)
      .eq('organization_id', membership.organizationId)
      .maybeSingle();

    if (teamError || !team) {
      return failure('PLANNING_TEAM_FORBIDDEN', traceId);
    }

    const { data: isPlanner, error: plannerError } = await supabase.rpc(
      'is_planning_team_planner',
      { target_team_id: parsed.data.teamId },
    );
    if (plannerError || !isPlanner) {
      return failure('PLANNING_TEAM_FORBIDDEN', traceId);
    }

    const { data, error } = await supabase
      .from('planning_teams')
      .update({
        name: parsed.data.name,
        description: parsed.data.description,
        default_sprint_length_days: parsed.data.defaultSprintLengthDays,
      })
      .eq('id', parsed.data.teamId)
      .eq('organization_id', membership.organizationId)
      .select('id')
      .single();

    if (error || !data) {
      return failure(
        isConflict(error)
          ? 'PLANNING_TEAM_CONFLICT'
          : 'PLANNING_TEAM_SAVE_FAILED',
        traceId,
      );
    }

    revalidatePlanning();
    return { ok: true, data: { teamId: data.id } };
  } catch {
    return failure('PLANNING_TEAM_SAVE_FAILED', traceId);
  }
}

export async function setPlanningTeamMembers(
  input: unknown,
): Promise<ActionResult<{ teamId: string }>> {
  const traceId = randomUUID();
  const parsed = planningTeamMembersSchema.safeParse(input);

  if (!parsed.success) {
    return failure(
      'INVALID_PLANNING_TEAM',
      traceId,
      parsed.error.flatten().fieldErrors,
    );
  }

  try {
    const membership = await requireMembership();
    const supabase = await createServerSupabase();
    const { data: team, error: teamError } = await supabase
      .from('planning_teams')
      .select('organization_id')
      .eq('id', parsed.data.teamId)
      .eq('organization_id', membership.organizationId)
      .maybeSingle();

    if (teamError || !team) {
      return failure('PLANNING_TEAM_FORBIDDEN', traceId);
    }

    const { data: isPlanner, error: plannerError } = await supabase.rpc(
      'is_planning_team_planner',
      { target_team_id: parsed.data.teamId },
    );
    if (plannerError) return failure('PLANNING_TEAM_SAVE_FAILED', traceId);

    if (!isPlanner) {
      const ownMembership = parsed.data.members[0];
      if (
        parsed.data.members.length !== 1 ||
        !ownMembership ||
        ownMembership.userId !== membership.userId ||
        ownMembership.role !== 'member'
      ) {
        return failure('PLANNING_TEAM_FORBIDDEN', traceId);
      }

      const { error } = await supabase
        .from('planning_team_members')
        .update({
          default_capacity_hours_per_day: ownMembership.capacityHoursPerDay,
        })
        .eq('organization_id', membership.organizationId)
        .eq('planning_team_id', parsed.data.teamId)
        .eq('user_id', membership.userId);

      if (error) return failure('PLANNING_TEAM_SAVE_FAILED', traceId);

      revalidatePlanning();
      return { ok: true, data: { teamId: parsed.data.teamId } };
    }

    const { data: replaced, error: replaceError } = await supabase.rpc(
      'replace_planning_team_members',
      {
        target_team_id: parsed.data.teamId,
        replacement_members: parsed.data.members.map((member) => ({
          user_id: member.userId,
          planning_role: member.role,
          default_capacity_hours_per_day: member.capacityHoursPerDay,
        })),
      },
    );

    if (replaceError || !replaced) {
      if (hasDatabaseCode(replaceError, '42501')) {
        return failure('PLANNING_TEAM_FORBIDDEN', traceId);
      }
      if (
        hasDatabaseCode(replaceError, '22023') ||
        hasDatabaseCode(replaceError, '23514')
      ) {
        return failure('INVALID_PLANNING_TEAM', traceId);
      }
      return failure('PLANNING_TEAM_SAVE_FAILED', traceId);
    }

    revalidatePlanning();
    return { ok: true, data: { teamId: parsed.data.teamId } };
  } catch {
    return failure('PLANNING_TEAM_SAVE_FAILED', traceId);
  }
}

export async function archivePlanningTeam(
  input: unknown,
): Promise<ActionResult<null>> {
  const traceId = randomUUID();
  const parsed = planningTeamArchiveSchema.safeParse(input);

  if (!parsed.success) {
    return failure(
      'INVALID_PLANNING_TEAM',
      traceId,
      parsed.error.flatten().fieldErrors,
    );
  }

  try {
    await requireAdmin();
    const supabase = await createServerSupabase();
    const { data, error } = await supabase.rpc('archive_planning_team', {
      target_team_id: parsed.data.teamId,
    });

    if (error || !data) {
      return failure(
        error && isConflict(error)
          ? 'PLANNING_TEAM_CONFLICT'
          : 'PLANNING_TEAM_SAVE_FAILED',
        traceId,
      );
    }

    revalidatePlanning();
    return { ok: true, data: null };
  } catch {
    return failure('PLANNING_TEAM_SAVE_FAILED', traceId);
  }
}
