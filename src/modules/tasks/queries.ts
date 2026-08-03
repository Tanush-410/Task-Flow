import 'server-only';

import { createServerSupabase } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/database.types';

import {
  listDisplayNames,
  requireAdmin,
  requireMembership,
} from '../members/queries';

export async function listOrganizationTasks() {
  const membership = await requireAdmin();
  const supabase = await createServerSupabase();

  return supabase
    .from('tasks')
    .select('*')
    .eq('organization_id', membership.organizationId)
    .order('created_at', { ascending: false });
}

export async function getTaskById(taskId: string) {
  await requireMembership();
  const supabase = await createServerSupabase();

  return supabase.from('tasks').select('*').eq('id', taskId).maybeSingle();
}

export async function listTaskAssignments(taskId: string) {
  await requireMembership();
  const supabase = await createServerSupabase();

  return supabase
    .from('task_assignments')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: false });
}

export type DashboardSummary = {
  totalTasks: number;
  activeAssignments: number;
  overdueCount: number;
  delayedCount: number;
  completedThisMonth: number;
};

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const membership = await requireAdmin();
  const supabase = await createServerSupabase();

  const [{ data: tasks }, { data: assignments }] = await Promise.all([
    supabase
      .from('tasks')
      .select('id,due_at,status')
      .eq('organization_id', membership.organizationId),
    supabase
      .from('task_assignments')
      .select('status,completed_at,task_id')
      .eq('organization_id', membership.organizationId),
  ]);

  const taskRows = tasks ?? [];
  const assignmentRows = assignments ?? [];
  const dueAtByTaskId = new Map(taskRows.map((task) => [task.id, task.due_at]));

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  let overdueCount = 0;
  let completedThisMonth = 0;
  let delayedCount = 0;
  let activeAssignments = 0;

  for (const assignment of assignmentRows) {
    if (assignment.status === 'completed') {
      if (
        assignment.completed_at &&
        new Date(assignment.completed_at) >= monthStart
      ) {
        completedThisMonth += 1;
      }
      continue;
    }

    activeAssignments += 1;

    if (assignment.status === 'delayed') {
      delayedCount += 1;
    }

    const dueAt = dueAtByTaskId.get(assignment.task_id);
    if (dueAt && new Date(dueAt) < now) {
      overdueCount += 1;
    }
  }

  return {
    totalTasks: taskRows.filter((task) => task.status !== 'archived').length,
    activeAssignments,
    overdueCount,
    delayedCount,
    completedThisMonth,
  };
}

export type CalendarTask = {
  task: Database['public']['Tables']['tasks']['Row'];
  assignees: { userId: string; displayName: string }[];
};

export function rangeFilter(startISO: string, endISO: string): string {
  return (
    `and(due_at.gte.${startISO},due_at.lte.${endISO}),` +
    `and(due_at.is.null,start_at.gte.${startISO},start_at.lte.${endISO})`
  );
}

/** Every org task whose due date (or start date, if no due date) falls in range. */
export async function listOrganizationTasksInRange(
  startISO: string,
  endISO: string,
): Promise<CalendarTask[]> {
  const membership = await requireAdmin();
  const supabase = await createServerSupabase();

  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('organization_id', membership.organizationId)
    .neq('status', 'archived')
    .or(rangeFilter(startISO, endISO))
    .order('due_at', { ascending: true });

  if (error || !tasks || tasks.length === 0) {
    return [];
  }

  const taskIds = tasks.map((task) => task.id);
  const { data: assignments } = await supabase
    .from('task_assignments')
    .select('task_id,assignee_id')
    .in('task_id', taskIds);

  const assigneeIds = Array.from(
    new Set((assignments ?? []).map((row) => row.assignee_id)),
  );
  const displayNames = await listDisplayNames(assigneeIds);

  const assigneesByTaskId = new Map<
    string,
    { userId: string; displayName: string }[]
  >();

  for (const row of assignments ?? []) {
    const list = assigneesByTaskId.get(row.task_id) ?? [];
    list.push({
      userId: row.assignee_id,
      displayName: displayNames.get(row.assignee_id) ?? 'Unknown',
    });
    assigneesByTaskId.set(row.task_id, list);
  }

  return tasks.map((task) => ({
    task,
    assignees: assigneesByTaskId.get(task.id) ?? [],
  }));
}
