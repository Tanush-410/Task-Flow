import { signOut } from '@/modules/auth/actions';
import { requireAdmin } from '@/modules/members/queries';
import { getCurrentOrganization } from '@/modules/organizations/queries';

const cardClassName =
  'max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_18px_50px_-32px_rgba(15,23,42,0.45)]';

export default async function SettingsPage() {
  await requireAdmin();
  const { data: organization } = await getCurrentOrganization();

  return (
    <section aria-labelledby="settings-heading" className="space-y-8">
      <div>
        <p className="text-sm font-medium text-slate-500">Organization</p>
        <h1
          className="mt-1 text-3xl font-semibold tracking-[-0.035em] text-slate-950"
          id="settings-heading"
        >
          Settings
        </h1>
      </div>

      <div className={cardClassName}>
        <h2 className="text-lg font-semibold tracking-[-0.02em] text-slate-950">
          Organization details
        </h2>
        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Name</dt>
            <dd className="font-semibold text-slate-950">
              {organization?.name ?? '—'}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Timezone</dt>
            <dd className="font-semibold text-slate-950">
              {organization?.timezone ?? '—'}
            </dd>
          </div>
        </dl>
      </div>

      <div className={cardClassName}>
        <h2 className="text-lg font-semibold tracking-[-0.02em] text-slate-950">
          Account
        </h2>
        <form action={signOut} className="mt-4">
          <button
            className="h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:border-slate-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
            type="submit"
          >
            Sign out
          </button>
        </form>
      </div>
    </section>
  );
}
