import 'server-only';

import { z } from 'zod';

import { createAdminSupabase } from '@/lib/supabase/admin';
import type { MembershipContext } from '@/modules/members/context';
import {
  listPlanningTeamsForMembership,
  type PlanningTeamSummary,
} from '@/modules/planning-teams/queries';

import { requireAzureDevOpsAdmin } from './access';
import {
  azureDevOpsSafeErrorCodeSchema,
  type AzureDevOpsSafeErrorCode,
} from './safe-errors';

const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;
const AZURE_ORGANIZATION_URL_PATTERN =
  /^https:\/\/dev\.azure\.com\/([A-Za-z0-9](?:[A-Za-z0-9-]{0,48}[A-Za-z0-9])?)$/;
const CONNECTION_SELECT =
  'id,organization_id,status,authorized_user_display_name,authorized_user_email,azure_organization_id,azure_organization_name,azure_organization_url,last_verified_at,safe_error_code';
const TEAM_LINK_SELECT =
  'id,organization_id,connection_id,planning_team_id,azure_project_name,azure_team_name,status,created_at';

const boundedSafeString = (minimum: number, maximum: number) =>
  z
    .string()
    .min(minimum)
    .max(maximum)
    .refine((value) => !CONTROL_CHARACTER_PATTERN.test(value));

const timestamp = boundedSafeString(1, 64).refine(
  (value) =>
    /^\d{4}-\d{2}-\d{2}T/.test(value) && !Number.isNaN(Date.parse(value)),
);
const connectionStatus = z.enum([
  'pending',
  'configured',
  'paused',
  'disconnected',
]);
const authorizedUserFields = {
  id: z.uuid(),
  organization_id: z.uuid(),
  authorized_user_display_name: boundedSafeString(0, 200),
  authorized_user_email: z.email().max(320).nullable(),
};
const trustworthyConnectionSchema = z
  .object(authorizedUserFields)
  .passthrough();
const connectionFields = {
  ...authorizedUserFields,
  organization_id: z.uuid(),
  status: connectionStatus,
  last_verified_at: timestamp.nullable(),
  safe_error_code: azureDevOpsSafeErrorCodeSchema.nullable(),
};
const connectionRowSchema = z.union([
  z
    .object({
      ...connectionFields,
      azure_organization_id: z.null(),
      azure_organization_name: z.null(),
      azure_organization_url: z.null(),
    })
    .strict(),
  z
    .object({
      ...connectionFields,
      azure_organization_id: z.uuid(),
      azure_organization_name: boundedSafeString(1, 256),
      azure_organization_url: boundedSafeString(1, 2_048).regex(
        AZURE_ORGANIZATION_URL_PATTERN,
      ),
    })
    .strict(),
]);
const teamLinkRowSchema = z
  .object({
    id: z.uuid(),
    organization_id: z.uuid(),
    connection_id: z.uuid(),
    planning_team_id: z.uuid(),
    azure_project_name: boundedSafeString(1, 256),
    azure_team_name: boundedSafeString(1, 256),
    status: z.enum(['configured', 'paused', 'disconnected']),
    created_at: timestamp,
  })
  .strict();
const teamLinkRowsSchema = z.array(teamLinkRowSchema).max(10_000);

export type AzureDevOpsConnectionView = {
  id: string;
  status: 'pending' | 'configured' | 'paused' | 'disconnected';
  authorizedUser: {
    displayName: string;
    email: string | null;
  };
  organization: {
    id: string;
    name: string;
    url: string;
  } | null;
  lastVerifiedAt: string | null;
  safeErrorCode: AzureDevOpsSafeErrorCode | null;
  teamLinks: Array<{
    id: string;
    planningTeamId: string;
    azureProjectName: string;
    azureTeamName: string;
    status: 'configured' | 'paused' | 'disconnected';
  }>;
};

export class AzureDevOpsConnectionQueryError extends Error {
  readonly code = 'AZURE_CONNECTION_QUERY_FAILED';

  constructor() {
    super('Azure DevOps connection could not be loaded.');
    this.name = 'AzureDevOpsConnectionQueryError';
  }
}

function queryFailed(): never {
  throw new AzureDevOpsConnectionQueryError();
}

function degradedConnection(
  connection: z.infer<typeof trustworthyConnectionSchema>,
): AzureDevOpsConnectionView {
  return {
    id: connection.id,
    status: 'disconnected',
    authorizedUser: {
      displayName:
        connection.authorized_user_display_name || 'Azure DevOps user',
      email: connection.authorized_user_email,
    },
    organization: null,
    lastVerifiedAt: null,
    safeErrorCode: 'AZURE_CONNECTION_DATA_INVALID',
    teamLinks: [],
  };
}

async function queryAzureDevOpsConnection(
  membership: MembershipContext,
): Promise<AzureDevOpsConnectionView | null> {
  const admin = createAdminSupabase();
  const { data: privateConnection, error: connectionError } = await admin
    .from('azure_devops_connections')
    .select(CONNECTION_SELECT)
    .eq('organization_id', membership.organizationId)
    .maybeSingle();

  if (connectionError || privateConnection === undefined) queryFailed();
  if (privateConnection === null) return null;

  const trustworthyConnection =
    trustworthyConnectionSchema.safeParse(privateConnection);
  if (
    !trustworthyConnection.success ||
    trustworthyConnection.data.organization_id !== membership.organizationId
  ) {
    queryFailed();
  }

  const connection = connectionRowSchema.safeParse(privateConnection);
  if (
    !connection.success ||
    connection.data.organization_id !== membership.organizationId
  ) {
    return degradedConnection(trustworthyConnection.data);
  }

  const { data: privateLinks, error: linksError } = await admin
    .from('azure_devops_team_links')
    .select(TEAM_LINK_SELECT)
    .eq('organization_id', membership.organizationId)
    .eq('connection_id', connection.data.id)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true });
  if (linksError || !privateLinks) queryFailed();

  const links = teamLinkRowsSchema.safeParse(privateLinks);
  if (
    !links.success ||
    links.data.some(
      (link) =>
        link.organization_id !== membership.organizationId ||
        link.connection_id !== connection.data.id,
    )
  ) {
    return degradedConnection(trustworthyConnection.data);
  }

  const organization =
    connection.data.azure_organization_id === null
      ? null
      : {
          id: connection.data.azure_organization_id,
          name: connection.data.azure_organization_name,
          url: connection.data.azure_organization_url,
        };

  return {
    id: connection.data.id,
    status: connection.data.status,
    authorizedUser: {
      displayName:
        connection.data.authorized_user_display_name || 'Azure DevOps user',
      email: connection.data.authorized_user_email,
    },
    organization,
    lastVerifiedAt: connection.data.last_verified_at,
    safeErrorCode: connection.data.safe_error_code,
    teamLinks: links.data.map((link) => ({
      id: link.id,
      planningTeamId: link.planning_team_id,
      azureProjectName: link.azure_project_name,
      azureTeamName: link.azure_team_name,
      status: link.status,
    })),
  };
}

export async function getAzureDevOpsConnection(): Promise<AzureDevOpsConnectionView | null> {
  const membership = await requireAzureDevOpsAdmin();
  try {
    return await queryAzureDevOpsConnection(membership);
  } catch {
    queryFailed();
  }
}

export async function getAzureDevOpsConnectionSetup(): Promise<{
  connection: AzureDevOpsConnectionView | null;
  planningTeams: PlanningTeamSummary[];
}> {
  const membership = await requireAzureDevOpsAdmin();
  let connection: AzureDevOpsConnectionView | null;
  try {
    connection = await queryAzureDevOpsConnection(membership);
  } catch {
    queryFailed();
  }
  const planningTeams = await listPlanningTeamsForMembership(membership);

  return { connection, planningTeams };
}
