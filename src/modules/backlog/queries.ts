import 'server-only';

import { createServerSupabase } from '@/lib/supabase/server';
import { requireMembership } from '@/modules/members/queries';
import { requirePlanningTeamAccess } from '@/modules/planning-teams/queries';

import type { WorkItemType } from './schemas';

const PARENT_TYPE_BY_CHILD: Record<WorkItemType, WorkItemType | null> = {
  epic: null,
  feature: 'epic',
  user_story: 'feature',
  task: 'user_story',
};

export type BacklogWorkItem = {
  id: string;
  parentTaskId: string | null;
  type: WorkItemType;
  title: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  storyPoints: number | null;
  originalHours: number | null;
  remainingHours: number | null;
  backlogRank: string | null;
  assigneeIds: string[];
  children: BacklogWorkItem[];
};

export type BacklogFilters = {
  assigneeId?: string;
  type?: WorkItemType;
  estimateState?: 'estimated' | 'unestimated' | 'all';
  text?: string;
};

export type ParentCandidate = {
  id: string;
  title: string;
  planningTeamId: string;
  planningTeamName: string;
};

function matchesFilters(
  item: Omit<BacklogWorkItem, 'children'>,
  filters: BacklogFilters,
): boolean {
  if (filters.type && item.type !== filters.type) return false;

  if (filters.assigneeId && !item.assigneeIds.includes(filters.assigneeId)) {
    return false;
  }

  if (filters.estimateState && filters.estimateState !== 'all') {
    const hasEstimate = item.storyPoints != null || item.originalHours != null;
    if (filters.estimateState === 'estimated' && !hasEstimate) return false;
    if (filters.estimateState === 'unestimated' && hasEstimate) return false;
  }

  if (filters.text) {
    const needle = filters.text.trim().toLowerCase();
    if (needle && !item.title.toLowerCase().includes(needle)) return false;
  }

  return true;
}

// Keeps a node when it matches the filters itself OR any descendant does,
// so the collapsible tree never loses an ancestor chain leading to a
// match -- filtering never structurally breaks the hierarchy.
function filterTree(
  nodes: BacklogWorkItem[],
  filters: BacklogFilters,
): BacklogWorkItem[] {
  const hasActiveFilter =
    filters.type !== undefined ||
    filters.assigneeId !== undefined ||
    (filters.estimateState !== undefined && filters.estimateState !== 'all') ||
    Boolean(filters.text?.trim());

  if (!hasActiveFilter) return nodes;

  const result: BacklogWorkItem[] = [];
  for (const node of nodes) {
    const filteredChildren = filterTree(node.children, filters);
    const selfMatches = matchesFilters(node, filters);
    if (selfMatches || filteredChildren.length > 0) {
      result.push({ ...node, children: filteredChildren });
    }
  }
  return result;
}

export async function listBacklogHierarchy(
  teamId: string,
  filters: BacklogFilters = {},
): Promise<BacklogWorkItem[]> {
  await requirePlanningTeamAccess(teamId);
  const supabase = await createServerSupabase();

  const [{ data: rows, error }, { data: assignmentRows }] = await Promise.all([
    supabase
      .from('tasks')
      .select(
        'id,parent_task_id,work_item_type,title,priority,story_points,original_hours,remaining_hours,backlog_rank',
      )
      .eq('planning_team_id', teamId)
      .order('backlog_rank', { ascending: true }),
    supabase
      .from('task_assignments')
      .select('task_id,assignee_id')
      .eq('organization_id', (await requireMembership()).organizationId),
  ]);

  if (error || !rows) return [];

  const taskIds = new Set(rows.map((row) => row.id));
  const assigneesByTask = new Map<string, string[]>();
  for (const assignment of assignmentRows ?? []) {
    if (!taskIds.has(assignment.task_id)) continue;
    const existing = assigneesByTask.get(assignment.task_id) ?? [];
    existing.push(assignment.assignee_id);
    assigneesByTask.set(assignment.task_id, existing);
  }

  const nodesById = new Map<string, BacklogWorkItem>();
  for (const row of rows) {
    nodesById.set(row.id, {
      id: row.id,
      parentTaskId: row.parent_task_id,
      type: row.work_item_type,
      title: row.title,
      priority: row.priority,
      storyPoints: row.story_points,
      originalHours: row.original_hours,
      remainingHours: row.remaining_hours,
      backlogRank: row.backlog_rank,
      assigneeIds: assigneesByTask.get(row.id) ?? [],
      children: [],
    });
  }

  const roots: BacklogWorkItem[] = [];
  for (const row of rows) {
    const node = nodesById.get(row.id)!;
    const parent = row.parent_task_id
      ? nodesById.get(row.parent_task_id)
      : undefined;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return filterTree(roots, filters);
}

export async function getWorkItemDescendantCount(
  taskId: string,
): Promise<number> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc('count_work_item_descendants', {
    target_task_id: taskId,
  });

  if (error || typeof data !== 'number') return 0;
  return data;
}

export async function listValidParentCandidates(
  childType: WorkItemType,
): Promise<ParentCandidate[]> {
  const parentType = PARENT_TYPE_BY_CHILD[childType];
  if (!parentType) return [];

  const membership = await requireMembership();
  const supabase = await createServerSupabase();

  const { data: memberships, error: membershipError } = await supabase
    .from('planning_team_members')
    .select('planning_team_id')
    .eq('organization_id', membership.organizationId)
    .eq('user_id', membership.userId);

  if (membershipError) return [];

  const teamIds = new Set(
    (memberships ?? []).map((row) => row.planning_team_id),
  );

  const { data: teams, error: teamsError } = await supabase
    .from('planning_teams')
    .select('id,name')
    .eq('organization_id', membership.organizationId)
    .eq('is_archived', false);

  if (teamsError || !teams) return [];

  const visibleTeamIds =
    membership.role === 'admin'
      ? teams.map((team) => team.id)
      : teams.filter((team) => teamIds.has(team.id)).map((team) => team.id);

  if (visibleTeamIds.length === 0) return [];

  const teamNameById = new Map(teams.map((team) => [team.id, team.name]));

  const { data: candidates, error: candidatesError } = await supabase
    .from('tasks')
    .select('id,title,planning_team_id')
    .in('planning_team_id', visibleTeamIds)
    .eq('work_item_type', parentType)
    .order('backlog_rank', { ascending: true });

  if (candidatesError || !candidates) return [];

  return candidates
    .filter((candidate) => candidate.planning_team_id !== null)
    .map((candidate) => ({
      id: candidate.id,
      title: candidate.title,
      planningTeamId: candidate.planning_team_id!,
      planningTeamName: teamNameById.get(candidate.planning_team_id!) ?? '',
    }));
}
