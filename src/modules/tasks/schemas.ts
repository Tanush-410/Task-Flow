import { z } from 'zod';

const taskPrioritySchema = z.enum(['low', 'medium', 'high', 'urgent']);
const taskStatusSchema = z.enum(['draft', 'published', 'archived']);

export const taskCreateSchema = z.object({
  organizationId: z.string().uuid(),
  title: z.string().trim().min(1).max(140),
  description: z.string().trim().max(10_000).default(''),
  priority: taskPrioritySchema.default('medium'),
  dueAt: z.string().datetime().nullish(),
  startAt: z.string().datetime().nullish(),
  acknowledgementRequired: z.boolean().default(false),
});

export const taskUpdateSchema = z.object({
  taskId: z.string().uuid(),
  title: z.string().trim().min(1).max(140).optional(),
  description: z.string().trim().max(10_000).optional(),
  priority: taskPrioritySchema.optional(),
  status: taskStatusSchema.optional(),
  dueAt: z.string().datetime().nullable().optional(),
  startAt: z.string().datetime().nullable().optional(),
  acknowledgementRequired: z.boolean().optional(),
});

export const taskPublishSchema = z.object({
  taskId: z.string().uuid(),
  publishedAt: z.string().datetime().optional(),
});

export const taskArchiveSchema = z.object({
  taskId: z.string().uuid(),
  archivedAt: z.string().datetime().optional(),
});

export type TaskPriority = z.infer<typeof taskPrioritySchema>;
export type TaskStatus = z.infer<typeof taskStatusSchema>;
export type TaskCreateInput = z.infer<typeof taskCreateSchema>;
export type TaskUpdateInput = z.infer<typeof taskUpdateSchema>;
export type TaskPublishInput = z.infer<typeof taskPublishSchema>;
export type TaskArchiveInput = z.infer<typeof taskArchiveSchema>;
