import 'server-only';

import { createServerSupabase } from '@/lib/supabase/server';

import { requireAdmin, requireMembership } from '../members/queries';

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
