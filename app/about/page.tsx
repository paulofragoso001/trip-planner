import Link from "next/link";

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-[#f4f7fb] px-6 py-10 text-ink">
      <article className="mx-auto max-w-3xl rounded-2xl border border-line bg-white p-6 shadow-panel sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
          About Almidy
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-tight">
          Plan travel with confidence
        </h1>
        <div className="mt-8 grid gap-6 text-sm leading-7 text-slate-700">
          <p>
            Almidy brings trip plans, places, dates, reservations, expenses, and
            travel documents into one organized workspace.
          </p>
          <p>
            The web and native experiences share the same account and trip data,
            so travelers can move between planning, their trip wallet, and the map
            without losing context.
          </p>
          <p>
            Features marked Soon or Pro soon are not yet available. Almidy will
            only enable them when their complete, persistent workflow is ready.
          </p>
        </div>
        <div className="mt-8 flex flex-wrap gap-3 border-t border-line pt-5">
          <Link className="rounded-lg bg-brand px-4 py-2 text-sm font-bold text-white" href="/dashboard/account">
            Account settings
          </Link>
          <Link className="rounded-lg border border-line px-4 py-2 text-sm font-bold" href="/privacy">
            Privacy
          </Link>
          <Link className="rounded-lg border border-line px-4 py-2 text-sm font-bold" href="/terms">
            Terms
          </Link>
        </div>
      </article>
    </main>
  );
}
