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
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function parseServerEnv(value: unknown): ServerEnv {
  return serverEnvSchema.parse(value);
}

export function serverEnv(): ServerEnv {
  return parseServerEnv({
    APP_ORIGIN: process.env.APP_ORIGIN,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
}
