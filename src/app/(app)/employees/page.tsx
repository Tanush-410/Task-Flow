import { UsersRound } from 'lucide-react';
import Link from 'next/link';

import { InviteMemberForm } from '@/components/invite-member-form';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
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
        <h2 className="text-lg font-semibold tracking-[-0.02em] text-slate-950">
          Invite someone
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Send a secure invite link, or they can{' '}
          <Link
            className="text-accent-hover underline underline-offset-2"
            href="/signup"
          >
            create their own account
          </Link>{' '}
          and select this organization.
        </p>
        <div className="mt-4 max-w-xl">
          <InviteMemberForm />
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold tracking-[-0.02em] text-slate-950">
          Directory ({members.length})
        </h2>
        {members.length === 0 ? (
          <EmptyState
            className="mt-4"
            description="Invite your first teammate above."
            icon={UsersRound}
            title="No members yet"
          />
        ) : (
          <ul className="mt-4 divide-y divide-slate-200">
            {members.map((member) => (
              <li
                className="flex items-center justify-between gap-4 py-3"
                key={member.id}
              >
                <div className="flex items-center gap-3">
                  <Avatar
                    displayName={member.displayName}
                    userId={member.userId}
                  />
                  <span className="text-sm font-semibold text-slate-950">
                    {member.displayName}
                  </span>
                </div>
                <Badge variant={member.role === 'admin' ? 'accent' : 'neutral'}>
                  {member.role}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}
