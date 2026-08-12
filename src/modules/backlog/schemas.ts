import { z } from 'zod';

import { uuidSchema } from '@/lib/schemas';

const workItemTypeSchema = z.enum(['epic', 'feature', 'user_story', 'task']);
const taskPrioritySchema = z.enum(['low', 'medium', 'high', 'urgent']);
const storyPointsSchema = z.number().min(0).max(999.99);
const hoursSchema = z.number().min(0).max(9_999.99);

export const workItemCreateSchema = z
  .object({
    planningTeamId: uuidSchema,
    parentTaskId: uuidSchema.nullable().default(null),
    type: workItemTypeSchema,
    title: z.string().trim().min(1).max(140),
    description: z.string().trim().max(10_000).default(''),
    priority: taskPrioritySchema.default('medium'),
    storyPoints: storyPointsSchema.nullish(),
    originalHours: hoursSchema.nullish(),
    remainingHours: hoursSchema.nullish(),
  })
  .superRefine((value, context) => {
    if (value.type === 'task') {
      if (value.storyPoints != null) {
        context.addIssue({
          code: 'custom',
          message: 'A task cannot carry story points',
          path: ['storyPoints'],
        });
      }
      return;
    }

    if (value.originalHours != null || value.remainingHours != null) {
      context.addIssue({
        code: 'custom',
        message: 'Only a task can carry hour estimates',
        path: ['originalHours'],
      });
    }
  });

export const workItemPlanningFieldsUpdateSchema = z
  .object({
    taskId: uuidSchema,
    title: z.string().trim().min(1).max(140).optional(),
    description: z.string().trim().max(10_000).optional(),
    priority: taskPrioritySchema.optional(),
    storyPoints: storyPointsSchema.nullable().optional(),
    remainingHours: hoursSchema.nullable().optional(),
    originalHours: hoursSchema.nullable().optional(),
  })
  .refine(
    (value) =>
      value.title !== undefined ||
      value.description !== undefined ||
      value.priority !== undefined ||
      value.storyPoints !== undefined ||
      value.remainingHours !== undefined ||
      value.originalHours !== undefined,
    { message: 'At least one field must change' },
  )
  .refine(
    (value) =>
      value.originalHours === undefined || value.remainingHours !== undefined,
    {
      message: 'Re-estimating original hours requires remaining hours too',
      path: ['remainingHours'],
    },
  );

export const moveWorkItemSchema = z.object({
  taskId: uuidSchema,
  newParentTaskId: uuidSchema.nullable(),
  newPlanningTeamId: uuidSchema,
  includeDescendants: z.boolean().default(false),
});

export const rankBacklogItemSchema = z.object({
  taskId: uuidSchema,
  beforeTaskId: uuidSchema.nullable().default(null),
  afterTaskId: uuidSchema.nullable().default(null),
});

export type WorkItemType = z.infer<typeof workItemTypeSchema>;
export type WorkItemCreateInput = z.infer<typeof workItemCreateSchema>;
export type WorkItemPlanningFieldsUpdateInput = z.infer<
  typeof workItemPlanningFieldsUpdateSchema
>;
export type MoveWorkItemInput = z.infer<typeof moveWorkItemSchema>;
export type RankBacklogItemInput = z.infer<typeof rankBacklogItemSchema>;
