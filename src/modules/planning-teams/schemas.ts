import { z } from 'zod';

import { uuidSchema } from '@/lib/schemas';

const planningRoleSchema = z.enum(['planner', 'member']);
const teamNameSchema = z.string().trim().min(1).max(100);
const teamDescriptionSchema = z.string().trim().max(2_000).default('');
const sprintLengthSchema = z.number().int().min(1).max(42);
const capacitySchema = z.number().min(0).max(24);

const planningTeamFields = {
  name: teamNameSchema,
  description: teamDescriptionSchema,
  defaultSprintLengthDays: sprintLengthSchema,
};

export const planningTeamCreateSchema = z.object(planningTeamFields);

export const planningTeamUpdateSchema = z.object({
  teamId: uuidSchema,
  ...planningTeamFields,
});

export const planningTeamMembersSchema = z
  .object({
    teamId: uuidSchema,
    members: z
      .array(
        z.object({
          userId: uuidSchema,
          role: planningRoleSchema,
          capacityHoursPerDay: capacitySchema,
        }),
      )
      .max(500),
  })
  .superRefine(({ members }, context) => {
    const userIds = new Set<string>();

    for (const member of members) {
      if (userIds.has(member.userId)) {
        context.addIssue({
          code: 'custom',
          message: 'Each user can appear only once',
          path: ['members'],
        });
        return;
      }

      userIds.add(member.userId);
    }
  });

export const planningTeamArchiveSchema = z.object({
  teamId: uuidSchema,
});

export type PlanningTeamCreateInput = z.infer<
  typeof planningTeamCreateSchema
>;
export type PlanningTeamUpdateInput = z.infer<
  typeof planningTeamUpdateSchema
>;
export type PlanningTeamMembersInput = z.infer<
  typeof planningTeamMembersSchema
>;
