import {
  BellRing,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  ListChecks,
  PenSquare,
  UsersRound,
} from 'lucide-react';
import Link from 'next/link';
import type { ComponentType } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

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

const steps: {
  title: string;
  description: string;
  icon: ComponentType<{ 'aria-hidden'?: boolean; className?: string }>;
}[] = [
  {
    title: 'Create a task',
    description:
      'Give it a title, a priority, and a due date — from the task list, the calendar, or a quick-create popover on any day.',
    icon: PenSquare,
  },
  {
    title: 'Assign your team',
    description:
      'Tag one person or several. Everyone you assign is notified immediately, and shows up on the calendar in their own color.',
    icon: UsersRound,
  },
  {
    title: 'Track it to done',
    description:
      'Watch progress update in real time, get notified the moment something is completed or delayed, and never chase a status update again.',
    icon: CheckCircle2,
  },
];

export function LandingPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-6 sm:px-8">
        <div className="flex items-center gap-2.5 font-semibold tracking-[-0.02em]">
          <span
            aria-hidden="true"
            className="grid size-8 place-items-center rounded-lg bg-primary text-sm text-primary-foreground"
          >
            T
          </span>
          TaskFlow
        </div>
        <nav aria-label="Account" className="flex items-center gap-3">
          <Button asChild size="lg" variant="ghost">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild size="lg">
            <Link href="/signup">Get started</Link>
          </Button>
        </nav>
      </header>

      <div className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-[-12rem] left-1/2 -z-10 h-[36rem] w-[56rem] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl"
        />

        <section className="mx-auto w-full max-w-3xl px-5 pt-14 pb-10 text-center sm:px-8 sm:pt-20">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">
            <CalendarDays aria-hidden className="size-3.5" />
            Now with a full team calendar
          </span>
          <h1 className="mt-5 text-4xl font-semibold tracking-[-0.04em] text-balance text-foreground sm:text-5xl">
            Assign, track, and complete work without the chaos.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-7 text-muted-foreground">
            TaskFlow gives founders and managers one place to assign tasks to
            their team, and gives employees a focused view of exactly what is
            due, delayed, or done.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild className="h-12 px-6 text-sm">
              <Link href="/signup">Create your workspace</Link>
            </Button>
            <Button asChild className="h-12 px-6 text-sm" variant="outline">
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </section>
      </div>

      <section
        aria-label="Features"
        className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-4 px-5 pb-20 sm:grid-cols-2 sm:px-8"
      >
        {features.map((feature) => (
          <Card className="shadow-card" key={feature.title}>
            <CardContent>
              <span className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary">
                <feature.icon aria-hidden className="size-5" />
              </span>
              <h2 className="mt-4 text-lg font-semibold tracking-[-0.02em] text-foreground">
                {feature.title}
              </h2>
              <p className="mt-2 text-[15px] leading-6 text-muted-foreground">
                {feature.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section
        aria-labelledby="how-it-works-heading"
        className="border-t border-border"
      >
        <div className="mx-auto w-full max-w-5xl px-5 py-20 sm:px-8">
          <div className="mx-auto max-w-xl text-center">
            <span className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
              How it works
            </span>
            <h2
              className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-foreground"
              id="how-it-works-heading"
            >
              Three steps from idea to done.
            </h2>
          </div>

          <ol className="mt-14 grid grid-cols-1 gap-10 sm:grid-cols-3 sm:gap-6">
            {steps.map((step, index) => (
              <li
                className="relative text-center sm:text-left"
                key={step.title}
              >
                <div className="mx-auto flex items-center gap-3 sm:mx-0">
                  <span className="grid size-11 shrink-0 place-items-center rounded-full border border-primary/30 bg-primary-soft text-primary">
                    <step.icon aria-hidden className="size-5" />
                  </span>
                  <span className="font-mono text-sm text-muted-foreground">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                </div>
                <h3 className="mt-4 text-lg font-semibold tracking-[-0.02em] text-foreground">
                  {step.title}
                </h3>
                <p className="mt-2 text-[15px] leading-6 text-muted-foreground">
                  {step.description}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-5 pb-20 sm:px-8">
        <div className="relative overflow-hidden rounded-3xl border border-primary/25 bg-primary-soft px-8 py-14 text-center shadow-card-lg sm:px-16">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-1/2 -z-10 h-[28rem] w-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/20 blur-3xl"
          />
          <h2 className="text-3xl font-semibold tracking-[-0.03em] text-balance text-foreground sm:text-4xl">
            Bring order to your team&apos;s work today.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-[15px] leading-6 text-muted-foreground">
            Free to start. Set up your organization in under a minute — no
            credit card required.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild className="h-12 px-6 text-sm">
              <Link href="/signup">Create your workspace</Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 sm:flex-row sm:px-8">
          <div className="flex items-center gap-2.5 text-sm font-semibold tracking-[-0.02em] text-foreground">
            <span
              aria-hidden="true"
              className="grid size-6 place-items-center rounded-md bg-primary text-xs text-primary-foreground"
            >
              T
            </span>
            TaskFlow
          </div>
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} TaskFlow. A focused workspace for
            team tasks and daily priorities.
          </p>
        </div>
      </footer>
    </main>
  );
}
