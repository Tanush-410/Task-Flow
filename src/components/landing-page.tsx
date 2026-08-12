import {
  BellRing,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Eye,
  GitBranch,
  ListChecks,
  ListTree,
  Notebook,
  PenSquare,
  Search,
  Trophy,
  UsersRound,
} from 'lucide-react';
import Link from 'next/link';
import type { ComponentType } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const CHART_TOKENS = [
  '--chart-1',
  '--chart-2',
  '--chart-3',
  '--chart-4',
  '--chart-5',
];

function chipStyle(index: number) {
  const token = CHART_TOKENS[index % CHART_TOKENS.length];
  return {
    backgroundColor: `color-mix(in oklch, var(${token}), transparent 82%)`,
    color: `var(${token})`,
  };
}

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
    title: 'See it your way',
    description:
      'Switch between a List, a drag-and-drop Board, or a Month/Week/Day Calendar — the same tasks, three views, color-tagged by who they belong to.',
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
  {
    title: 'See who’s thriving',
    description:
      'A productivity ranking shows admins who finishes work fastest, based on real turnaround time from assignment to completion.',
    icon: Trophy,
  },
  {
    title: 'Know what’s in flight',
    description:
      'A live current-work view shows admins exactly what every employee has in progress right now, at a glance.',
    icon: Eye,
  },
  {
    title: 'Find anything instantly',
    description:
      'Press ⌘K from anywhere in the app to jump straight to a task by title — no digging through lists or boards.',
    icon: Search,
  },
  {
    title: 'Keep a private trail',
    description:
      'Personal notes only you can see, plus an organization-wide activity feed of every task and assignment change, most recent first.',
    icon: Notebook,
  },
  {
    title: 'Know your people',
    description:
      'An employee directory with role management and invites, so admins always know who’s on the team and what they own.',
    icon: Building2,
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
            <ListTree aria-hidden className="size-3.5" />
            New: native sprint planning
          </span>
          <h1 className="mt-5 text-4xl font-semibold tracking-[-0.04em] text-balance text-foreground sm:text-5xl">
            Assign, plan, and ship work — without the chaos.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-7 text-muted-foreground">
            TaskFlow gives founders and managers one place to assign daily work
            and rank a full sprint backlog, and gives employees a focused view
            of exactly what is due, delayed, or done.
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
        className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-4 px-5 pb-20 sm:grid-cols-2 sm:px-8 lg:grid-cols-3"
      >
        {features.map((feature, index) => (
          <Card className="shadow-card" key={feature.title}>
            <CardContent>
              <span
                aria-hidden="true"
                className="grid size-10 place-items-center rounded-xl"
                style={chipStyle(index)}
              >
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
        aria-labelledby="sprint-planning-heading"
        className="border-t border-border bg-muted/30"
      >
        <div className="mx-auto grid w-full max-w-5xl grid-cols-1 items-center gap-12 px-5 py-20 sm:px-8 lg:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">
              <GitBranch aria-hidden className="size-3.5" />
              Sprint planning
            </span>
            <h2
              className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-balance text-foreground"
              id="sprint-planning-heading"
            >
              A ranked backlog, built natively — no external account required.
            </h2>
            <p className="mt-4 text-[15px] leading-7 text-muted-foreground">
              Build out a full Epic → Feature → User Story → Task hierarchy —
              Bugs included, with their own repro steps and severity. Estimate
              with story points or hours, reorder with a keyboard or
              drag-and-drop, and move a whole subtree to another team with a
              live preview of exactly what comes with it.
            </p>
            <ul className="mt-6 space-y-3">
              {[
                'Cycles are structurally impossible — enforced by the database, not app code',
                'Fractional ranking reorders one item without renumbering the rest of the backlog',
                'Cross-team moves show a live descendant count before you commit to them',
              ].map((point) => (
                <li className="flex items-start gap-2.5 text-sm" key={point}>
                  <CheckCircle2
                    aria-hidden
                    className="mt-0.5 size-4 shrink-0 text-primary"
                  />
                  <span className="text-muted-foreground">{point}</span>
                </li>
              ))}
            </ul>
          </div>

          <Card className="shadow-card-lg">
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                <div className="flex items-center gap-2 px-4 py-3">
                  <Badge>Epic</Badge>
                  <span className="text-sm font-medium text-foreground">
                    Checkout redesign
                  </span>
                </div>
                <div className="flex items-center gap-2 py-3 pr-4 pl-8">
                  <Badge variant="secondary">Feature</Badge>
                  <span className="text-sm font-medium text-foreground">
                    Payment flow
                  </span>
                </div>
                <div className="flex items-center gap-2 py-3 pr-4 pl-14">
                  <Badge variant="outline">User story</Badge>
                  <span className="text-sm font-medium text-foreground">
                    Add saved cards
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    5 pts
                  </span>
                </div>
                <div className="flex items-center gap-2 py-3 pr-4 pl-14">
                  <Badge variant="destructive">Bug</Badge>
                  <span className="text-sm font-medium text-foreground">
                    Retry fails silently
                  </span>
                </div>
                <div className="flex items-center gap-2 py-3 pr-4 pl-20">
                  <Badge variant="outline">Task</Badge>
                  <span className="text-sm font-medium text-foreground">
                    Add retry telemetry
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    3h / 5h
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
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
