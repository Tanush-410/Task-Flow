import type { HTMLAttributes } from 'react';

import { cn } from '@/lib/cn';

type BadgeVariant = 'neutral' | 'danger' | 'warning' | 'success' | 'accent';

const variantClass: Record<BadgeVariant, string> = {
  neutral: 'bg-slate-100 text-slate-700',
  danger: 'bg-red-50 text-red-700',
  warning: 'bg-amber-50 text-amber-800',
  success: 'bg-emerald-50 text-emerald-700',
  accent: 'bg-accent-soft text-accent-hover',
};

export function Badge({
  variant = 'neutral',
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold tracking-wide uppercase',
        variantClass[variant],
        className,
      )}
      {...props}
    />
  );
}
