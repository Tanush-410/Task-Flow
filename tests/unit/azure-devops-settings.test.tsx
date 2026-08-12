import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  currentDeploymentEnvironment: vi.fn(),
  disconnectAzureDevOps: vi.fn(),
  evaluateFeatureFlag: vi.fn(),
  getAzureDevOpsConnectionSetup: vi.fn(),
  getCurrentOrganization: vi.fn(),
  getOwnConnectCode: vi.fn(),
  listAccessibleAzureOrganizations: vi.fn(),
  listAzureProjects: vi.fn(),
  listAzureTeams: vi.fn(),
  refresh: vi.fn(),
  requireAdmin: vi.fn(),
  requireAzureDevOpsAdmin: vi.fn(),
  saveAzureTeamLink: vi.fn(),
  selectAzureOrganization: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock('@/modules/azure-devops/connections/actions', () => ({
  disconnectAzureDevOps: mocks.disconnectAzureDevOps,
  listAccessibleAzureOrganizations: mocks.listAccessibleAzureOrganizations,
  listAzureProjects: mocks.listAzureProjects,
  listAzureTeams: mocks.listAzureTeams,
  saveAzureTeamLink: mocks.saveAzureTeamLink,
  selectAzureOrganization: mocks.selectAzureOrganization,
}));
vi.mock('@/modules/azure-devops/connections/queries', () => ({
  getAzureDevOpsConnectionSetup: mocks.getAzureDevOpsConnectionSetup,
}));
vi.mock('@/modules/azure-devops/connections/access', () => ({
  requireAzureDevOpsAdmin: mocks.requireAzureDevOpsAdmin,
}));
vi.mock('@/modules/auth/actions', () => ({ signOut: mocks.signOut }));
vi.mock('@/modules/members/queries', () => ({
  getOwnConnectCode: mocks.getOwnConnectCode,
  requireAdmin: mocks.requireAdmin,
}));
vi.mock('@/modules/operations/deployment-environment', () => ({
  currentDeploymentEnvironment: mocks.currentDeploymentEnvironment,
}));
vi.mock('@/modules/operations/feature-flags', () => ({
  evaluateFeatureFlag: mocks.evaluateFeatureFlag,
}));
vi.mock('@/modules/organizations/queries', () => ({
  getCurrentOrganization: mocks.getCurrentOrganization,
}));

import { AzureDevOpsConnectionForm } from '@/components/integrations/azure-devops-connection-form';
import { AzureDevOpsTeamMappingForm } from '@/components/integrations/azure-devops-team-mapping-form';
import type { AzureDevOpsConnectionView } from '@/modules/azure-devops/connections/queries';
import type { PlanningTeamSummary } from '@/modules/planning-teams/queries';
import AzureDevOpsIntegrationPage from '@/app/(app)/settings/integrations/azure-devops/page';
import SettingsPage from '@/app/(app)/settings/page';

const planningTeam = (
  overrides: Partial<PlanningTeamSummary> = {},
): PlanningTeamSummary => ({
  id: 'team-1',
  name: 'Platform',
  description: '',
  defaultSprintLengthDays: 14,
  isArchived: false,
  memberCount: 3,
  currentUserRole: 'planner',
  ...overrides,
});

const baseConnection: AzureDevOpsConnectionView = {
  id: 'connection-1',
  status: 'pending',
  authorizedUser: {
    displayName: 'Ada Azure',
    email: 'ada.azure@example.test',
  },
  organization: null,
  lastVerifiedAt: null,
  safeErrorCode: null,
  teamLinks: [],
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('AzureDevOpsConnectionForm', () => {
  it('shows a POST-based connect form when disconnected', () => {
    render(<AzureDevOpsConnectionForm connection={null} />);

    expect(screen.getByText('Not connected')).toBeVisible();
    const form = screen
      .getByRole('button', {
        name: 'Connect Azure DevOps',
      })
      .closest('form');
    expect(form).toHaveAttribute(
      'action',
      '/api/integrations/azure-devops/connect',
    );
    expect(form).toHaveAttribute('method', 'POST');
    expect(screen.queryByText('Disconnect')).toBeNull();
  });

  it('shows pending setup with disconnect available', () => {
    render(<AzureDevOpsConnectionForm connection={baseConnection} />);

    expect(screen.getByText('Pending setup')).toBeVisible();
    expect(screen.getByText('Ada Azure', { exact: false })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Disconnect' })).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Connect Azure DevOps' }),
    ).toBeNull();
  });

  it('shows the configured organization and a ready-for-import badge', () => {
    render(
      <AzureDevOpsConnectionForm
        connection={{
          ...baseConnection,
          status: 'configured',
          organization: {
            id: 'org-1',
            name: 'Contoso',
            url: 'https://dev.azure.com/contoso',
          },
        }}
      />,
    );

    expect(screen.getByText('Ready for initial import')).toBeVisible();
    expect(screen.getByText('Contoso')).toBeVisible();
  });

  it('shows reconnect guidance when paused', () => {
    render(
      <AzureDevOpsConnectionForm
        connection={{ ...baseConnection, status: 'paused' }}
      />,
    );

    expect(screen.getByText('Reconnect required')).toBeVisible();
    expect(
      screen.getByText('Azure DevOps needs to be reconnected'),
    ).toBeVisible();
    const form = screen
      .getByRole('button', {
        name: 'Reconnect Azure DevOps',
      })
      .closest('form');
    expect(form).toHaveAttribute(
      'action',
      '/api/integrations/azure-devops/connect',
    );
    expect(screen.queryByRole('button', { name: 'Disconnect' })).toBeNull();
  });

  it('never renders ciphertext or provider secrets', () => {
    render(
      <AzureDevOpsConnectionForm
        connection={{
          ...baseConnection,
          status: 'configured',
          organization: {
            id: 'org-1',
            name: 'Contoso',
            url: 'https://dev.azure.com/contoso',
          },
        }}
      />,
    );

    const text = document.body.textContent ?? '';
    expect(text).not.toMatch(/ciphertext/i);
    expect(text).not.toMatch(/bearer/i);
    expect(text).not.toMatch(/access[-_ ]?token/i);
  });

  it('requires confirmation before disconnecting and describes preserved data', async () => {
    mocks.disconnectAzureDevOps.mockResolvedValue({
      ok: true,
      data: undefined,
    });
    render(<AzureDevOpsConnectionForm connection={baseConnection} />);

    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));

    expect(
      screen.getByText(/Planning teams and their mappings are preserved/i),
    ).toBeVisible();
    expect(mocks.disconnectAzureDevOps).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm disconnect' }));

    await waitFor(() => {
      expect(mocks.disconnectAzureDevOps).toHaveBeenCalledOnce();
    });
    await waitFor(() => {
      expect(mocks.refresh).toHaveBeenCalledOnce();
    });
  });

  it('cancels the confirmation without disconnecting', () => {
    render(<AzureDevOpsConnectionForm connection={baseConnection} />);

    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByRole('button', { name: 'Disconnect' })).toBeVisible();
    expect(mocks.disconnectAzureDevOps).not.toHaveBeenCalled();
  });

  it('shows a safe error and does not refresh when disconnect fails', async () => {
    mocks.disconnectAzureDevOps.mockResolvedValue({
      ok: false,
      error: {
        code: 'AZURE_DEVOPS_ACTION_FAILED',
        message: 'The Azure DevOps action could not be completed.',
        traceId: 'trace-123',
      },
    });
    render(<AzureDevOpsConnectionForm connection={baseConnection} />);

    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm disconnect' }));

    await waitFor(() => {
      expect(
        screen.getByText('The Azure DevOps action could not be completed.'),
      ).toBeVisible();
    });
    expect(screen.getByText(/trace-123/)).toBeVisible();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});

describe('AzureDevOpsTeamMappingForm', () => {
  beforeEach(() => {
    mocks.listAccessibleAzureOrganizations.mockResolvedValue({
      ok: true,
      data: [],
    });
    mocks.listAzureProjects.mockResolvedValue({ ok: true, data: [] });
  });

  it('offers organization selection once discovery resolves', async () => {
    mocks.listAccessibleAzureOrganizations.mockResolvedValue({
      ok: true,
      data: [
        {
          id: 'account-1',
          name: 'Contoso',
          url: 'https://dev.azure.com/contoso',
        },
      ],
    });

    render(
      <AzureDevOpsTeamMappingForm
        connection={baseConnection}
        planningTeams={[planningTeam()]}
      />,
    );

    expect(screen.getByLabelText('Azure DevOps organization')).toBeVisible();
    await waitFor(() => {
      expect(
        screen.getByRole('combobox', { name: 'Azure DevOps organization' }),
      ).not.toBeDisabled();
    });
    expect(
      screen.getByRole('button', { name: 'Use this organization' }),
    ).toBeDisabled();
  });

  it('shows existing team links with sanitized details', () => {
    render(
      <AzureDevOpsTeamMappingForm
        connection={{
          ...baseConnection,
          status: 'configured',
          organization: {
            id: 'org-1',
            name: 'Contoso',
            url: 'https://dev.azure.com/contoso',
          },
          teamLinks: [
            {
              id: 'link-1',
              planningTeamId: 'team-1',
              azureProjectName: 'Platform Delivery',
              azureTeamName: 'Delivery',
              status: 'configured',
            },
          ],
        }}
        planningTeams={[
          planningTeam(),
          planningTeam({ id: 'team-2', name: 'Growth' }),
        ]}
      />,
    );

    expect(screen.getByText('Platform')).toBeVisible();
    expect(screen.getByText('Platform Delivery / Delivery')).toBeVisible();
    expect(screen.getByText('Ready for initial import')).toBeVisible();
  });

  it('offers project and team selectors once the organization is selected', async () => {
    mocks.listAzureProjects.mockResolvedValue({
      ok: true,
      data: [{ id: 'project-1', name: 'Platform' }],
    });

    render(
      <AzureDevOpsTeamMappingForm
        connection={{
          ...baseConnection,
          organization: {
            id: 'org-1',
            name: 'Contoso',
            url: 'https://dev.azure.com/contoso',
          },
        }}
        planningTeams={[planningTeam()]}
      />,
    );

    expect(screen.getByLabelText('Azure project')).toBeVisible();
    expect(screen.getByLabelText('Azure team')).toBeVisible();
    expect(screen.getByLabelText('TaskFlow planning team')).toBeVisible();
    expect(screen.getByRole('combobox', { name: 'Azure team' })).toBeDisabled();

    await waitFor(() => {
      expect(
        screen.getByRole('combobox', { name: 'Azure project' }),
      ).not.toBeDisabled();
    });
    expect(
      screen.getByRole('button', { name: 'Map planning team' }),
    ).toBeDisabled();
  });

  it('tells the admin when every visible planning team is already mapped', () => {
    render(
      <AzureDevOpsTeamMappingForm
        connection={{
          ...baseConnection,
          organization: {
            id: 'org-1',
            name: 'Contoso',
            url: 'https://dev.azure.com/contoso',
          },
          teamLinks: [
            {
              id: 'link-1',
              planningTeamId: 'team-1',
              azureProjectName: 'Platform',
              azureTeamName: 'Delivery',
              status: 'configured',
            },
          ],
        }}
        planningTeams={[planningTeam()]}
      />,
    );

    expect(
      screen.getByText(
        'Every visible planning team is already mapped to an Azure DevOps team.',
      ),
    ).toBeVisible();
  });
});

describe('Settings page', () => {
  beforeEach(() => {
    mocks.requireAdmin.mockResolvedValue({
      organizationId: 'org-1',
      userId: 'user-1',
      role: 'admin',
    });
    mocks.getCurrentOrganization.mockResolvedValue({
      data: { name: 'Acme', timezone: 'UTC' },
    });
    mocks.getOwnConnectCode.mockResolvedValue(null);
    mocks.currentDeploymentEnvironment.mockReturnValue('staging');
    mocks.listAccessibleAzureOrganizations.mockResolvedValue({
      ok: true,
      data: [],
    });
    mocks.listAzureProjects.mockResolvedValue({ ok: true, data: [] });
  });

  it('shows the Azure DevOps card only when the integration flag is enabled', async () => {
    mocks.evaluateFeatureFlag.mockResolvedValue(true);

    render(await SettingsPage());

    const link = screen.getByRole('link', { name: 'Manage Azure DevOps' });
    expect(link).toHaveAttribute('href', '/settings/integrations/azure-devops');
  });

  it('hides the Azure DevOps card when the integration flag is disabled', async () => {
    mocks.evaluateFeatureFlag.mockResolvedValue(false);

    render(await SettingsPage());

    expect(
      screen.queryByRole('link', { name: 'Manage Azure DevOps' }),
    ).toBeNull();
  });

  it('fails closed and hides the card when the flag check throws', async () => {
    mocks.evaluateFeatureFlag.mockRejectedValue(
      new Error('flag lookup failed'),
    );

    render(await SettingsPage());

    expect(
      screen.queryByRole('link', { name: 'Manage Azure DevOps' }),
    ).toBeNull();
  });
});

describe('Azure DevOps integration page', () => {
  beforeEach(() => {
    mocks.listAccessibleAzureOrganizations.mockResolvedValue({
      ok: true,
      data: [],
    });
    mocks.listAzureProjects.mockResolvedValue({ ok: true, data: [] });
  });

  it('does not render team mapping before a connection exists', async () => {
    mocks.getAzureDevOpsConnectionSetup.mockResolvedValue({
      connection: null,
      planningTeams: [],
    });

    render(await AzureDevOpsIntegrationPage());

    expect(screen.getByRole('heading', { name: 'Azure DevOps' })).toBeVisible();
    expect(screen.getByText('Not connected')).toBeVisible();
    expect(screen.queryByText('Team mapping')).toBeNull();
  });

  it('renders team mapping once a connection exists', async () => {
    mocks.getAzureDevOpsConnectionSetup.mockResolvedValue({
      connection: baseConnection,
      planningTeams: [planningTeam()],
    });

    render(await AzureDevOpsIntegrationPage());

    expect(screen.getByText('Pending setup')).toBeVisible();
    expect(screen.getByText('Team mapping')).toBeVisible();
  });
});
