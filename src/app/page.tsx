import { redirect } from 'next/navigation';

import { LandingPage } from '@/components/landing-page';
import { roleLandingPath } from '@/modules/auth/navigation';
import { getMembershipAccess } from '@/modules/members/queries';

export default async function Home() {
  const access = await getMembershipAccess();

  if (access.kind === 'membership') {
    redirect(roleLandingPath(access.membership.role));
  }

  if (access.location === '/access-pending') {
    redirect(access.location);
  }

  return <LandingPage />;
}
