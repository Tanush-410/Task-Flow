import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ createAdminSupabase: vi.fn() }));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabase: mocks.createAdminSupabase,
}));

import { evaluateFeatureFlag } from '@/modules/operations/feature-flags';

describe('feature flag service-role query', () => {
  const input = {
    key: 'reports',
    environment: 'production' as const,
    userId: '10000000-0000-0000-0000-000000000001',
    organizationId: '20000000-0000-0000-0000-000000000001',
    role: 'admin' as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('filters materialized rows to global/requested organization and unscoped/requested role', async () => {
    const builder = {
      select: vi.fn(),
      eq: vi.fn(),
      or: vi.fn(),
      then: vi.fn((resolve) =>
        Promise.resolve(
          resolve({
            data: [
              {
                organization_id: null,
                role_scope: null,
                enabled: true,
                rollout_percentage: 100,
                expires_on: '2099-12-31',
              },
            ],
            error: null,
          }),
        ),
      ),
    };
    builder.select.mockReturnValue(builder);
    builder.eq.mockReturnValue(builder);
    builder.or.mockReturnValue(builder);
    const from = vi.fn().mockReturnValue(builder);
    mocks.createAdminSupabase.mockReturnValue({ from });

    await expect(evaluateFeatureFlag(input)).resolves.toBe(true);

    expect(from).toHaveBeenCalledWith('feature_flags');
    expect(builder.eq).toHaveBeenNthCalledWith(1, 'key', 'reports');
    expect(builder.eq).toHaveBeenNthCalledWith(2, 'environment', 'production');
    expect(builder.or).toHaveBeenNthCalledWith(
      1,
      `organization_id.is.null,organization_id.eq.${input.organizationId}`,
    );
    expect(builder.or).toHaveBeenNthCalledWith(
      2,
      'role_scope.is.null,role_scope.eq.admin',
    );
  });
});
