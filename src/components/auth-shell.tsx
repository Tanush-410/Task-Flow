import type { ReactNode } from 'react';

import { BrandMark } from './brand-mark';

export function AuthCard({
  children,
  headingId,
}: {
  children: ReactNode;
  headingId?: string;
}) {
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden px-5 py-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-1/2 -z-10 h-[26rem] w-[26rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/20 blur-[100px] motion-safe:animate-pulse motion-safe:[animation-duration:4s]"
      />
      <section
        aria-labelledby={headingId}
        className="w-full max-w-[420px] rounded-2xl bg-glass-bg px-6 py-8 shadow-card-lg ring-1 ring-glass-border backdrop-blur-xl backdrop-saturate-150 sm:px-9 sm:py-10"
      >
        {children}
      </section>
    </main>
  );
}

export function AuthLogo() {
  return (
    <div className="mb-7 flex items-center gap-2.5 font-semibold tracking-[-0.02em] text-foreground">
      <BrandMark />
      TaskFlow
    </div>
  );
}
