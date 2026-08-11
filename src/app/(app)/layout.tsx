import type { ReactNode } from 'react';

import { AppShell } from '@/components/app-shell';
import {
  getCurrentProfile,
  requireMembership,
} from '@/modules/members/queries';
import { countUnreadNotifications } from '@/modules/notifications/queries';
import { currentDeploymentEnvironment } from '@/modules/operations/deployment-environment';
import { evaluateFeatureFlag } from '@/modules/operations/feature-flags';

export default async function ProtectedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const membership = await requireMembership();
  const [profile, unreadNotificationCount, planningEnabled] = await Promise.all(
    [
      getCurrentProfile(),
      countUnreadNotifications(),
      evaluateFeatureFlag({
        key: 'native_sprint_planning',
        environment: currentDeploymentEnvironment(),
        userId: membership.userId,
        organizationId: membership.organizationId,
        role: membership.role,
      }),
    ],
  );

  return (
    <AppShell
      displayName={profile.displayName || 'You'}
      planningEnabled={planningEnabled}
      role={membership.role}
      unreadNotificationCount={unreadNotificationCount}
      userId={membership.userId}
    >
      {children}
    </AppShell>
  );
}
