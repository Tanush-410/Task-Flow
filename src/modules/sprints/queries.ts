import 'server-only';

import { createServerSupabase } from '@/lib/supabase/server';
import { requireMembership } from '@/modules/members/queries';
import { requirePlanningTeamAccess } from '@/modules/planning-teams/queries';

import type { SprintStatus } from './schemas';

export type SprintSummary = {
  id: string;
  planningTeamId: string;
  name: string;
  startDate: string;
  endDate: string;
  status: SprintStatus;
  itemCount: number;
  storyPoints: number;
};

export type SprintTaskRow = {
  id: string;
  type: 'epic' | 'feature' | 'user_story' | 'bug' | 'task';
  title: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  storyPoints: number | null;
  originalHours: number | null;
  remainingHours: number | null;
  status: 'draft' | 'published' | 'archived';
  assigneeIds: string[];
};

export type SprintDetail = SprintSummary & {
  tasks: SprintTaskRow[];
};

export async function listSprints(
  planningTeamId: string,
): Promise<SprintSummary[]> {
  await requirePlanningTeamAccess(planningTeamId);
  const supabase = await createServerSupabase();

  const [{ data: sprints, error }, { data: taskRows }] = await Promise.all([
    supabase
      .from('sprints')
      .select('id,planning_team_id,name,start_date,end_date,status')
      .eq('planning_team_id', planningTeamId)
      .order('start_date', { ascending: false }),
    supabase
      .from('tasks')
      .select('sprint_id,story_points')
      .eq('planning_team_id', planningTeamId)
      .not('sprint_id', 'is', null),
  ]);

  if (error || !sprints) return [];

  const statsBySprintId = new Map<string, { count: number; points: number }>();
  for (const row of taskRows ?? []) {
    if (!row.sprint_id) continue;
    const existing = statsBySprintId.get(row.sprint_id) ?? {
      count: 0,
      points: 0,
    };
    existing.count += 1;
    existing.points += row.story_points ?? 0;
    statsBySprintId.set(row.sprint_id, existing);
  }

  return sprints.map((sprint) => ({
    id: sprint.id,
    planningTeamId: sprint.planning_team_id,
    name: sprint.name,
    startDate: sprint.start_date,
    endDate: sprint.end_date,
    status: sprint.status,
    itemCount: statsBySprintId.get(sprint.id)?.count ?? 0,
    storyPoints: statsBySprintId.get(sprint.id)?.points ?? 0,
  }));
}

export async function getSprint(
  sprintId: string,
): Promise<SprintDetail | null> {
  const supabase = await createServerSupabase();
  const { data: sprint, error } = await supabase
    .from('sprints')
    .select('id,planning_team_id,name,start_date,end_date,status')
    .eq('id', sprintId)
    .maybeSingle();

  if (error || !sprint) return null;

  const [membership] = await Promise.all([
    requireMembership(),
    requirePlanningTeamAccess(sprint.planning_team_id),
  ]);

  const [{ data: taskRows }, { data: assignmentRows }] = await Promise.all([
    supabase
      .from('tasks')
      .select(
        'id,work_item_type,title,priority,story_points,original_hours,remaining_hours,status',
      )
      .eq('sprint_id', sprintId)
      .order('backlog_rank', { ascending: true }),
    supabase
      .from('task_assignments')
      .select('task_id,assignee_id')
      .eq('organization_id', membership.organizationId),
  ]);

  const taskIds = new Set((taskRows ?? []).map((row) => row.id));
  const assigneesByTask = new Map<string, string[]>();
  for (const assignment of assignmentRows ?? []) {
    if (!taskIds.has(assignment.task_id)) continue;
    const existing = assigneesByTask.get(assignment.task_id) ?? [];
    existing.push(assignment.assignee_id);
    assigneesByTask.set(assignment.task_id, existing);
  }

  const tasks: SprintTaskRow[] = (taskRows ?? []).map((row) => ({
    id: row.id,
    type: row.work_item_type,
    title: row.title,
    priority: row.priority,
    storyPoints: row.story_points,
    originalHours: row.original_hours,
    remainingHours: row.remaining_hours,
    status: row.status,
    assigneeIds: assigneesByTask.get(row.id) ?? [],
  }));

  return {
    id: sprint.id,
    planningTeamId: sprint.planning_team_id,
    name: sprint.name,
    startDate: sprint.start_date,
    endDate: sprint.end_date,
    status: sprint.status,
    itemCount: tasks.length,
    storyPoints: tasks.reduce((sum, task) => sum + (task.storyPoints ?? 0), 0),
    tasks,
  };
}

/** Just enough shape for the backlog row's sprint picker. */
export async function listAssignableSprints(
  planningTeamId: string,
): Promise<{ id: string; name: string; status: SprintStatus }[]> {
  const sprints = await listSprints(planningTeamId);
  return sprints
    .filter((sprint) => sprint.status !== 'completed')
    .map((sprint) => ({
      id: sprint.id,
      name: sprint.name,
      status: sprint.status,
    }));
}
