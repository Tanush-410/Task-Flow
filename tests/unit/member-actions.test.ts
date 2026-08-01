import { createHash } from 'node:crypto';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createServerSupabase: vi.fn(),
  deleteInvitation: vi.fn(),
  deleteWhereId: vi.fn(),
  deliverInvitation: vi.fn(),
  from: vi.fn(),
  insert: vi.fn(),
  requireAdmin: vi.fn(),
  rpc: vi.fn(),
  select: vi.fn(),
  serverEnv: vi.fn(),
  single: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/server-env', () => ({ serverEnv: mocks.serverEnv }));
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabase: mocks.createServerSupabase,
}));
vi.mock('@/modules/members/invitation-delivery', () => ({
  deliverInvitation: mocks.deliverInvitation,
}));
vi.mock('@/modules/members/queries', () => ({
  requireAdmin: mocks.requireAdmin,
}));

import { acceptInvitation, inviteMember } from '@/modules/members/actions';

describe('inviteMember', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({
      organizationId: 'org-123',
      role: 'admin',
      userId: 'admin-123',
    });
    mocks.serverEnv.mockReturnValue({ APP_ORIGIN: 'https://tasks.example' });
    mocks.createServerSupabase.mockResolvedValue({
      from: mocks.from,
      rpc: mocks.rpc,
    });
    mocks.from.mockReturnValue({
      delete: mocks.deleteInvitation,
      insert: mocks.insert,
    });
    mocks.insert.mockReturnValue({ select: mocks.select });
    mocks.select.mockReturnValue({ single: mocks.single });
    mocks.single.mockResolvedValue({
      data: {
        email: 'person@example.com',
        expires_at: '2026-08-09T00:00:00.000Z',
        id: 'invite-123',
      },
      error: null,
    });
    mocks.deleteInvitation.mockReturnValue({ eq: mocks.deleteWhereId });
    mocks.deleteWhereId.mockResolvedValue({ error: null });
    mocks.deliverInvitation.mockResolvedValue({ ok: true });
  });

  it('requires verified admin context before persisting', async () => {
    await inviteMember({ email: ' PERSON@example.com ', role: 'employee' });

    expect(mocks.requireAdmin).toHaveBeenCalledOnce();
    expect(mocks.requireAdmin.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.insert.mock.invocationCallOrder[0],
    );
  });

  it('uses exactly the client-insertable columns and stores only a token hash', async () => {
    await inviteMember({ email: ' PERSON@example.com ', role: 'employee' });

    const inserted = mocks.insert.mock.calls[0][0];
    expect(Object.keys(inserted).sort()).toEqual([
      'email',
      'expires_at',
      'organization_id',
      'role',
      'token_hash',
    ]);
    expect(inserted).toMatchObject({
      email: 'person@example.com',
      organization_id: 'org-123',
      role: 'employee',
      token_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect(inserted).not.toHaveProperty('invited_by');
  });

  it('persists before delivering an absolute bearer URL and returns redacted metadata', async () => {
    const result = await inviteMember({
      email: ' PERSON@example.com ',
      role: 'employee',
    });

    expect(mocks.single.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.deliverInvitation.mock.invocationCallOrder[0],
    );
    expect(mocks.deliverInvitation).toHaveBeenCalledWith({
      invitationUrl: expect.stringMatching(
        /^https:\/\/tasks\.example\/invite\/[A-Za-z0-9_-]{43}$/,
      ),
      recipientEmail: 'person@example.com',
    });

    const invitationUrl =
      mocks.deliverInvitation.mock.calls[0][0].invitationUrl;
    const token = invitationUrl.split('/').at(-1);
    expect(mocks.insert.mock.calls[0][0].token_hash).toBe(
      createHash('sha256').update(token).digest('hex'),
    );
    expect(result).toEqual({
      ok: true,
      data: {
        email: 'person@example.com',
        expiresAt: '2026-08-09T00:00:00.000Z',
        invitationId: 'invite-123',
      },
    });
    expect(JSON.stringify(result)).not.toContain(token);
    expect(JSON.stringify(result)).not.toContain('/invite/');
  });

  it.each([
    [{ ok: false, reason: 'unavailable' }],
    [new Error('sensitive provider failure')],
  ])(
    'revokes the persisted invitation and fails safely when delivery is unavailable',
    async (deliveryOutcome) => {
      if (deliveryOutcome instanceof Error) {
        mocks.deliverInvitation.mockRejectedValueOnce(deliveryOutcome);
      } else {
        mocks.deliverInvitation.mockResolvedValueOnce(deliveryOutcome);
      }
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      const consoleLog = vi
        .spyOn(console, 'log')
        .mockImplementation(() => undefined);

      const result = await inviteMember({
        email: 'person@example.com',
        role: 'employee',
      });

      expect(mocks.deleteInvitation).toHaveBeenCalledOnce();
      expect(mocks.deleteWhereId).toHaveBeenCalledWith('id', 'invite-123');
      expect(result).toMatchObject({
        ok: false,
        error: {
          code: 'INVITATION_DELIVERY_UNAVAILABLE',
          message: 'Invitation delivery is currently unavailable.',
          traceId: expect.any(String),
        },
      });
      expect(JSON.stringify(result)).not.toContain('sensitive');
      expect(consoleError).not.toHaveBeenCalled();
      expect(consoleLog).not.toHaveBeenCalled();
      consoleError.mockRestore();
      consoleLog.mockRestore();
    },
  );

  it('returns generic errors for authorization and persistence failures', async () => {
    mocks.requireAdmin.mockRejectedValueOnce(
      new Error('sensitive auth detail'),
    );
    const denied = await inviteMember({
      email: 'person@example.com',
      role: 'employee',
    });

    mocks.single.mockResolvedValueOnce({
      data: null,
      error: new Error('sensitive unique violation'),
    });
    const failed = await inviteMember({
      email: 'person@example.com',
      role: 'employee',
    });

    for (const result of [denied, failed]) {
      expect(result).toMatchObject({
        ok: false,
        error: {
          code: 'INVITATION_CREATE_FAILED',
          message: 'The invitation could not be created.',
          traceId: expect.any(String),
        },
      });
      expect(JSON.stringify(result)).not.toContain('sensitive');
    }
    expect(mocks.deliverInvitation).not.toHaveBeenCalled();
  });
});

describe('acceptInvitation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createServerSupabase.mockResolvedValue({ rpc: mocks.rpc });
  });

  it('hashes the token before invoking the acceptance RPC', async () => {
    const token = 'a'.repeat(43);
    mocks.rpc.mockResolvedValue({
      data: [{ organization_id: 'org-123', role: 'employee' }],
      error: null,
    });

    const result = await acceptInvitation({ token });

    expect(mocks.rpc).toHaveBeenCalledWith('accept_invitation', {
      invitation_token_hash: createHash('sha256').update(token).digest('hex'),
    });
    expect(JSON.stringify(mocks.rpc.mock.calls)).not.toContain(token);
    expect(result).toEqual({
      ok: true,
      data: { organizationId: 'org-123', role: 'employee' },
    });
  });

  it('returns one generic error for invalid, expired, or used invitations', async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: new Error('INVITATION_INVALID'),
    });

    const result = await acceptInvitation({ token: 'b'.repeat(43) });

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: 'INVITATION_ACCEPT_FAILED',
        message: 'This invitation could not be accepted.',
        traceId: expect.any(String),
      },
    });
    expect(JSON.stringify(result)).not.toContain('INVITATION_INVALID');
  });
});
