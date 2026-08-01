import { redirect } from 'next/navigation';

import { roleLandingPath } from '@/modules/auth/navigation';
import { getMembershipAccess } from '@/modules/members/queries';

export default async function Home() {
  const access = await getMembershipAccess();

  if (access.kind === 'redirect') {
    redirect(access.location);
  }

  redirect(roleLandingPath(access.membership.role));
}
