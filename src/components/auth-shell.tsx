import type { ReactNode } from 'react';

export function AuthCard({
  children,
  headingId,
}: {
  children: ReactNode;
  headingId?: string;
}) {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-5 py-12">
      <section
        aria-labelledby={headingId}
        className="w-full max-w-[420px] rounded-2xl border border-border bg-card px-6 py-8 shadow-card sm:px-9 sm:py-10"
      >
        {children}
      </section>
    </main>
  );
}

export function AuthLogo() {
  return (
    <div className="mb-7 flex items-center gap-2.5 font-semibold tracking-[-0.02em] text-foreground">
      <span
        aria-hidden="true"
        className="grid size-8 place-items-center rounded-lg bg-primary text-sm text-primary-foreground"
      >
        T
      </span>
      TaskFlow
    </div>
  );
}
