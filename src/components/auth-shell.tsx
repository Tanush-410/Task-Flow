import type { ReactNode } from 'react';

export function AuthCard({
  children,
  headingId,
}: {
  children: ReactNode;
  headingId?: string;
}) {
  return (
    <main className="grid min-h-screen place-items-center px-5 py-12">
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
      <span
        aria-hidden="true"
        className="grid size-8 place-items-center rounded-lg bg-[radial-gradient(circle_at_30%_25%,var(--primary-hover),var(--primary)_65%)] text-sm text-primary-foreground shadow-[0_0_16px_var(--glass-glow)]"
      >
        T
      </span>
      TaskFlow
    </div>
  );
}
