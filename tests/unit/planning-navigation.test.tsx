import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/notification-bell', () => ({
  NotificationBell: () => null,
}));
vi.mock('@/components/sign-out-menu-item', () => ({
  SignOutMenuItem: () => null,
}));
vi.mock('@/components/command-palette', () => ({
  CommandPalette: () => null,
}));
vi.mock('@/components/route-transition', () => ({
  RouteTransition: ({ children }: { children: ReactNode }) => children,
}));

import { AppShell } from '@/components/app-shell';

afterEach(cleanup);

describe('Planning navigation', () => {
  it.each(['admin', 'employee'] as const)(
    'shows Planning for an enabled %s',
    (role) => {
      render(
        <AppShell
          completedToday={0}
          displayName="Team Member"
          planningEnabled
          role={role}
          unreadNotificationCount={0}
          userId="user-1"
        >
          Content
        </AppShell>,
      );

      expect(screen.getByRole('link', { name: 'Planning' })).toHaveAttribute(
        'href',
        '/planning',
      );
    },
  );

  it('hides Planning when the feature is disabled', () => {
    render(
      <AppShell
        completedToday={0}
        displayName="Team Member"
        planningEnabled={false}
        role="admin"
        unreadNotificationCount={0}
        userId="user-1"
      >
        Content
      </AppShell>,
    );

    expect(screen.queryByRole('link', { name: 'Planning' })).toBeNull();
  });
});
