import Link from "next/link";
import {
  ArrowLeft,
  Briefcase,
  Building2,
  Flag,
  Globe2,
  MapPin,
  Route,
  Sparkles
} from "lucide-react";
import type { ComponentType, SVGProps } from "react";

import type { TravelStatsData } from "@/app/dashboard/profile/stats/loader";
import { cn } from "@/components/trip-ui";

type StatItem = {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  value: number;
  tone: string;
};

export function TravelStatsPage({ data }: { data: TravelStatsData }) {
  const stats = buildStats(data);
  const totalStats = [
    { label: "Trips", value: data.stats.trips },
    { label: "Places", value: data.stats.places },
    { label: "Mapped", value: data.stats.mapped },
    ...(data.stats.ideas === null ? [] : [{ label: "Ideas", value: data.stats.ideas }])
  ];

  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-3xl flex-col bg-[#0b0b0d] pb-28 text-white lg:my-10 lg:min-h-0 lg:overflow-hidden lg:rounded-[2rem] lg:border lg:border-white/10 lg:shadow-2xl">
      <section className="relative overflow-hidden px-5 pb-8 pt-5 sm:px-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_0%,rgba(99,102,241,0.35),transparent_36%),radial-gradient(circle_at_90%_15%,rgba(20,184,166,0.25),transparent_34%),linear-gradient(180deg,#15151b_0%,#0b0b0d_72%)]" />
        <div className="absolute right-4 top-4 grid h-44 w-44 grid-cols-2 gap-2 opacity-25 blur-[0.2px]">
          <div className="rounded-[1.5rem] bg-white/30" />
          <div className="rounded-[1.5rem] bg-sky-300/30" />
          <div className="rounded-[1.5rem] bg-amber-300/25" />
          <div className="rounded-[1.5rem] bg-emerald-300/20" />
        </div>

        <div className="relative z-10">
          <div className="mb-14 flex items-center justify-between">
            <Link
              href="/dashboard"
              className="grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white ring-1 ring-white/10 transition hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white/50"
              aria-label="Back to Home"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white/85 ring-1 ring-white/10">
              All Time
            </div>
          </div>

          <div className="mx-auto flex max-w-md flex-col items-center text-center">
            <div className="mb-5 flex min-h-10 items-center justify-center">
              {data.flags.length > 0 ? (
                <div className="flex -space-x-2" aria-label="Countries visited">
                  {data.flags.map((country) => (
                    <span
                      key={country.country}
                      title={`${country.country} (${country.count})`}
                      className="grid h-10 w-10 place-items-center rounded-full bg-white text-xl ring-2 ring-[#0b0b0d]"
                    >
                      {country.flag}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="grid h-10 w-10 place-items-center rounded-full bg-white/10 ring-1 ring-white/10">
                  <Flag className="h-5 w-5 text-white/70" />
                </div>
              )}
            </div>

            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.28em] text-white/55">
              Wayline
            </p>
            <h1 className="text-5xl font-black tracking-[-0.04em] text-white sm:text-6xl">
              Travel Stats
            </h1>
            <p className="mt-3 max-w-sm text-base font-medium text-white/65">
              A summary of the trips, places, ideas, and mapped stops in your Wayline account.
            </p>
          </div>
        </div>
      </section>

      <section className="relative z-10 -mt-2 space-y-4 rounded-t-[2rem] bg-[#151517] px-5 pb-8 pt-6 ring-1 ring-white/10 sm:px-8">
        {data.error ? (
          <div className="rounded-3xl bg-amber-500/10 p-4 text-sm font-semibold text-amber-100 ring-1 ring-amber-300/20">
            {data.error}
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {stats.map((item) => (
            <StatTile key={item.label} item={item} />
          ))}
        </div>

        <div className="rounded-[1.75rem] bg-[#202024] p-5 ring-1 ring-white/10">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-white/55">Total</p>
              <p className="text-3xl font-black tracking-[-0.03em] text-white">
                {data.stats.trips} {data.stats.trips === 1 ? "trip" : "trips"}
              </p>
            </div>
            <div className="grid h-11 w-11 place-items-center rounded-full bg-white/10">
              <Briefcase className="h-5 w-5 text-white/70" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {totalStats.map((item) => (
              <div key={item.label} className="rounded-2xl bg-black/25 p-4">
                <p className="text-2xl font-black text-white">{item.value}</p>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/45">
                  {item.label}
                </p>
              </div>
            ))}
          </div>

          {data.stats.trips === 0 ? (
            <Link
              href="/dashboard/trips#new-trip"
              className="mt-5 flex min-h-11 items-center justify-center rounded-full bg-white px-5 text-sm font-black text-black transition hover:bg-white/90"
            >
              Create your first trip
            </Link>
          ) : null}
        </div>
      </section>
    </main>
  );
}

function buildStats(data: TravelStatsData): StatItem[] {
  return [
    {
      icon: Briefcase,
      label: "Trips",
      value: data.stats.trips,
      tone: "bg-indigo-500/18 text-indigo-200"
    },
    ...(data.stats.countries === null
      ? []
      : [{
          icon: Globe2,
          label: "Countries",
          value: data.stats.countries,
          tone: "bg-emerald-500/18 text-emerald-200"
        }]),
    ...(data.stats.cities === null
      ? []
      : [{
          icon: Building2,
          label: "Cities",
          value: data.stats.cities,
          tone: "bg-cyan-500/18 text-cyan-200"
        }]),
    {
      icon: MapPin,
      label: "Places",
      value: data.stats.places,
      tone: "bg-pink-500/18 text-pink-200"
    },
    ...(data.stats.ideas === null
      ? []
      : [{
          icon: Sparkles,
          label: "Ideas",
          value: data.stats.ideas,
          tone: "bg-amber-500/18 text-amber-200"
        }]),
    {
      icon: Route,
      label: "Mapped",
      value: data.stats.mapped,
      tone: "bg-blue-500/18 text-blue-200"
    }
  ];
}

function StatTile({ item }: { item: StatItem }) {
  const Icon = item.icon;

  return (
    <div className="rounded-[1.5rem] bg-[#202024] p-4 ring-1 ring-white/10">
      <div className={cn("mb-5 grid h-10 w-10 place-items-center rounded-full", item.tone)}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-3xl font-black tracking-[-0.03em] text-white">{item.value}</p>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/45">
        {item.label}
      </p>
    </div>
  );
}
