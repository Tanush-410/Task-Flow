import { signOut } from '@/modules/auth/actions';
import { requireAdmin } from '@/modules/members/queries';
import { getCurrentOrganization } from '@/modules/organizations/queries';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';

export default async function SettingsPage() {
  await requireAdmin();
  const { data: organization } = await getCurrentOrganization();

  return (
    <section aria-labelledby="settings-heading" className="space-y-6">
      <PageHeader
        eyebrow="Organization"
        headingId="settings-heading"
        title="Settings"
      />

      <Card className="max-w-xl">
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
      </Card>

      <Card className="max-w-xl">
        <h2 className="text-lg font-semibold tracking-[-0.02em] text-slate-950">
          Account
        </h2>
        <form action={signOut} className="mt-4">
          <Button size="sm" type="submit" variant="secondary">
            Sign out
          </Button>
        </form>
      </Card>
    </section>
  );
}
