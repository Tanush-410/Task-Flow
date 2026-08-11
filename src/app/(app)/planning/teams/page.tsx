import { Archive, ArrowRight } from 'lucide-react';
import Link from 'next/link';

import { TeamForm } from '@/components/planning/team-form';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { requireMembership } from '@/modules/members/queries';
import { listPlanningTeams } from '@/modules/planning-teams/queries';

export default async function PlanningTeamsPage() {
  const membership = await requireMembership();
  const teams = await listPlanningTeams({ includeArchived: true });

  return (
    <section aria-labelledby="planning-teams-heading" className="space-y-8">
      <PageHeader
        description="Define stable delivery groups, their sprint cadence, and who can plan work."
        eyebrow="Sprint planning"
        headingId="planning-teams-heading"
        title="Planning teams"
      />

      {membership.role === 'admin' ? (
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Create a team</CardTitle>
          </CardHeader>
          <CardContent className="max-w-2xl">
            <TeamForm mode="create" />
          </CardContent>
        </Card>
      ) : null}

      <div>
        <div className="mb-3 flex items-center justify-between gap-4">
          <h2 className="text-base font-semibold">All teams</h2>
          <span className="text-sm text-muted-foreground">
            {teams.length} total
          </span>
        </div>

        {teams.length === 0 ? (
          <EmptyState
            description="Create the first team above to begin planning sprints."
            icon={Archive}
            title="No teams configured"
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <ul className="divide-y divide-border">
              {teams.map((team) => (
                <li key={team.id}>
                  <Link
                    className="group flex items-center justify-between gap-5 px-5 py-4 transition-colors hover:bg-muted/45 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
                    href={`/planning/teams/${team.id}`}
                  >
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-medium">
                          {team.name}
                        </span>
                        {team.isArchived ? (
                          <Badge variant="outline">Archived</Badge>
                        ) : null}
                      </span>
                      <span className="mt-1 block text-sm text-muted-foreground">
                        {team.memberCount}{' '}
                        {team.memberCount === 1 ? 'member' : 'members'} ·{' '}
                        {team.defaultSprintLengthDays} days
                      </span>
                    </span>
                    <ArrowRight
                      aria-hidden
                      className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
