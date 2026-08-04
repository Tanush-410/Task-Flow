import { UsersRound } from 'lucide-react';
import Link from 'next/link';

import { InviteMemberForm } from '@/components/invite-member-form';
import { PersonAvatar } from '@/components/person-avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { listOrganizationMembers } from '@/modules/members/queries';
import { getEmployeeWorkload } from '@/modules/reports/queries';

export default async function EmployeesPage() {
  const [members, workload] = await Promise.all([
    listOrganizationMembers(),
    getEmployeeWorkload(),
  ]);
  const maxActive = Math.max(1, ...workload.map((row) => row.activeCount));

  return (
    <section aria-labelledby="employees-heading" className="space-y-6">
      <PageHeader
        eyebrow="Organization"
        headingId="employees-heading"
        title="Employees"
      />

      <Card>
        <CardHeader>
          <CardTitle>Invite someone</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Send a secure invite link, or they can{' '}
            <Link
              className="text-primary underline underline-offset-2"
              href="/signup"
            >
              create their own account
            </Link>{' '}
            and select this organization.
          </p>
          <div className="mt-4 max-w-xl">
            <InviteMemberForm />
          </div>
        </CardContent>
      </Card>

      {workload.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Workload</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-4">
              {workload.map((row) => (
                <li key={row.userId}>
                  <Link
                    className="flex items-center justify-between text-sm hover:text-primary"
                    href={`/employees/${row.userId}`}
                  >
                    <span className="font-medium text-foreground">
                      {row.displayName}
                    </span>
                    <span className="text-muted-foreground">
                      {row.activeCount} active
                      {row.overdueCount > 0 ? (
                        <span className="ml-1.5 font-semibold text-red-400">
                          · {row.overdueCount} overdue
                        </span>
                      ) : null}
                    </span>
                  </Link>
                  <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-[width]"
                      style={{
                        width:
                          row.activeCount === 0
                            ? '0%'
                            : `${Math.max(2, (row.activeCount / maxActive) * 100)}%`,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Directory ({members.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <EmptyState
              description="Invite your first teammate above."
              icon={UsersRound}
              title="No members yet"
            />
          ) : (
            <ul className="divide-y divide-border">
              {members.map((member) => {
                const content = (
                  <>
                    <div className="flex items-center gap-3">
                      <PersonAvatar
                        displayName={member.displayName}
                        userId={member.userId}
                      />
                      <span className="text-sm font-semibold text-foreground">
                        {member.displayName}
                      </span>
                    </div>
                    <Badge
                      variant={
                        member.role === 'admin' ? 'default' : 'secondary'
                      }
                    >
                      {member.role}
                    </Badge>
                  </>
                );

                return (
                  <li key={member.id}>
                    {member.role === 'employee' ? (
                      <Link
                        className="flex items-center justify-between gap-4 py-3 hover:opacity-80"
                        href={`/employees/${member.userId}`}
                      >
                        {content}
                      </Link>
                    ) : (
                      <div className="flex items-center justify-between gap-4 py-3">
                        {content}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
