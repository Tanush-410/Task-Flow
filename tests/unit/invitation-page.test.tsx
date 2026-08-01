import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  acceptInvitation: vi.fn(),
  createServerSupabase: vi.fn(),
  getClaims: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
  redirect: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({
  notFound: mocks.notFound,
  redirect: mocks.redirect,
}));
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabase: mocks.createServerSupabase,
}));
vi.mock('@/modules/members/actions', () => ({
  acceptInvitation: mocks.acceptInvitation,
}));

import InvitationPage from '@/app/invite/[token]/page';

afterEach(cleanup);

describe('InvitationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createServerSupabase.mockResolvedValue({
      auth: { getClaims: mocks.getClaims },
    });
  });

  it('offers a safe sign-in continuation to unauthenticated invitees', async () => {
    const token = 'a'.repeat(43);
    mocks.getClaims.mockResolvedValue({ data: null, error: null });

    render(
      await InvitationPage({
        params: Promise.resolve({ token }),
        searchParams: Promise.resolve({}),
      }),
    );

    expect(
      screen.getByRole('link', { name: 'Sign in to continue' }),
    ).toHaveAttribute(
      'href',
      `/login?next=${encodeURIComponent(`/invite/${token}`)}`,
    );
  });

  it('shows an acceptance form to an authenticated invitee', async () => {
    mocks.getClaims.mockResolvedValue({
      data: { claims: { sub: 'user-123' } },
      error: null,
    });

    render(
      await InvitationPage({
        params: Promise.resolve({ token: 'b'.repeat(43) }),
        searchParams: Promise.resolve({}),
      }),
    );

    expect(
      screen.getByRole('button', { name: 'Accept invitation' }),
    ).toBeInTheDocument();
  });

  it('rejects malformed invitation tokens', async () => {
    await expect(
      InvitationPage({
        params: Promise.resolve({ token: '../login' }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow('NEXT_NOT_FOUND');
  });
});
