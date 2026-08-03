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
      className="group relative flex min-h-11 shrink-0 items-center gap-3 rounded-lg px-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary active:bg-slate-200 aria-[current=page]:bg-primary-soft aria-[current=page]:text-primary md:before:absolute md:before:top-1.5 md:before:bottom-1.5 md:before:-left-4 md:before:w-1 md:before:rounded-full md:before:bg-primary md:before:opacity-0 md:aria-[current=page]:before:opacity-100"
      href={href}
    >
      {children}
    </Link>
  );
}
