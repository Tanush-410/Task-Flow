import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createAdminSupabase: vi.fn(),
  createAzureDevOpsClient: vi.fn(),
  createServerSupabase: vi.fn(),
  listAzureAccounts: vi.fn(),
  listAzureProjects: vi.fn(),
  listAzureTeams: vi.fn(),
  refreshEntraTokens: vi.fn(),
  requireAzureDevOpsAdmin: vi.fn(),
  revalidatePath: vi.fn(),
  serverEnv: vi.fn(),
  shouldRefreshToken: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock('@/lib/server-env', () => ({ serverEnv: mocks.serverEnv }));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabase: mocks.createAdminSupabase,
}));
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabase: mocks.createServerSupabase,
}));
vi.mock('@/modules/azure-devops/connections/access', () => ({
  requireAzureDevOpsAdmin: mocks.requireAzureDevOpsAdmin,
}));
vi.mock('@/modules/azure-devops/auth/entra', () => ({
  refreshEntraTokens: mocks.refreshEntraTokens,
  shouldRefreshToken: mocks.shouldRefreshToken,
}));
vi.mock('@/modules/azure-devops/client/discovery', () => ({
  listAzureAccounts: mocks.listAzureAccounts,
  listAzureProjects: mocks.listAzureProjects,
  listAzureTeams: mocks.listAzureTeams,
}));
vi.mock('@/modules/azure-devops/client/http', async () => {
  const actual = await vi.importActual<
    typeof import('@/modules/azure-devops/client/http')
  >('@/modules/azure-devops/client/http');
  return {
    AzureDevOpsError: actual.AzureDevOpsError,
    createAzureDevOpsClient: mocks.createAzureDevOpsClient,
  };
});

import { encryptSecret } from '@/modules/azure-devops/auth/crypto';
import { AzureDevOpsError } from '@/modules/azure-devops/client/http';
import {
  disconnectAzureDevOps,
  listAccessibleAzureOrganizations,
  listAzureProjects,
  listAzureTeams,
  saveAzureTeamLink,
  selectAzureOrganization,
} from '@/modules/azure-devops/connections/actions';

type QueryResult = { data?: unknown; error?: unknown };

function query(result: QueryResult = { data: null, error: null }) {
  const builder = {
    delete: vi.fn(),
    eq: vi.fn(),
    insert: vi.fn(),
    maybeSingle: vi.fn(),
    order: vi.fn(),
    select: vi.fn(),
    single: vi.fn(),
    then: (
      resolve: (value: QueryResult) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => Promise.resolve(result).then(resolve, reject),
    update: vi.fn(),
  };

  for (const method of [
    'delete',
    'eq',
    'insert',
    'order',
    'select',
    'update',
  ] as const) {
    builder[method].mockReturnValue(builder);
  }
  builder.single.mockResolvedValue(result);
  builder.maybeSingle.mockResolvedValue(result);
  return builder;
}

const organizationId = '10000000-0000-4000-8000-000000000001';
const userId = '20000000-0000-4000-8000-000000000002';
const connectionId = '30000000-0000-4000-8000-000000000003';
const authorizedUserId = '50000000-0000-4000-8000-000000000005';
const planningTeamId = '40000000-0000-4000-8000-000000000004';
const azureAccountId = '60000000-0000-4000-8000-000000000006';
const azureProjectId = '70000000-0000-4000-8000-000000000007';
const azureTeamId = '80000000-0000-4000-8000-000000000008';
const futureExpiry = '2099-01-01T00:00:00.000Z';

const membership = {
  organizationId,
  userId,
  role: 'admin' as const,
};

const environment = {
  APP_ORIGIN: 'https://taskflow.example',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role',
  AZURE_DEVOPS_ENTRA_TENANT_ID: 'tenant-id',
  AZURE_DEVOPS_ENTRA_CLIENT_ID: '90000000-0000-4000-8000-000000000009',
  AZURE_DEVOPS_ENTRA_CLIENT_SECRET: 'client-secret',
  AZURE_DEVOPS_OAUTH_SCOPES:
    'offline_access 499b84ac-1321-427f-aa17-267ca6975798/.default',
  AZURE_DEVOPS_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 9).toString('base64'),
  AZURE_DEVOPS_TOKEN_KEY_ID: 'azure.key-1',
};

function encryptedFixture(plaintext: string): string {
  const key = {
    id: environment.AZURE_DEVOPS_TOKEN_KEY_ID,
    bytes: new Uint8Array(
      Buffer.from(environment.AZURE_DEVOPS_TOKEN_ENCRYPTION_KEY, 'base64'),
    ),
  };
  return encryptSecret(plaintext, key);
}

function connectionRow(overrides: Record<string, unknown> = {}): QueryResult {
  return {
    data: {
      id: connectionId,
      organization_id: organizationId,
      authorized_user_id: authorizedUserId,
      access_token_ciphertext: encryptedFixture('access-token-plain'),
      refresh_token_ciphertext: encryptedFixture('refresh-token-plain'),
      token_expires_at: futureExpiry,
      azure_organization_id: azureAccountId,
      azure_organization_name: 'Contoso',
      azure_organization_url: 'https://dev.azure.com/contoso',
      ...overrides,
    },
    error: null,
  };
}

const azureAccount = {
  id: azureAccountId,
  name: 'Contoso',
  url: 'https://dev.azure.com/contoso',
};
const azureProject = { id: azureProjectId, name: 'Platform' };
const azureTeam = { id: azureTeamId, name: 'Delivery' };

let adminFromQueue: ReturnType<typeof query>[];
let adminRpc: ReturnType<typeof vi.fn>;

function makeAdmin() {
  adminFromQueue = [];
  adminRpc = vi.fn();
  const admin = {
    from: vi.fn(() => {
      const next = adminFromQueue.shift();
      if (!next) throw new Error('Unexpected admin.from() call in test');
      return next;
    }),
    rpc: adminRpc,
  };
  mocks.createAdminSupabase.mockReturnValue(admin);
  return admin;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAzureDevOpsAdmin.mockResolvedValue(membership);
  mocks.serverEnv.mockReturnValue(environment);
  mocks.shouldRefreshToken.mockReturnValue(false);
  mocks.createAzureDevOpsClient.mockReturnValue({});
  makeAdmin();
});

describe('listAccessibleAzureOrganizations', () => {
  it('requires an authorized connection before discovery', async () => {
    adminFromQueue.push(query({ data: null, error: null }));

    const result = await listAccessibleAzureOrganizations();

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'AZURE_RECONNECT_REQUIRED' },
    });
    expect(mocks.listAzureAccounts).not.toHaveBeenCalled();
  });

  it('discovers accounts for the authorized member id', async () => {
    adminFromQueue.push(query(connectionRow()));
    mocks.listAzureAccounts.mockResolvedValue([azureAccount]);

    const result = await listAccessibleAzureOrganizations();

    expect(result).toEqual({ ok: true, data: [azureAccount] });
    expect(mocks.listAzureAccounts).toHaveBeenCalledWith({}, authorizedUserId);
  });

  it('refreshes an expiring token before discovery and persists it', async () => {
    adminFromQueue.push(
      query(connectionRow({ token_expires_at: '2020-01-01T00:00:00.000Z' })),
    );
    const update = query({ error: null });
    adminFromQueue.push(update);
    mocks.shouldRefreshToken.mockReturnValue(true);
    mocks.refreshEntraTokens.mockResolvedValue({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
      expiresAt: futureExpiry,
      grantedScopes: ['offline_access'],
    });
    mocks.listAzureAccounts.mockResolvedValue([azureAccount]);

    const result = await listAccessibleAzureOrganizations();

    expect(result).toEqual({ ok: true, data: [azureAccount] });
    expect(update.update).toHaveBeenCalledWith(
      expect.objectContaining({
        access_token_ciphertext: expect.any(String),
        refresh_token_ciphertext: expect.any(String),
        token_expires_at: futureExpiry,
      }),
    );
    expect(update.eq).toHaveBeenCalledWith('id', connectionId);
  });

  it('pauses the connection and fails safely when refresh is rejected', async () => {
    adminFromQueue.push(
      query(connectionRow({ token_expires_at: '2020-01-01T00:00:00.000Z' })),
    );
    const pause = query({ error: null });
    adminFromQueue.push(pause);
    mocks.shouldRefreshToken.mockReturnValue(true);
    mocks.refreshEntraTokens.mockRejectedValue(new Error('provider rejected'));

    const result = await listAccessibleAzureOrganizations();

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'AZURE_RECONNECT_REQUIRED' },
    });
    expect(pause.update).toHaveBeenCalledWith({
      status: 'paused',
      safe_error_code: 'AZURE_RECONNECT_REQUIRED',
    });
    expect(JSON.stringify(result)).not.toContain('provider rejected');
  });

  it('does not query the database when the caller is not an authorized admin', async () => {
    mocks.requireAzureDevOpsAdmin.mockRejectedValue(
      new Error('REDIRECT:/login'),
    );

    const result = await listAccessibleAzureOrganizations();

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'AZURE_DEVOPS_ACTION_FAILED' },
    });
    expect(mocks.createAdminSupabase).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain('/login');
  });

  it('maps provider errors to safe stable codes', async () => {
    adminFromQueue.push(query(connectionRow()));
    mocks.listAzureAccounts.mockRejectedValue(
      new AzureDevOpsError('AZURE_UNAVAILABLE'),
    );

    const result = await listAccessibleAzureOrganizations();

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'AZURE_DEVOPS_UNAVAILABLE' },
    });
  });
});

describe('selectAzureOrganization', () => {
  it('rejects an invalid account id before authorization', async () => {
    const result = await selectAzureOrganization({ azureAccountId: 'nope' });

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'INVALID_AZURE_DEVOPS_INPUT' },
    });
    expect(mocks.requireAzureDevOpsAdmin).not.toHaveBeenCalled();
  });

  it('rediscovers the account server-side and ignores client-supplied names', async () => {
    adminFromQueue.push(query(connectionRow()));
    mocks.listAzureAccounts.mockResolvedValue([azureAccount]);
    const update = query({ error: null });
    adminFromQueue.push(update);

    const result = await selectAzureOrganization({
      azureAccountId,
      azureAccountName: 'Attacker Org',
    });

    expect(result).toEqual({ ok: true, data: { connectionId } });
    expect(update.update).toHaveBeenCalledWith({
      azure_organization_id: azureAccount.id,
      azure_organization_name: azureAccount.name,
      azure_organization_url: azureAccount.url,
      safe_error_code: null,
    });
    expect(update.eq).toHaveBeenCalledWith('id', connectionId);
    expect(update.eq).toHaveBeenCalledWith('organization_id', organizationId);
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      '/settings/integrations/azure-devops',
    );
  });

  it('rejects an account id that discovery does not return', async () => {
    adminFromQueue.push(query(connectionRow()));
    mocks.listAzureAccounts.mockResolvedValue([]);

    const result = await selectAzureOrganization({ azureAccountId });

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'INVALID_AZURE_DEVOPS_INPUT' },
    });
  });
});

describe('listAzureProjects', () => {
  it('requires a selected Azure organization', async () => {
    adminFromQueue.push(query(connectionRow({ azure_organization_url: null })));

    const result = await listAzureProjects();

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'AZURE_ORGANIZATION_NOT_SELECTED' },
    });
    expect(mocks.listAzureProjects).not.toHaveBeenCalled();
  });

  it('discovers projects for the stored organization slug', async () => {
    adminFromQueue.push(query(connectionRow()));
    mocks.listAzureProjects.mockResolvedValue([azureProject]);

    const result = await listAzureProjects();

    expect(result).toEqual({ ok: true, data: [azureProject] });
    expect(mocks.listAzureProjects).toHaveBeenCalledWith({}, 'contoso');
  });
});

describe('listAzureTeams', () => {
  it('rejects an invalid project id before authorization', async () => {
    const result = await listAzureTeams({ azureProjectId: 'not-a-uuid' });

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'INVALID_AZURE_DEVOPS_INPUT' },
    });
    expect(mocks.requireAzureDevOpsAdmin).not.toHaveBeenCalled();
  });

  it('discovers teams for the given project within the stored organization', async () => {
    adminFromQueue.push(query(connectionRow()));
    mocks.listAzureTeams.mockResolvedValue([azureTeam]);

    const result = await listAzureTeams({ azureProjectId });

    expect(result).toEqual({ ok: true, data: [azureTeam] });
    expect(mocks.listAzureTeams).toHaveBeenCalledWith(
      {},
      'contoso',
      azureProjectId,
    );
  });
});

describe('saveAzureTeamLink', () => {
  const validInput = {
    planningTeamId,
    azureProjectId,
    azureProjectName: azureProject.name,
    azureTeamId,
    azureTeamName: azureTeam.name,
  };

  it('rejects invalid input before touching the database', async () => {
    const result = await saveAzureTeamLink({
      ...validInput,
      azureProjectName: '',
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'INVALID_AZURE_DEVOPS_INPUT' },
    });
    expect(mocks.requireAzureDevOpsAdmin).not.toHaveBeenCalled();
  });

  it('rejects a planning team that is not visible in this organization', async () => {
    mocks.createServerSupabase.mockResolvedValue({
      from: vi.fn(() => query({ data: null, error: null })),
    });

    const result = await saveAzureTeamLink(validInput);

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'AZURE_DEVOPS_FORBIDDEN' },
    });
    expect(mocks.createAdminSupabase).not.toHaveBeenCalled();
  });

  it('verifies the project and team server-side and configures the mapping', async () => {
    mocks.createServerSupabase.mockResolvedValue({
      from: vi.fn(() =>
        query({ data: { organization_id: organizationId }, error: null }),
      ),
    });
    adminFromQueue.push(query(connectionRow()));
    mocks.listAzureProjects.mockResolvedValue([azureProject]);
    mocks.listAzureTeams.mockResolvedValue([azureTeam]);
    adminRpc.mockResolvedValue({ data: 'link-1', error: null });

    const result = await saveAzureTeamLink(validInput);

    expect(result).toEqual({ ok: true, data: { teamLinkId: 'link-1' } });
    expect(adminRpc).toHaveBeenCalledWith('configure_azure_devops_team_link', {
      target_organization_id: organizationId,
      target_connection_id: connectionId,
      target_planning_team_id: planningTeamId,
      target_azure_project_id: azureProjectId,
      target_azure_project_name: azureProject.name,
      target_azure_team_id: azureTeamId,
      target_azure_team_name: azureTeam.name,
      target_created_by: userId,
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      '/settings/integrations/azure-devops',
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/planning', 'layout');
  });

  it('rejects a client-supplied project name that does not match discovery', async () => {
    mocks.createServerSupabase.mockResolvedValue({
      from: vi.fn(() =>
        query({ data: { organization_id: organizationId }, error: null }),
      ),
    });
    adminFromQueue.push(query(connectionRow()));
    mocks.listAzureProjects.mockResolvedValue([
      { ...azureProject, name: 'Renamed Project' },
    ]);

    const result = await saveAzureTeamLink(validInput);

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'INVALID_AZURE_DEVOPS_INPUT' },
    });
    expect(adminRpc).not.toHaveBeenCalled();
  });

  it('maps a uniqueness conflict from the database to a safe code', async () => {
    mocks.createServerSupabase.mockResolvedValue({
      from: vi.fn(() =>
        query({ data: { organization_id: organizationId }, error: null }),
      ),
    });
    adminFromQueue.push(query(connectionRow()));
    mocks.listAzureProjects.mockResolvedValue([azureProject]);
    mocks.listAzureTeams.mockResolvedValue([azureTeam]);
    adminRpc.mockResolvedValue({
      data: null,
      error: { code: '23505', message: 'duplicate key value' },
    });

    const result = await saveAzureTeamLink(validInput);

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'AZURE_DEVOPS_MAPPING_CONFLICT' },
    });
    expect(JSON.stringify(result)).not.toContain('duplicate key');
  });
});

describe('disconnectAzureDevOps', () => {
  it('succeeds when there is nothing to disconnect', async () => {
    adminFromQueue.push(query({ data: null, error: null }));

    const result = await disconnectAzureDevOps();

    expect(result).toEqual({ ok: true, data: undefined });
    expect(adminRpc).not.toHaveBeenCalled();
  });

  it('clears credentials through the transactional disconnect RPC', async () => {
    adminFromQueue.push(query(connectionRow()));
    adminRpc.mockResolvedValue({ data: true, error: null });

    const result = await disconnectAzureDevOps();

    expect(result).toEqual({ ok: true, data: undefined });
    expect(adminRpc).toHaveBeenCalledWith(
      'disconnect_azure_devops_connection',
      {
        target_organization_id: organizationId,
        target_connection_id: connectionId,
      },
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      '/settings/integrations/azure-devops',
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/planning', 'layout');
  });

  it('fails safely when the RPC reports failure', async () => {
    adminFromQueue.push(query(connectionRow()));
    adminRpc.mockResolvedValue({ data: false, error: null });

    const result = await disconnectAzureDevOps();

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'AZURE_DEVOPS_ACTION_FAILED' },
    });
  });
});
