import 'server-only';

import { createServerSupabase } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/database.types';

import {
  listDisplayNames,
  requireAdmin,
  requireMembership,
} from '../members/queries';

export const TASKS_PAGE_SIZE = 20;

export async function listOrganizationTasks() {
  const membership = await requireAdmin();
  const supabase = await createServerSupabase();

  return supabase
    .from('tasks')
    .select('*')
    .eq('organization_id', membership.organizationId)
    .order('created_at', { ascending: false });
}

export type PaginatedTasks = {
  tasks: Database['public']['Tables']['tasks']['Row'][];
  totalCount: number;
  page: number;
  pageSize: number;
};

/**
 * Paginated variant of listOrganizationTasks for the /tasks list, which
 * would otherwise pull every task in the organization into memory just to
 * render one page of rows.
 */
type TaskStatusColumn = Database['public']['Tables']['tasks']['Row']['status'];
type TaskPriorityColumn =
  Database['public']['Tables']['tasks']['Row']['priority'];

export async function listOrganizationTasksPage(input: {
  page: number;
  status?: string;
  priority?: string;
  sort?: 'due-asc' | 'due-desc' | 'priority' | 'newest';
}): Promise<PaginatedTasks> {
  const membership = await requireAdmin();
  const supabase = await createServerSupabase();

  const page = Math.max(1, input.page);
  const from = (page - 1) * TASKS_PAGE_SIZE;
  const to = from + TASKS_PAGE_SIZE - 1;

  let query = supabase
    .from('tasks')
    .select('*', { count: 'exact' })
    .eq('organization_id', membership.organizationId);

  if (input.status && input.status !== 'all') {
    query = query.eq('status', input.status as TaskStatusColumn);
  }
  if (input.priority && input.priority !== 'all') {
    query = query.eq('priority', input.priority as TaskPriorityColumn);
  }

  if (input.sort === 'newest') {
    query = query.order('created_at', { ascending: false });
  } else if (input.sort === 'due-desc') {
    query = query.order('due_at', { ascending: false, nullsFirst: false });
  } else if (input.sort === 'priority') {
    // Postgres sorts enums by declaration order; task_priority is declared
    // low, medium, high, urgent, so descending gives urgent-first.
    query = query.order('priority', { ascending: false });
  } else {
    query = query.order('due_at', { ascending: true, nullsFirst: false });
  }

  const { data, count, error } = await query.range(from, to);

  if (error || !data) {
    return { tasks: [], totalCount: 0, page, pageSize: TASKS_PAGE_SIZE };
  }

  return {
    tasks: data,
    totalCount: count ?? 0,
    page,
    pageSize: TASKS_PAGE_SIZE,
  };
}

export type RecentTask = {
  id: string;
  title: string;
  status: Database['public']['Tables']['tasks']['Row']['status'];
};

/** Lightweight, capped query for the dashboard's "Recent tasks" widget. */
export async function listRecentOrganizationTasks(
  limit = 5,
): Promise<RecentTask[]> {
  const membership = await requireAdmin();
  const supabase = await createServerSupabase();

  const { data, error } = await supabase
    .from('tasks')
    .select('id,title,status')
    .eq('organization_id', membership.organizationId)
    .order('created_at', { ascending: false })
    .limit(limit);

  return error || !data ? [] : data;
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

/**
 * Aggregate counts via `head: true` count queries instead of pulling every
 * task and assignment row into memory just to tally them client-side — the
 * original implementation didn't scale with organization size.
 */
export async function getDashboardSummary(): Promise<DashboardSummary> {
  const membership = await requireAdmin();
  const supabase = await createServerSupabase();
  const organizationId = membership.organizationId;

  const now = new Date();
  const nowIso = now.toISOString();
  const monthStartIso = new Date(
    now.getFullYear(),
    now.getMonth(),
    1,
  ).toISOString();

  const [
    totalTasksResult,
    activeAssignmentsResult,
    delayedResult,
    completedThisMonthResult,
    overdueResult,
  ] = await Promise.all([
    supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .neq('status', 'archived'),
    supabase
      .from('task_assignments')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .neq('status', 'completed'),
    supabase
      .from('task_assignments')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('status', 'delayed'),
    supabase
      .from('task_assignments')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('status', 'completed')
      .gte('completed_at', monthStartIso),
    supabase
      .from('task_assignments')
      .select('*, tasks!inner(due_at)', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .neq('status', 'completed')
      .lt('tasks.due_at', nowIso),
  ]);

  return {
    totalTasks: totalTasksResult.count ?? 0,
    activeAssignments: activeAssignmentsResult.count ?? 0,
    overdueCount: overdueResult.count ?? 0,
    delayedCount: delayedResult.count ?? 0,
    completedThisMonth: completedThisMonthResult.count ?? 0,
  };
}

export type BoardAssignment = {
  assignmentId: string;
  taskId: string;
  title: string;
  priority: string;
  dueAt: string | null;
  status: 'not_started' | 'in_progress' | 'delayed' | 'completed';
  assigneeId: string;
  assigneeName: string;
};

/** Every assignment in the org, any status, flattened for the admin Kanban board. */
export async function listOrganizationAssignmentsBoard(): Promise<
  BoardAssignment[]
> {
  const membership = await requireAdmin();
  const supabase = await createServerSupabase();

  const { data: assignments } = await supabase
    .from('task_assignments')
    .select('id,assignee_id,task_id,status')
    .eq('organization_id', membership.organizationId);

  const rows = assignments ?? [];
  const taskIds = Array.from(new Set(rows.map((row) => row.task_id)));
  const [{ data: tasks }, displayNames] = await Promise.all([
    supabase.from('tasks').select('id,title,priority,due_at').in('id', taskIds),
    listDisplayNames(rows.map((row) => row.assignee_id)),
  ]);
  const taskById = new Map((tasks ?? []).map((task) => [task.id, task]));

  const board: BoardAssignment[] = [];
  for (const row of rows) {
    const task = taskById.get(row.task_id);
    if (!task) continue;

    board.push({
      assignmentId: row.id,
      taskId: task.id,
      title: task.title,
      priority: task.priority,
      dueAt: task.due_at,
      status: row.status,
      assigneeId: row.assignee_id,
      assigneeName: displayNames.get(row.assignee_id) ?? 'Unknown',
    });
  }

  return board;
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
