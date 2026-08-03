import 'server-only';

import { createServerSupabase } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/database.types';

import { requireMembership } from '../members/queries';

export type TaskNotificationType =
  Database['public']['Enums']['task_notification_type'];

export type TaskNotificationInput = {
  organizationId: string;
  recipientId: string;
  taskId?: string | null;
  assignmentId?: string | null;
  notificationType: TaskNotificationType;
  title: string;
  body: string;
};

export async function listMyNotifications() {
  const membership = await requireMembership();
  const supabase = await createServerSupabase();

  return supabase
    .from('task_notifications')
    .select('*')
    .eq('recipient_id', membership.userId)
    .order('created_at', { ascending: false })
    .limit(50);
}

export async function countUnreadNotifications(): Promise<number> {
  const membership = await requireMembership();
  const supabase = await createServerSupabase();
  const { count, error } = await supabase
    .from('task_notifications')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', membership.userId)
    .is('read_at', null);

  if (error) {
    return 0;
  }

  return count ?? 0;
}
