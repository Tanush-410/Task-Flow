import { describe, expect, it } from 'vitest';

import {
  AuthContextError,
  MembershipContextError,
  requireSingleMembership,
  resolveMembershipAccess,
} from '@/modules/members/context';

describe('requireSingleMembership', () => {
  it('returns the only active membership', () => {
    const membership = {
      organizationId: 'org',
      userId: 'user',
      role: 'admin' as const,
    };

    expect(requireSingleMembership([membership])).toEqual(membership);
  });

  it('rejects missing membership', () => {
    expect(() => requireSingleMembership([])).toThrow(
      'ACTIVE_MEMBERSHIP_REQUIRED',
    );
  });

  it('rejects multiple active memberships with a typed context error', () => {
    const memberships = [
      { organizationId: 'org-a', userId: 'user', role: 'admin' as const },
      { organizationId: 'org-b', userId: 'user', role: 'employee' as const },
    ];

    expect(() => requireSingleMembership(memberships)).toThrow(
      MembershipContextError,
    );
    expect(() => requireSingleMembership(memberships)).toThrow(
      'MULTIPLE_ACTIVE_MEMBERSHIPS',
    );
  });
});

describe('resolveMembershipAccess', () => {
  it('sends an unverified request without a subject to login', async () => {
    const result = await resolveMembershipAccess(
      async () => ({ data: { claims: {} }, error: null }),
      async () => {
        throw new Error('membership query must not run');
      },
    );

    expect(result).toEqual({ kind: 'redirect', location: '/login' });
  });

  it('throws a safe auth context error when claim verification fails', async () => {
    const result = resolveMembershipAccess(
      async () => ({
        data: null,
        error: new Error('sensitive claim detail'),
      }),
      async () => ({ data: [], error: null }),
    );

    await expect(result).rejects.toBeInstanceOf(AuthContextError);
    await expect(result).rejects.toThrow('CLAIM_VERIFICATION_FAILED');
    await expect(result).rejects.not.toThrow('sensitive claim detail');
  });

  it('throws a safe auth context error when the membership query fails', async () => {
    const result = resolveMembershipAccess(
      async () => ({ data: { claims: { sub: 'user' } }, error: null }),
      async () => ({
        data: null,
        error: new Error('sensitive database detail'),
      }),
    );

    await expect(result).rejects.toBeInstanceOf(AuthContextError);
    await expect(result).rejects.toThrow('MEMBERSHIP_QUERY_FAILED');
    await expect(result).rejects.not.toThrow('sensitive database detail');
  });

  it('maps the database membership role into application context', async () => {
    const result = await resolveMembershipAccess(
      async () => ({ data: { claims: { sub: 'user' } }, error: null }),
      async () => ({
        data: [
          {
            organization_id: 'org',
            user_id: 'user',
            role: 'employee',
          },
        ],
        error: null,
      }),
    );

    expect(result).toEqual({
      kind: 'membership',
      membership: {
        organizationId: 'org',
        userId: 'user',
        role: 'employee',
      },
    });
  });

  it('sends a verified user without an active membership to access pending', async () => {
    const result = await resolveMembershipAccess(
      async () => ({ data: { claims: { sub: 'user' } }, error: null }),
      async () => ({ data: [], error: null }),
    );

    expect(result).toEqual({
      kind: 'redirect',
      location: '/access-pending',
    });
  });

  it('rejects multiple database memberships as a context integrity failure', async () => {
    const result = resolveMembershipAccess(
      async () => ({ data: { claims: { sub: 'user' } }, error: null }),
      async () => ({
        data: [
          { organization_id: 'org-a', user_id: 'user', role: 'admin' },
          { organization_id: 'org-b', user_id: 'user', role: 'employee' },
        ],
        error: null,
      }),
    );

    await expect(result).rejects.toBeInstanceOf(MembershipContextError);
    await expect(result).rejects.toThrow('MULTIPLE_ACTIVE_MEMBERSHIPS');
  });
});
