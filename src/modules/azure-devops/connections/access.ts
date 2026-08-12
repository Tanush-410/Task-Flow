import 'server-only';

import { redirect } from 'next/navigation';

import { requireAdmin } from '@/modules/members/queries';
import type { MembershipContext } from '@/modules/members/context';
import { currentDeploymentEnvironment } from '@/modules/operations/deployment-environment';
import { evaluateFeatureFlag } from '@/modules/operations/feature-flags';

export async function requireAzureDevOpsAdmin(): Promise<MembershipContext> {
  const membership = await requireAdmin();
  let enabled = false;

  try {
    enabled = await evaluateFeatureFlag({
      key: 'azure_devops_integration',
      environment: currentDeploymentEnvironment(),
      userId: membership.userId,
      organizationId: membership.organizationId,
      role: membership.role,
    });
  } catch {
    enabled = false;
  }

  if (!enabled) redirect('/settings');

  return membership;
}
