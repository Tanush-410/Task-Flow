import Link from 'next/link';

import { AuthCard, AuthLogo } from '@/components/auth-shell';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <AuthCard>
      <AuthLogo />
      <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
        404
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-foreground">
        Page not found.
      </h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        The page you&apos;re looking for doesn&apos;t exist, or you may not have
        access to it.
      </p>
      <Button asChild className="mt-6 w-full">
        <Link href="/">Back to TaskFlow</Link>
      </Button>
    </AuthCard>
  );
}
