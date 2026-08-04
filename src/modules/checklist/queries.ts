import 'server-only';

import { createServerSupabase } from '@/lib/supabase/server';

import { requireMembership } from '../members/queries';

export async function listChecklistItems(taskId: string) {
  await requireMembership();
  const supabase = await createServerSupabase();

  return supabase
    .from('task_checklist_items')
    .select('*')
    .eq('task_id', taskId)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });
}
