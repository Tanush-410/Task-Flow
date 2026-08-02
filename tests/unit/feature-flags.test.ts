import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  evaluateFeatureFlag,
  isInRollout,
} from '@/modules/operations/feature-flags';

describe('isInRollout', () => {
  it('includes everyone at 100 percent', () => {
    expect(isInRollout('user', 'reports', 100)).toBe(true);
  });

  it('excludes everyone at 0 percent', () => {
    expect(isInRollout('user', 'reports', 0)).toBe(false);
  });

  it('is deterministic at 50 percent', () => {
    const firstEvaluation = isInRollout('user', 'reports', 50);

    expect(isInRollout('user', 'reports', 50)).toBe(firstEvaluation);
  });

  it('clamps percentages below and above the supported boundaries', () => {
    expect(isInRollout('user', 'reports', -1)).toBe(false);
    expect(isInRollout('user', 'reports', 101)).toBe(true);
  });

  it('fails closed for invalid rollout inputs', () => {
    expect(isInRollout('', 'reports', 50)).toBe(false);
    expect(isInRollout('   ', 'reports', 100)).toBe(false);
    expect(isInRollout('user', '', 50)).toBe(false);
    expect(isInRollout('user', '   ', 100)).toBe(false);
    expect(isInRollout('user', 'reports', Number.NaN)).toBe(false);
    expect(isInRollout('user', 'reports', Number.POSITIVE_INFINITY)).toBe(
      false,
    );
  });
});

describe('evaluateFeatureFlag', () => {
  const input = {
    key: 'reports',
    environment: 'production' as const,
    userId: 'user',
    organizationId: 'organization-a',
    role: 'admin' as const,
  };

  it('uses the most specific organization and role scope', async () => {
    const query = vi.fn().mockResolvedValue([
      {
        organization_id: null,
        role_scope: null,
        enabled: true,
        rollout_percentage: 100,
        expires_on: '2099-12-31',
      },
      {
        organization_id: 'organization-a',
        role_scope: 'admin',
        enabled: false,
        rollout_percentage: 100,
        expires_on: '2099-12-31',
      },
    ]);

    await expect(evaluateFeatureFlag(input, { query })).resolves.toBe(false);
    expect(query).toHaveBeenCalledWith({
      key: 'reports',
      environment: 'production',
    });
  });

  it('ignores rows outside the requested organization and role', async () => {
    const query = vi.fn().mockResolvedValue([
      {
        organization_id: 'organization-b',
        role_scope: 'admin',
        enabled: true,
        rollout_percentage: 100,
        expires_on: '2099-12-31',
      },
      {
        organization_id: null,
        role_scope: 'employee',
        enabled: true,
        rollout_percentage: 100,
        expires_on: '2099-12-31',
      },
    ]);

    await expect(evaluateFeatureFlag(input, { query })).resolves.toBe(false);
  });

  it('fails closed for disabled and expired flags', async () => {
    const disabledQuery = vi.fn().mockResolvedValue([
      {
        organization_id: null,
        role_scope: null,
        enabled: false,
        rollout_percentage: 100,
        expires_on: '2099-12-31',
      },
    ]);
    const expiredQuery = vi.fn().mockResolvedValue([
      {
        organization_id: null,
        role_scope: null,
        enabled: true,
        rollout_percentage: 100,
        expires_on: '2026-07-31',
      },
    ]);

    await expect(
      evaluateFeatureFlag(input, { query: disabledQuery }),
    ).resolves.toBe(false);
    await expect(
      evaluateFeatureFlag(input, {
        query: expiredQuery,
        now: () => new Date('2026-08-01T00:00:00.000Z'),
      }),
    ).resolves.toBe(false);
  });

  it('applies the deterministic user rollout to an active flag', async () => {
    const query = vi.fn().mockResolvedValue([
      {
        organization_id: null,
        role_scope: null,
        enabled: true,
        rollout_percentage: 50,
        expires_on: '2099-12-31',
      },
    ]);

    await expect(evaluateFeatureFlag(input, { query })).resolves.toBe(
      isInRollout(input.userId, input.key, 50),
    );
  });

  it('fails closed on missing, query, ambiguous, and malformed configuration', async () => {
    const validRow = {
      organization_id: null,
      role_scope: null,
      enabled: true,
      rollout_percentage: 100,
      expires_on: '2099-12-31',
    };

    await expect(
      evaluateFeatureFlag(input, { query: vi.fn().mockResolvedValue([]) }),
    ).resolves.toBe(false);
    await expect(
      evaluateFeatureFlag(input, {
        query: vi.fn().mockRejectedValue(new Error('raw provider error')),
      }),
    ).resolves.toBe(false);
    await expect(
      evaluateFeatureFlag(input, {
        query: vi.fn().mockResolvedValue([validRow, validRow]),
      }),
    ).resolves.toBe(false);
    await expect(
      evaluateFeatureFlag(input, {
        query: vi
          .fn()
          .mockResolvedValue([{ ...validRow, rollout_percentage: 101 }]),
      }),
    ).resolves.toBe(false);
    await expect(
      evaluateFeatureFlag(input, {
        query: vi
          .fn()
          .mockResolvedValue([{ ...validRow, expires_on: '2099-02-31' }]),
      }),
    ).resolves.toBe(false);
  });

  it('fails closed before querying for invalid evaluation input', async () => {
    const query = vi.fn().mockResolvedValue([
      {
        organization_id: null,
        role_scope: null,
        enabled: true,
        rollout_percentage: 100,
        expires_on: '2099-12-31',
      },
    ]);

    await expect(
      evaluateFeatureFlag(
        { ...input, environment: 'preview' as typeof input.environment },
        { query },
      ),
    ).resolves.toBe(false);
    expect(query).not.toHaveBeenCalled();
  });
});
