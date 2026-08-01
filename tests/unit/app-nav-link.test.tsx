import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  usePathname: vi.fn(),
}));

vi.mock('next/navigation', () => ({ usePathname: mocks.usePathname }));

import { AppNavLink } from '@/components/app-nav-link';

afterEach(cleanup);

describe('AppNavLink', () => {
  it('marks the matching destination as the current page', () => {
    mocks.usePathname.mockReturnValue('/settings/members');

    render(<AppNavLink href="/settings">Settings</AppNavLink>);

    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('does not mark an unrelated destination as current', () => {
    mocks.usePathname.mockReturnValue('/dashboard');

    render(<AppNavLink href="/settings">Settings</AppNavLink>);

    expect(screen.getByRole('link', { name: 'Settings' })).not.toHaveAttribute(
      'aria-current',
    );
  });
});
