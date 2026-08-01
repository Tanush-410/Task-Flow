import { requireMembership } from '@/modules/members/queries';

export default async function MyDayPage() {
  await requireMembership();

  return (
    <section aria-labelledby="my-day-heading">
      <p className="text-sm font-medium text-slate-500">Focus</p>
      <h1
        className="mt-1 text-3xl font-semibold tracking-[-0.035em] text-slate-950"
        id="my-day-heading"
      >
        My Day
      </h1>
      <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
        Your assigned work and daily priorities will appear here as those
        features become available.
      </p>
    </section>
  );
}
