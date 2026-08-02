import 'server-only';

import { createServerSupabase } from '@/lib/supabase/server';

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

export async function getAssignmentById(assignmentId: string) {
  await requireMembership();
  const supabase = await createServerSupabase();

  return supabase
    .from('task_assignments')
    .select('*')
    .eq('id', assignmentId)
    .maybeSingle();
}
