import {
  Bell,
  CalendarCheck,
  CalendarDays,
  ChartNoAxesCombined,
  CheckSquare2,
  LayoutDashboard,
  ListChecks,
  Settings,
  UserRound,
  UsersRound,
} from 'lucide-react';
import Link from 'next/link';
import type { ComponentType, ReactNode } from 'react';

import type { MembershipContext } from '@/modules/members/context';

import { AppNavLink } from './app-nav-link';
import { NotificationBell } from './notification-bell';
import { Avatar } from './ui/avatar';

type Role = MembershipContext['role'];
type NavigationItem = {
  href: string;
  icon: ComponentType<{ 'aria-hidden'?: boolean; className?: string }>;
  label: string;
};

const adminItems: NavigationItem[] = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/tasks', icon: ListChecks, label: 'All Tasks' },
  { href: '/calendar', icon: CalendarDays, label: 'Calendar' },
  { href: '/employees', icon: UsersRound, label: 'Employees' },
  { href: '/reports', icon: ChartNoAxesCombined, label: 'Reports' },
  { href: '/notifications', icon: Bell, label: 'Notifications' },
  { href: '/settings', icon: Settings, label: 'Settings' },
];

const employeeItems: NavigationItem[] = [
  { href: '/my-day', icon: CalendarCheck, label: 'My Day' },
  { href: '/my-tasks', icon: CheckSquare2, label: 'My Tasks' },
  { href: '/calendar', icon: CalendarDays, label: 'Calendar' },
  { href: '/notifications', icon: Bell, label: 'Notifications' },
  { href: '/profile', icon: UserRound, label: 'Profile' },
];

export function AppShell({
  children,
  role,
  userId,
  displayName,
  unreadNotificationCount,
}: {
  children: ReactNode;
  role: Role;
  userId: string;
  displayName: string;
  unreadNotificationCount: number;
}) {
  const items = role === 'admin' ? adminItems : employeeItems;
  const home = role === 'admin' ? '/dashboard' : '/my-day';

  return (
    <div className="min-h-screen bg-background text-slate-950 md:grid md:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="border-b border-slate-200 bg-white md:sticky md:top-0 md:flex md:h-screen md:flex-col md:border-r md:border-b-0">
        <div className="flex min-h-16 items-center justify-between px-5 md:min-h-20 md:px-6">
          <Link
            className="inline-flex items-center gap-2.5 rounded-md font-semibold tracking-[-0.02em] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
            href={home}
          >
            <span
              aria-hidden="true"
              className="grid size-8 place-items-center rounded-lg bg-accent text-sm text-white"
            >
              T
            </span>
            <span>TaskFlow</span>
          </Link>
          <div className="flex items-center gap-2">
            <NotificationBell
              initialUnreadCount={unreadNotificationCount}
              userId={userId}
            />
            <span className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold tracking-wider text-slate-600 uppercase md:hidden">
              {role}
            </span>
          </div>
        </div>

        <nav
          aria-label="Primary"
          className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-1 md:flex-col md:overflow-visible md:px-4 md:py-3"
        >
          {items.map(({ href, icon: Icon, label }) => (
            <AppNavLink href={href} key={href}>
              <Icon
                aria-hidden={true}
                className="size-[18px] text-slate-400 transition-colors group-hover:text-slate-700 group-aria-[current=page]:text-accent-hover"
              />
              {label}
            </AppNavLink>
          ))}
        </nav>

        <div className="hidden border-t border-slate-200 px-4 py-4 md:block">
          <Link
            className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
            href={role === 'admin' ? '/settings' : '/profile'}
          >
            <Avatar displayName={displayName} userId={userId} />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-slate-900">
                {displayName}
              </span>
              <span className="block text-xs font-medium text-slate-500 capitalize">
                {role}
              </span>
            </span>
          </Link>
        </div>
      </aside>

      <main className="min-w-0 px-5 py-8 sm:px-8 md:px-10 md:py-10">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
