export default function AccessPendingPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-6">
      <section className="max-w-lg rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-zinc-950">Access pending</h1>
        <p className="mt-3 leading-7 text-zinc-600">
          Your account is verified, but it is not assigned to an organization
          yet. Ask your organization administrator to grant access.
        </p>
      </section>
    </main>
  );
}
