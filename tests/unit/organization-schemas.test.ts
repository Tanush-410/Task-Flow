import { describe, expect, it } from 'vitest';

import { invitationSchema } from '@/modules/members/schemas';
import { organizationSchema } from '@/modules/organizations/schemas';

describe('organizationSchema', () => {
  it('trims an organization name and accepts an IANA timezone', () => {
    expect(
      organizationSchema.parse({ name: '  Acme  ', timezone: 'Asia/Kolkata' }),
    ).toEqual({ name: 'Acme', timezone: 'Asia/Kolkata' });
  });

  it.each(['', ' '.repeat(4), 'a'.repeat(121)])(
    'rejects an organization name outside 1..120 trimmed characters',
    (name) => {
      expect(
        organizationSchema.safeParse({ name, timezone: 'UTC' }).success,
      ).toBe(false);
    },
  );

  it('rejects an invalid timezone', () => {
    expect(
      organizationSchema.safeParse({ name: 'Acme', timezone: 'Mars/Olympus' })
        .success,
    ).toBe(false);
  });
});

describe('invitationSchema', () => {
  it('normalizes email and accepts supported roles', () => {
    expect(
      invitationSchema.parse({ email: ' ADMIN@Example.COM ', role: 'admin' }),
    ).toEqual({ email: 'admin@example.com', role: 'admin' });
    expect(
      invitationSchema.parse({ email: 'staff@example.com', role: 'employee' }),
    ).toEqual({ email: 'staff@example.com', role: 'employee' });
  });

  it('rejects owner as an invitation role', () => {
    expect(
      invitationSchema.safeParse({ email: 'e@example.com', role: 'owner' })
        .success,
    ).toBe(false);
  });
});
