import type { ReactNode } from 'react';

export function PageHeader({
  eyebrow,
  title,
  headingId,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  headingId?: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        {eyebrow ? (
          <p className="text-sm font-medium text-muted-foreground">{eyebrow}</p>
        ) : null}
        <h1
          className="mt-1 text-3xl font-semibold tracking-[-0.035em] text-foreground"
          id={headingId}
        >
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-base leading-7 text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
