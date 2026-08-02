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
