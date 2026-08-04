import { z } from 'zod';

import { uuidSchema } from '@/lib/schemas';

export const dependencyCreateSchema = z
  .object({
    taskId: uuidSchema,
    dependsOnTaskId: uuidSchema,
  })
  .refine((value) => value.taskId !== value.dependsOnTaskId, {
    message: 'A task cannot depend on itself.',
    path: ['dependsOnTaskId'],
  });

export const dependencyDeleteSchema = z.object({
  dependencyId: uuidSchema,
});
