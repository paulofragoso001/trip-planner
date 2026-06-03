import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  CircleDollarSign,
  FileText,
  Lightbulb,
  Map,
  MoreHorizontal,
  Route,
  Share2
} from "lucide-react";
import type { ReactNode } from "react";
import type { TripWorkspaceData } from "@/app/dashboard/trips/[tripId]/loader";

type TripPassHeroProps = {
  trip: TripWorkspaceData;
  tripId: string;
};

export function TripPassHero({ trip, tripId }: TripPassHeroProps) {
  const destinationInitials = initialsForDestination(trip.destination);
  const routeReady = trip.needsLocationStops === 0 && trip.mappedStops > 0;

  return (
    <section
      className="relative isolate overflow-hidden rounded-[2rem] bg-slate-950 text-white shadow-2xl ring-1 ring-black/10"
      data-testid="trip-pass-hero"
    >
      <div className={heroBackgroundForDestination(trip.destination)} aria-hidden="true" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(255,255,255,0.22),transparent_32%),radial-gradient(circle_at_88%_20%,rgba(255,255,255,0.14),transparent_26%),linear-gradient(120deg,rgba(2,6,23,0.22),rgba(2,6,23,0.88))]" aria-hidden="true" />
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/45 to-transparent" aria-hidden="true" />
      <div className="absolute -left-5 top-1/2 hidden h-10 w-10 -translate-y-1/2 rounded-full bg-[#f4f7fb] lg:block" aria-hidden="true" />
      <div className="absolute -right-5 top-1/2 hidden h-10 w-10 -translate-y-1/2 rounded-full bg-[#f4f7fb] lg:block" aria-hidden="true" />

      <div className="relative grid gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_300px] lg:p-6">
        <div className="grid min-w-0 content-between gap-6">
          <div className="flex items-center justify-between gap-3 text-sm font-black">
            <Link
              aria-label="Back to trips"
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white/14 px-3 text-white backdrop-blur transition hover:bg-white/22 focus:outline-none focus:ring-4 focus:ring-white/25"
              href="/dashboard/trips"
            >
              <ArrowLeft className="h-5 w-5" aria-hidden="true" />
              <span className="hidden lg:inline">Back</span>
            </Link>
            <div className="flex items-center gap-2">
              <Link
                aria-label="Share trip"
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white/14 px-3 text-white backdrop-blur transition hover:bg-white/22 focus:outline-none focus:ring-4 focus:ring-white/25"
                href={`/dashboard/trips/${encodeURIComponent(tripId)}/sharing`}
              >
                <Share2 className="h-4 w-4" aria-hidden="true" />
                <span className="hidden lg:inline">Share</span>
              </Link>
              <button
                aria-label="More trip options"
                className="grid h-11 w-11 place-items-center rounded-full bg-white/14 text-white backdrop-blur transition hover:bg-white/22 focus:outline-none focus:ring-4 focus:ring-white/25"
                type="button"
              >
                <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="min-w-0 py-1">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-white/66">
              Trip pass
            </p>
            <h2 className="mt-3 max-w-3xl break-words text-3xl font-black uppercase leading-[0.96] tracking-tight sm:text-5xl">
              {trip.name}
            </h2>
            <p className="mt-3 text-base font-bold text-white/86">{trip.destination}</p>
            <div className="mt-5 grid gap-1.5 text-sm font-semibold text-white/82">
              <p>{trip.dateRange}</p>
              <p>{trip.travelStyle} trip</p>
            </div>

            <div className="mt-5 flex gap-2 overflow-x-auto pb-1 text-center sm:flex-wrap sm:overflow-visible">
              <PassMetric label="Places" value={String(trip.stopCount)} />
              <PassMetric label="Mapped" value={String(trip.mappedStops)} />
              <PassMetric label="Ideas" value={String(trip.suggestionsCount)} />
            </div>

            <div
              className={[
                "mt-4 inline-flex min-h-10 items-center gap-2 rounded-2xl px-3 text-sm font-bold ring-1",
                routeReady
                  ? "bg-emerald-300/16 text-emerald-50 ring-emerald-100/20"
                  : "bg-amber-300/16 text-amber-50 ring-amber-100/20"
              ].join(" ")}
            >
              <Route className="h-4 w-4" aria-hidden="true" />
              {routeReady ? "Route ready" : `${trip.needsLocationStops} need location`}
            </div>

            <div className="mt-5 flex gap-3 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible">
              <HeroQuickAction href={`/dashboard/trips/${encodeURIComponent(tripId)}/timeline`} icon={<CalendarDays className="h-5 w-5" />} label="Itinerary" />
              <HeroQuickAction href={`/dashboard/trips/${encodeURIComponent(tripId)}/map`} icon={<Map className="h-5 w-5" />} label="Map" />
              <HeroQuickAction href={`/dashboard/trips/${encodeURIComponent(tripId)}/map#smart-suggestions`} icon={<Lightbulb className="h-5 w-5" />} label="Ideas" />
              <HeroQuickAction href={`/dashboard/trips/${encodeURIComponent(tripId)}/budget`} icon={<CircleDollarSign className="h-5 w-5" />} label="Expenses" />
              <HeroQuickAction href={`/dashboard/trips/${encodeURIComponent(tripId)}/documents`} icon={<FileText className="h-5 w-5" />} label="Docs" />
              <HeroQuickAction href={`/dashboard/trips/${encodeURIComponent(tripId)}/sharing`} icon={<Share2 className="h-5 w-5" />} label="Share" />
            </div>
          </div>

          {trip.error ? (
            <p className="mt-4 rounded-2xl bg-amber-400/18 px-3 py-2 text-sm font-semibold text-amber-50 ring-1 ring-amber-200/25">
              {trip.error}
            </p>
          ) : null}
        </div>

        <div className="hidden min-h-56 overflow-hidden rounded-[1.25rem] bg-white/10 p-3 ring-1 ring-white/12 backdrop-blur lg:block">
          <div className="relative grid h-full place-items-center overflow-hidden rounded-[1rem] bg-black/20">
            <div className={destinationPanelForDestination(trip.destination)} aria-hidden="true" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.28),transparent_28%),linear-gradient(145deg,rgba(15,23,42,0.08),rgba(15,23,42,0.68))]" aria-hidden="true" />
            <div className="relative text-center">
              <div className="mx-auto grid h-20 w-20 place-items-center rounded-[1.25rem] bg-white text-2xl font-black text-slate-950 shadow-xl">
                {destinationInitials}
              </div>
              <p className="mt-4 max-w-48 text-sm font-black uppercase tracking-[0.2em] text-white/82">
                {primaryDestination(trip.destination)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroQuickAction({
  href,
  icon,
  label
}: {
  href: string;
  icon: ReactNode;
  label: string;
}) {
  return (
    <Link className="grid min-w-[4.4rem] justify-items-center gap-2 text-center text-[0.72rem] font-bold text-white/76" href={href}>
      <span className="grid h-12 w-12 place-items-center rounded-full bg-white/14 text-white shadow-lg ring-1 ring-white/12 backdrop-blur transition hover:bg-white/22">
        {icon}
      </span>
      {label}
    </Link>
  );
}

function PassMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[6.2rem] rounded-2xl bg-white/12 px-3 py-3 ring-1 ring-white/10 backdrop-blur">
      <p className="text-lg font-black leading-none">{value}</p>
      <p className="mt-1 text-[0.65rem] font-black uppercase tracking-[0.14em] text-white/58">{label}</p>
    </div>
  );
}

function primaryDestination(destination: string) {
  const clean = destination.replace(/,\s*(United States|USA)$/i, "").trim();
  const primary = clean.split(",")[0]?.trim();
  return primary || "Wayline";
}

function initialsForDestination(destination: string) {
  const words = destination
    .split(/[,\s]+/)
    .map((word) => word.trim())
    .filter(Boolean)
    .slice(0, 2);

  return words.map((word) => word[0]?.toUpperCase()).join("") || "WL";
}

function heroBackgroundForDestination(destination: string) {
  const value = destination.toLowerCase();
  if (value.includes("miami")) {
    return "absolute inset-0 bg-[linear-gradient(135deg,#0f766e,#2563eb_48%,#f97316)]";
  }
  if (value.includes("barcelona")) {
    return "absolute inset-0 bg-[linear-gradient(135deg,#7c2d12,#1d4ed8_52%,#f59e0b)]";
  }
  if (value.includes("new york")) {
    return "absolute inset-0 bg-[linear-gradient(135deg,#111827,#334155_45%,#7f1d1d)]";
  }
  return "absolute inset-0 bg-[linear-gradient(135deg,#172554,#0f766e_55%,#111827)]";
}

function destinationPanelForDestination(destination: string) {
  const value = destination.toLowerCase();
  if (value.includes("miami")) {
    return "absolute inset-0 bg-[linear-gradient(135deg,#0891b2,#2563eb_48%,#fb923c)]";
  }
  if (value.includes("barcelona")) {
    return "absolute inset-0 bg-[linear-gradient(135deg,#b45309,#1d4ed8_50%,#facc15)]";
  }
  if (value.includes("new york")) {
    return "absolute inset-0 bg-[linear-gradient(135deg,#020617,#475569_48%,#991b1b)]";
  }
  return "absolute inset-0 bg-[linear-gradient(135deg,#1e3a8a,#0f766e_52%,#0f172a)]";
}
