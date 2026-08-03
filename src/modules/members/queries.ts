import 'server-only';

import { redirect } from 'next/navigation';

import { createServerSupabase } from '@/lib/supabase/server';

import {
  resolveMembershipAccess,
  type MembershipAccess,
  type MembershipContext,
} from './context';

export type { MembershipContext } from './context';
export { requireSingleMembership } from './context';

export async function getMembershipAccess(): Promise<MembershipAccess> {
  const supabase = await createServerSupabase();
  return resolveMembershipAccess(
    () => supabase.auth.getClaims(),
    async (userId) => {
      const { data, error } = await supabase
        .from('organization_memberships')
        .select('organization_id,user_id,role')
        .eq('user_id', userId)
        .eq('status', 'active');

      return { data, error };
    },
  );
}

export async function requireMembership(): Promise<MembershipContext> {
  const access = await getMembershipAccess();

  if (access.kind === 'redirect') {
    redirect(access.location);
  }

  return access.membership;
}

export async function requireAdmin(): Promise<MembershipContext> {
  const membership = await requireMembership();

  if (membership.role !== 'admin') {
    redirect('/my-day');
  }

  return membership;
}

export async function requireEmployee(): Promise<MembershipContext> {
  const membership = await requireMembership();

  if (membership.role !== 'employee') {
    redirect('/dashboard');
  }

  return membership;
}

export async function getCurrentProfile(): Promise<{
  displayName: string;
  role: MembershipContext['role'];
}> {
  const membership = await requireMembership();
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', membership.userId)
    .maybeSingle();

  return { displayName: data?.display_name ?? '', role: membership.role };
}

export type OrganizationMember = {
  id: string;
  userId: string;
  role: MembershipContext['role'];
  status: 'active' | 'deactivated';
  displayName: string;
};

export async function listOrganizationMembers(): Promise<OrganizationMember[]> {
  const membership = await requireAdmin();
  const supabase = await createServerSupabase();

  const { data: memberships, error } = await supabase
    .from('organization_memberships')
    .select('id,role,status,user_id,created_at')
    .eq('organization_id', membership.organizationId)
    .order('created_at', { ascending: true });

  if (error || !memberships) {
    return [];
  }

  const userIds = memberships.map((row) => row.user_id);
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id,display_name')
    .in('id', userIds);

  const displayNameById = new Map(
    (profiles ?? []).map((profile) => [profile.id, profile.display_name]),
  );

  return memberships.map((row) => ({
    id: row.id,
    userId: row.user_id,
    role: row.role,
    status: row.status,
    displayName: displayNameById.get(row.user_id) ?? 'Unknown',
  }));
}

export async function listDisplayNames(
  userIds: string[],
): Promise<Map<string, string>> {
  const uniqueIds = Array.from(new Set(userIds));

  if (uniqueIds.length === 0) {
    return new Map();
  }

  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from('profiles')
    .select('id,display_name')
    .in('id', uniqueIds);

  return new Map((data ?? []).map((row) => [row.id, row.display_name]));
}

export async function listOrganizationAdmins(
  organizationId: string,
): Promise<string[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('organization_memberships')
    .select('user_id')
    .eq('organization_id', organizationId)
    .eq('role', 'admin')
    .eq('status', 'active');

  if (error || !data) {
    return [];
  }

  return data.map((row) => row.user_id);
}
