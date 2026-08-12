import 'server-only';

import { redirect } from 'next/navigation';

import { getMembershipAccess } from '@/modules/members/queries';
import type { MembershipContext } from '@/modules/members/context';
import { currentDeploymentEnvironment } from '@/modules/operations/deployment-environment';
import { evaluateFeatureFlag } from '@/modules/operations/feature-flags';

export type AzureDevOpsAdminAccess =
  | { kind: 'allowed'; membership: MembershipContext }
  | {
      kind: 'redirect';
      location: '/login' | '/access-pending' | '/my-day' | '/settings';
    };

export async function getAzureDevOpsAdminAccess(): Promise<AzureDevOpsAdminAccess> {
  const access = await getMembershipAccess();
  if (access.kind === 'redirect') return access;

  const { membership } = access;
  if (membership.role !== 'admin') {
    return { kind: 'redirect', location: '/my-day' };
  }

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

  if (!enabled) return { kind: 'redirect', location: '/settings' };

  return { kind: 'allowed', membership };
}

export async function requireAzureDevOpsAdmin(): Promise<MembershipContext> {
  const access = await getAzureDevOpsAdminAccess();
  if (access.kind === 'redirect') redirect(access.location);

  return access.membership;
}
