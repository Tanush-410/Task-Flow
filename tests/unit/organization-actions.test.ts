import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createServerSupabase: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabase: mocks.createServerSupabase,
}));

import { createOrganization } from '@/modules/organizations/actions';

describe('createOrganization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createServerSupabase.mockResolvedValue({ rpc: mocks.rpc });
  });

  it('returns field errors before opening a database client', async () => {
    const result = await createOrganization({
      name: '   ',
      timezone: 'Invalid/Timezone',
    });

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: 'INVALID_ORGANIZATION',
        message: 'Check the organization details.',
        fields: { name: expect.any(Array), timezone: expect.any(Array) },
        traceId: expect.any(String),
      },
    });
    expect(mocks.createServerSupabase).not.toHaveBeenCalled();
  });

  it('uses the bootstrap RPC and returns its organization id', async () => {
    mocks.rpc.mockResolvedValue({ data: 'org-123', error: null });

    const result = await createOrganization({
      name: ' Acme ',
      timezone: 'Asia/Kolkata',
    });

    expect(mocks.rpc).toHaveBeenCalledWith('bootstrap_organization', {
      organization_name: 'Acme',
      organization_timezone: 'Asia/Kolkata',
    });
    expect(result).toEqual({ ok: true, data: { organizationId: 'org-123' } });
  });

  it('does not leak database errors', async () => {
    mocks.rpc.mockRejectedValue(new Error('sensitive database detail'));

    const result = await createOrganization({ name: 'Acme', timezone: 'UTC' });

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: 'ORGANIZATION_CREATE_FAILED',
        message: 'The organization could not be created.',
        traceId: expect.any(String),
      },
    });
    expect(JSON.stringify(result)).not.toContain('sensitive');
  });
});
