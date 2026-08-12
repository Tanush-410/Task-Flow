import { ArrowLeft, ListTree } from 'lucide-react';
import Link from 'next/link';

import { TeamForm } from '@/components/planning/team-form';
import { TeamMembersForm } from '@/components/planning/team-members-form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { archivePlanningTeam } from '@/modules/planning-teams/actions';
import { requireMembership } from '@/modules/members/queries';
import {
  listPlanningTeamCandidates,
  requirePlanningTeamAccess,
} from '@/modules/planning-teams/queries';

async function archiveTeam(formData: FormData) {
  'use server';

  await archivePlanningTeam({ teamId: formData.get('teamId') });
}

export default async function PlanningTeamPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  const [membership, team] = await Promise.all([
    requireMembership(),
    requirePlanningTeamAccess(teamId),
  ]);
  const canManage = team.currentUserRole !== 'member';
  const candidates = canManage
    ? await listPlanningTeamCandidates(teamId)
    : team.members.map((member) => ({
        userId: member.userId,
        displayName: member.displayName,
        planningRole: member.planningRole,
        defaultCapacityHoursPerDay: member.defaultCapacityHoursPerDay,
      }));

  return (
    <section aria-labelledby="planning-team-heading" className="space-y-8">
      <div>
        <Link
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          href="/planning"
        >
          <ArrowLeft aria-hidden className="size-4" />
          Sprint planning
        </Link>
        <div className="mt-4">
          <PageHeader
            action={
              <div className="flex items-center gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link href={`/planning/teams/${team.id}/backlog`}>
                    <ListTree aria-hidden />
                    View backlog
                  </Link>
                </Button>
                <Badge variant={team.isArchived ? 'outline' : 'secondary'}>
                  {team.isArchived ? 'Archived' : team.currentUserRole}
                </Badge>
              </div>
            }
            description={
              team.description ||
              `${team.defaultSprintLengthDays}-day default sprint cadence`
            }
            headingId="planning-team-heading"
            title={team.name}
          />
        </div>
      </div>

      {canManage ? (
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Team settings</CardTitle>
          </CardHeader>
          <CardContent className="max-w-2xl">
            <TeamForm
              initialTeam={{
                id: team.id,
                name: team.name,
                description: team.description,
                defaultSprintLengthDays: team.defaultSprintLengthDays,
              }}
              mode="edit"
            />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="border-b">
          <CardTitle>
            {canManage ? 'Members and capacity' : 'Your capacity'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TeamMembersForm
            canManage={canManage}
            canManageOwnRole={membership.role === 'admin'}
            candidates={candidates}
            currentUserId={membership.userId}
            teamId={team.id}
          />
        </CardContent>
      </Card>

      {membership.role === 'admin' && !team.isArchived ? (
        <div className="border-t border-border pt-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold">Archive team</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Hide this team from active planning without deleting its data.
              </p>
            </div>
            <form action={archiveTeam}>
              <input name="teamId" type="hidden" value={team.id} />
              <Button type="submit" variant="destructive">
                Archive team
              </Button>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
