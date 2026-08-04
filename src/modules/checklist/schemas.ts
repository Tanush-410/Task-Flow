import { z } from 'zod';

import { uuidSchema } from '@/lib/schemas';

export const checklistItemCreateSchema = z.object({
  taskId: uuidSchema,
  title: z.string().trim().min(1).max(200),
});

export const checklistItemToggleSchema = z.object({
  itemId: uuidSchema,
  isDone: z.boolean(),
});

export const checklistItemDeleteSchema = z.object({
  itemId: uuidSchema,
});
