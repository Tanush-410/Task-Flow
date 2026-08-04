import { z } from 'zod';

import { uuidSchema } from '@/lib/schemas';

export const invitationSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(['admin', 'employee']),
});

export const invitationAcceptanceSchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
});

export const connectionRequestSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{6}$/),
  role: z.enum(['admin', 'employee']),
});

export const connectionRequestResponseSchema = z.object({
  requestId: uuidSchema,
  accept: z.boolean(),
});
