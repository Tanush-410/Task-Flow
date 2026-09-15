import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { SprintStatusControl } from '@/components/planning/sprint-status-control';
import { SprintTaskList } from '@/components/planning/sprint-task-list';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { listAssignableMembers } from '@/modules/members/queries';
import { requirePlanningTeamAccess } from '@/modules/planning-teams/queries';
import { getSprint } from '@/modules/sprints/queries';

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
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  return `${format(startDate)} – ${format(endDate)}`;
}

export default async function SprintDetailPage({
  params,
}: {
  params: Promise<{ teamId: string; sprintId: string }>;
}) {
  const { teamId, sprintId } = await params;
  const [team, sprint, assignableMembers] = await Promise.all([
    requirePlanningTeamAccess(teamId),
    getSprint(sprintId),
    listAssignableMembers(),
  ]);

  if (!sprint || sprint.planningTeamId !== teamId) {
    notFound();
  }

  const canManage = team.currentUserRole !== 'member';
  const memberNameById = Object.fromEntries(
    assignableMembers.map((member) => [member.userId, member.displayName]),
  );

  return (
    <section aria-labelledby="sprint-heading" className="space-y-6">
      <div>
        <Link
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          href={`/planning/teams/${teamId}/sprints`}
        >
          <ArrowLeft aria-hidden className="size-4" />
          Sprints
        </Link>
        <div className="mt-4">
          <PageHeader
            action={
              canManage ? (
                <SprintStatusControl
                  sprintId={sprint.id}
                  status={sprint.status}
                />
              ) : (
                <Badge variant={STATUS_VARIANT[sprint.status]}>
                  {STATUS_LABELS[sprint.status]}
                </Badge>
              )
            }
            description={formatDateRange(sprint.startDate, sprint.endDate)}
            headingId="sprint-heading"
            title={sprint.name}
          />
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {sprint.itemCount} {sprint.itemCount === 1 ? 'item' : 'items'}
          {sprint.storyPoints > 0 ? ` · ${sprint.storyPoints} points` : ''}
        </p>
      </div>

      <SprintTaskList memberNameById={memberNameById} tasks={sprint.tasks} />
    </section>
  );
}
