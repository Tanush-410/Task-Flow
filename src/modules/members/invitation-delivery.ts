import 'server-only';

export type InvitationDeliveryRequest = {
  recipientEmail: string;
  invitationUrl: string;
};

export type InvitationDeliveryResult =
  { ok: true } | { ok: false; reason: 'unavailable' };

/**
 * No managed email provider is configured, so this is a best-effort/no-op
 * delivery channel — `inviteMember` no longer requires it to succeed.
 * Manual link-sharing (the admin copies the invite URL from the UI and
 * sends it themselves) is the supported primary path: the bearer URL is
 * deliberately returned to the admin's browser for that purpose. Wiring up
 * a real provider here later makes email delivery an additional channel,
 * not a required one.
 */
export async function deliverInvitation(
  request: InvitationDeliveryRequest,
): Promise<InvitationDeliveryResult> {
  void request;
  return { ok: false, reason: 'unavailable' };
}
