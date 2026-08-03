import {
  Bell,
  CalendarCheck,
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

type Role = MembershipContext['role'];
type NavigationItem = {
  href: string;
  icon: ComponentType<{ 'aria-hidden'?: boolean; className?: string }>;
  label: string;
};

const adminItems: NavigationItem[] = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/tasks', icon: ListChecks, label: 'All Tasks' },
  { href: '/employees', icon: UsersRound, label: 'Employees' },
  { href: '/reports', icon: ChartNoAxesCombined, label: 'Reports' },
  { href: '/notifications', icon: Bell, label: 'Notifications' },
  { href: '/settings', icon: Settings, label: 'Settings' },
];

const employeeItems: NavigationItem[] = [
  { href: '/my-day', icon: CalendarCheck, label: 'My Day' },
  { href: '/my-tasks', icon: CheckSquare2, label: 'My Tasks' },
  { href: '/notifications', icon: Bell, label: 'Notifications' },
  { href: '/profile', icon: UserRound, label: 'Profile' },
];

export function AppShell({
  children,
  role,
  userId,
  unreadNotificationCount,
}: {
  children: ReactNode;
  role: Role;
  userId: string;
  unreadNotificationCount: number;
}) {
  const items = role === 'admin' ? adminItems : employeeItems;
  const home = role === 'admin' ? '/dashboard' : '/my-day';

  return (
    <div className="min-h-screen bg-[#f7f7f5] text-slate-950 md:grid md:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="border-b border-slate-200 bg-white md:sticky md:top-0 md:flex md:h-screen md:flex-col md:border-r md:border-b-0">
        <div className="flex min-h-16 items-center justify-between px-5 md:min-h-20 md:px-6">
          <Link
            className="inline-flex items-center gap-2.5 rounded-md font-semibold tracking-[-0.02em] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-slate-950"
            href={home}
          >
            <span
              aria-hidden="true"
              className="grid size-8 place-items-center rounded-lg bg-slate-950 text-sm text-white"
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
            <span className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-600 md:hidden">
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
                className="size-[18px] text-slate-400 transition-colors group-hover:text-slate-700"
              />
              {label}
            </AppNavLink>
          ))}
        </nav>

        <div className="hidden border-t border-slate-200 px-6 py-5 md:block">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Signed in as
          </p>
          <p className="mt-1 text-sm font-medium capitalize text-slate-700">
            {role}
          </p>
        </div>
      </aside>

      <main className="min-w-0 px-5 py-8 sm:px-8 md:px-10 md:py-10">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
