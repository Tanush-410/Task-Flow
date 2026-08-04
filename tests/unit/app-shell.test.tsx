import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/notification-bell', () => ({
  NotificationBell: () => null,
}));

vi.mock('@/components/sign-out-menu-item', () => ({
  SignOutMenuItem: () => null,
}));

vi.mock('@/components/global-search', () => ({
  GlobalSearch: () => null,
}));

import { AppShell } from '@/components/app-shell';

afterEach(cleanup);

describe('AppShell', () => {
  it('shows admin navigation without employee-only links', () => {
    render(
      <AppShell
        displayName="Asha Admin"
        role="admin"
        unreadNotificationCount={0}
        userId="user-1"
      >
        Admin content
      </AppShell>,
    );

    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'All Tasks' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Calendar' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Employees' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Reports' })).toBeVisible();
    expect(screen.queryByRole('link', { name: 'My Day' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'My Tasks' })).toBeNull();
  });

  it('shows employee navigation without admin-only links', () => {
    render(
      <AppShell
        displayName="Priya Employee"
        role="employee"
        unreadNotificationCount={0}
        userId="user-1"
      >
        Employee content
      </AppShell>,
    );

    expect(screen.getByRole('link', { name: 'My Day' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'My Tasks' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Calendar' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Notifications' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Profile' })).toBeVisible();
    expect(screen.queryByRole('link', { name: 'Dashboard' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Employees' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Reports' })).toBeNull();
  });
});
