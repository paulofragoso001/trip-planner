import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  return (
    <main className="min-h-screen px-6 py-8">
      <section className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
            Wayline Travel
          </p>
          <h1 className="mt-3 max-w-3xl text-4xl font-black leading-tight tracking-tight text-ink md:text-6xl">
            Auth-ready travel planning for every itinerary workflow.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
            This Next.js version includes Supabase authentication, Tailwind styling,
            protected dashboard access, and a clean foundation for moving the
            existing itinerary prototype into a production app.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {user ? (
              <>
                <Link
                  href="/dashboard"
                  className="rounded-lg bg-brand px-5 py-3 text-sm font-bold text-white shadow-panel transition hover:bg-blue-700"
                >
                  Open dashboard
                </Link>
                <form action={signOut}>
                  <button className="rounded-lg border border-line bg-white px-5 py-3 text-sm font-bold text-ink transition hover:bg-slate-50">
                    Sign out
                  </button>
                </form>
              </>
            ) : (
              <>
                <Link
                  href="/signup"
                  className="rounded-lg bg-brand px-5 py-3 text-sm font-bold text-white shadow-panel transition hover:bg-blue-700"
                >
                  Create account
                </Link>
                <Link
                  href="/login"
                  className="rounded-lg border border-line bg-white px-5 py-3 text-sm font-bold text-ink transition hover:bg-slate-50"
                >
                  Log in
                </Link>
              </>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-line bg-white p-5 shadow-panel">
          <div className="rounded-lg bg-slate-950 p-5 text-white">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-200">
              Auth stack
            </p>
            <div className="mt-5 grid gap-3">
              {["Next.js App Router", "Supabase Auth", "Cookie-based SSR", "Tailwind UI system"].map(
                (item) => (
                  <div
                    key={item}
                    className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-3"
                  >
                    <span className="font-semibold">{item}</span>
                    <span className="rounded-full bg-emerald-300 px-2 py-1 text-xs font-black text-emerald-950">
                      Ready
                    </span>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
