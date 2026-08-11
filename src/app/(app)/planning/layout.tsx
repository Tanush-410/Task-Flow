import type { ReactNode } from 'react';

import { notFound } from 'next/navigation';

import { requireMembership } from '@/modules/members/queries';
import { currentDeploymentEnvironment } from '@/modules/operations/deployment-environment';
import { evaluateFeatureFlag } from '@/modules/operations/feature-flags';

export default async function PlanningLayout({
  children,
}: {
  children: ReactNode;
}) {
  const membership = await requireMembership();
  const enabled = await evaluateFeatureFlag({
    key: 'native_sprint_planning',
    environment: currentDeploymentEnvironment(),
    userId: membership.userId,
    organizationId: membership.organizationId,
    role: membership.role,
  });

  if (!enabled) notFound();

  return children;
}
