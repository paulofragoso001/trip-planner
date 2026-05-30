import Link from "next/link";
import { Sparkles, MapPinned, Route, Lightbulb } from "lucide-react";
import { signOut } from "@/app/actions";
import { createClient } from "@/lib/supabase/server";
import { waylineCopy } from "@/lib/copy/wayline-copy";

const features = [
  {
    description: "Paste travel notes, links, or screenshots from the ideas you already saved.",
    icon: Sparkles,
    title: "Add inspiration"
  },
  {
    description: "Confirm the places Wayline finds before they become part of your trip.",
    icon: MapPinned,
    title: "Review places"
  },
  {
    description: "Turn approved places into a day-by-day plan with a route-ready map.",
    icon: Route,
    title: "Build your route"
  },
  {
    description: "Discover nearby food, activities, and ideas around your confirmed places.",
    icon: Lightbulb,
    title: "Get smart suggestions"
  }
];

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.12),transparent_34%),linear-gradient(180deg,#f8fafc,#eef4fb)] px-5 py-6 sm:px-6 lg:px-8">
      <section className="mx-auto flex max-w-6xl flex-col gap-10 py-10 sm:py-14 lg:min-h-[calc(100vh-8rem)] lg:justify-center">
        <div className="grid gap-8 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-brand">
              Wayline
            </p>
            <h1 className="mt-4 max-w-4xl text-4xl font-black leading-[0.98] tracking-tight text-ink sm:text-5xl lg:text-7xl">
              {waylineCopy.productPromise}
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
              {waylineCopy.productDescription}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                className="inline-flex min-h-12 items-center justify-center rounded-xl bg-brand px-6 py-3 text-sm font-black text-white shadow-panel transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200"
                href={user ? "/dashboard/imports" : "/signup"}
              >
                Plan with AI
              </Link>
              <Link
                className="inline-flex min-h-12 items-center justify-center rounded-xl border border-line bg-white px-6 py-3 text-sm font-black text-ink shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-blue-100"
                href={user ? "/dashboard" : "/login"}
              >
                {user ? "Open dashboard" : "Log in"}
              </Link>
              {user ? (
                <form action={signOut}>
                  <button className="inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-line bg-white px-6 py-3 text-sm font-black text-slate-600 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-blue-100 sm:w-auto">
                    Sign out
                  </button>
                </form>
              ) : null}
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/80 bg-white/85 p-4 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur">
            <div className="rounded-[1.5rem] bg-slate-950 p-5 text-white">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-200">
                From idea to itinerary
              </p>
              <div className="mt-5 grid gap-3">
                {features.map((feature) => {
                  const Icon = feature.icon;
                  return (
                    <div
                      className="rounded-2xl border border-white/10 bg-white/[0.06] p-4"
                      key={feature.title}
                    >
                      <div className="flex items-start gap-3">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-brand">
                          <Icon aria-hidden="true" className="h-5 w-5" />
                        </span>
                        <div>
                          <h2 className="text-base font-black">{feature.title}</h2>
                          <p className="mt-1 text-sm leading-6 text-slate-300">
                            {feature.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-wrap gap-4 border-t border-line/80 py-5 text-sm font-bold text-slate-600">
        <Link className="hover:text-ink" href="/privacy">
          Privacy
        </Link>
        <Link className="hover:text-ink" href="/terms">
          Terms
        </Link>
        <a className="hover:text-ink" href="mailto:hello@wayline.app">
          Contact
        </a>
        <a className="hover:text-ink" href="mailto:feedback@wayline.app">
          Feedback
        </a>
      </footer>
    </main>
  );
}
