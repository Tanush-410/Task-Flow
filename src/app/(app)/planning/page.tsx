import { ArrowRight, CalendarRange, UsersRound } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { requireMembership } from '@/modules/members/queries';
import { listPlanningTeams } from '@/modules/planning-teams/queries';

export default async function PlanningPage() {
  const membership = await requireMembership();
  const teams = await listPlanningTeams();

  return (
    <section aria-labelledby="planning-heading" className="space-y-8">
      <PageHeader
        action={
          membership.role === 'admin' ? (
            <Button asChild variant="outline">
              <Link href="/planning/teams">Manage teams</Link>
            </Button>
          ) : undefined
        }
        description="Choose a team to prepare its next sprint, balance capacity, and keep delivery work visible."
        eyebrow="Planning"
        headingId="planning-heading"
        title="Sprint planning"
      />

      {teams.length === 0 ? (
        <EmptyState
          action={
            membership.role === 'admin' ? (
              <Button asChild>
                <Link href="/planning/teams">Create a planning team</Link>
              </Button>
            ) : undefined
          }
          description={
            membership.role === 'admin'
              ? 'Create a team, choose its members, and set a default sprint cadence.'
              : 'You will see a team here after a planner adds you.'
          }
          icon={CalendarRange}
          title="No planning teams yet"
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <ul className="divide-y divide-border">
            {teams.map((team) => (
              <li key={team.id}>
                <Link
                  className="group grid gap-4 px-5 py-5 transition-colors hover:bg-muted/45 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                  href={`/planning/teams/${team.id}`}
                >
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-semibold tracking-[-0.015em] text-foreground">
                        {team.name}
                      </span>
                      <Badge variant="secondary">{team.currentUserRole}</Badge>
                    </span>
                    {team.description ? (
                      <span className="mt-1 block max-w-2xl text-sm leading-6 text-muted-foreground">
                        {team.description}
                      </span>
                    ) : null}
                  </span>

                  <span className="flex items-center gap-5 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <UsersRound aria-hidden className="size-4" />
                      {team.memberCount}{' '}
                      {team.memberCount === 1 ? 'member' : 'members'}
                    </span>
                    <span>{team.defaultSprintLengthDays}-day cadence</span>
                    <ArrowRight
                      aria-hidden
                      className="size-4 transition-transform group-hover:translate-x-0.5"
                    />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
