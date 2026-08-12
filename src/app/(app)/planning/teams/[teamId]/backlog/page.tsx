import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

import { BacklogFilters } from '@/components/planning/backlog/backlog-filters';
import { BacklogTree } from '@/components/planning/backlog/backlog-tree';
import { PageHeader } from '@/components/ui/page-header';
import { listBacklogHierarchy } from '@/modules/backlog/queries';
import type { WorkItemType } from '@/modules/backlog/schemas';
import { listAssignableMembers } from '@/modules/members/queries';
import { requirePlanningTeamAccess } from '@/modules/planning-teams/queries';

const TYPE_FILTERS: WorkItemType[] = ['epic', 'feature', 'user_story', 'task'];
const ESTIMATE_FILTERS = ['estimated', 'unestimated'] as const;

export default async function BacklogPage({
  params,
  searchParams,
}: {
  params: Promise<{ teamId: string }>;
  searchParams: Promise<{
    type?: string;
    assigneeId?: string;
    estimateState?: string;
    q?: string;
  }>;
}) {
  const { teamId } = await params;
  const query = await searchParams;

  const activeType = TYPE_FILTERS.includes(query.type as WorkItemType)
    ? (query.type as WorkItemType)
    : undefined;
  const activeEstimateState = ESTIMATE_FILTERS.includes(
    query.estimateState as (typeof ESTIMATE_FILTERS)[number],
  )
    ? (query.estimateState as (typeof ESTIMATE_FILTERS)[number])
    : undefined;
  const activeAssigneeId = query.assigneeId || undefined;
  const activeText = query.q ?? '';

  const [team, tree, assignableMembers] = await Promise.all([
    requirePlanningTeamAccess(teamId),
    listBacklogHierarchy(teamId, {
      type: activeType,
      assigneeId: activeAssigneeId,
      estimateState: activeEstimateState,
      text: activeText,
    }),
    listAssignableMembers(),
  ]);

  const memberNameById = Object.fromEntries(
    assignableMembers.map((member) => [member.userId, member.displayName]),
  );

  return (
    <section aria-labelledby="backlog-heading" className="space-y-6">
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
            description="The ranked hierarchy of epics, features, user stories, and tasks this team owns."
            headingId="backlog-heading"
            title="Backlog"
          />
        </div>
      </div>

      <BacklogFilters
        assigneeId={activeAssigneeId ?? 'all'}
        assignees={assignableMembers.map((member) => ({
          userId: member.userId,
          displayName: member.displayName,
        }))}
        estimateState={activeEstimateState ?? 'all'}
        teamId={teamId}
        text={activeText}
        type={activeType ?? 'all'}
      />

      <BacklogTree
        items={tree}
        memberNameById={memberNameById}
        teamId={teamId}
      />
    </section>
  );
}
