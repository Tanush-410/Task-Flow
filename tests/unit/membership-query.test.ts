import { describe, expect, it } from 'vitest';

import { requireSingleMembership } from '@/modules/members/queries';

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
});
