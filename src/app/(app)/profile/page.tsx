import { signOut } from '@/modules/auth/actions';
import {
  getCurrentProfile,
  requireMembership,
} from '@/modules/members/queries';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';

export default async function ProfilePage() {
  const [membership, profile] = await Promise.all([
    requireMembership(),
    getCurrentProfile(),
  ]);

  return (
    <section aria-labelledby="profile-heading" className="space-y-6">
      <PageHeader
        eyebrow="Account"
        headingId="profile-heading"
        title="Profile"
      />

      <Card className="max-w-xl">
        <div className="flex items-center gap-4">
          <Avatar
            displayName={profile.displayName || 'You'}
            size="lg"
            userId={membership.userId}
          />
          <div>
            <p className="text-base font-semibold text-slate-950">
              {profile.displayName || '—'}
            </p>
            <p className="text-sm text-slate-500 capitalize">{profile.role}</p>
          </div>
        </div>

        <form action={signOut} className="mt-6">
          <Button size="sm" type="submit" variant="secondary">
            Sign out
          </Button>
        </form>
      </Card>
    </section>
  );
}
