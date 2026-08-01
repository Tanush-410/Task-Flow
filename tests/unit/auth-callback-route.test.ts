import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createServerSupabase: vi.fn(),
  exchangeCodeForSession: vi.fn(),
  getMembershipAccess: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabase: mocks.createServerSupabase,
}));
vi.mock('@/modules/members/queries', () => ({
  getMembershipAccess: mocks.getMembershipAccess,
}));

import { GET } from '@/app/auth/callback/route';

function callbackRequest(search = '') {
  return new NextRequest(`https://taskflow.example/auth/callback${search}`);
}

async function location(search = '') {
  const response = await GET(callbackRequest(search));
  expect(response.status).toBe(307);
  return response.headers.get('location');
}

describe('GET /auth/callback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createServerSupabase.mockResolvedValue({
      auth: { exchangeCodeForSession: mocks.exchangeCodeForSession },
    });
    mocks.exchangeCodeForSession.mockResolvedValue({ error: null });
    mocks.getMembershipAccess.mockResolvedValue({
      kind: 'membership',
      membership: {
        organizationId: 'org',
        role: 'employee',
        userId: 'user',
      },
    });
  });

  it('sends a callback without a code to a safe login error', async () => {
    await expect(location()).resolves.toBe(
      'https://taskflow.example/login?error=callback',
    );
    expect(mocks.createServerSupabase).not.toHaveBeenCalled();
  });

  it('sends a returned exchange error to a safe login error', async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({
      error: new Error('sensitive exchange detail'),
    });

    await expect(location('?code=returned-error')).resolves.toBe(
      'https://taskflow.example/login?error=callback',
    );
    expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith('returned-error');
  });

  it('sends a thrown operational failure to a safe login error', async () => {
    mocks.exchangeCodeForSession.mockRejectedValue(
      new Error('sensitive network detail'),
    );

    await expect(location('?code=thrown-error')).resolves.toBe(
      'https://taskflow.example/login?error=callback',
    );
  });

  it.each([
    ['/login', 'https://taskflow.example/login?error=session'],
    ['/access-pending', 'https://taskflow.example/access-pending'],
  ] as const)(
    'honors verified membership redirect %s',
    async (membershipLocation, expectedLocation) => {
      mocks.getMembershipAccess.mockResolvedValue({
        kind: 'redirect',
        location: membershipLocation,
      });

      await expect(location('?code=membership')).resolves.toBe(
        expectedLocation,
      );
    },
  );

  it.each([
    ['admin', 'https://taskflow.example/dashboard'],
    ['employee', 'https://taskflow.example/my-day'],
  ] as const)(
    'sends a verified %s to the role landing page',
    async (role, expectedLocation) => {
      mocks.getMembershipAccess.mockResolvedValue({
        kind: 'membership',
        membership: { organizationId: 'org', role, userId: 'user' },
      });

      await expect(location('?code=role')).resolves.toBe(expectedLocation);
    },
  );

  it('preserves a safe authorized next path and query', async () => {
    await expect(
      location('?code=safe&next=%2Fnotifications%3Fview%3Dunread'),
    ).resolves.toBe('https://taskflow.example/notifications?view=unread');
  });

  it('falls back to the role landing for a hostile next URL', async () => {
    await expect(
      location('?code=hostile&next=https%3A%2F%2Fevil.example%2Fphish'),
    ).resolves.toBe('https://taskflow.example/my-day');
  });
});
