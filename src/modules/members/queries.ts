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
