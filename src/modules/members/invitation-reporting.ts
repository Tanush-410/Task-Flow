import 'server-only';

export function reportInvitationCleanupFailure(event: {
  traceId: string;
  invitationId: string;
}) {
  console.error('invitation_cleanup_failed', event);
}
