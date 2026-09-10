import type { ReactNode } from 'react';

const SIZE = 36;
const RADIUS = 16;
const STROKE = 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
/** Ring fills toward this many completions -- a gentle implicit daily goal,
 *  not a hard cap (it simply stays full past this point). */
const DAILY_TARGET = 5;

/** A thin ring around the sidebar avatar that fills as the user completes
 * tasks today -- a quiet, personal momentum cue rather than a tracker. */
export function AvatarProgressRing({
  completedToday,
  children,
}: {
  completedToday: number;
  children: ReactNode;
}) {
  if (completedToday <= 0) return <>{children}</>;

  const ratio = Math.min(1, completedToday / DAILY_TARGET);
  const offset = CIRCUMFERENCE * (1 - ratio);

  return (
    <span
      className="relative inline-grid size-9 shrink-0 place-items-center"
      title={`${completedToday} completed today`}
    >
      <svg
        aria-hidden="true"
        className="absolute inset-0 -rotate-90"
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        width={SIZE}
      >
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          fill="none"
          r={RADIUS}
          stroke="var(--border)"
          strokeWidth={STROKE}
        />
        <circle
          className="transition-[stroke-dashoffset] duration-700 ease-out"
          cx={SIZE / 2}
          cy={SIZE / 2}
          fill="none"
          r={RADIUS}
          stroke="var(--primary)"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          strokeLinecap="round"
          strokeWidth={STROKE}
        />
      </svg>
      {children}
    </span>
  );
}
