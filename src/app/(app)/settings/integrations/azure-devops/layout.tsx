import type { ReactNode } from 'react';

import { requireAzureDevOpsAdmin } from '@/modules/azure-devops/connections/access';

export default async function AzureDevOpsIntegrationLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireAzureDevOpsAdmin();

  return children;
}
