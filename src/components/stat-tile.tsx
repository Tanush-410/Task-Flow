import type { ComponentType } from 'react';

import { Card } from '@/components/ui/card';

const TONE_CHIP: Record<'default' | 'danger' | 'success', string> = {
  default: 'bg-muted text-muted-foreground',
  danger: 'bg-red-500/10 text-red-400',
  success: 'bg-emerald-500/10 text-emerald-400',
};

export function StatTile({
  icon: Icon,
  label,
  value,
  tone = 'default',
}: {
  icon: ComponentType<{ 'aria-hidden'?: boolean; className?: string }>;
  label: string;
  value: number | string;
  tone?: 'default' | 'danger' | 'success';
}) {
  const valueIsRed = tone === 'danger' && Number(value) > 0;

  return (
    <Card className="p-5 sm:p-5">
      <span
        className={`grid size-8 place-items-center rounded-lg ${TONE_CHIP[tone]}`}
      >
        <Icon aria-hidden className="size-4" />
      </span>
      <p className="mt-3 text-sm font-medium text-muted-foreground">{label}</p>
      <p
        className={`mt-1 text-3xl font-semibold tracking-[-0.03em] ${
          valueIsRed ? 'text-red-400' : 'text-foreground'
        }`}
      >
        {value}
      </p>
    </Card>
  );
}
