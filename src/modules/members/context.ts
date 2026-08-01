import {
  AuthInvalidJwtError,
  AuthSessionMissingError,
  isAuthApiError,
  isAuthError,
  isAuthRetryableFetchError,
} from '@supabase/supabase-js';

import type { Database } from '@/lib/supabase/database.types';

type MembershipRole = Database['public']['Enums']['membership_role'];

type MembershipRow = Pick<
  Database['public']['Tables']['organization_memberships']['Row'],
  'organization_id' | 'role' | 'user_id'
>;

type ClaimsResult = {
  data: { claims: { sub?: string } } | null;
  error: unknown;
};

type MembershipQueryResult = {
  data: MembershipRow[] | null;
  error: unknown;
};

export type MembershipContext = {
  organizationId: string;
  userId: string;
  role: MembershipRole;
};

export class AuthContextError extends Error {
  constructor(
    readonly code: 'CLAIM_VERIFICATION_FAILED' | 'MEMBERSHIP_QUERY_FAILED',
    options?: ErrorOptions,
  ) {
    super(code, options);
    this.name = 'AuthContextError';
  }
}

export class MembershipContextError extends Error {
  constructor(readonly code: 'MULTIPLE_ACTIVE_MEMBERSHIPS') {
    super(code);
    this.name = 'MembershipContextError';
  }
}

export type MembershipAccess =
  | { kind: 'redirect'; location: '/login' | '/access-pending' }
  | { kind: 'membership'; membership: MembershipContext };

export function requireSingleMembership(
  items: MembershipContext[],
): MembershipContext {
  if (items.length === 0) {
    throw new Error('ACTIVE_MEMBERSHIP_REQUIRED');
  }

  if (items.length > 1) {
    throw new MembershipContextError('MULTIPLE_ACTIVE_MEMBERSHIPS');
  }

  return items[0];
}

function isTerminalAuthSessionError(error: unknown): boolean {
  return (
    error instanceof AuthInvalidJwtError ||
    error instanceof AuthSessionMissingError ||
    (isAuthApiError(error) &&
      (error.code === 'refresh_token_not_found' ||
        error.code === 'refresh_token_already_used' ||
        error.code === 'session_expired')) ||
    (isAuthError(error) &&
      error.status === 401 &&
      !isAuthRetryableFetchError(error))
  );
}

export async function resolveMembershipAccess(
  getClaims: () => Promise<ClaimsResult>,
  getMemberships: (userId: string) => Promise<MembershipQueryResult>,
): Promise<MembershipAccess> {
  let claimsResult: ClaimsResult;

  try {
    claimsResult = await getClaims();
  } catch (error) {
    if (isTerminalAuthSessionError(error)) {
      return { kind: 'redirect', location: '/login' };
    }

    throw new AuthContextError('CLAIM_VERIFICATION_FAILED', { cause: error });
  }

  const { data: claims, error: claimsError } = claimsResult;

  if (claimsError) {
    if (isTerminalAuthSessionError(claimsError)) {
      return { kind: 'redirect', location: '/login' };
    }

    throw new AuthContextError('CLAIM_VERIFICATION_FAILED', {
      cause: claimsError,
    });
  }

  const userId = claims?.claims.sub;

  if (!userId) {
    return { kind: 'redirect', location: '/login' };
  }

  const { data, error } = await getMemberships(userId);

  if (error || !data) {
    throw new AuthContextError('MEMBERSHIP_QUERY_FAILED', { cause: error });
  }

  if (data.length === 0) {
    return { kind: 'redirect', location: '/access-pending' };
  }

  const membership = requireSingleMembership(
    data.map((item) => ({
      organizationId: item.organization_id,
      userId: item.user_id,
      role: item.role,
    })),
  );

  return { kind: 'membership', membership };
}
