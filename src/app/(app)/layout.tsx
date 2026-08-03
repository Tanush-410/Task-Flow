import type { ReactNode } from 'react';

import { AppShell } from '@/components/app-shell';
import { requireMembership } from '@/modules/members/queries';
import { countUnreadNotifications } from '@/modules/notifications/queries';

export default async function ProtectedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const membership = await requireMembership();
  const unreadNotificationCount = await countUnreadNotifications();

  return (
    <AppShell
      role={membership.role}
      unreadNotificationCount={unreadNotificationCount}
      userId={membership.userId}
    >
      {children}
    </AppShell>
  );
}
