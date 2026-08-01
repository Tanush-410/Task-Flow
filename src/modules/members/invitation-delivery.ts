import 'server-only';

export type InvitationDeliveryRequest = {
  recipientEmail: string;
  invitationUrl: string;
};

export type InvitationDeliveryResult =
  { ok: true } | { ok: false; reason: 'unavailable' };

/**
 * Fail closed until a managed Supabase Auth admin invitation provider and its
 * server-only credentials are configured. Bearer invitation URLs must never be
 * logged or returned to browser code.
 */
export async function deliverInvitation(
  request: InvitationDeliveryRequest,
): Promise<InvitationDeliveryResult> {
  void request;
  return { ok: false, reason: 'unavailable' };
}
