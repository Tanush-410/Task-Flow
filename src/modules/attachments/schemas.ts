import { z } from 'zod';

import { uuidSchema } from '@/lib/schemas';

const MAX_FILE_SIZE = 25 * 1024 * 1024;

export const attachmentRecordSchema = z.object({
  taskId: uuidSchema,
  fileName: z.string().trim().min(1).max(255),
  storagePath: z.string().trim().min(1),
  fileSize: z.number().int().positive().max(MAX_FILE_SIZE),
  mimeType: z.string().trim().min(1).max(255),
});

export const attachmentDeleteSchema = z.object({
  attachmentId: uuidSchema,
});
