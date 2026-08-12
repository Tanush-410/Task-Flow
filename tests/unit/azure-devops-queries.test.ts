import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createAdminSupabase: vi.fn(),
  listPlanningTeamsForMembership: vi.fn(),
  requireAzureDevOpsAdmin: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabase: mocks.createAdminSupabase,
}));
vi.mock('@/modules/azure-devops/connections/access', () => ({
  requireAzureDevOpsAdmin: mocks.requireAzureDevOpsAdmin,
}));
vi.mock('@/modules/planning-teams/queries', () => ({
  listPlanningTeamsForMembership: mocks.listPlanningTeamsForMembership,
}));

import {
  AzureDevOpsConnectionQueryError,
  getAzureDevOpsConnection,
  getAzureDevOpsConnectionSetup,
} from '@/modules/azure-devops/connections/queries';

type QueryResult = { data: unknown; error: unknown };

function connectionQuery(result: QueryResult) {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.maybeSingle.mockResolvedValue(result);
  return builder;
}

function linksQuery(result: QueryResult) {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    then: (
      resolve: (value: QueryResult) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => Promise.resolve(result).then(resolve, reject),
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  return builder;
}

const membership = {
  organizationId: '10000000-0000-4000-8000-000000000001',
  userId: '20000000-0000-4000-8000-000000000002',
  role: 'admin' as const,
};

const connectionId = '30000000-0000-4000-8000-000000000003';

const validConnection = {
  id: connectionId,
  organization_id: membership.organizationId,
  status: 'configured',
  authorized_user_display_name: 'Ada Admin',
  authorized_user_email: 'ada@example.test',
  azure_organization_id: '40000000-0000-4000-8000-000000000004',
  azure_organization_name: 'Contoso Engineering',
  azure_organization_url: 'https://dev.azure.com/contoso-engineering',
  last_verified_at: '2026-08-12T10:30:00.000Z',
  safe_error_code: null,
};

const validLink = {
  id: '50000000-0000-4000-8000-000000000005',
  organization_id: membership.organizationId,
  connection_id: connectionId,
  planning_team_id: '60000000-0000-4000-8000-000000000006',
  azure_project_name: 'Product Platform',
  azure_team_name: 'Core Delivery',
  status: 'configured',
  created_at: '2026-08-12T10:35:00.000Z',
};

const degradedConnection = {
  id: connectionId,
  status: 'disconnected',
  authorizedUser: {
    displayName: 'Ada Admin',
    email: 'ada@example.test',
  },
  organization: null,
  lastVerifiedAt: null,
  safeErrorCode: 'AZURE_CONNECTION_DATA_INVALID',
  teamLinks: [],
};

const forbiddenFields = [
  'tenant_id',
  'granted_scopes',
  'access_token_ciphertext',
  'refresh_token_ciphertext',
  'token_expires_at',
  'authorized_user_id',
  'azure_project_id',
  'azure_team_id',
] as const;

function forbiddenSelectFields(selection: string): string[] {
  const selected = new Set(selection.split(',').map((field) => field.trim()));
  return forbiddenFields.filter((field) => selected.has(field));
}

function adminClient(
  connectionResult: QueryResult,
  linksResult: QueryResult = { data: [], error: null },
) {
  const connection = connectionQuery(connectionResult);
  const links = linksQuery(linksResult);
  const from = vi.fn((table: string) =>
    table === 'azure_devops_connections' ? connection : links,
  );
  mocks.createAdminSupabase.mockReturnValue({ from });
  return { connection, from, links };
}

describe('Azure DevOps connection queries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAzureDevOpsAdmin.mockResolvedValue(membership);
    mocks.listPlanningTeamsForMembership.mockResolvedValue([]);
  });

  it('authorizes before creating the service-role client', async () => {
    const events: string[] = [];
    mocks.requireAzureDevOpsAdmin.mockImplementation(async () => {
      events.push('authorized');
      return membership;
    });
    mocks.createAdminSupabase.mockImplementation(() => {
      events.push('admin-client');
      return {
        from: vi.fn(() => connectionQuery({ data: null, error: null })),
      };
    });

    await expect(getAzureDevOpsConnection()).resolves.toBeNull();

    expect(events).toEqual(['authorized', 'admin-client']);
  });

  it('queries only scoped safe columns and maps the sanitized DTO', async () => {
    const secondLink = {
      ...validLink,
      id: '70000000-0000-4000-8000-000000000007',
      planning_team_id: '80000000-0000-4000-8000-000000000008',
      azure_project_name: 'Operations',
      azure_team_name: 'Release',
      status: 'paused',
      created_at: '2026-08-12T10:36:00.000Z',
    };
    const { connection, from, links } = adminClient(
      { data: validConnection, error: null },
      { data: [validLink, secondLink], error: null },
    );

    await expect(getAzureDevOpsConnection()).resolves.toEqual({
      id: connectionId,
      status: 'configured',
      authorizedUser: {
        displayName: 'Ada Admin',
        email: 'ada@example.test',
      },
      organization: {
        id: '40000000-0000-4000-8000-000000000004',
        name: 'Contoso Engineering',
        url: 'https://dev.azure.com/contoso-engineering',
      },
      lastVerifiedAt: '2026-08-12T10:30:00.000Z',
      safeErrorCode: null,
      teamLinks: [
        {
          id: validLink.id,
          planningTeamId: validLink.planning_team_id,
          azureProjectName: 'Product Platform',
          azureTeamName: 'Core Delivery',
          status: 'configured',
        },
        {
          id: secondLink.id,
          planningTeamId: secondLink.planning_team_id,
          azureProjectName: 'Operations',
          azureTeamName: 'Release',
          status: 'paused',
        },
      ],
    });

    expect(from).toHaveBeenNthCalledWith(1, 'azure_devops_connections');
    expect(from).toHaveBeenNthCalledWith(2, 'azure_devops_team_links');
    expect(connection.select).toHaveBeenCalledWith(
      'id,organization_id,status,authorized_user_display_name,authorized_user_email,azure_organization_id,azure_organization_name,azure_organization_url,last_verified_at,safe_error_code',
    );
    expect(links.select).toHaveBeenCalledWith(
      'id,organization_id,connection_id,planning_team_id,azure_project_name,azure_team_name,status,created_at',
    );
    for (const [selection] of [
      ...connection.select.mock.calls,
      ...links.select.mock.calls,
    ]) {
      const selectedFields = new Set(
        String(selection)
          .split(',')
          .map((field) => field.trim()),
      );
      for (const forbiddenField of forbiddenFields) {
        expect(selectedFields.has(forbiddenField)).toBe(false);
      }
    }
    expect(connection.eq).toHaveBeenCalledWith(
      'organization_id',
      membership.organizationId,
    );
    expect(links.eq).toHaveBeenNthCalledWith(
      1,
      'organization_id',
      membership.organizationId,
    );
    expect(links.eq).toHaveBeenNthCalledWith(2, 'connection_id', connectionId);
    expect(links.order).toHaveBeenNthCalledWith(1, 'created_at', {
      ascending: true,
    });
    expect(links.order).toHaveBeenNthCalledWith(2, 'id', { ascending: true });
  });

  it('uses a safe display-name fallback for an empty disconnected row', async () => {
    adminClient({
      data: {
        ...validConnection,
        status: 'disconnected',
        authorized_user_display_name: '',
        authorized_user_email: null,
        azure_organization_id: null,
        azure_organization_name: null,
        azure_organization_url: null,
        last_verified_at: null,
        safe_error_code: 'AZURE_RECONNECT_REQUIRED',
      },
      error: null,
    });

    await expect(getAzureDevOpsConnection()).resolves.toMatchObject({
      status: 'disconnected',
      authorizedUser: { displayName: 'Azure DevOps user', email: null },
      organization: null,
      lastVerifiedAt: null,
      safeErrorCode: 'AZURE_RECONNECT_REQUIRED',
    });
  });

  it('returns null without loading links when no connection exists', async () => {
    const { from } = adminClient({ data: null, error: null });

    await expect(getAzureDevOpsConnection()).resolves.toBeNull();
    expect(from).toHaveBeenCalledOnce();
  });

  it.each([
    ['a connection query error', { data: null, error: new Error('private') }],
    ['a missing query result', { data: undefined, error: null }],
  ])('throws a stable nonleaking error for %s', async (_label, result) => {
    adminClient(result);

    const error = await getAzureDevOpsConnection().catch(
      (reason: unknown) => reason,
    );

    expect(error).toBeInstanceOf(AzureDevOpsConnectionQueryError);
    expect(error).toMatchObject({ code: 'AZURE_CONNECTION_QUERY_FAILED' });
    expect(String(error)).not.toContain('private');
  });

  it.each([
    ['a partial Azure organization', { azure_organization_name: null }],
    [
      'a non-canonical Azure organization URL',
      { azure_organization_url: 'https://dev.azure.com/contoso-engineering/' },
    ],
    [
      'a different Azure URL host',
      { azure_organization_url: 'https://contoso.example/contoso-engineering' },
    ],
    ['an invalid verification timestamp', { last_verified_at: 'yesterday' }],
    ['an unsafe error code', { safe_error_code: 'Provider body leaked' }],
    ['an unsupported status', { status: 'connected' }],
  ])('returns a sanitized degraded DTO for %s', async (_label, override) => {
    adminClient({
      data: { ...validConnection, ...override },
      error: null,
    });

    await expect(getAzureDevOpsConnection()).resolves.toEqual(
      degradedConnection,
    );
  });

  it('throws a nonleaking query error for a cross-organization connection row', async () => {
    const privateDisplayName = 'Private Cross Org User';
    const privateEmail = 'private-cross-org@example.test';
    const privateOrganizationId = '90000000-0000-4000-8000-000000000009';
    adminClient({
      data: {
        ...validConnection,
        organization_id: privateOrganizationId,
        authorized_user_display_name: privateDisplayName,
        authorized_user_email: privateEmail,
      },
      error: null,
    });

    const error = await getAzureDevOpsConnection().catch(
      (reason: unknown) => reason,
    );

    expect(error).toMatchObject({ code: 'AZURE_CONNECTION_QUERY_FAILED' });
    expect(String(error)).not.toContain(privateDisplayName);
    expect(String(error)).not.toContain(privateEmail);
    expect(String(error)).not.toContain(privateOrganizationId);
  });

  it.each([
    ['a non-UUID connection id', { id: 'not-a-uuid' }],
    [
      'a control character in the display name',
      { authorized_user_display_name: 'Ada\nAdmin' },
    ],
    ['an invalid email', { authorized_user_email: 'not-an-email' }],
  ])(
    'throws a safe query error without trustworthy public identity for %s',
    async (_label, override) => {
      adminClient({
        data: { ...validConnection, ...override },
        error: null,
      });

      await expect(getAzureDevOpsConnection()).rejects.toMatchObject({
        code: 'AZURE_CONNECTION_QUERY_FAILED',
      });
    },
  );

  it.each([
    ['pending public status', { status: 'pending' }],
    [
      'cross-organization provenance',
      { organization_id: '90000000-0000-4000-8000-000000000009' },
    ],
    [
      'a different connection provenance',
      { connection_id: '90000000-0000-4000-8000-000000000009' },
    ],
    ['a non-UUID planning team', { planning_team_id: 'team' }],
    [
      'a control character in a provider name',
      { azure_team_name: 'Core\u0000Delivery' },
    ],
  ])(
    'returns a sanitized degraded DTO for a malformed team link with %s',
    async (_label, override) => {
      adminClient(
        { data: validConnection, error: null },
        { data: [{ ...validLink, ...override }], error: null },
      );

      await expect(getAzureDevOpsConnection()).resolves.toEqual(
        degradedConnection,
      );
    },
  );

  it('throws a stable query error when the team-link query fails', async () => {
    adminClient(
      { data: validConnection, error: null },
      { data: null, error: new Error('private provider details') },
    );

    const error = await getAzureDevOpsConnection().catch(
      (reason: unknown) => reason,
    );

    expect(error).toMatchObject({ code: 'AZURE_CONNECTION_QUERY_FAILED' });
    expect(String(error)).not.toContain('private provider details');
  });

  it('throws a stable query error when service-role client creation throws', async () => {
    mocks.createAdminSupabase.mockImplementation(() => {
      throw new Error('private service configuration');
    });

    await expect(getAzureDevOpsConnection()).rejects.toMatchObject({
      code: 'AZURE_CONNECTION_QUERY_FAILED',
    });
  });

  it('detects an exact forbidden field added to an otherwise safe select', () => {
    expect(
      forbiddenSelectFields(
        'id,organization_id,status,access_token_ciphertext',
      ),
    ).toEqual(['access_token_ciphertext']);
  });

  it('loads setup planning teams through the existing visibility query after one Azure guard', async () => {
    const planningTeams = [
      {
        id: '60000000-0000-4000-8000-000000000006',
        name: 'Core Delivery',
        description: '',
        defaultSprintLengthDays: 14,
        isArchived: false,
        memberCount: 3,
        currentUserRole: 'admin',
      },
    ];
    const events: string[] = [];
    mocks.requireAzureDevOpsAdmin.mockImplementation(async () => {
      events.push('authorized');
      return membership;
    });
    const query = connectionQuery({ data: null, error: null });
    mocks.createAdminSupabase.mockImplementation(() => {
      events.push('admin-client');
      return { from: vi.fn(() => query) };
    });
    mocks.listPlanningTeamsForMembership.mockImplementation(async () => {
      events.push('planning-teams');
      return planningTeams;
    });

    await expect(getAzureDevOpsConnectionSetup()).resolves.toEqual({
      connection: null,
      planningTeams,
    });
    expect(mocks.requireAzureDevOpsAdmin).toHaveBeenCalledOnce();
    expect(mocks.listPlanningTeamsForMembership).toHaveBeenCalledWith(
      membership,
    );
    expect(events).toEqual(['authorized', 'admin-client', 'planning-teams']);
  });
});
