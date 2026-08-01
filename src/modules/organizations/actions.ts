'use server';

import { randomUUID } from 'node:crypto';

import type { ActionResult } from '@/lib/result';
import { createServerSupabase } from '@/lib/supabase/server';

import { organizationSchema } from './schemas';

const CREATION_ERROR = {
  code: 'ORGANIZATION_CREATE_FAILED',
  message: 'The organization could not be created.',
} as const;

export async function createOrganization(
  input: unknown,
): Promise<ActionResult<{ organizationId: string }>> {
  const traceId = randomUUID();
  const parsed = organizationSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'INVALID_ORGANIZATION',
        message: 'Check the organization details.',
        traceId,
        fields: parsed.error.flatten().fieldErrors,
      },
    };
  }

  try {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase.rpc('bootstrap_organization', {
      organization_name: parsed.data.name,
      organization_timezone: parsed.data.timezone,
    });

    if (error || !data) {
      return { ok: false, error: { ...CREATION_ERROR, traceId } };
    }

    return { ok: true, data: { organizationId: data } };
  } catch {
    return { ok: false, error: { ...CREATION_ERROR, traceId } };
  }
}
