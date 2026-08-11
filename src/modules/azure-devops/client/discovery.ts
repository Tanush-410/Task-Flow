import 'server-only';

import { z } from 'zod';

import {
  AzureDevOpsError,
  isValidAzureOrganizationSlug,
  type AzureDevOpsClient,
  type AzurePage,
} from './http';

const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;
const DEV_AZURE_ACCOUNT_URI_PATTERN =
  /^https:\/\/vssps\.dev\.azure\.com\/([A-Za-z0-9-]+)\/$/;
const VISUAL_STUDIO_ACCOUNT_URI_PATTERN =
  /^https:\/\/([A-Za-z0-9-]+)\.vssps\.visualstudio\.com(?::443)?\/$/;
const safeName = z
  .string()
  .min(1)
  .max(256)
  .refine((value) => !CONTROL_CHARACTER_PATTERN.test(value));

const profileSchema = z.object({
  id: z.uuid(),
  displayName: safeName,
  emailAddress: z.email().max(320).nullable().optional(),
});

const accountSchema = z.object({
  accountId: z.uuid(),
  accountName: safeName,
  accountUri: z.string().min(1).max(2_048),
});

const resourceSchema = z.object({
  id: z.uuid(),
  name: safeName,
});

function pageSchema<T>(item: z.ZodType<T>): z.ZodType<AzurePage<T>> {
  return z.object({
    count: z.number().int().nonnegative(),
    value: z.array(item).max(10_000),
  });
}

export type AzureProfile = {
  readonly id: string;
  readonly displayName: string;
  readonly email: string | null;
};

export type AzureAccount = {
  readonly id: string;
  readonly name: string;
  readonly url: string;
};

export type AzureProject = {
  readonly id: string;
  readonly name: string;
};

export type AzureTeam = {
  readonly id: string;
  readonly name: string;
};

function invalidResponse(): never {
  throw new AzureDevOpsError('AZURE_RESPONSE_INVALID');
}

function validateUuid(value: unknown): asserts value is string {
  const parsed = z.uuid().safeParse(value);
  if (!parsed.success) invalidResponse();
}

function validateOrganization(value: unknown): asserts value is string {
  if (!isValidAzureOrganizationSlug(value)) {
    invalidResponse();
  }
}

function organizationFromAccountUri(accountUri: string): string {
  try {
    const devAzureMatch = DEV_AZURE_ACCOUNT_URI_PATTERN.exec(accountUri);
    const visualStudioMatch =
      VISUAL_STUDIO_ACCOUNT_URI_PATTERN.exec(accountUri);
    const slug = devAzureMatch?.[1] ?? visualStudioMatch?.[1];
    if (!slug || !isValidAzureOrganizationSlug(slug)) invalidResponse();

    const url = new URL(accountUri);
    if (
      url.protocol !== 'https:' ||
      url.port ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      invalidResponse();
    }

    if (devAzureMatch) {
      if (
        url.hostname !== 'vssps.dev.azure.com' ||
        url.pathname !== `/${slug}/`
      ) {
        invalidResponse();
      }
      return slug;
    }

    if (
      url.hostname !== `${slug.toLowerCase()}.vssps.visualstudio.com` ||
      url.pathname !== '/'
    ) {
      invalidResponse();
    }
    return slug;
  } catch (error) {
    if (error instanceof AzureDevOpsError) throw error;
    invalidResponse();
  }
}

function uniqueById<T extends { readonly id: string }>(
  values: readonly T[],
): readonly T[] {
  const seen = new Set<string>();
  for (const value of values) {
    const id = value.id.toLowerCase();
    if (seen.has(id)) invalidResponse();
    seen.add(id);
  }
  return Object.freeze([...values]);
}

export async function getAzureProfile(
  client: AzureDevOpsClient,
): Promise<AzureProfile> {
  const profile = await client.getProfile(profileSchema);
  return Object.freeze({
    id: profile.id,
    displayName: profile.displayName,
    email: profile.emailAddress ?? null,
  });
}

export async function listAzureAccounts(
  client: AzureDevOpsClient,
  memberId: string,
): Promise<readonly AzureAccount[]> {
  validateUuid(memberId);
  const accounts = await client.listAccounts(
    memberId,
    pageSchema(accountSchema),
  );
  return uniqueById(
    accounts.map((account) => {
      const slug = organizationFromAccountUri(account.accountUri);
      return Object.freeze({
        id: account.accountId,
        name: account.accountName,
        url: `https://dev.azure.com/${slug}`,
      });
    }),
  );
}

export async function listAzureProjects(
  client: AzureDevOpsClient,
  organizationSlug: string,
): Promise<readonly AzureProject[]> {
  validateOrganization(organizationSlug);
  const projects = await client.listProjects(
    organizationSlug,
    pageSchema(resourceSchema),
  );
  return uniqueById(
    projects.map((project) =>
      Object.freeze({ id: project.id, name: project.name }),
    ),
  );
}

export async function listAzureTeams(
  client: AzureDevOpsClient,
  organizationSlug: string,
  projectId: string,
): Promise<readonly AzureTeam[]> {
  validateOrganization(organizationSlug);
  validateUuid(projectId);
  const teams = await client.listTeams(
    organizationSlug,
    projectId,
    pageSchema(resourceSchema),
  );
  return uniqueById(
    teams.map((team) => Object.freeze({ id: team.id, name: team.name })),
  );
}
