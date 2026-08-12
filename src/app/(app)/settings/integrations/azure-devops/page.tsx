import { PageHeader } from '@/components/ui/page-header';
import { AzureDevOpsConnectionForm } from '@/components/integrations/azure-devops-connection-form';
import { AzureDevOpsTeamMappingForm } from '@/components/integrations/azure-devops-team-mapping-form';
import { getAzureDevOpsConnectionSetup } from '@/modules/azure-devops/connections/queries';

export default async function AzureDevOpsIntegrationPage() {
  const { connection, planningTeams } = await getAzureDevOpsConnectionSetup();

  return (
    <section aria-labelledby="azure-devops-heading" className="space-y-6">
      <PageHeader
        description="Connect Microsoft Entra to discover Azure DevOps organizations and map a planning team before starting synchronization."
        eyebrow="Integrations"
        headingId="azure-devops-heading"
        title="Azure DevOps"
      />

      <AzureDevOpsConnectionForm connection={connection} />

      {connection && connection.status !== 'disconnected' ? (
        <AzureDevOpsTeamMappingForm
          connection={connection}
          planningTeams={planningTeams}
        />
      ) : null}
    </section>
  );
}
