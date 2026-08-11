import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/notification-bell', () => ({
  NotificationBell: () => null,
}));
vi.mock('@/components/sign-out-menu-item', () => ({
  SignOutMenuItem: () => null,
}));
vi.mock('@/components/global-search', () => ({ GlobalSearch: () => null }));

import { AppShell } from '@/components/app-shell';

afterEach(cleanup);

describe('Planning navigation', () => {
  it.each(['admin', 'employee'] as const)(
    'shows Planning for an enabled %s',
    (role) => {
      render(
        <AppShell
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
