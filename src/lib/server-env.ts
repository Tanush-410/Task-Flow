import 'server-only';

import { z } from 'zod';

const applicationOriginSchema = z.url().transform((value, context) => {
  const url = new URL(value);

  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    context.addIssue({
      code: 'custom',
      message: 'APP_ORIGIN must be an HTTP origin without a path.',
    });
    return z.NEVER;
  }

  return url.origin;
});

const serverEnvSchema = z.object({
  APP_ORIGIN: applicationOriginSchema,
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  AZURE_DEVOPS_ENTRA_TENANT_ID: z.string().min(1),
  AZURE_DEVOPS_ENTRA_CLIENT_ID: z.uuid(),
  AZURE_DEVOPS_ENTRA_CLIENT_SECRET: z.string().min(1),
  AZURE_DEVOPS_OAUTH_SCOPES: z
    .string()
    .refine((value) => value.split(/\s+/).includes('offline_access')),
  AZURE_DEVOPS_TOKEN_ENCRYPTION_KEY: z
    .base64()
    .refine((value) => Buffer.from(value, 'base64').byteLength === 32),
  AZURE_DEVOPS_TOKEN_KEY_ID: z
    .string()
    .regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$/),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function parseServerEnv(value: unknown): ServerEnv {
  return serverEnvSchema.parse(value);
}

export function serverEnv(): ServerEnv {
  return parseServerEnv({
    APP_ORIGIN: process.env.APP_ORIGIN,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    AZURE_DEVOPS_ENTRA_TENANT_ID: process.env.AZURE_DEVOPS_ENTRA_TENANT_ID,
    AZURE_DEVOPS_ENTRA_CLIENT_ID: process.env.AZURE_DEVOPS_ENTRA_CLIENT_ID,
    AZURE_DEVOPS_ENTRA_CLIENT_SECRET:
      process.env.AZURE_DEVOPS_ENTRA_CLIENT_SECRET,
    AZURE_DEVOPS_OAUTH_SCOPES: process.env.AZURE_DEVOPS_OAUTH_SCOPES,
    AZURE_DEVOPS_TOKEN_ENCRYPTION_KEY:
      process.env.AZURE_DEVOPS_TOKEN_ENCRYPTION_KEY,
    AZURE_DEVOPS_TOKEN_KEY_ID: process.env.AZURE_DEVOPS_TOKEN_KEY_ID,
  });
}
