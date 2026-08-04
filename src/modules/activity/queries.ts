import 'server-only';

import { createServerSupabase } from '@/lib/supabase/server';

import { requireAdmin, requireMembership } from '../members/queries';

export async function listTaskActivity(taskId: string) {
  await requireMembership();
  const supabase = await createServerSupabase();

  return supabase
    .from('task_activity_events')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: false });
}

const ORGANIZATION_ACTIVITY_LIMIT = 100;

/**
 * Org-wide feed for admins. Relies on the same RLS predicate as
 * listTaskActivity (is_task_participant, which is_task_admin already
 * satisfies for every task in the admin's org) — no separate policy needed.
 */
export async function listOrganizationActivity() {
  const membership = await requireAdmin();
  const supabase = await createServerSupabase();

  return supabase
    .from('task_activity_events')
    .select('*')
    .eq('organization_id', membership.organizationId)
    .order('created_at', { ascending: false })
    .limit(ORGANIZATION_ACTIVITY_LIMIT);
}
