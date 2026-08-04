'use server';

import { randomUUID } from 'node:crypto';

import type { ActionResult } from '@/lib/result';
import { createServerSupabase } from '@/lib/supabase/server';

import { requireAdmin } from './queries';
import {
  connectionRequestResponseSchema,
  connectionRequestSchema,
} from './schemas';

const CONNECTION_REQUEST_ERROR = {
  code: 'CONNECTION_REQUEST_FAILED',
  message:
    'That code did not match anyone, or they are already a member of your organization.',
} as const;
const CONNECTION_RESPONSE_ERROR = {
  code: 'CONNECTION_RESPONSE_FAILED',
  message: 'This request could not be updated.',
} as const;

export async function requestConnection(
  input: unknown,
): Promise<ActionResult<{ requestId: string; targetDisplayName: string }>> {
  const traceId = randomUUID();
  const parsed = connectionRequestSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'INVALID_CONNECTION_REQUEST',
        message: 'Check the connect code.',
        traceId,
        fields: parsed.error.flatten().fieldErrors,
      },
    };
  }

  try {
    await requireAdmin();
    const supabase = await createServerSupabase();
    const { data, error } = await supabase.rpc('create_connection_request', {
      target_code: parsed.data.code,
      target_role: parsed.data.role,
    });

    if (error || !data?.[0]) {
      return { ok: false, error: { ...CONNECTION_REQUEST_ERROR, traceId } };
    }

    return {
      ok: true,
      data: {
        requestId: data[0].request_id,
        targetDisplayName: data[0].target_display_name,
      },
    };
  } catch {
    return { ok: false, error: { ...CONNECTION_REQUEST_ERROR, traceId } };
  }
}

export async function respondToConnectionRequest(
  input: unknown,
): Promise<
  ActionResult<{ organizationId: string; role: 'admin' | 'employee' } | null>
> {
  const traceId = randomUUID();
  const parsed = connectionRequestResponseSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: { ...CONNECTION_RESPONSE_ERROR, traceId } };
  }

  try {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase.rpc(
      'respond_to_connection_request',
      {
        request_id: parsed.data.requestId,
        accept: parsed.data.accept,
      },
    );

    const responded = data?.[0];

    if (error || !responded) {
      return { ok: false, error: { ...CONNECTION_RESPONSE_ERROR, traceId } };
    }

    return {
      ok: true,
      data:
        responded.organization_id && responded.role
          ? { organizationId: responded.organization_id, role: responded.role }
          : null,
    };
  } catch {
    return { ok: false, error: { ...CONNECTION_RESPONSE_ERROR, traceId } };
  }
}
