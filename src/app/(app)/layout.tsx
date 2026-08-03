import type { ReactNode } from 'react';

import { AppShell } from '@/components/app-shell';
import {
  getCurrentProfile,
  requireMembership,
} from '@/modules/members/queries';
import { countUnreadNotifications } from '@/modules/notifications/queries';

export default async function ProtectedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const membership = await requireMembership();
  const [profile, unreadNotificationCount] = await Promise.all([
    getCurrentProfile(),
    countUnreadNotifications(),
  ]);

  return (
    <AppShell
      displayName={profile.displayName || 'You'}
      role={membership.role}
      unreadNotificationCount={unreadNotificationCount}
      userId={membership.userId}
    >
      {children}
    </AppShell>
  );
}
