import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  Car,
  ChevronRight,
  Plane,
  Share2,
  Train,
  X
} from "lucide-react";
import type { ComponentType, SVGProps } from "react";

import type {
  TravelStatsData,
  TravelStatsTransportCard
} from "@/app/dashboard/profile/stats/loader";
import { cn } from "@/components/trip-ui";
import { dashboardActionRoutes } from "@/lib/dashboard/action-routes";

const WORLD_COUNTRY_TOTAL = 246;

type TravelStatsView = "overview" | "countries";

type Metric = {
  href?: string;
  label: string;
  value: number | null;
};

type TransportTone = {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  tone: string;
};

const transportTones: Record<TravelStatsTransportCard["id"], TransportTone> = {
  air: {
    icon: Plane,
    tone: "text-sky-300"
  },
  road: {
    icon: Car,
    tone: "text-blue-300"
  },
  train: {
    icon: Train,
    tone: "text-amber-300"
  }
};

export function TravelStatsPage({
  data,
  view = "overview"
}: {
  data: TravelStatsData;
  view?: TravelStatsView;
}) {
  const countryPercent = countryVisitPercent(data);

  if (view === "countries") {
    return <CountriesDetailView countryPercent={countryPercent} data={data} />;
  }

  const metrics = buildMetrics(data);
  const visibleFlags = data.flags.slice(0, 8);
  const hiddenFlags = Math.max(data.countries.length - visibleFlags.length, 0);

  return (
    <main
      className="min-h-[calc(100dvh-4rem)] overflow-y-auto bg-black pb-[calc(7rem+env(safe-area-inset-bottom))] text-white lg:mx-auto lg:my-8 lg:min-h-0 lg:max-w-[28rem] lg:rounded-[2rem] lg:pb-6 lg:ring-1 lg:ring-white/10"
      data-testid="travel-stats-page"
    >
      <section
        className="relative isolate min-h-[34rem] overflow-hidden px-5 pb-8 pt-5"
        data-testid="travel-stats-overview"
      >
        <StatsCollage />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.08)_0%,rgba(0,0,0,0.6)_44%,#1f1f20_100%)]" />

        <StatsTopBar closeHref="/dashboard/trips" />

        <div className="relative z-10 mt-52 flex flex-col items-center text-center">
          <YearSelector data={data} view="overview" />
          <h1 className="mt-5 text-4xl font-black tracking-tight text-white">
            Travel Stats
          </h1>
          <p className="mt-1 text-sm font-semibold text-white/62">
            {data.daysTraveling} {data.daysTraveling === 1 ? "day" : "days"} travelling
          </p>

          <div className="mt-5 flex min-h-11 items-center justify-center">
            {visibleFlags.length ? (
              <div className="flex -space-x-2" aria-label="Countries visited">
                {visibleFlags.map((country) => (
                  <span
                    key={country.country}
                    title={`${country.country} (${country.count}x)`}
                    className="grid h-11 w-11 place-items-center rounded-full bg-[#f6f1ea] text-xl shadow-[0_10px_28px_rgba(0,0,0,0.28)] ring-2 ring-[#1f1f20]"
                  >
                    {country.flag}
                  </span>
                ))}
                {hiddenFlags ? (
                  <span className="grid h-11 min-w-11 place-items-center rounded-full bg-white text-xs font-black text-black ring-2 ring-[#1f1f20]">
                    +{hiddenFlags}
                  </span>
                ) : null}
              </div>
            ) : (
              <span className="rounded-full bg-white/10 px-4 py-2 text-xs font-bold text-white/65 ring-1 ring-white/10">
                No countries recorded yet
              </span>
            )}
          </div>

          <div className="mt-7 grid w-full max-w-sm grid-cols-3 gap-x-4 gap-y-7">
            {metrics.map((metric) => (
              <MetricStat key={metric.label} metric={metric} />
            ))}
          </div>
        </div>
      </section>

      <section className="relative z-20 -mt-6 space-y-4 rounded-t-[2rem] bg-[#202020] px-5 pb-8 pt-5 shadow-[0_-20px_60px_rgba(0,0,0,0.38)] ring-1 ring-white/10">
        <div className="mx-auto mb-2 h-1.5 w-16 rounded-full bg-white/45" />
        {data.error ? <ErrorBanner message={data.error} /> : null}

        <TotalCard data={data} />
        <CountriesCard countryPercent={countryPercent} data={data} />
        <TransportSection transport={data.transport} />
      </section>
    </main>
  );
}

function CountriesDetailView({
  countryPercent,
  data
}: {
  countryPercent: number;
  data: TravelStatsData;
}) {
  return (
    <main
      className="min-h-[calc(100dvh-4rem)] overflow-y-auto bg-[#1f1f20] px-5 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-5 text-white lg:mx-auto lg:my-8 lg:min-h-0 lg:max-w-[28rem] lg:rounded-[2rem] lg:pb-6 lg:ring-1 lg:ring-white/10"
      data-testid="travel-stats-countries-detail"
    >
      <div className="relative z-10 flex items-center justify-between">
        <Link
          href={statsHref(data, "overview")}
          aria-label="Back to travel stats"
          className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white ring-1 ring-white/12 transition hover:bg-white/15 focus:outline-none focus:ring-4 focus:ring-orange-400/20"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </Link>
        <Link
          href={dashboardActionRoutes.trips.list}
          aria-label="Close countries stats"
          className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white/85 ring-1 ring-white/12 transition hover:bg-white/15 focus:outline-none focus:ring-4 focus:ring-orange-400/20"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </Link>
      </div>

      <section className="mt-7" data-testid="travel-stats-countries">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black tracking-tight text-white">Countries</h1>
            <p className="mt-1 text-base font-semibold text-white/45">{selectedYearLabel(data)}</p>
          </div>
          <div className="relative grid h-24 w-24 shrink-0 place-items-center">
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background: `conic-gradient(#f59e0b ${Math.min(countryPercent, 100)}%, rgba(255,255,255,0.14) 0)`
              }}
            />
            <div className="relative grid h-16 w-16 place-items-center rounded-full bg-[#1f1f20] text-base font-black text-amber-300">
              {countryPercent}%
            </div>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-[auto_1fr] items-end gap-x-6">
          <p className="text-6xl font-black leading-none text-amber-400">{data.stats.countries ?? 0}</p>
          <p className="text-6xl font-black leading-none text-white/50">{WORLD_COUNTRY_TOTAL}</p>
          <p className="text-base font-black text-amber-400">Visited</p>
          <p className="text-base font-black text-white/42">World total</p>
        </div>

        {data.countries.length ? (
          <div className="divide-y divide-white/8 rounded-[1.35rem] bg-[#19191b] px-3 ring-1 ring-white/8">
            {data.countries.map((country) => (
              <CountryRow key={country.country} country={country} />
            ))}
          </div>
        ) : (
          <div className="rounded-[1.35rem] bg-[#19191b] p-5 ring-1 ring-white/8">
            <h2 className="text-xl font-black text-white">No country stats yet</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-white/55">
              Create trips with destinations to build your travel history.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}

function StatsCollage() {
  return (
    <div className="absolute inset-0 bg-[#0a1118]" aria-hidden="true">
      <div className="absolute -left-8 top-0 h-52 w-60 rotate-[-14deg] rounded-[2.2rem] bg-[linear-gradient(135deg,#7b4b21,#d8b16e_55%,#1d2826)] opacity-80" />
      <div className="absolute right-[-2rem] top-2 h-40 w-52 rotate-[12deg] rounded-[2rem] bg-[linear-gradient(135deg,#253b71,#0e9f8e_62%,#05101b)] opacity-80" />
      <div className="absolute left-16 top-28 h-44 w-56 rotate-[-8deg] rounded-[2rem] bg-[linear-gradient(135deg,#1e5b64,#90d4ce_52%,#17202a)] opacity-90" />
      <div className="absolute right-12 top-32 h-36 w-44 rotate-[16deg] rounded-[2rem] bg-[linear-gradient(135deg,#5b4632,#f1efe3_50%,#0f2230)] opacity-70" />
      <div className="absolute inset-x-0 bottom-0 h-48 bg-[linear-gradient(180deg,transparent,#202020_80%)]" />
    </div>
  );
}

function StatsTopBar({ closeHref }: { closeHref: string }) {
  return (
    <div className="relative z-10 flex items-center justify-between">
      <Link
        href={dashboardActionRoutes.trips.list}
        aria-label="Back to trips"
        className="grid h-10 w-10 place-items-center rounded-full bg-black/38 text-white ring-1 ring-white/12 backdrop-blur-xl transition hover:bg-black/50 focus:outline-none focus:ring-4 focus:ring-orange-400/20"
      >
        <ArrowLeft className="h-5 w-5" aria-hidden="true" />
      </Link>
      <div className="flex items-center gap-2">
        <button
          aria-label="Share travel stats"
          className="relative grid h-10 w-10 cursor-not-allowed place-items-center rounded-full bg-black/24 text-white/45 ring-1 ring-white/10 backdrop-blur-xl"
          disabled
          title="Sharing is coming soon"
          type="button"
        >
          <Share2 className="h-5 w-5" aria-hidden="true" />
          <span className="absolute -bottom-1 -right-1 rounded-full bg-white px-1.5 py-0.5 text-[0.55rem] font-black uppercase text-slate-950">
            Soon
          </span>
        </button>
        <Link
          href={closeHref}
          aria-label="Close travel stats"
          className="grid h-10 w-10 place-items-center rounded-full bg-black/38 text-white/85 ring-1 ring-white/12 backdrop-blur-xl transition hover:bg-black/50 focus:outline-none focus:ring-4 focus:ring-orange-400/20"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}

function YearSelector({
  data,
  view
}: {
  data: TravelStatsData;
  view: TravelStatsView;
}) {
  return (
    <div
      className="inline-flex items-center gap-2 rounded-full bg-black/42 px-4 py-2 text-sm font-bold text-white/90 ring-1 ring-white/12 backdrop-blur-xl"
      data-testid="travel-stats-year-selector"
    >
      <CalendarDays className="h-4 w-4" aria-hidden="true" />
      <span>{selectedYearLabel(data)}</span>
      {data.yearOptions.length > 1 ? (
        <span className="text-white/45" aria-hidden="true">
          /
        </span>
      ) : null}
      {data.yearOptions.length > 1 ? (
        <Link
          href={statsHrefForYear("all", view)}
          className="text-white/55 transition hover:text-white"
        >
          All
        </Link>
      ) : null}
    </div>
  );
}

function MetricStat({ metric }: { metric: Metric }) {
  if (metric.value === null) return null;

  const content = (
    <>
      <p className="text-3xl font-black leading-none tracking-tight text-white">
        {metric.value}
      </p>
      <p className="mt-1 text-xs font-medium text-white/55">
        {metric.label}
      </p>
    </>
  );

  if (metric.href) {
    return (
      <Link
        aria-label={`Open ${metric.label.toLowerCase()} stats`}
        className="min-w-0 rounded-2xl text-center transition hover:bg-white/[0.05] focus:outline-none focus:ring-4 focus:ring-orange-400/20"
        href={metric.href}
      >
        {content}
      </Link>
    );
  }

  return <div className="min-w-0 text-center">{content}</div>;
}

function TotalCard({ data }: { data: TravelStatsData }) {
  return (
    <section className="rounded-[1.35rem] bg-[#19191b] p-4 ring-1 ring-white/8">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-black text-white">Total</h2>
        <Share2 className="h-4 w-4 text-white/42" aria-hidden="true" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-5xl font-black leading-none text-[#6d6bff]">{data.stats.trips}</p>
          <p className="mt-1 text-sm font-semibold text-white/55">Trips</p>
        </div>
        <div>
          <p className="text-5xl font-black leading-none text-white/62">{data.daysTraveling}</p>
          <p className="mt-1 text-sm font-semibold text-white/55">Days Travelling</p>
        </div>
      </div>
    </section>
  );
}

function CountriesCard({
  countryPercent,
  data
}: {
  countryPercent: number;
  data: TravelStatsData;
}) {
  return (
    <section
      className="rounded-[1.35rem] bg-[#1b1b1d] p-4 ring-1 ring-white/8"
      data-testid="travel-stats-countries"
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-white">Countries</h2>
          <p className="text-sm font-semibold text-white/45">
            {selectedYearLabel(data)}
          </p>
        </div>
        <div className="relative grid h-20 w-20 shrink-0 place-items-center">
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: `conic-gradient(#f59e0b ${Math.min(countryPercent, 100)}%, rgba(255,255,255,0.14) 0)`
            }}
          />
          <div className="relative grid h-14 w-14 place-items-center rounded-full bg-[#1b1b1d] text-sm font-black text-amber-300">
            {countryPercent}%
          </div>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-[auto_1fr] items-end gap-x-4">
        <p className="text-5xl font-black leading-none text-amber-400">{data.stats.countries ?? 0}</p>
        <p className="text-5xl font-black leading-none text-white/50">{WORLD_COUNTRY_TOTAL}</p>
        <p className="text-sm font-black text-amber-400">Visited</p>
        <p className="text-sm font-black text-white/42">World total</p>
      </div>

      {data.countries.length ? (
        <>
          <div className="divide-y divide-white/8">
            {data.countries.slice(0, 5).map((country) => (
              <CountryRow key={country.country} country={country} />
            ))}
          </div>
          <Link
            className="mt-3 flex min-h-11 items-center justify-between rounded-2xl bg-white/[0.06] px-4 text-sm font-black text-white transition hover:bg-white/[0.1] focus:outline-none focus:ring-4 focus:ring-orange-400/20"
            data-testid="travel-stats-countries-link"
            href={statsHref(data, "countries")}
          >
            View all countries
            <ChevronRight className="h-4 w-4 text-white/55" aria-hidden="true" />
          </Link>
        </>
      ) : (
        <div className="rounded-2xl bg-white/[0.04] p-4">
          <h3 className="text-base font-black text-white">No country stats yet</h3>
          <p className="mt-1 text-sm font-semibold leading-6 text-white/55">
            Create trips with destinations to build your travel history.
          </p>
        </div>
      )}
    </section>
  );
}

function CountryRow({ country }: { country: TravelStatsData["countries"][number] }) {
  return (
    <div className="grid min-h-12 grid-cols-[2rem_1fr_auto] items-center gap-3">
      <span className="grid h-7 w-7 place-items-center rounded-full bg-white text-sm">
        {country.flag}
      </span>
      <span className="truncate text-sm font-bold text-white/90">{country.country}</span>
      <span className="text-sm font-semibold text-white/45">{country.count}x</span>
    </div>
  );
}

function TransportSection({ transport }: { transport: TravelStatsTransportCard[] }) {
  return (
    <section className="space-y-4" data-testid="travel-stats-transport">
      {transport.map((card) => (
        <TransportCard key={card.id} card={card} />
      ))}
    </section>
  );
}

function TransportCard({ card }: { card: TravelStatsTransportCard }) {
  const tone = transportTones[card.id];
  const Icon = tone.icon;

  return (
    <article className="rounded-[1.35rem] bg-[#19191b] p-4 ring-1 ring-white/8">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Icon className={cn("h-4 w-4", tone.tone)} aria-hidden="true" />
            <h2 className="text-lg font-black text-white">{card.title}</h2>
          </div>
          <p className={cn("mt-3 text-5xl font-black leading-none", card.count ? "text-[#b59b71]" : "text-white/35")}>
            {card.count}x
          </p>
        </div>
        <Share2 className="h-4 w-4 text-white/42" aria-hidden="true" />
      </div>

      {card.count ? (
        <>
          <div className="mb-4 grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-black text-white/45">Time</p>
              <p className="mt-1 text-2xl font-black text-white">{card.timeLabel || "—"}</p>
            </div>
            <div>
              <p className="text-sm font-black text-white/45">{card.detailLabel}</p>
              <p className="mt-1 text-2xl font-black text-white">{card.detailValue || "—"}</p>
            </div>
          </div>

          {card.breakdown.length ? (
            <div className="divide-y divide-white/8">
              {card.breakdown.map((country) => (
                <CountryRow key={country.country} country={country} />
              ))}
            </div>
          ) : null}
        </>
      ) : (
        <p className="rounded-2xl bg-white/[0.04] p-4 text-sm font-semibold text-white/55">
          Not enough route data yet.
        </p>
      )}
    </article>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-2xl bg-amber-300/10 p-4 text-sm font-semibold text-amber-100 ring-1 ring-amber-300/20">
      {message}
    </div>
  );
}

function buildMetrics(data: TravelStatsData): Metric[] {
  const countriesHref = data.countries.length ? statsHref(data, "countries") : undefined;

  return [
    { label: "Trips", value: data.stats.trips },
    { href: countriesHref, label: "Countries", value: data.stats.countries ?? 0 },
    { label: "Cities", value: data.stats.cities ?? 0 },
    { label: "Flights", value: data.stats.flights },
    { label: "Hotels", value: data.stats.hotels },
    { label: "Activities", value: data.stats.activities }
  ];
}

function countryVisitPercent(data: TravelStatsData) {
  return data.stats.countries
    ? Math.round((data.stats.countries / WORLD_COUNTRY_TOTAL) * 100)
    : 0;
}

function selectedYearLabel(data: TravelStatsData) {
  return data.selectedYear === null ? "All Time" : String(data.selectedYear);
}

function statsHref(data: TravelStatsData, view: TravelStatsView) {
  return statsHrefForYear(data.selectedYear === null ? "all" : data.selectedYear, view);
}

function statsHrefForYear(year: number | "all", view: TravelStatsView) {
  const params = new URLSearchParams();
  params.set("year", String(year));
  if (view === "countries") {
    params.set("view", "countries");
  }

  return `/dashboard/profile/stats?${params.toString()}`;
}
