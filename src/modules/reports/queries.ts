import 'server-only';

import { createServerSupabase } from '@/lib/supabase/server';

import { listOrganizationMembers, requireAdmin } from '../members/queries';

export type EmployeeCompletionStat = {
  userId: string;
  displayName: string;
  completedCount: number;
  onTimeCount: number;
  onTimePercentage: number;
};

export async function getEmployeeCompletionReport(): Promise<
  EmployeeCompletionStat[]
> {
  const membership = await requireAdmin();
  const supabase = await createServerSupabase();

  const [{ data: assignments }, members] = await Promise.all([
    supabase
      .from('task_assignments')
      .select('assignee_id,status,completed_at,task_id')
      .eq('organization_id', membership.organizationId)
      .eq('status', 'completed'),
    listOrganizationMembers(),
  ]);

  const completedRows = assignments ?? [];
  const taskIds = Array.from(new Set(completedRows.map((row) => row.task_id)));
  const { data: tasks } = await supabase
    .from('tasks')
    .select('id,due_at')
    .in('id', taskIds);
  const dueAtByTaskId = new Map(
    (tasks ?? []).map((task) => [task.id, task.due_at]),
  );

  const statsByUser = new Map<string, { completed: number; onTime: number }>();

  for (const row of completedRows) {
    const stat = statsByUser.get(row.assignee_id) ?? {
      completed: 0,
      onTime: 0,
    };
    stat.completed += 1;

    const dueAt = dueAtByTaskId.get(row.task_id);
    if (
      !dueAt ||
      (row.completed_at && new Date(row.completed_at) <= new Date(dueAt))
    ) {
      stat.onTime += 1;
    }

    statsByUser.set(row.assignee_id, stat);
  }

  return members
    .filter((member) => member.role === 'employee')
    .map((member) => {
      const stat = statsByUser.get(member.userId) ?? {
        completed: 0,
        onTime: 0,
      };

      return {
        userId: member.userId,
        displayName: member.displayName,
        completedCount: stat.completed,
        onTimeCount: stat.onTime,
        onTimePercentage:
          stat.completed === 0
            ? 0
            : Math.round((stat.onTime / stat.completed) * 100),
      };
    })
    .sort((a, b) => b.completedCount - a.completedCount);
}
