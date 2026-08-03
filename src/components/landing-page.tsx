import Link from 'next/link';

const features = [
  {
    title: 'Assign with clarity',
    description:
      'Create a task once, assign it to one or many people, and set a priority and deadline — everyone knows exactly what to do.',
  },
  {
    title: 'Track real progress',
    description:
      'Employees move work through Not Started, In Progress, Delayed, or Completed, with a required reason whenever something slips.',
  },
  {
    title: 'Never miss an update',
    description:
      'Admins are notified the moment work is completed or delayed; employees are notified the moment something new lands on their plate.',
  },
  {
    title: 'One view for every task',
    description:
      'Admins see every task across the team with progress rollups; employees see a focused list of only what is theirs.',
  },
];

export function LandingPage() {
  return (
    <main className="min-h-screen bg-[#f4f4f1] text-slate-950">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-6 sm:px-8">
        <div className="flex items-center gap-2.5 font-semibold tracking-[-0.02em]">
          <span
            aria-hidden="true"
            className="grid size-8 place-items-center rounded-lg bg-slate-950 text-sm text-white"
          >
            T
          </span>
          TaskFlow
        </div>
        <nav aria-label="Account" className="flex items-center gap-3">
          <Link
            className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
            href="/login"
          >
            Sign in
          </Link>
          <Link
            className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
            href="/signup"
          >
            Get started
          </Link>
        </nav>
      </header>

      <section className="mx-auto w-full max-w-3xl px-5 pt-14 pb-10 text-center sm:px-8 sm:pt-20">
        <h1 className="text-4xl font-semibold tracking-[-0.04em] text-balance text-slate-950 sm:text-5xl">
          Assign, track, and complete work without the chaos.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg leading-7 text-slate-600">
          TaskFlow gives founders and managers one place to assign tasks to
          their team, and gives employees a focused view of exactly what is due,
          delayed, or done.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            className="flex h-12 items-center justify-center rounded-xl bg-slate-950 px-6 text-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
            href="/signup"
          >
            Create your workspace
          </Link>
          <Link
            className="flex h-12 items-center justify-center rounded-xl border border-slate-300 bg-white px-6 text-sm font-semibold text-slate-950 hover:border-slate-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
            href="/login"
          >
            Sign in
          </Link>
        </div>
      </section>

      <section
        aria-label="Features"
        className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-4 px-5 pb-20 sm:grid-cols-2 sm:px-8"
      >
        {features.map((feature) => (
          <div
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_18px_50px_-32px_rgba(15,23,42,0.45)]"
            key={feature.title}
          >
            <h2 className="text-lg font-semibold tracking-[-0.02em] text-slate-950">
              {feature.title}
            </h2>
            <p className="mt-2 text-[15px] leading-6 text-slate-600">
              {feature.description}
            </p>
          </div>
        ))}
      </section>
    </main>
  );
}
