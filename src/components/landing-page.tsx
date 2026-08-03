import {
  BellRing,
  CalendarDays,
  ClipboardCheck,
  ListChecks,
} from 'lucide-react';
import Link from 'next/link';
import type { ComponentType } from 'react';

const features: {
  title: string;
  description: string;
  icon: ComponentType<{ 'aria-hidden'?: boolean; className?: string }>;
}[] = [
  {
    title: 'Assign with clarity',
    description:
      'Create a task once, assign it to one or many people, and set a priority and deadline — everyone knows exactly what to do.',
    icon: ClipboardCheck,
  },
  {
    title: 'A calendar for your whole team',
    description:
      'See every task on a Month, Week, or Day calendar, color-tagged by who it belongs to — just like the calendar you already know.',
    icon: CalendarDays,
  },
  {
    title: 'Track real progress',
    description:
      'Employees move work through Not Started, In Progress, Delayed, or Completed, with a required reason whenever something slips.',
    icon: ListChecks,
  },
  {
    title: 'Never miss an update',
    description:
      'Admins are notified the moment work is completed or delayed; employees are notified the moment something new lands on their plate.',
    icon: BellRing,
  },
];

export function LandingPage() {
  return (
    <main className="min-h-screen bg-background text-slate-950">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-6 sm:px-8">
        <div className="flex items-center gap-2.5 font-semibold tracking-[-0.02em]">
          <span
            aria-hidden="true"
            className="grid size-8 place-items-center rounded-lg bg-accent text-sm text-white"
          >
            T
          </span>
          TaskFlow
        </div>
        <nav aria-label="Account" className="flex items-center gap-3">
          <Link
            className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            href="/login"
          >
            Sign in
          </Link>
          <Link
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            href="/signup"
          >
            Get started
          </Link>
        </nav>
      </header>

      <section className="mx-auto w-full max-w-3xl px-5 pt-14 pb-10 text-center sm:px-8 sm:pt-20">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent-hover">
          <CalendarDays aria-hidden className="size-3.5" />
          Now with a full team calendar
        </span>
        <h1 className="mt-5 text-4xl font-semibold tracking-[-0.04em] text-balance text-slate-950 sm:text-5xl">
          Assign, track, and complete work without the chaos.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg leading-7 text-slate-600">
          TaskFlow gives founders and managers one place to assign tasks to
          their team, and gives employees a focused view of exactly what is due,
          delayed, or done.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            className="flex h-12 items-center justify-center rounded-xl bg-accent px-6 text-sm font-semibold text-white hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            href="/signup"
          >
            Create your workspace
          </Link>
          <Link
            className="flex h-12 items-center justify-center rounded-xl border border-slate-300 bg-white px-6 text-sm font-semibold text-slate-950 hover:border-slate-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            href="/login"
          >
            Sign in
          </Link>
        </div>
      </section>

      <section
        aria-label="Features"
        className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-4 px-5 pb-20 sm:grid-cols-2 sm:px-8"
      >
        {features.map((feature) => (
          <div
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card"
            key={feature.title}
          >
            <span className="grid size-10 place-items-center rounded-xl bg-accent-soft text-accent-hover">
              <feature.icon aria-hidden className="size-5" />
            </span>
            <h2 className="mt-4 text-lg font-semibold tracking-[-0.02em] text-slate-950">
              {feature.title}
            </h2>
            <p className="mt-2 text-[15px] leading-6 text-slate-600">
              {feature.description}
            </p>
          </div>
        ))}
      </section>
    </main>
  );
}
