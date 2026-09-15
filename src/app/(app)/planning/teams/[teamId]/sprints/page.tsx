import { ArrowLeft, CalendarRange } from 'lucide-react';
import Link from 'next/link';

import { SprintForm } from '@/components/planning/sprint-form';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { requirePlanningTeamAccess } from '@/modules/planning-teams/queries';
import { listSprints } from '@/modules/sprints/queries';

const STATUS_LABELS = {
  planned: 'Planned',
  active: 'Active',
  completed: 'Completed',
} as const;

const STATUS_VARIANT = {
  planned: 'secondary',
  active: 'default',
  completed: 'outline',
} as const;

function formatDateRange(startDate: string, endDate: string): string {
  const format = (value: string) =>
    new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  return `${format(startDate)} – ${format(endDate)}`;
}

export default async function SprintsPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  const [team, sprints] = await Promise.all([
    requirePlanningTeamAccess(teamId),
    listSprints(teamId),
  ]);
  const canManage = team.currentUserRole !== 'member';

  return (
    <section aria-labelledby="sprints-heading" className="space-y-8">
      <div>
        <Link
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          href={`/planning/teams/${teamId}`}
        >
          <ArrowLeft aria-hidden className="size-4" />
          {team.name}
        </Link>
        <div className="mt-4">
          <PageHeader
            description="Every rostered member of this team can open a sprint here to see exactly what's planned."
            headingId="sprints-heading"
            title="Sprints"
          />
        </div>
      </div>

      {canManage ? (
        <Card>
          <CardHeader className="border-b">
            <CardTitle>New sprint</CardTitle>
          </CardHeader>
          <CardContent className="max-w-2xl">
            <SprintForm
              defaultSprintLengthDays={team.defaultSprintLengthDays}
              mode="create"
              planningTeamId={teamId}
            />
          </CardContent>
        </Card>
      ) : null}

      <div>
        <div className="mb-3 flex items-center justify-between gap-4">
          <h2 className="text-base font-semibold">All sprints</h2>
          <span className="text-sm text-muted-foreground">
            {sprints.length} total
          </span>
        </div>

        {sprints.length === 0 ? (
          <EmptyState
            description={
              canManage
                ? 'Create the first sprint above, then assign backlog tasks to it.'
                : 'A planner hasn’t created a sprint for this team yet.'
            }
            icon={CalendarRange}
            title="No sprints yet"
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <ul className="divide-y divide-border">
              {sprints.map((sprint) => (
                <li key={sprint.id}>
                  <Link
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-muted/45 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
                    href={`/planning/teams/${teamId}/sprints/${sprint.id}`}
                  >
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-medium">
                          {sprint.name}
                        </span>
                        <Badge variant={STATUS_VARIANT[sprint.status]}>
                          {STATUS_LABELS[sprint.status]}
                        </Badge>
                      </span>
                      <span className="mt-1 block text-sm text-muted-foreground">
                        {formatDateRange(sprint.startDate, sprint.endDate)} ·{' '}
                        {sprint.itemCount}{' '}
                        {sprint.itemCount === 1 ? 'item' : 'items'}
                        {sprint.storyPoints > 0
                          ? ` · ${sprint.storyPoints} pts`
                          : ''}
                      </span>
                    </span>
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
