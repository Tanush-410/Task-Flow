'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSyncExternalStore, type ReactNode } from 'react';

import { getLastView, subscribeLastViewChange } from '@/lib/last-view';

export function AppNavLink({
  children,
  href,
  boardHref,
  viewScope,
}: {
  children: ReactNode;
  href: string;
  /** The Board-view equivalent of `href`, e.g. `/tasks/board`. */
  boardHref?: string;
  /** When set, this link opens to `boardHref` if that was the user's last-used view. */
  viewScope?: string;
}) {
  const pathname = usePathname();
  const lastView = useSyncExternalStore(
    subscribeLastViewChange,
    () => (viewScope ? getLastView(viewScope) : null),
    () => null,
  );
  const resolvedHref =
    viewScope && boardHref && lastView === 'board' ? boardHref : href;
  const isCurrent = Boolean(
    pathname && (pathname === href || pathname.startsWith(`${href}/`)),
  );

  return (
    <Link
      aria-current={isCurrent ? 'page' : undefined}
      className="group relative flex min-h-11 shrink-0 items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary active:bg-accent aria-[current=page]:bg-primary-soft aria-[current=page]:text-primary md:before:absolute md:before:top-1.5 md:before:bottom-1.5 md:before:-left-4 md:before:w-1 md:before:rounded-full md:before:bg-primary md:before:opacity-0 md:aria-[current=page]:before:opacity-100"
      href={resolvedHref}
    >
      {children}
    </Link>
  );
}
