import { z } from 'zod';

import { uuidSchema } from '@/lib/schemas';

export const commentCreateSchema = z.object({
  taskId: uuidSchema,
  body: z.string().trim().min(1).max(4000),
});

export const commentDeleteSchema = z.object({
  commentId: uuidSchema,
});

export type CommentCreateInput = z.infer<typeof commentCreateSchema>;
export type CommentDeleteInput = z.infer<typeof commentDeleteSchema>;
