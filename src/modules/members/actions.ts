'use server';

import { createHash, randomBytes, randomUUID } from 'node:crypto';

import type { ActionResult } from '@/lib/result';
import { serverEnv } from '@/lib/server-env';
import { createServerSupabase } from '@/lib/supabase/server';

import { deliverInvitation } from './invitation-delivery';
import { requireAdmin } from './queries';
import { invitationAcceptanceSchema, invitationSchema } from './schemas';

const INVITATION_CREATE_ERROR = {
  code: 'INVITATION_CREATE_FAILED',
  message: 'The invitation could not be created.',
} as const;
const INVITATION_ACCEPT_ERROR = {
  code: 'INVITATION_ACCEPT_FAILED',
  message: 'This invitation could not be accepted.',
} as const;
const INVITATION_DELIVERY_ERROR = {
  code: 'INVITATION_DELIVERY_UNAVAILABLE',
  message: 'Invitation delivery is currently unavailable.',
} as const;
const INVITATION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1_000;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function inviteMember(
  input: unknown,
): Promise<
  ActionResult<{ invitationId: string; email: string; expiresAt: string }>
> {
  const traceId = randomUUID();
  const parsed = invitationSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'INVALID_INVITATION',
        message: 'Check the invitation details.',
        traceId,
        fields: parsed.error.flatten().fieldErrors,
      },
    };
  }

  let invitation: { id: string; email: string; expires_at: string };
  let token: string;
  let supabase: Awaited<ReturnType<typeof createServerSupabase>>;

  try {
    const admin = await requireAdmin();
    token = randomBytes(32).toString('base64url');
    supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from('invitations')
      .insert({
        organization_id: admin.organizationId,
        email: parsed.data.email,
        role: parsed.data.role,
        token_hash: hashToken(token),
        expires_at: new Date(Date.now() + INVITATION_LIFETIME_MS).toISOString(),
      })
      .select('id,email,expires_at')
      .single();

    if (error || !data) {
      return { ok: false, error: { ...INVITATION_CREATE_ERROR, traceId } };
    }
    invitation = data;
  } catch {
    return { ok: false, error: { ...INVITATION_CREATE_ERROR, traceId } };
  }

  let delivered = false;
  try {
    const { APP_ORIGIN } = serverEnv();
    const invitationUrl = new URL(`/invite/${token}`, APP_ORIGIN).toString();
    delivered = (
      await deliverInvitation({
        recipientEmail: invitation.email,
        invitationUrl,
      })
    ).ok;
  } catch {
    delivered = false;
  }

  if (!delivered) {
    try {
      await supabase.from('invitations').delete().eq('id', invitation.id);
    } catch {
      // Best-effort revocation; never leak delivery or bearer-token details.
    }
    return { ok: false, error: { ...INVITATION_DELIVERY_ERROR, traceId } };
  }

  return {
    ok: true,
    data: {
      invitationId: invitation.id,
      email: invitation.email,
      expiresAt: invitation.expires_at,
    },
  };
}

export async function acceptInvitation(
  input: unknown,
): Promise<
  ActionResult<{ organizationId: string; role: 'admin' | 'employee' }>
> {
  const traceId = randomUUID();
  const parsed = invitationAcceptanceSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: { ...INVITATION_ACCEPT_ERROR, traceId } };
  }

  try {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase.rpc('accept_invitation', {
      invitation_token_hash: hashToken(parsed.data.token),
    });

    const accepted = data?.[0];

    if (error || !accepted) {
      return { ok: false, error: { ...INVITATION_ACCEPT_ERROR, traceId } };
    }

    return {
      ok: true,
      data: { organizationId: accepted.organization_id, role: accepted.role },
    };
  } catch {
    return { ok: false, error: { ...INVITATION_ACCEPT_ERROR, traceId } };
  }
}
