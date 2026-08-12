'use server';

import { randomUUID } from 'node:crypto';

import { revalidatePath } from 'next/cache';

import type { ActionResult } from '@/lib/result';
import { createServerSupabase } from '@/lib/supabase/server';
import { requireMembership } from '@/modules/members/queries';
import { listPlanningTeams } from '@/modules/planning-teams/queries';

import {
  getWorkItemDescendantCount,
  listValidParentCandidates,
  type ParentCandidate,
} from './queries';
import {
  moveWorkItemSchema,
  rankBacklogItemSchema,
  workItemCreateSchema,
  workItemPlanningFieldsUpdateSchema,
  type WorkItemType,
} from './schemas';

export type BacklogActionCode =
  | 'INVALID_WORK_ITEM'
  | 'WORK_ITEM_FORBIDDEN'
  | 'WORK_ITEM_SAVE_FAILED'
  | 'RANK_CONFLICT';

const ERROR_MESSAGES = {
  INVALID_WORK_ITEM: 'Check the work item details.',
  WORK_ITEM_FORBIDDEN: 'You cannot make that backlog change.',
  WORK_ITEM_SAVE_FAILED: 'The work item could not be saved.',
  RANK_CONFLICT: 'The backlog order changed. Try reordering again.',
} satisfies Record<BacklogActionCode, string>;

function failure(
  code: BacklogActionCode,
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

function hasDatabaseCode(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === code
  );
}

function mapRpcError(
  error: unknown,
  traceId: string,
  fieldsOnForbiddenParent?: Record<string, string[]>,
): ActionResult<never> {
  if (hasDatabaseCode(error, '42501')) {
    return failure('WORK_ITEM_FORBIDDEN', traceId);
  }
  if (hasDatabaseCode(error, '23514') || hasDatabaseCode(error, '22023')) {
    return failure('INVALID_WORK_ITEM', traceId, fieldsOnForbiddenParent);
  }
  return failure('WORK_ITEM_SAVE_FAILED', traceId);
}

function revalidatePlanning(): void {
  revalidatePath('/planning', 'layout');
}

export async function createWorkItem(
  input: unknown,
): Promise<ActionResult<{ workItemId: string }>> {
  const traceId = randomUUID();
  const parsed = workItemCreateSchema.safeParse(input);
  if (!parsed.success) {
    return failure(
      'INVALID_WORK_ITEM',
      traceId,
      parsed.error.flatten().fieldErrors,
    );
  }

  try {
    await requireMembership();
    const supabase = await createServerSupabase();
    const { data, error } = await supabase.rpc('create_work_item', {
      target_planning_team_id: parsed.data.planningTeamId,
      item_type: parsed.data.type,
      item_title: parsed.data.title,
      item_description: parsed.data.description,
      item_priority: parsed.data.priority,
      ...(parsed.data.parentTaskId !== null
        ? { target_parent_task_id: parsed.data.parentTaskId }
        : {}),
      ...(parsed.data.storyPoints != null
        ? { item_story_points: parsed.data.storyPoints }
        : {}),
      ...(parsed.data.originalHours != null
        ? { item_original_hours: parsed.data.originalHours }
        : {}),
      ...(parsed.data.remainingHours != null
        ? { item_remaining_hours: parsed.data.remainingHours }
        : {}),
    });

    if (error || !data) return mapRpcError(error, traceId);

    revalidatePlanning();
    return { ok: true, data: { workItemId: data } };
  } catch {
    return failure('WORK_ITEM_SAVE_FAILED', traceId);
  }
}

export async function updateWorkItemPlanningFields(
  input: unknown,
): Promise<ActionResult<{ taskId: string }>> {
  const traceId = randomUUID();
  const parsed = workItemPlanningFieldsUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return failure(
      'INVALID_WORK_ITEM',
      traceId,
      parsed.error.flatten().fieldErrors,
    );
  }

  try {
    await requireMembership();
    const supabase = await createServerSupabase();

    // original_hours is never directly grantable (see the migration
    // comment); the only writer is reestimate_work_item_hours. Every
    // other planning field is an ordinary grant + RLS column update.
    if (parsed.data.originalHours !== undefined) {
      const { error } = await supabase.rpc('reestimate_work_item_hours', {
        target_task_id: parsed.data.taskId,
        new_original_hours: parsed.data.originalHours ?? 0,
        new_remaining_hours: parsed.data.remainingHours ?? 0,
      });
      if (error) return mapRpcError(error, traceId);

      revalidatePlanning();
      return { ok: true, data: { taskId: parsed.data.taskId } };
    }

    const patch: Partial<{
      title: string;
      description: string;
      priority: 'low' | 'medium' | 'high' | 'urgent';
      story_points: number | null;
      remaining_hours: number | null;
    }> = {};
    if (parsed.data.title !== undefined) patch.title = parsed.data.title;
    if (parsed.data.description !== undefined) {
      patch.description = parsed.data.description;
    }
    if (parsed.data.priority !== undefined)
      patch.priority = parsed.data.priority;
    if (parsed.data.storyPoints !== undefined) {
      patch.story_points = parsed.data.storyPoints;
    }
    if (parsed.data.remainingHours !== undefined) {
      patch.remaining_hours = parsed.data.remainingHours;
    }

    const { data, error } = await supabase
      .from('tasks')
      .update(patch)
      .eq('id', parsed.data.taskId)
      .select('id')
      .single();

    if (error || !data) {
      return failure('WORK_ITEM_FORBIDDEN', traceId);
    }

    revalidatePlanning();
    return { ok: true, data: { taskId: data.id } };
  } catch {
    return failure('WORK_ITEM_SAVE_FAILED', traceId);
  }
}

export async function moveWorkItem(
  input: unknown,
): Promise<ActionResult<{ movedCount: number }>> {
  const traceId = randomUUID();
  const parsed = moveWorkItemSchema.safeParse(input);
  if (!parsed.success) {
    return failure(
      'INVALID_WORK_ITEM',
      traceId,
      parsed.error.flatten().fieldErrors,
    );
  }

  try {
    await requireMembership();
    const supabase = await createServerSupabase();
    const { data, error } = await supabase.rpc('move_work_item', {
      target_task_id: parsed.data.taskId,
      new_planning_team_id: parsed.data.newPlanningTeamId,
      include_descendants: parsed.data.includeDescendants,
      ...(parsed.data.newParentTaskId !== null
        ? { new_parent_task_id: parsed.data.newParentTaskId }
        : {}),
    });

    if (error || data == null) {
      return mapRpcError(error, traceId, {
        includeDescendants: ['This move affects descendants.'],
      });
    }

    revalidatePlanning();
    return { ok: true, data: { movedCount: data } };
  } catch {
    return failure('WORK_ITEM_SAVE_FAILED', traceId);
  }
}

export async function rankBacklogItem(
  input: unknown,
): Promise<ActionResult<{ rank: string }>> {
  const traceId = randomUUID();
  const parsed = rankBacklogItemSchema.safeParse(input);
  if (!parsed.success) {
    return failure(
      'INVALID_WORK_ITEM',
      traceId,
      parsed.error.flatten().fieldErrors,
    );
  }

  try {
    await requireMembership();
    const supabase = await createServerSupabase();

    const attempt = () =>
      supabase.rpc('assign_backlog_rank', {
        target_task_id: parsed.data.taskId,
        ...(parsed.data.beforeTaskId !== null
          ? { before_task_id: parsed.data.beforeTaskId }
          : {}),
        ...(parsed.data.afterTaskId !== null
          ? { after_task_id: parsed.data.afterTaskId }
          : {}),
      });

    const first = await attempt();
    if (!first.error && first.data) {
      revalidatePlanning();
      return { ok: true, data: { rank: first.data } };
    }

    const isRankRace =
      hasDatabaseCode(first.error, '22023') ||
      hasDatabaseCode(first.error, '23505');
    if (!isRankRace) return mapRpcError(first.error, traceId);

    const { data: scopeRow, error: scopeError } = await supabase
      .from('tasks')
      .select('planning_team_id,parent_task_id,work_item_type')
      .eq('id', parsed.data.taskId)
      .single();

    if (scopeError || !scopeRow || !scopeRow.planning_team_id) {
      return failure('RANK_CONFLICT', traceId);
    }

    const { error: rebalanceError } = await supabase.rpc(
      'rebalance_backlog_siblings',
      {
        target_team_id: scopeRow.planning_team_id,
        target_work_item_type: scopeRow.work_item_type,
        ...(scopeRow.parent_task_id !== null
          ? { target_parent_task_id: scopeRow.parent_task_id }
          : {}),
      },
    );
    if (rebalanceError) return failure('RANK_CONFLICT', traceId);

    const second = await attempt();
    if (second.error || !second.data) {
      return failure('RANK_CONFLICT', traceId);
    }

    revalidatePlanning();
    return { ok: true, data: { rank: second.data } };
  } catch {
    return failure('WORK_ITEM_SAVE_FAILED', traceId);
  }
}

export type MoveWorkItemOptions = {
  descendantCount: number;
  candidates: ParentCandidate[];
};

/**
 * Powers the move/reparent dialog. Epics have no parent type to search
 * for (`listValidParentCandidates` always returns `[]` for one), so an
 * epic's "candidates" are its visible planning teams instead -- the
 * dialog treats `candidate.planningTeamId` as the destination team and
 * always sends `newParentTaskId: null` for that case.
 */
export async function fetchWorkItemMoveOptions(
  taskId: string,
  type: WorkItemType,
): Promise<MoveWorkItemOptions> {
  const [descendantCount, candidates] = await Promise.all([
    getWorkItemDescendantCount(taskId),
    type === 'epic'
      ? listPlanningTeams().then((teams) =>
          teams
            .filter((team) => !team.isArchived)
            .map((team) => ({
              id: team.id,
              title: team.name,
              planningTeamId: team.id,
              planningTeamName: team.name,
            })),
        )
      : listValidParentCandidates(type),
  ]);

  return { descendantCount, candidates };
}
