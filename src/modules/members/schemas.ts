import { z } from 'zod';

export const invitationSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(['admin', 'employee']),
});

export const invitationAcceptanceSchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
});
