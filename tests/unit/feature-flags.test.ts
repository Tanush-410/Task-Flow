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

  it.each([
    ['user', 'reports', 23],
    ['alpha', 'reports', 58],
    ['user', 'boards', 72],
  ])('matches the known SHA-256 bucket for %s/%s', (userId, key, bucket) => {
    expect(isInRollout(userId, key, bucket)).toBe(false);
    expect(isInRollout(userId, key, bucket + 1)).toBe(true);
  });

  it('is monotonic as rollout percentage increases', () => {
    const evaluations = Array.from({ length: 101 }, (_, percentage) =>
      isInRollout('user', 'reports', percentage),
    );
    const firstIncluded = evaluations.indexOf(true);

    expect(evaluations.slice(0, firstIncluded)).not.toContain(true);
    expect(evaluations.slice(firstIncluded)).not.toContain(false);
  });

  it('separates user and key inputs', () => {
    expect(isInRollout('user', 'reports', 50)).toBe(true);
    expect(isInRollout('alpha', 'reports', 50)).toBe(false);
    expect(isInRollout('user', 'boards', 50)).toBe(false);
  });

  it('distributes a 50 percent rollout across a representative population', () => {
    const included = Array.from({ length: 1_000 }, (_, index) =>
      isInRollout(`user-${index}`, 'reports', 50),
    ).filter(Boolean).length;

    expect(included).toBeGreaterThanOrEqual(400);
    expect(included).toBeLessThanOrEqual(600);
  });

  it('clamps percentages below and above the supported boundaries', () => {
    expect(isInRollout('user', 'reports', -1)).toBe(false);
    expect(isInRollout('user', 'reports', 101)).toBe(true);
  });

  it('fails closed for invalid rollout inputs', () => {
    expect(isInRollout('', 'reports', 50)).toBe(false);
    expect(isInRollout('   ', 'reports', 100)).toBe(false);
    expect(isInRollout('user ', 'reports', 100)).toBe(false);
    expect(isInRollout(null as never, 'reports', 50)).toBe(false);
    expect(isInRollout(42 as never, 'reports', 50)).toBe(false);
    expect(isInRollout('x'.repeat(129), 'reports', 100)).toBe(false);
    expect(isInRollout('user', '', 50)).toBe(false);
    expect(isInRollout('user', '   ', 100)).toBe(false);
    expect(isInRollout('user', ' reports', 100)).toBe(false);
    expect(isInRollout('user', 'Reports', 100)).toBe(false);
    expect(isInRollout('user', 'x'.repeat(65), 100)).toBe(false);
    expect(isInRollout('user', null as never, 50)).toBe(false);
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
    userId: '10000000-0000-0000-0000-000000000001',
    organizationId: 'abcdef00-0000-0000-0000-000000000001',
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
        organization_id: input.organizationId,
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
      organizationId: input.organizationId,
      role: 'admin',
    });
  });

  it('ignores rows outside the requested organization and role', async () => {
    const query = vi.fn().mockResolvedValue([
      {
        organization_id: '20000000-0000-0000-0000-000000000002',
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

  it('treats expires_on as inclusive through the matching UTC date', async () => {
    const query = vi.fn().mockResolvedValue([
      {
        organization_id: null,
        role_scope: null,
        enabled: true,
        rollout_percentage: 100,
        expires_on: '2026-08-01',
      },
    ]);

    await expect(
      evaluateFeatureFlag(input, {
        query,
        now: () => new Date('2026-08-01T23:59:59.999Z'),
      }),
    ).resolves.toBe(true);
    await expect(
      evaluateFeatureFlag(input, {
        query,
        now: () => new Date('2026-08-01T23:30:00.000-02:00'),
      }),
    ).resolves.toBe(false);
  });

  it.each([
    {
      name: 'organization and role over organization-only',
      rows: [
        { organization: 'requested', role: null, enabled: true },
        { organization: 'requested', role: 'admin', enabled: false },
        { organization: null, role: 'admin', enabled: true },
        { organization: null, role: null, enabled: true },
      ],
      expected: false,
    },
    {
      name: 'organization-only over global role',
      rows: [
        { organization: 'requested', role: null, enabled: true },
        { organization: null, role: 'admin', enabled: false },
        { organization: null, role: null, enabled: false },
      ],
      expected: true,
    },
    {
      name: 'global role over global unscoped',
      rows: [
        { organization: null, role: 'admin', enabled: true },
        { organization: null, role: null, enabled: false },
      ],
      expected: true,
    },
    {
      name: 'global unscoped as the final fallback',
      rows: [{ organization: null, role: null, enabled: true }],
      expected: true,
    },
  ])('orders $name', async ({ rows, expected }) => {
    const query = vi.fn().mockResolvedValue(
      rows.map((row) => ({
        organization_id:
          row.organization === 'requested' ? input.organizationId : null,
        role_scope: row.role,
        enabled: row.enabled,
        rollout_percentage: 100,
        expires_on: '2099-12-31',
      })),
    );

    await expect(evaluateFeatureFlag(input, { query })).resolves.toBe(expected);
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

  it.each([
    null,
    {},
    { ...input, key: 42 },
    { ...input, key: ' reports' },
    { ...input, key: 'Reports' },
    { ...input, key: 'x'.repeat(65) },
    { ...input, userId: null },
    { ...input, userId: `${input.userId} ` },
    { ...input, userId: 'not-a-uuid' },
    { ...input, organizationId: 'not-a-uuid' },
    { ...input, organizationId: input.organizationId.toUpperCase() },
  ])('fails closed for malformed runtime input %#', async (candidate) => {
    const query = vi.fn();

    await expect(
      evaluateFeatureFlag(candidate as never, { query }),
    ).resolves.toBe(false);
    expect(query).not.toHaveBeenCalled();
  });
});
