'use client';

import Link from 'next/link';
import { useEffect } from 'react';

import { AuthCard, AuthLogo } from '@/components/auth-shell';
import { Button } from '@/components/ui/button';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Unhandled application error', error);
  }, [error]);

  return (
    <AuthCard>
      <AuthLogo />
      <p className="text-xs font-semibold tracking-[0.14em] text-destructive uppercase">
        Something went wrong
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-foreground">
        We hit a snag.
      </h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        An unexpected error occurred. Try again, or head back to your dashboard.
      </p>
      {error.digest ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Reference: {error.digest}
        </p>
      ) : null}
      <div className="mt-6 flex gap-2">
        <Button className="flex-1" onClick={reset} variant="outline">
          Try again
        </Button>
        <Button asChild className="flex-1">
          <Link href="/">Go home</Link>
        </Button>
      </div>
    </AuthCard>
  );
}
