import 'server-only';

import { createAdminSupabase } from '@/lib/supabase/admin';
import { createServerSupabase } from '@/lib/supabase/server';

import { requireAdmin } from '../members/queries';

export type SignupOrganizationOption = { id: string; name: string };

export async function listOrganizationsForSignup(): Promise<
  SignupOrganizationOption[]
> {
  const admin = createAdminSupabase();
  const { data, error } = await admin
    .from('organizations')
    .select('id,name')
    .order('name', { ascending: true });

  if (error || !data) {
    return [];
  }

  return data;
}

export async function getCurrentOrganization() {
  const membership = await requireAdmin();
  const supabase = await createServerSupabase();

  return supabase
    .from('organizations')
    .select('*')
    .eq('id', membership.organizationId)
    .maybeSingle();
}
