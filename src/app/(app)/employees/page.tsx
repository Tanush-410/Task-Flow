import { UsersRound } from 'lucide-react';
import Link from 'next/link';

import { InviteMemberForm } from '@/components/invite-member-form';
import { PersonAvatar } from '@/components/person-avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { listOrganizationMembers } from '@/modules/members/queries';

export default async function EmployeesPage() {
  const members = await listOrganizationMembers();

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
              {members.map((member) => (
                <li
                  className="flex items-center justify-between gap-4 py-3"
                  key={member.id}
                >
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
                    variant={member.role === 'admin' ? 'default' : 'secondary'}
                  >
                    {member.role}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
