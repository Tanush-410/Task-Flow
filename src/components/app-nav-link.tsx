'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

export function AppNavLink({
  children,
  href,
}: {
  children: ReactNode;
  href: string;
}) {
  const pathname = usePathname();
  const isCurrent = Boolean(
    pathname && (pathname === href || pathname.startsWith(`${href}/`)),
  );

  return (
    <Link
      aria-current={isCurrent ? 'page' : undefined}
      className="group flex min-h-11 shrink-0 items-center gap-3 rounded-lg px-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-950 active:bg-slate-200 aria-[current=page]:bg-slate-100 aria-[current=page]:text-slate-950"
      href={href}
    >
      {children}
    </Link>
  );
}
