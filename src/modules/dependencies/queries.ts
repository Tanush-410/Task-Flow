import 'server-only';

import { createServerSupabase } from '@/lib/supabase/server';

import { requireMembership } from '../members/queries';

export type TaskDependencyRow = {
  id: string;
  dependsOnTaskId: string;
  dependsOnTaskTitle: string;
  isSatisfied: boolean;
};

async function resolveSatisfaction(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  dependsOnTaskIds: string[],
): Promise<Map<string, boolean>> {
  if (dependsOnTaskIds.length === 0) {
    return new Map();
  }

  const { data: assignments } = await supabase
    .from('task_assignments')
    .select('task_id,status')
    .in('task_id', dependsOnTaskIds);

  const statusesByTask = new Map<string, string[]>();
  for (const row of assignments ?? []) {
    const list = statusesByTask.get(row.task_id) ?? [];
    list.push(row.status);
    statusesByTask.set(row.task_id, list);
  }

  const satisfaction = new Map<string, boolean>();
  for (const taskId of dependsOnTaskIds) {
    const statuses = statusesByTask.get(taskId) ?? [];
    satisfaction.set(
      taskId,
      statuses.length === 0 ||
        statuses.every((status) => status === 'completed'),
    );
  }

  return satisfaction;
}

export async function listTaskDependencies(
  taskId: string,
): Promise<TaskDependencyRow[]> {
  await requireMembership();
  const supabase = await createServerSupabase();

  const { data: deps } = await supabase
    .from('task_dependencies')
    .select('id,depends_on_task_id')
    .eq('task_id', taskId);

  if (!deps || deps.length === 0) {
    return [];
  }

  const dependsOnIds = deps.map((row) => row.depends_on_task_id);
  const [{ data: tasks }, satisfaction] = await Promise.all([
    supabase.from('tasks').select('id,title').in('id', dependsOnIds),
    resolveSatisfaction(supabase, dependsOnIds),
  ]);

  const titleById = new Map((tasks ?? []).map((task) => [task.id, task.title]));

  return deps.map((row) => ({
    id: row.id,
    dependsOnTaskId: row.depends_on_task_id,
    dependsOnTaskTitle: titleById.get(row.depends_on_task_id) ?? 'Unknown task',
    isSatisfied: satisfaction.get(row.depends_on_task_id) ?? true,
  }));
}

/** Used by changeAssignmentStatus to block completion while blocked. */
export async function hasUnsatisfiedDependencies(
  taskId: string,
): Promise<boolean> {
  const supabase = await createServerSupabase();
  const { data: deps } = await supabase
    .from('task_dependencies')
    .select('depends_on_task_id')
    .eq('task_id', taskId);

  if (!deps || deps.length === 0) {
    return false;
  }

  const satisfaction = await resolveSatisfaction(
    supabase,
    deps.map((row) => row.depends_on_task_id),
  );

  return Array.from(satisfaction.values()).some((satisfied) => !satisfied);
}
