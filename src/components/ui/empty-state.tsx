import type { ComponentType, ReactNode } from 'react';

import { cn } from '@/lib/cn';

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ComponentType<{ 'aria-hidden'?: boolean; className?: string }>;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 px-6 py-12 text-center',
        className,
      )}
    >
      {Icon ? (
        <Icon aria-hidden className="mx-auto size-10 text-slate-300" />
      ) : null}
      <p className="mt-3 text-base font-semibold text-slate-900">{title}</p>
      {description ? (
        <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
