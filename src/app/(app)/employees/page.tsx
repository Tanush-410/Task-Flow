import Link from 'next/link';

import { InviteMemberForm } from '@/components/invite-member-form';
import { listOrganizationMembers } from '@/modules/members/queries';

export default async function EmployeesPage() {
  const members = await listOrganizationMembers();

  return (
    <section aria-labelledby="employees-heading" className="space-y-8">
      <div>
        <p className="text-sm font-medium text-slate-500">Organization</p>
        <h1
          className="mt-1 text-3xl font-semibold tracking-[-0.035em] text-slate-950"
          id="employees-heading"
        >
          Employees
        </h1>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_18px_50px_-32px_rgba(15,23,42,0.45)]">
        <h2 className="text-lg font-semibold tracking-[-0.02em] text-slate-950">
          Invite someone
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Send a secure invite link, or they can{' '}
          <Link className="underline underline-offset-2" href="/signup">
            create their own account
          </Link>{' '}
          and select this organization.
        </p>
        <div className="mt-4 max-w-xl">
          <InviteMemberForm />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_18px_50px_-32px_rgba(15,23,42,0.45)]">
        <h2 className="text-lg font-semibold tracking-[-0.02em] text-slate-950">
          Directory ({members.length})
        </h2>
        {members.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">No members yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-200">
            {members.map((member) => (
              <li
                className="flex items-center justify-between gap-4 py-3"
                key={member.id}
              >
                <span className="text-sm font-semibold text-slate-950">
                  {member.displayName}
                </span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold tracking-wide text-slate-700 uppercase">
                  {member.role}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
