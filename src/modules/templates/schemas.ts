import { z } from 'zod';

import { uuidSchema } from '@/lib/schemas';

const taskPrioritySchema = z.enum(['low', 'medium', 'high', 'urgent']);
const taskRecurrenceSchema = z.enum(['none', 'daily', 'weekly', 'monthly']);

export const templateCreateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  title: z.string().trim().min(1).max(140),
  description: z.string().trim().max(10_000).default(''),
  priority: taskPrioritySchema.default('medium'),
  recurrence: taskRecurrenceSchema.default('none'),
  acknowledgementRequired: z.boolean().default(false),
});

export const templateDeleteSchema = z.object({
  templateId: uuidSchema,
});
