'use server';

import { randomUUID } from 'node:crypto';

import { revalidatePath } from 'next/cache';

import type { ActionResult } from '@/lib/result';
import { serverEnv, type ServerEnv } from '@/lib/server-env';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { createServerSupabase } from '@/lib/supabase/server';

import {
  decryptSecret,
  encryptSecret,
  type EncryptionKey,
} from '../auth/crypto';
import {
  refreshEntraTokens,
  shouldRefreshToken,
  type EntraTokenSet,
} from '../auth/entra';
import {
  listAzureAccounts,
  listAzureProjects as discoverAzureProjects,
  listAzureTeams as discoverAzureTeams,
  type AzureAccount,
  type AzureProject,
  type AzureTeam,
} from '../client/discovery';
import {
  AzureDevOpsError,
  createAzureDevOpsClient,
  type AzureDevOpsClient,
} from '../client/http';
import { fixtureFetch } from '../testing/fixture-fetch';

import { requireAzureDevOpsAdmin } from './access';
import {
  listAzureTeamsSchema,
  saveAzureTeamLinkSchema,
  selectAzureOrganizationSchema,
} from './schemas';

const AZURE_ORGANIZATION_URL_PATTERN =
  /^https:\/\/dev\.azure\.com\/([A-Za-z0-9](?:[A-Za-z0-9-]{0,48}[A-Za-z0-9])?)$/;

export type AzureDevOpsActionCode =
  | 'INVALID_AZURE_DEVOPS_INPUT'
  | 'AZURE_DEVOPS_FORBIDDEN'
  | 'AZURE_RECONNECT_REQUIRED'
  | 'AZURE_ORGANIZATION_NOT_SELECTED'
  | 'AZURE_DEVOPS_UNAVAILABLE'
  | 'AZURE_DEVOPS_DISCOVERY_FAILED'
  | 'AZURE_DEVOPS_MAPPING_CONFLICT'
  | 'AZURE_DEVOPS_ACTION_FAILED';

const ERROR_MESSAGES = {
  INVALID_AZURE_DEVOPS_INPUT: 'Check the Azure DevOps selection.',
  AZURE_DEVOPS_FORBIDDEN: 'You cannot make that Azure DevOps change.',
  AZURE_RECONNECT_REQUIRED: 'Reconnect Azure DevOps to continue.',
  AZURE_ORGANIZATION_NOT_SELECTED: 'Select an Azure DevOps organization first.',
  AZURE_DEVOPS_UNAVAILABLE: 'Azure DevOps is temporarily unavailable.',
  AZURE_DEVOPS_DISCOVERY_FAILED: 'Azure DevOps data could not be loaded.',
  AZURE_DEVOPS_MAPPING_CONFLICT:
    'That Azure DevOps team is already mapped to a planning team.',
  AZURE_DEVOPS_ACTION_FAILED: 'The Azure DevOps action could not be completed.',
} satisfies Record<AzureDevOpsActionCode, string>;

class AzureActionError extends Error {
  constructor(readonly code: AzureDevOpsActionCode) {
    super(ERROR_MESSAGES[code]);
    this.name = 'AzureActionError';
  }
}

function failure(
  code: AzureDevOpsActionCode,
  traceId: string,
  fields?: Record<string, string[]>,
): ActionResult<never> {
  return {
    ok: false,
    error: {
      code,
      message: ERROR_MESSAGES[code],
      traceId,
      ...(fields ? { fields } : {}),
    },
  };
}

function hasDatabaseCode(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === code
  );
}

function mapThrown(error: unknown): AzureDevOpsActionCode {
  if (error instanceof AzureActionError) return error.code;
  if (error instanceof AzureDevOpsError) {
    if (error.code === 'AZURE_RECONNECT_REQUIRED') {
      return 'AZURE_RECONNECT_REQUIRED';
    }
    if (error.code === 'AZURE_UNAVAILABLE') return 'AZURE_DEVOPS_UNAVAILABLE';
    return 'AZURE_DEVOPS_DISCOVERY_FAILED';
  }
  return 'AZURE_DEVOPS_ACTION_FAILED';
}

function revalidateIntegrationSettings(): void {
  revalidatePath('/settings/integrations/azure-devops');
}

function revalidatePlanning(): void {
  revalidatePath('/planning', 'layout');
}

function encryptionKey(environment: ServerEnv): EncryptionKey {
  return {
    id: environment.AZURE_DEVOPS_TOKEN_KEY_ID,
    bytes: new Uint8Array(
      Buffer.from(environment.AZURE_DEVOPS_TOKEN_ENCRYPTION_KEY, 'base64'),
    ),
  };
}

function organizationSlugFromUrl(url: string): string {
  const match = AZURE_ORGANIZATION_URL_PATTERN.exec(url);
  const slug = match?.[1];
  if (!slug) throw new AzureActionError('AZURE_DEVOPS_ACTION_FAILED');
  return slug;
}

type ConnectionRow = {
  id: string;
  organizationId: string;
  authorizedUserId: string;
  accessTokenCiphertext: string | null;
  refreshTokenCiphertext: string | null;
  tokenExpiresAt: string | null;
  azureOrganizationId: string | null;
  azureOrganizationName: string | null;
  azureOrganizationUrl: string | null;
};

async function loadConnectionRow(
  admin: ReturnType<typeof createAdminSupabase>,
  organizationId: string,
): Promise<ConnectionRow | null> {
  const { data, error } = await admin
    .from('azure_devops_connections')
    .select(
      'id,organization_id,authorized_user_id,access_token_ciphertext,refresh_token_ciphertext,token_expires_at,azure_organization_id,azure_organization_name,azure_organization_url',
    )
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (error) throw new AzureActionError('AZURE_DEVOPS_ACTION_FAILED');
  if (!data) return null;

  return {
    id: data.id,
    organizationId: data.organization_id,
    authorizedUserId: data.authorized_user_id,
    accessTokenCiphertext: data.access_token_ciphertext,
    refreshTokenCiphertext: data.refresh_token_ciphertext,
    tokenExpiresAt: data.token_expires_at,
    azureOrganizationId: data.azure_organization_id,
    azureOrganizationName: data.azure_organization_name,
    azureOrganizationUrl: data.azure_organization_url,
  };
}

async function markReconnectRequired(
  admin: ReturnType<typeof createAdminSupabase>,
  connectionId: string,
): Promise<void> {
  await admin
    .from('azure_devops_connections')
    .update({
      status: 'paused',
      safe_error_code: 'AZURE_RECONNECT_REQUIRED',
    })
    .eq('id', connectionId);
}

async function persistRefreshedTokens(
  admin: ReturnType<typeof createAdminSupabase>,
  connectionId: string,
  tokens: EntraTokenSet,
  key: EncryptionKey,
): Promise<void> {
  await admin
    .from('azure_devops_connections')
    .update({
      access_token_ciphertext: encryptSecret(tokens.accessToken, key),
      refresh_token_ciphertext: encryptSecret(tokens.refreshToken, key),
      token_expires_at: tokens.expiresAt,
    })
    .eq('id', connectionId);
}

type AuthorizedClient = {
  client: AzureDevOpsClient;
  connection: ConnectionRow;
};

async function createAuthorizedClient(
  organizationId: string,
): Promise<AuthorizedClient> {
  const admin = createAdminSupabase();
  const connection = await loadConnectionRow(admin, organizationId);
  if (
    !connection ||
    !connection.accessTokenCiphertext ||
    !connection.refreshTokenCiphertext ||
    !connection.tokenExpiresAt
  ) {
    throw new AzureActionError('AZURE_RECONNECT_REQUIRED');
  }

  const environment = serverEnv();
  const key = encryptionKey(environment);
  let accessToken = decryptSecret(connection.accessTokenCiphertext, [key]);

  async function refresh(): Promise<string> {
    try {
      const refreshToken = decryptSecret(connection!.refreshTokenCiphertext!, [
        key,
      ]);
      const tokens = await refreshEntraTokens(
        { refreshToken },
        { fetch: fixtureFetch() },
      );
      accessToken = tokens.accessToken;
      await persistRefreshedTokens(admin, connection!.id, tokens, key);
      return accessToken;
    } catch {
      await markReconnectRequired(admin, connection!.id);
      throw new AzureActionError('AZURE_RECONNECT_REQUIRED');
    }
  }

  if (shouldRefreshToken(connection.tokenExpiresAt)) {
    accessToken = await refresh();
  }

  const client = createAzureDevOpsClient({
    tokenProvider: {
      getAccessToken: async () => accessToken,
      refreshAccessToken: async () => refresh(),
    },
    fetch: fixtureFetch(),
  });

  return { client, connection };
}

export async function listAccessibleAzureOrganizations(): Promise<
  ActionResult<AzureAccount[]>
> {
  const traceId = randomUUID();
  try {
    const membership = await requireAzureDevOpsAdmin();
    const { client, connection } = await createAuthorizedClient(
      membership.organizationId,
    );
    const accounts = await listAzureAccounts(
      client,
      connection.authorizedUserId,
    );
    return { ok: true, data: [...accounts] };
  } catch (error) {
    return failure(mapThrown(error), traceId);
  }
}

export async function selectAzureOrganization(
  input: unknown,
): Promise<ActionResult<{ connectionId: string }>> {
  const traceId = randomUUID();
  const parsed = selectAzureOrganizationSchema.safeParse(input);
  if (!parsed.success) {
    return failure(
      'INVALID_AZURE_DEVOPS_INPUT',
      traceId,
      parsed.error.flatten().fieldErrors,
    );
  }

  try {
    const membership = await requireAzureDevOpsAdmin();
    const { client, connection } = await createAuthorizedClient(
      membership.organizationId,
    );
    const accounts = await listAzureAccounts(
      client,
      connection.authorizedUserId,
    );
    const account = accounts.find(
      (candidate) => candidate.id === parsed.data.azureAccountId,
    );
    if (!account) {
      return failure('INVALID_AZURE_DEVOPS_INPUT', traceId);
    }

    const admin = createAdminSupabase();
    const { error } = await admin
      .from('azure_devops_connections')
      .update({
        azure_organization_id: account.id,
        azure_organization_name: account.name,
        azure_organization_url: account.url,
        safe_error_code: null,
      })
      .eq('id', connection.id)
      .eq('organization_id', membership.organizationId);
    if (error) return failure('AZURE_DEVOPS_ACTION_FAILED', traceId);

    revalidateIntegrationSettings();
    return { ok: true, data: { connectionId: connection.id } };
  } catch (error) {
    return failure(mapThrown(error), traceId);
  }
}

export async function listAzureProjects(): Promise<
  ActionResult<AzureProject[]>
> {
  const traceId = randomUUID();
  try {
    const membership = await requireAzureDevOpsAdmin();
    const { client, connection } = await createAuthorizedClient(
      membership.organizationId,
    );
    if (!connection.azureOrganizationUrl) {
      return failure('AZURE_ORGANIZATION_NOT_SELECTED', traceId);
    }
    const slug = organizationSlugFromUrl(connection.azureOrganizationUrl);
    const projects = await discoverAzureProjects(client, slug);
    return { ok: true, data: [...projects] };
  } catch (error) {
    return failure(mapThrown(error), traceId);
  }
}

export async function listAzureTeams(
  input: unknown,
): Promise<ActionResult<AzureTeam[]>> {
  const traceId = randomUUID();
  const parsed = listAzureTeamsSchema.safeParse(input);
  if (!parsed.success) {
    return failure(
      'INVALID_AZURE_DEVOPS_INPUT',
      traceId,
      parsed.error.flatten().fieldErrors,
    );
  }

  try {
    const membership = await requireAzureDevOpsAdmin();
    const { client, connection } = await createAuthorizedClient(
      membership.organizationId,
    );
    if (!connection.azureOrganizationUrl) {
      return failure('AZURE_ORGANIZATION_NOT_SELECTED', traceId);
    }
    const slug = organizationSlugFromUrl(connection.azureOrganizationUrl);
    const teams = await discoverAzureTeams(
      client,
      slug,
      parsed.data.azureProjectId,
    );
    return { ok: true, data: [...teams] };
  } catch (error) {
    return failure(mapThrown(error), traceId);
  }
}

export async function saveAzureTeamLink(
  input: unknown,
): Promise<ActionResult<{ teamLinkId: string }>> {
  const traceId = randomUUID();
  const parsed = saveAzureTeamLinkSchema.safeParse(input);
  if (!parsed.success) {
    return failure(
      'INVALID_AZURE_DEVOPS_INPUT',
      traceId,
      parsed.error.flatten().fieldErrors,
    );
  }

  try {
    const membership = await requireAzureDevOpsAdmin();

    const supabase = await createServerSupabase();
    const { data: team, error: teamError } = await supabase
      .from('planning_teams')
      .select('organization_id')
      .eq('id', parsed.data.planningTeamId)
      .eq('organization_id', membership.organizationId)
      .maybeSingle();
    if (teamError || !team) {
      return failure('AZURE_DEVOPS_FORBIDDEN', traceId);
    }

    const { client, connection } = await createAuthorizedClient(
      membership.organizationId,
    );
    if (!connection.azureOrganizationUrl) {
      return failure('AZURE_ORGANIZATION_NOT_SELECTED', traceId);
    }
    const slug = organizationSlugFromUrl(connection.azureOrganizationUrl);

    const projects = await discoverAzureProjects(client, slug);
    const project = projects.find(
      (candidate) =>
        candidate.id === parsed.data.azureProjectId &&
        candidate.name === parsed.data.azureProjectName,
    );
    if (!project) {
      return failure('INVALID_AZURE_DEVOPS_INPUT', traceId);
    }

    const teams = await discoverAzureTeams(client, slug, project.id);
    const team_ = teams.find(
      (candidate) =>
        candidate.id === parsed.data.azureTeamId &&
        candidate.name === parsed.data.azureTeamName,
    );
    if (!team_) {
      return failure('INVALID_AZURE_DEVOPS_INPUT', traceId);
    }

    const admin = createAdminSupabase();
    const { data, error } = await admin.rpc(
      'configure_azure_devops_team_link',
      {
        target_organization_id: membership.organizationId,
        target_connection_id: connection.id,
        target_planning_team_id: parsed.data.planningTeamId,
        target_azure_project_id: project.id,
        target_azure_project_name: project.name,
        target_azure_team_id: team_.id,
        target_azure_team_name: team_.name,
        target_created_by: membership.userId,
      },
    );

    if (error || !data) {
      if (hasDatabaseCode(error, '42501')) {
        return failure('AZURE_DEVOPS_FORBIDDEN', traceId);
      }
      if (hasDatabaseCode(error, '23514') || hasDatabaseCode(error, '23505')) {
        return failure('AZURE_DEVOPS_MAPPING_CONFLICT', traceId);
      }
      if (hasDatabaseCode(error, '55000')) {
        return failure('AZURE_RECONNECT_REQUIRED', traceId);
      }
      return failure('AZURE_DEVOPS_ACTION_FAILED', traceId);
    }

    revalidateIntegrationSettings();
    revalidatePlanning();
    return { ok: true, data: { teamLinkId: data } };
  } catch (error) {
    return failure(mapThrown(error), traceId);
  }
}

export async function disconnectAzureDevOps(): Promise<ActionResult<void>> {
  const traceId = randomUUID();
  try {
    const membership = await requireAzureDevOpsAdmin();
    const admin = createAdminSupabase();
    const connection = await loadConnectionRow(
      admin,
      membership.organizationId,
    );
    if (!connection) {
      return { ok: true, data: undefined };
    }

    const { data, error } = await admin.rpc(
      'disconnect_azure_devops_connection',
      {
        target_organization_id: membership.organizationId,
        target_connection_id: connection.id,
      },
    );
    if (error || !data) {
      return failure('AZURE_DEVOPS_ACTION_FAILED', traceId);
    }

    revalidateIntegrationSettings();
    revalidatePlanning();
    return { ok: true, data: undefined };
  } catch (error) {
    return failure(mapThrown(error), traceId);
  }
}
