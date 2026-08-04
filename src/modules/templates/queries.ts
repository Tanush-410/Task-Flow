import 'server-only';

import { createServerSupabase } from '@/lib/supabase/server';

import { requireMembership } from '../members/queries';

export async function listTaskTemplates() {
  const membership = await requireMembership();
  const supabase = await createServerSupabase();

  return supabase
    .from('task_templates')
    .select('*')
    .eq('organization_id', membership.organizationId)
    .order('created_at', { ascending: false });
}
