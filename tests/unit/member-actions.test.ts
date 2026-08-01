import { createHash } from 'node:crypto';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createServerSupabase: vi.fn(),
  insert: vi.fn(),
  requireAdmin: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabase: mocks.createServerSupabase,
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
    mocks.createServerSupabase.mockResolvedValue({
      from: vi.fn(() => ({ insert: mocks.insert })),
      rpc: mocks.rpc,
    });
    mocks.insert.mockResolvedValue({ error: null });
  });

  it('requires verified admin context before creating an invitation', async () => {
    await inviteMember({ email: ' PERSON@example.com ', role: 'employee' });

    expect(mocks.requireAdmin).toHaveBeenCalledOnce();
    expect(mocks.requireAdmin.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.insert.mock.invocationCallOrder[0],
    );
  });

  it('stores only a SHA-256 hash of a 32-byte base64url token', async () => {
    const result = await inviteMember({
      email: ' PERSON@example.com ',
      role: 'employee',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected invitation success');

    expect(result.data.invitationPath).toMatch(/^\/invite\/[A-Za-z0-9_-]{43}$/);
    const token = result.data.invitationPath.slice('/invite/'.length);
    const inserted = mocks.insert.mock.calls[0][0];
    expect(inserted).toMatchObject({
      email: 'person@example.com',
      invited_by: 'admin-123',
      organization_id: 'org-123',
      role: 'employee',
      token_hash: createHash('sha256').update(token).digest('hex'),
    });
    expect(inserted.expires_at).toEqual(expect.any(String));
    expect(JSON.stringify(inserted)).not.toContain(token);
  });

  it('returns generic errors for authorization and persistence failures', async () => {
    mocks.requireAdmin.mockRejectedValueOnce(
      new Error('sensitive auth detail'),
    );
    const denied = await inviteMember({
      email: 'person@example.com',
      role: 'employee',
    });

    mocks.insert.mockResolvedValueOnce({
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
