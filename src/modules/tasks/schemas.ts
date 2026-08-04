import { z } from 'zod';

import { uuidSchema } from '@/lib/schemas';

const taskPrioritySchema = z.enum(['low', 'medium', 'high', 'urgent']);
const taskStatusSchema = z.enum(['draft', 'published', 'archived']);
const taskRecurrenceSchema = z.enum(['none', 'daily', 'weekly', 'monthly']);

export const taskCreateSchema = z.object({
  organizationId: uuidSchema,
  title: z.string().trim().min(1).max(140),
  description: z.string().trim().max(10_000).default(''),
  priority: taskPrioritySchema.default('medium'),
  dueAt: z.string().datetime().nullish(),
  startAt: z.string().datetime().nullish(),
  acknowledgementRequired: z.boolean().default(false),
});

export const taskUpdateSchema = z.object({
  taskId: uuidSchema,
  title: z.string().trim().min(1).max(140).optional(),
  description: z.string().trim().max(10_000).optional(),
  priority: taskPrioritySchema.optional(),
  status: taskStatusSchema.optional(),
  dueAt: z.string().datetime().nullable().optional(),
  startAt: z.string().datetime().nullable().optional(),
  acknowledgementRequired: z.boolean().optional(),
  recurrence: taskRecurrenceSchema.optional(),
});

export const taskPublishSchema = z.object({
  taskId: uuidSchema,
  publishedAt: z.string().datetime().optional(),
});

export const taskArchiveSchema = z.object({
  taskId: uuidSchema,
  archivedAt: z.string().datetime().optional(),
});

export const taskBulkStatusSchema = z.object({
  taskIds: z.array(uuidSchema).min(1).max(100),
  status: z.enum(['published', 'archived']),
});

export const taskCreateWithAssigneesSchema = z.object({
  title: z.string().trim().min(1).max(140),
  description: z.string().trim().max(10_000).default(''),
  priority: taskPrioritySchema.default('medium'),
  dueAt: z.string().datetime().nullish(),
  startAt: z.string().datetime().nullish(),
  acknowledgementRequired: z.boolean().default(false),
  recurrence: taskRecurrenceSchema.default('none'),
  assigneeIds: z.array(uuidSchema).min(1).max(50),
});

export type TaskPriority = z.infer<typeof taskPrioritySchema>;
export type TaskStatus = z.infer<typeof taskStatusSchema>;
export type TaskRecurrence = z.infer<typeof taskRecurrenceSchema>;
export type TaskCreateInput = z.infer<typeof taskCreateSchema>;
export type TaskUpdateInput = z.infer<typeof taskUpdateSchema>;
export type TaskPublishInput = z.infer<typeof taskPublishSchema>;
export type TaskArchiveInput = z.infer<typeof taskArchiveSchema>;
export type TaskCreateWithAssigneesInput = z.infer<
  typeof taskCreateWithAssigneesSchema
>;
