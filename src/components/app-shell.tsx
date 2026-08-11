import {
  Activity,
  Bell,
  CalendarCheck,
  CalendarDays,
  ChartNoAxesCombined,
  CheckSquare2,
  ChevronsUpDown,
  LayoutDashboard,
  ListChecks,
  ListTodo,
  PanelsTopLeft,
  Settings,
  StickyNote,
  TrendingUp,
  UserRound,
  UsersRound,
} from 'lucide-react';
import Link from 'next/link';
import type { ComponentType, ReactNode } from 'react';

import type { MembershipContext } from '@/modules/members/context';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { AppNavLink } from './app-nav-link';
import { GlobalSearch } from './global-search';
import { NotificationBell } from './notification-bell';
import { PersonAvatar } from './person-avatar';
import { SignOutMenuItem } from './sign-out-menu-item';

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
  { href: '/current-work', icon: ListTodo, label: 'Current Work' },
  { href: '/reports', icon: ChartNoAxesCombined, label: 'Reports' },
  { href: '/activity', icon: Activity, label: 'Activity' },
  { href: '/notes', icon: StickyNote, label: 'Notes' },
  { href: '/notifications', icon: Bell, label: 'Notifications' },
  { href: '/settings', icon: Settings, label: 'Settings' },
];

const employeeItems: NavigationItem[] = [
  { href: '/my-day', icon: CalendarCheck, label: 'My Day' },
  { href: '/my-tasks', icon: CheckSquare2, label: 'My Tasks' },
  { href: '/calendar', icon: CalendarDays, label: 'Calendar' },
  { href: '/my-progress', icon: TrendingUp, label: 'My Progress' },
  { href: '/notes', icon: StickyNote, label: 'Notes' },
  { href: '/notifications', icon: Bell, label: 'Notifications' },
  { href: '/profile', icon: UserRound, label: 'Profile' },
];

const planningItem: NavigationItem = {
  href: '/planning',
  icon: PanelsTopLeft,
  label: 'Planning',
};

export function AppShell({
  children,
  role,
  userId,
  displayName,
  planningEnabled,
  unreadNotificationCount,
}: {
  children: ReactNode;
  role: Role;
  userId: string;
  displayName: string;
  planningEnabled: boolean;
  unreadNotificationCount: number;
}) {
  const roleItems = role === 'admin' ? adminItems : employeeItems;
  const items = planningEnabled ? [...roleItems, planningItem] : roleItems;
  const home = role === 'admin' ? '/dashboard' : '/my-day';

  return (
    <div className="min-h-screen bg-background text-foreground md:grid md:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="border-b border-border bg-card md:sticky md:top-0 md:flex md:h-screen md:flex-col md:border-r md:border-b-0">
        <div className="flex min-h-16 items-center justify-between px-5 md:min-h-20 md:px-6">
          <Link
            className="inline-flex items-center gap-2.5 rounded-md font-semibold tracking-[-0.02em] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
            href={home}
          >
            <span
              aria-hidden="true"
              className="grid size-8 place-items-center rounded-lg bg-primary text-sm text-primary-foreground"
            >
              T
            </span>
            <span>TaskFlow</span>
          </Link>
          <div className="flex items-center gap-1">
            <GlobalSearch />
            <NotificationBell
              initialUnreadCount={unreadNotificationCount}
              userId={userId}
            />
            <span className="ml-1 rounded-md bg-muted px-2 py-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase md:hidden">
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
                className="size-[18px] text-muted-foreground transition-colors group-hover:text-muted-foreground group-aria-[current=page]:text-primary"
              />
              {label}
            </AppNavLink>
          ))}
        </nav>

        <div className="hidden border-t border-border px-3 py-3 md:block">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
                type="button"
              >
                <PersonAvatar displayName={displayName} userId={userId} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-foreground">
                    {displayName}
                  </span>
                  <span className="block text-xs font-medium text-muted-foreground capitalize">
                    {role}
                  </span>
                </span>
                <ChevronsUpDown
                  aria-hidden
                  className="size-4 shrink-0 text-muted-foreground"
                />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuItem asChild>
                <Link href={role === 'admin' ? '/settings' : '/profile'}>
                  {role === 'admin' ? (
                    <Settings aria-hidden />
                  ) : (
                    <UserRound aria-hidden />
                  )}
                  {role === 'admin' ? 'Settings' : 'Profile'}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <SignOutMenuItem />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      <main className="min-w-0 px-5 py-8 sm:px-8 md:px-10 md:py-10">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
