import type { ReactNode } from 'react';

import { AppShell } from '@/components/app-shell';
import { requireMembership } from '@/modules/members/queries';

export default async function ProtectedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const membership = await requireMembership();

  return <AppShell role={membership.role}>{children}</AppShell>;
}
