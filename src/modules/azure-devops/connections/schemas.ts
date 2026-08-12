import { z } from 'zod';

import { uuidSchema } from '@/lib/schemas';

function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

const boundedName = (maximum: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(maximum)
    .refine((value) => !hasControlCharacter(value));

export const selectAzureOrganizationSchema = z.object({
  azureAccountId: uuidSchema,
});

export const listAzureTeamsSchema = z.object({
  azureProjectId: uuidSchema,
});

export const saveAzureTeamLinkSchema = z.object({
  planningTeamId: uuidSchema,
  azureProjectId: uuidSchema,
  azureProjectName: boundedName(256),
  azureTeamId: uuidSchema,
  azureTeamName: boundedName(256),
});

export type SelectAzureOrganizationInput = z.infer<
  typeof selectAzureOrganizationSchema
>;
export type ListAzureTeamsInput = z.infer<typeof listAzureTeamsSchema>;
export type SaveAzureTeamLinkInput = z.infer<typeof saveAzureTeamLinkSchema>;
