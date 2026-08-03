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

// Intentionally looser than z.string().uuid(): that validator requires a
// strict RFC 4122 version/variant nibble, which rejects Postgres's own
// (perfectly valid) uuid values that don't follow that convention — for
// example the seeded demo organization id in supabase/seed.sql. The
// organization id is re-validated for existence by
// join_organization_as_employee regardless.
const looseUuidSchema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    'Select an organization to join.',
  );

export const signUpEmployeeSchema = z.object({
  displayName: displayNameSchema,
  email: emailSchema,
  password: passwordSchema,
  organizationId: looseUuidSchema,
});
