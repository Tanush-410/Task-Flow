import {
  Activity,
  Bell,
  CalendarCheck,
  CalendarDays,
  ChartNoAxesCombined,
  CheckSquare2,
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
import type { ComponentType } from 'react';

export type NavigationItem = {
  href: string;
  icon: ComponentType<{ 'aria-hidden'?: boolean; className?: string }>;
  label: string;
  /** The Board-view equivalent of `href`, for the "remember last view" nav. */
  boardHref?: string;
  viewScope?: string;
};

export const adminNavItems: NavigationItem[] = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  {
    href: '/tasks',
    icon: ListChecks,
    label: 'All Tasks',
    boardHref: '/tasks/board',
    viewScope: 'tasks',
  },
  { href: '/calendar', icon: CalendarDays, label: 'Calendar' },
  { href: '/employees', icon: UsersRound, label: 'Employees' },
  { href: '/current-work', icon: ListTodo, label: 'Current Work' },
  { href: '/reports', icon: ChartNoAxesCombined, label: 'Reports' },
  { href: '/activity', icon: Activity, label: 'Activity' },
  { href: '/notes', icon: StickyNote, label: 'Notes' },
  { href: '/notifications', icon: Bell, label: 'Notifications' },
  { href: '/settings', icon: Settings, label: 'Settings' },
];

export const employeeNavItems: NavigationItem[] = [
  { href: '/my-day', icon: CalendarCheck, label: 'My Day' },
  {
    href: '/my-tasks',
    icon: CheckSquare2,
    label: 'My Tasks',
    boardHref: '/my-tasks/board',
    viewScope: 'my-tasks',
  },
  { href: '/calendar', icon: CalendarDays, label: 'Calendar' },
  { href: '/my-progress', icon: TrendingUp, label: 'My Progress' },
  { href: '/notes', icon: StickyNote, label: 'Notes' },
  { href: '/notifications', icon: Bell, label: 'Notifications' },
  { href: '/profile', icon: UserRound, label: 'Profile' },
];

export const planningNavItem: NavigationItem = {
  href: '/planning',
  icon: PanelsTopLeft,
  label: 'Planning',
};

export function navItemsForRole(
  role: 'admin' | 'employee',
  planningEnabled: boolean,
): NavigationItem[] {
  const roleItems = role === 'admin' ? adminNavItems : employeeNavItems;
  return planningEnabled ? [...roleItems, planningNavItem] : roleItems;
}
