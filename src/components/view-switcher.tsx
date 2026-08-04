'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function ViewSwitcher({
  items,
}: {
  items: { href: string; label: string }[];
}) {
  const pathname = usePathname();

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
