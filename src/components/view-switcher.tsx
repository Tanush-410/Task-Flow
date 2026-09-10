'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

import { setLastView, type ViewMode } from '@/lib/last-view';

export function ViewSwitcher({
  items,
  scope,
}: {
  items: { href: string; label: string; view?: ViewMode }[];
  /** When set, remembers which of the `view`-tagged items is active. */
  scope?: string;
}) {
  const pathname = usePathname();

  useEffect(() => {
    if (!scope) return;
    const active = items.find((item) => item.href === pathname);
    if (active?.view) setLastView(scope, active.view);
    // `items` is a fresh array literal from the caller every render --
    // intentionally excluded so this only re-runs on an actual nav change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, scope]);

  return (
    <div className="inline-flex w-fit items-center gap-1 rounded-lg bg-muted p-[3px]">
      {items.map((item) => {
        const isActive = pathname === item.href;

        return (
          <Link
            aria-current={isActive ? 'page' : undefined}
            className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
              isActive
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            href={item.href}
            key={item.href}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
