import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(128),
});

const displayNameSchema = z.string().trim().min(1).max(100);
const emailSchema = z.string().trim().toLowerCase().email();
const passwordSchema = z.string().min(8).max(128);

export const signUpAdminSchema = z.object({
  displayName: displayNameSchema,
  email: emailSchema,
  password: passwordSchema,
  organizationName: z.string().trim().min(1).max(120),
});

export const signUpEmployeeSchema = z.object({
  displayName: displayNameSchema,
  email: emailSchema,
  password: passwordSchema,
  organizationId: z.string().uuid('Select an organization to join.'),
});
