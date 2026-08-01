'use server';

import { createHash, randomBytes, randomUUID } from 'node:crypto';

import type { ActionResult } from '@/lib/result';
import { serverEnv } from '@/lib/server-env';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { createServerSupabase } from '@/lib/supabase/server';

import { deliverInvitation } from './invitation-delivery';
import { reportInvitationCleanupFailure } from './invitation-reporting';
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
const INVITATION_FINALIZE_ERROR = {
  code: 'INVITATION_FINALIZE_FAILED',
  message: 'The invitation was delivered but could not be activated.',
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
    await requireAdmin();
    token = randomBytes(32).toString('base64url');
    supabase = await createServerSupabase();
    const { data, error } = await supabase.rpc('stage_invitation', {
      invitation_email: parsed.data.email,
      invitation_role: parsed.data.role,
      invitation_token_hash: hashToken(token),
      invitation_expires_at: new Date(
        Date.now() + INVITATION_LIFETIME_MS,
      ).toISOString(),
    });

    if (error || !data?.[0]) {
      return { ok: false, error: { ...INVITATION_CREATE_ERROR, traceId } };
    }
    invitation = data[0];
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
      const discarded = await supabase.rpc('discard_staged_invitation', {
        invitation_id: invitation.id,
      });
      if (discarded.error) {
        reportInvitationCleanupFailure({
          traceId,
          invitationId: invitation.id,
        });
      }
    } catch {
      // Best-effort revocation; never leak delivery or bearer-token details.
    }
    return { ok: false, error: { ...INVITATION_DELIVERY_ERROR, traceId } };
  }

  try {
    const admin = createAdminSupabase();
    const finalized = await admin.rpc('finalize_invitation_delivery', {
      invitation_id: invitation.id,
    });
    if (finalized.error || !finalized.data) {
      await supabase.rpc('discard_staged_invitation', {
        invitation_id: invitation.id,
      });
      return { ok: false, error: { ...INVITATION_FINALIZE_ERROR, traceId } };
    }
  } catch {
    try {
      await supabase.rpc('discard_staged_invitation', {
        invitation_id: invitation.id,
      });
    } catch {
      // Pending-delivery tokens remain unusable and require support cleanup.
    }
    return { ok: false, error: { ...INVITATION_FINALIZE_ERROR, traceId } };
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
