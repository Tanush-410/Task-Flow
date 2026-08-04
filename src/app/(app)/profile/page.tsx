import { signOut } from '@/modules/auth/actions';
import {
  getCurrentProfile,
  getOwnConnectCode,
  listMyConnectionRequests,
  requireMembership,
} from '@/modules/members/queries';
import { ConnectionRequestList } from '@/components/connection-request-list';
import { CopyButton } from '@/components/copy-button';
import { PersonAvatar } from '@/components/person-avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';

export default async function ProfilePage() {
  const [membership, profile, connectCode, requests] = await Promise.all([
    requireMembership(),
    getCurrentProfile(),
    getOwnConnectCode(),
    listMyConnectionRequests(),
  ]);

  return (
    <section aria-labelledby="profile-heading" className="space-y-6">
      <PageHeader
        eyebrow="Account"
        headingId="profile-heading"
        title="Profile"
      />

      <Card className="max-w-xl">
        <CardContent>
          <div className="flex items-center gap-4">
            <PersonAvatar
              displayName={profile.displayName || 'You'}
              size="lg"
              userId={membership.userId}
            />
            <div>
              <p className="text-base font-semibold text-foreground">
                {profile.displayName || '—'}
              </p>
              <p className="text-sm text-muted-foreground capitalize">
                {profile.role}
              </p>
            </div>
          </div>

          <form action={signOut} className="mt-6">
            <Button size="sm" type="submit" variant="outline">
              Sign out
            </Button>
          </form>
        </CardContent>
      </Card>

      {connectCode ? (
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>Your connect code</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Share this with an admin so they can add you to their organization
              — you&apos;ll still need to accept the request.
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

      {requests.length > 0 ? (
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>Pending requests to join</CardTitle>
          </CardHeader>
          <CardContent>
            <ConnectionRequestList requests={requests} />
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}
