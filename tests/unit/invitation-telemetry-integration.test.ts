import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createAdminSupabase: vi.fn(),
  createServerSupabase: vi.fn(),
  deliverInvitation: vi.fn(),
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
vi.mock('@/modules/members/queries', () => ({
  requireAdmin: mocks.requireAdmin,
}));

import { inviteMember } from '@/modules/members/actions';

describe('invitation cleanup telemetry integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({
      organizationId: '10000000-0000-4000-8000-000000000001',
      role: 'admin',
      userId: '10000000-0000-4000-8000-000000000002',
    });
    mocks.serverEnv.mockReturnValue({ APP_ORIGIN: 'https://tasks.example' });
    mocks.createServerSupabase.mockResolvedValue({ rpc: mocks.rpc });
    mocks.createAdminSupabase.mockReturnValue({ rpc: mocks.rpc });
    mocks.deliverInvitation.mockResolvedValue({ ok: true });
    mocks.rpc.mockImplementation(async (name: string) => {
      if (name === 'stage_invitation') {
        return {
          data: [
            {
              id: '20000000-0000-4000-8000-000000000001',
              email: 'person@example.com',
              expires_at: '2026-08-09T00:00:00.000Z',
            },
          ],
          error: null,
        };
      }
      if (name === 'finalize_invitation_delivery') {
        return {
          data: null,
          error: new Error(
            'postgres://person@example.com:db-secret@db.example/tasks',
          ),
        };
      }
      if (name === 'discard_staged_invitation') {
        return {
          data: false,
          error: new Error(
            'postgres://person@example.com:db-secret@db.example/tasks',
          ),
        };
      }
      return { data: true, error: null };
    });
  });

  it('emits an actually serialized privacy-safe cleanup record', async () => {
    const records: string[] = [];
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation((record) => records.push(String(record)));

    const result = await inviteMember({
      email: 'person@example.com',
      role: 'employee',
    });

    consoleError.mockRestore();
    expect(result).toMatchObject({
      ok: false,
      error: { code: 'INVITATION_FINALIZE_FAILED' },
    });
    expect(records).toHaveLength(1);
    expect(JSON.parse(records[0])).toMatchObject({
      level: 'error',
      code: 'INVITATION_CLEANUP_FAILED',
      message: 'Invitation cleanup failed',
      context: {
        operation: 'invitation_cleanup',
        invitationId: '20000000-0000-4000-8000-000000000001',
      },
    });
    expect(records[0]).not.toContain('person@example.com');
    expect(records[0]).not.toContain('db-secret');
  });

  it('does not let telemetry sink failure alter invitation behavior', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {
      throw new Error('telemetry sink failed');
    });

    await expect(
      inviteMember({ email: 'person@example.com', role: 'employee' }),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: 'INVITATION_FINALIZE_FAILED' },
    });

    consoleError.mockRestore();
  });
});
