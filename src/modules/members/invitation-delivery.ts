import 'server-only';

export type InvitationDelivery = {
  invitationPath: `/invite/${string}`;
  delivery: 'deferred';
};

/**
 * Live email delivery is intentionally deferred until a managed Auth adapter is
 * configured. Keeping this server-only boundary prevents a future provider key
 * or raw token from entering client code or database rows.
 */
export function prepareInvitationDelivery(token: string): InvitationDelivery {
  return {
    invitationPath: `/invite/${token}`,
    delivery: 'deferred',
  };
}
