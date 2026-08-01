import { createHash } from 'node:crypto';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createAdminSupabase: vi.fn(),
  createServerSupabase: vi.fn(),
  deliverInvitation: vi.fn(),
  reportCleanupFailure: vi.fn(),
  requireAdmin: vi.fn(),
  rpc: vi.fn(),
  serverEnv: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/server-env', () => ({ serverEnv: mocks.serverEnv }));
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabase: mocks.createServerSupabase,
}));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabase: mocks.createAdminSupabase,
}));
vi.mock('@/modules/members/invitation-delivery', () => ({
  deliverInvitation: mocks.deliverInvitation,
}));
vi.mock('@/modules/members/invitation-reporting', () => ({
  reportInvitationCleanupFailure: mocks.reportCleanupFailure,
}));
vi.mock('@/modules/members/queries', () => ({
  requireAdmin: mocks.requireAdmin,
}));

import { acceptInvitation, inviteMember } from '@/modules/members/actions';

const staged = {
  email: 'person@example.com',
  expires_at: '2026-08-09T00:00:00.000Z',
  id: 'invite-123',
};

describe('inviteMember', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({
      organizationId: 'org-123',
      role: 'admin',
      userId: 'admin-123',
    });
    mocks.serverEnv.mockReturnValue({ APP_ORIGIN: 'https://tasks.example' });
    mocks.createServerSupabase.mockResolvedValue({ rpc: mocks.rpc });
    mocks.createAdminSupabase.mockReturnValue({ rpc: mocks.rpc });
    mocks.rpc.mockImplementation(async (name: string) => {
      if (name === 'stage_invitation') return { data: [staged], error: null };
      return { data: true, error: null };
    });
    mocks.deliverInvitation.mockResolvedValue({ ok: true });
  });

  it('stages, delivers, then finalizes and returns only redacted metadata', async () => {
    const result = await inviteMember({
      email: ' PERSON@example.com ',
      role: 'employee',
    });

    expect(mocks.requireAdmin).toHaveBeenCalledOnce();
    expect(mocks.rpc).toHaveBeenNthCalledWith(1, 'stage_invitation', {
      invitation_email: 'person@example.com',
      invitation_expires_at: expect.any(String),
      invitation_role: 'employee',
      invitation_token_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect(mocks.deliverInvitation).toHaveBeenCalledWith({
      invitationUrl: expect.stringMatching(
        /^https:\/\/tasks\.example\/invite\/[A-Za-z0-9_-]{43}$/,
      ),
      recipientEmail: 'person@example.com',
    });
    expect(mocks.rpc).toHaveBeenNthCalledWith(
      2,
      'finalize_invitation_delivery',
      {
        invitation_id: 'invite-123',
      },
    );
    expect(mocks.createAdminSupabase).toHaveBeenCalledOnce();
    expect(mocks.rpc.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.deliverInvitation.mock.invocationCallOrder[0],
    );
    expect(mocks.deliverInvitation.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.rpc.mock.invocationCallOrder[1],
    );
    const token = mocks.deliverInvitation.mock.calls[0][0].invitationUrl
      .split('/')
      .at(-1);
    expect(mocks.rpc.mock.calls[0][1].invitation_token_hash).toBe(
      createHash('sha256').update(token).digest('hex'),
    );
    expect(result).toEqual({
      ok: true,
      data: {
        invitationId: staged.id,
        email: staged.email,
        expiresAt: staged.expires_at,
      },
    });
    expect(JSON.stringify(result)).not.toContain(token);
  });

  it.each([
    [{ ok: false, reason: 'unavailable' }],
    [new Error('sensitive delivery failure')],
  ])(
    'discards staging after delivery failure and inspects cleanup errors',
    async (outcome) => {
      if (outcome instanceof Error)
        mocks.deliverInvitation.mockRejectedValueOnce(outcome);
      else mocks.deliverInvitation.mockResolvedValueOnce(outcome);
      mocks.rpc.mockImplementation(async (name: string) => {
        if (name === 'stage_invitation') return { data: [staged], error: null };
        if (name === 'discard_staged_invitation') {
          return { data: null, error: new Error('sensitive cleanup failure') };
        }
        return { data: true, error: null };
      });

      const result = await inviteMember({
        email: 'person@example.com',
        role: 'employee',
      });

      expect(mocks.rpc).toHaveBeenLastCalledWith('discard_staged_invitation', {
        invitation_id: staged.id,
      });
      expect(result).toMatchObject({
        ok: false,
        error: {
          code: 'INVITATION_DELIVERY_UNAVAILABLE',
          traceId: expect.any(String),
        },
      });
      expect(JSON.stringify(result)).not.toContain('sensitive');
    },
  );

  it('marks staging failed and returns an operational error when finalize fails', async () => {
    mocks.rpc.mockImplementation(async (name: string) => {
      if (name === 'stage_invitation') return { data: [staged], error: null };
      if (name === 'finalize_invitation_delivery') {
        return { data: null, error: new Error('sensitive finalize failure') };
      }
      return { data: true, error: null };
    });

    const result = await inviteMember({
      email: 'person@example.com',
      role: 'employee',
    });

    expect(mocks.rpc).toHaveBeenLastCalledWith('discard_staged_invitation', {
      invitation_id: staged.id,
    });
    expect(result).toMatchObject({
      ok: false,
      error: {
        code: 'INVITATION_FINALIZE_FAILED',
        traceId: expect.any(String),
      },
    });
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
    expect(result).toEqual({
      ok: true,
      data: { organizationId: 'org-123', role: 'employee' },
    });
  });

  it('returns one generic error for unusable invitations', async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: new Error('INVITATION_INVALID'),
    });
    const result = await acceptInvitation({ token: 'b'.repeat(43) });
    expect(result).toMatchObject({
      ok: false,
      error: { code: 'INVITATION_ACCEPT_FAILED', traceId: expect.any(String) },
    });
    expect(JSON.stringify(result)).not.toContain('INVITATION_INVALID');
  });
});
