import { signOut } from '@/modules/auth/actions';
import { getOwnConnectCode, requireAdmin } from '@/modules/members/queries';
import { getCurrentOrganization } from '@/modules/organizations/queries';
import { CopyButton } from '@/components/copy-button';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';

export default async function SettingsPage() {
  await requireAdmin();
  const [{ data: organization }, connectCode] = await Promise.all([
    getCurrentOrganization(),
    getOwnConnectCode(),
  ]);

  return (
    <section aria-labelledby="settings-heading" className="space-y-6">
      <PageHeader
        eyebrow="Organization"
        headingId="settings-heading"
        title="Settings"
      />

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Organization details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Name</dt>
              <dd className="font-semibold text-foreground">
                {organization?.name ?? '—'}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Timezone</dt>
              <dd className="font-semibold text-foreground">
                {organization?.timezone ?? '—'}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {connectCode ? (
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>Your connect code</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Other admins can use this to add you to their organization.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <span className="flex-1 font-mono text-lg font-semibold tracking-[0.2em] text-foreground">
                {connectCode.connectCode}
              </span>
              <CopyButton label="Copy code" value={connectCode.connectCode} />
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={signOut}>
            <Button size="sm" type="submit" variant="outline">
              Sign out
            </Button>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}
