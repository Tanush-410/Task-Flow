import 'server-only';

import { createServerSupabase } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/database.types';

import { requireMembership } from '../members/queries';

export async function listMyAssignments() {
  const membership = await requireMembership();
  const supabase = await createServerSupabase();

  return supabase
    .from('task_assignments')
    .select('*')
    .eq('assignee_id', membership.userId)
    .order('created_at', { ascending: false });
}

export type MyAssignmentWithTask = {
  assignment: Database['public']['Tables']['task_assignments']['Row'];
  task: Database['public']['Tables']['tasks']['Row'];
};

export async function listMyAssignmentsWithTasks(): Promise<
  MyAssignmentWithTask[]
> {
  const membership = await requireMembership();
  const supabase = await createServerSupabase();

  const { data: assignments, error } = await supabase
    .from('task_assignments')
    .select('*')
    .eq('assignee_id', membership.userId)
    .order('created_at', { ascending: false });

  if (error || !assignments || assignments.length === 0) {
    return [];
  }

  const taskIds = Array.from(new Set(assignments.map((row) => row.task_id)));
  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .in('id', taskIds);
  const taskById = new Map((tasks ?? []).map((task) => [task.id, task]));

  const rows: MyAssignmentWithTask[] = [];
  for (const assignment of assignments) {
    const task = taskById.get(assignment.task_id);
    if (task) {
      rows.push({ assignment, task });
    }
  }

  return rows;
}

export async function getAssignmentById(assignmentId: string) {
  await requireMembership();
  const supabase = await createServerSupabase();

  return supabase
    .from('task_assignments')
    .select('*')
    .eq('id', assignmentId)
    .maybeSingle();
}
