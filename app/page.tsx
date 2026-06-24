import Link from "next/link";
import {
  CalendarDays,
  CircleDollarSign,
  FileText,
  MapPinned,
  Share2,
  Sparkles
} from "lucide-react";
import type { ReactNode } from "react";
import { signOut } from "@/app/actions";
import { createClient } from "@/lib/supabase/server";

const features = [
  {
    description: "Paste notes, links, or screenshots. Almidy finds places and helps you review them.",
    icon: Sparkles,
    title: "Plan with AI"
  },
  {
    description: "Turn approved places into a day-by-day travel pass.",
    icon: CalendarDays,
    title: "Build your itinerary"
  },
  {
    description: "See your route, numbered places, and nearby ideas.",
    icon: MapPinned,
    title: "Explore your map"
  },
  {
    description: "Organize expenses, documents, and shared trip details in one place.",
    icon: FileText,
    title: "Keep trip details together"
  }
];

const floatingCards = [
  { className: "left-0 top-10 sm:left-6", icon: CalendarDays, label: "Itinerary", value: "4 places" },
  { className: "right-0 top-20 sm:right-8", icon: MapPinned, label: "Map route", value: "Route ready" },
  { className: "bottom-24 left-0 sm:left-10", icon: CircleDollarSign, label: "Expenses", value: "$820 tracked" },
  { className: "bottom-10 right-0 sm:right-2", icon: FileText, label: "Documents", value: "Receipts + notes" },
  { className: "bottom-0 left-1/2 -translate-x-1/2", icon: Share2, label: "Share", value: "Trip guests" }
];

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  return (
    <main className="min-h-screen overflow-x-hidden bg-white px-5 py-6 text-slate-950 sm:px-6 lg:px-8">
      <section className="mx-auto grid max-w-7xl gap-12 py-10 sm:py-14 lg:min-h-[calc(100vh-8rem)] lg:content-center">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-blue-600">
            Almidy
          </p>
          <h1 className="mt-5 text-5xl font-black leading-[0.95] tracking-tight text-slate-950 sm:text-6xl lg:text-8xl">
            All your trip details. Finally, in one place.
          </h1>
          <p className="mx-auto mt-6 max-w-3xl text-base leading-8 text-slate-600 sm:text-xl">
            Plan with AI, organize your itinerary, map your route, save documents, track expenses, and share your trip — all from one travel pass.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-slate-950 px-7 py-3 text-sm font-black text-white shadow-[0_16px_40px_rgba(15,23,42,0.18)] transition hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-200 sm:w-auto"
              href={user ? "/dashboard/plan" : "/signup"}
            >
              Start planning
            </Link>
            <Link
              className="inline-flex min-h-12 w-full items-center justify-center rounded-full border border-slate-200 bg-white px-7 py-3 text-sm font-black text-slate-950 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-blue-100 sm:w-auto"
              href={user ? "/dashboard" : "/login"}
            >
              {user ? "Open Almidy" : "Log in"}
            </Link>
            {user ? (
              <form action={signOut} className="w-full sm:w-auto">
                <button className="inline-flex min-h-12 w-full items-center justify-center rounded-full border border-slate-200 bg-white px-7 py-3 text-sm font-black text-slate-600 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-blue-100">
                  Sign out
                </button>
              </form>
            ) : null}
          </div>
          <p className="mt-4 text-sm font-semibold text-slate-500">
            Best for early testers planning Miami, Barcelona, or custom trips.
          </p>
        </div>

        <div className="relative mx-auto min-h-[560px] w-full max-w-5xl sm:min-h-[620px]">
          <div className="absolute inset-x-0 top-10 mx-auto h-[520px] max-w-[360px] rounded-[3.2rem] bg-slate-950 p-3 shadow-[0_40px_100px_rgba(15,23,42,0.28)] ring-1 ring-slate-900/20 sm:h-[590px] sm:max-w-[390px]">
            <div className="h-full overflow-hidden rounded-[2.55rem] bg-[radial-gradient(circle_at_20%_0%,rgba(37,99,235,0.34),transparent_36%),linear-gradient(180deg,#172554,#020617_48%,#111827)] p-5 text-white">
              <div className="mx-auto h-1.5 w-16 rounded-full bg-white/22" />
              <div className="mt-8">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-200">
                  Trip Pass
                </p>
                <h2 className="mt-2 text-3xl font-black leading-tight">
                  Miami Weekend
                </h2>
                <p className="mt-1 text-sm font-semibold text-white/68">
                  May 29 – May 31 · Balanced trip
                </p>
              </div>

              <div className="mt-6 grid grid-cols-3 gap-2">
                <MiniMetric label="Places" value="4" />
                <MiniMetric label="Mapped" value="4" />
                <MiniMetric label="Ideas" value="15" />
              </div>

              <div className="mt-5 rounded-[1.65rem] bg-white/10 p-4 ring-1 ring-white/10">
                <div className="flex items-center justify-between">
                  <p className="font-black">Itinerary</p>
                  <p className="text-xs font-bold text-white/55">Friday</p>
                </div>
                <div className="mt-4 grid gap-3">
                  <PhoneRow icon={<MapPinned className="h-4 w-4" />} label="South Pointe Park" meta="9:00 AM" />
                  <PhoneRow icon={<CalendarDays className="h-4 w-4" />} label="Komodo" meta="7:30 PM" />
                  <PhoneRow icon={<Sparkles className="h-4 w-4" />} label="Nearby Ideas" meta="15 found" />
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-[1.45rem] bg-white p-4 text-slate-950">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Expenses</p>
                  <p className="mt-2 text-2xl font-black">$820</p>
                </div>
                <div className="rounded-[1.45rem] bg-white/12 p-4 ring-1 ring-white/10">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-white/45">Docs</p>
                  <p className="mt-2 text-2xl font-black">3</p>
                </div>
              </div>
            </div>
          </div>

          {floatingCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                className={[
                  "absolute hidden w-44 rounded-[1.5rem] border border-slate-200 bg-white/95 p-4 shadow-[0_22px_60px_rgba(15,23,42,0.12)] backdrop-blur md:block",
                  card.className
                ].join(" ")}
                key={card.label}
              >
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-50 text-blue-700">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-sm font-black">{card.label}</p>
                    <p className="text-xs font-bold text-slate-500">{card.value}</p>
                  </div>
                </div>
              </div>
            );
          })}

          <div className="absolute bottom-0 left-0 right-0 grid gap-3 px-2 md:hidden">
            {floatingCards.slice(0, 4).map((card) => {
              const Icon = card.icon;
              return (
                <div
                  className="mx-auto flex min-h-16 w-full max-w-sm items-center gap-3 rounded-[1.35rem] border border-slate-200 bg-white p-3 shadow-sm"
                  key={card.label}
                >
                  <span className="grid h-10 w-10 place-items-center rounded-2xl bg-blue-50 text-blue-700">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-sm font-black">{card.label}</p>
                    <p className="text-xs font-bold text-slate-500">{card.value}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <article
                className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm"
                key={feature.title}
              >
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-950 text-white">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h2 className="mt-4 text-lg font-black">{feature.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{feature.description}</p>
              </article>
            );
          })}
        </section>
      </section>

      <footer className="mx-auto flex max-w-7xl flex-wrap gap-4 border-t border-slate-200 py-5 text-sm font-bold text-slate-600">
        <Link className="hover:text-slate-950" href="/privacy">
          Privacy
        </Link>
        <Link className="hover:text-slate-950" href="/terms">
          Terms
        </Link>
        <a className="hover:text-slate-950" href="mailto:hello@almidy.app">
          Contact
        </a>
        <a className="hover:text-slate-950" href="mailto:feedback@almidy.app">
          Feedback
        </a>
      </footer>
    </main>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/10 px-3 py-3 text-center ring-1 ring-white/10">
      <p className="text-xl font-black">{value}</p>
      <p className="mt-1 text-[0.65rem] font-black uppercase tracking-[0.12em] text-white/48">
        {label}
      </p>
    </div>
  );
}

function PhoneRow({ icon, label, meta }: { icon: ReactNode; label: string; meta: string }) {
  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
      <span className="grid h-8 w-8 place-items-center rounded-full bg-white/12 text-blue-200">
        {icon}
      </span>
      <span className="min-w-0 truncate text-sm font-black">{label}</span>
      <span className="text-xs font-bold text-white/48">{meta}</span>
    </div>
  );
}
