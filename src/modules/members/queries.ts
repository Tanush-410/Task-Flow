import { redirect } from 'next/navigation';

import { createServerSupabase } from '@/lib/supabase/server';

export type MembershipContext = {
  organizationId: string;
  userId: string;
  role: 'admin' | 'employee';
};

export function requireSingleMembership(
  items: MembershipContext[],
): MembershipContext {
  if (items.length !== 1) {
    throw new Error('ACTIVE_MEMBERSHIP_REQUIRED');
  }

  return items[0];
}

export async function requireMembership(): Promise<MembershipContext> {
  const supabase = await createServerSupabase();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;

  if (!userId) {
    redirect('/login');
  }

  const { data, error } = await supabase
    .from('organization_memberships')
    .select('organization_id,user_id,role')
    .eq('user_id', userId)
    .eq('status', 'active');

  if (error || !data) {
    redirect('/login');
  }

  return requireSingleMembership(
    data.map((item) => ({
      organizationId: item.organization_id,
      userId: item.user_id,
      role: item.role,
    })),
  );
}

export async function requireAdmin(): Promise<MembershipContext> {
  const membership = await requireMembership();

  if (membership.role !== 'admin') {
    redirect('/my-day');
  }

  return membership;
}
