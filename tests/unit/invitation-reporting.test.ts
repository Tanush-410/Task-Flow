import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ recordError: vi.fn() }));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/telemetry', () => ({ recordError: mocks.recordError }));

import { reportInvitationCleanupFailure } from '@/modules/members/invitation-reporting';

describe('reportInvitationCleanupFailure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reports through the privacy-safe telemetry seam', () => {
    reportInvitationCleanupFailure({
      traceId: 'trace-123',
      invitationId: 'invitation-123',
    });

    expect(mocks.recordError).toHaveBeenCalledOnce();
    expect(mocks.recordError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Invitation cleanup failed',
        code: 'INVITATION_CLEANUP_FAILED',
      }),
      'trace-123',
      {
        operation: 'invitation_cleanup',
        invitationId: 'invitation-123',
      },
    );
  });
});
