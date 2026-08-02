import 'server-only';

import { recordError } from '@/lib/telemetry';

export function reportInvitationCleanupFailure(event: {
  traceId: string;
  invitationId: string;
}) {
  const error = Object.assign(new Error('Invitation cleanup failed'), {
    code: 'INVITATION_CLEANUP_FAILED',
  });

  recordError(error, event.traceId, {
    operation: 'invitation_cleanup',
    invitationId: event.invitationId,
  });
}
