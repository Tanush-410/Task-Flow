import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { deliverInvitation } from '@/modules/members/invitation-delivery';

describe('deliverInvitation', () => {
  it('fails closed without logging bearer invitation data', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const consoleLog = vi
      .spyOn(console, 'log')
      .mockImplementation(() => undefined);

    await expect(
      deliverInvitation({
        invitationUrl: `https://tasks.example/invite/${'a'.repeat(43)}`,
        recipientEmail: 'person@example.com',
      }),
    ).resolves.toEqual({ ok: false, reason: 'unavailable' });
    expect(consoleError).not.toHaveBeenCalled();
    expect(consoleLog).not.toHaveBeenCalled();
    consoleError.mockRestore();
    consoleLog.mockRestore();
  });
});
