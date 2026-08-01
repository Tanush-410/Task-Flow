import {
  AuthApiError,
  AuthInvalidJwtError,
  AuthRetryableFetchError,
  AuthSessionMissingError,
} from '@supabase/supabase-js';
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

  it.each([
    new AuthInvalidJwtError('invalid signature detail'),
    new AuthSessionMissingError(),
    new AuthApiError('revoked session detail', 401, 'session_not_found'),
  ])('sends a terminal invalid session to login', async (error) => {
    const result = await resolveMembershipAccess(
      async () => ({ data: null, error }),
      async () => {
        throw new Error('membership query must not run');
      },
    );

    expect(result).toEqual({ kind: 'redirect', location: '/login' });
  });

  it('throws a safe auth context error with the operational cause', async () => {
    const operationalError = new AuthRetryableFetchError(
      'sensitive JWKS network detail',
      503,
    );
    const result = resolveMembershipAccess(
      async () => ({
        data: null,
        error: operationalError,
      }),
      async () => ({ data: [], error: null }),
    );

    const error = await result.catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AuthContextError);
    expect(error).toMatchObject({
      message: 'CLAIM_VERIFICATION_FAILED',
      cause: operationalError,
    });
    expect((error as Error).message).not.toContain('sensitive JWKS');
  });

  it('wraps a thrown claim-verification failure with its cause', async () => {
    const operationalError = new Error('sensitive crypto failure');
    const result = resolveMembershipAccess(
      async () => {
        throw operationalError;
      },
      async () => ({ data: [], error: null }),
    );

    const error = await result.catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AuthContextError);
    expect(error).toMatchObject({
      message: 'CLAIM_VERIFICATION_FAILED',
      cause: operationalError,
    });
  });

  it('throws a safe auth context error when the membership query fails', async () => {
    const queryError = new Error('sensitive database detail');
    const result = resolveMembershipAccess(
      async () => ({ data: { claims: { sub: 'user' } }, error: null }),
      async () => ({
        data: null,
        error: queryError,
      }),
    );

    const error = await result.catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AuthContextError);
    expect(error).toMatchObject({
      message: 'MEMBERSHIP_QUERY_FAILED',
      cause: queryError,
    });
    expect((error as Error).message).not.toContain('sensitive database');
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
