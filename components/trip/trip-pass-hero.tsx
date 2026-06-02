import Link from "next/link";
import { ArrowLeft, CalendarDays, MapPin, MoreHorizontal, Route, Share2, Sparkles } from "lucide-react";
import type { TripWorkspaceData } from "@/app/dashboard/trips/[tripId]/loader";

type TripPassHeroProps = {
  trip: TripWorkspaceData;
  tripId: string;
};

export function TripPassHero({ trip, tripId }: TripPassHeroProps) {
  const destinationInitials = initialsForDestination(trip.destination);
  const routeLabel = buildRouteLabel(trip.destination);

  return (
    <section
      className="relative isolate overflow-hidden rounded-[2rem] bg-slate-950 text-white shadow-xl"
      data-testid="trip-pass-hero"
    >
      <div className={heroBackgroundForDestination(trip.destination)} aria-hidden="true" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(255,255,255,0.18),transparent_34%),linear-gradient(120deg,rgba(2,6,23,0.42),rgba(2,6,23,0.84))]" aria-hidden="true" />
      <div className="absolute -left-5 top-1/2 hidden h-10 w-10 -translate-y-1/2 rounded-full bg-[#f4f7fb] lg:block" aria-hidden="true" />
      <div className="absolute -right-5 top-1/2 hidden h-10 w-10 -translate-y-1/2 rounded-full bg-[#f4f7fb] lg:block" aria-hidden="true" />

      <div className="relative grid gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_260px] lg:p-6">
        <div className="min-w-0">
          <div className="flex items-center justify-between gap-3">
            <Link
              aria-label="Back to trips"
              className="grid h-11 w-11 place-items-center rounded-full bg-white/14 text-white backdrop-blur transition hover:bg-white/22 focus:outline-none focus:ring-4 focus:ring-white/25"
              href="/dashboard/trips"
            >
              <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            </Link>
            <div className="flex items-center gap-2">
              <Link
                aria-label="Share trip"
                className="grid h-11 w-11 place-items-center rounded-full bg-white/14 text-white backdrop-blur transition hover:bg-white/22 focus:outline-none focus:ring-4 focus:ring-white/25"
                href={`/dashboard/trips/${encodeURIComponent(tripId)}/sharing`}
              >
                <Share2 className="h-4 w-4" aria-hidden="true" />
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

          <p className="mt-6 text-xs font-black uppercase tracking-[0.22em] text-white/72">
            Trip pass
          </p>
          <h2 className="mt-2 max-w-3xl break-words text-3xl font-black leading-[0.98] tracking-tight sm:text-5xl">
            {trip.name}
          </h2>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm font-bold text-white/86">
            <span className="inline-flex min-h-9 items-center gap-2 rounded-full bg-white/14 px-3 backdrop-blur">
              <MapPin className="h-4 w-4" aria-hidden="true" />
              {trip.destination}
            </span>
            <span className="inline-flex min-h-9 items-center gap-2 rounded-full bg-white/14 px-3 backdrop-blur">
              <CalendarDays className="h-4 w-4" aria-hidden="true" />
              {trip.dateRange}
            </span>
            <span className="inline-flex min-h-9 items-center gap-2 rounded-full bg-white/14 px-3 backdrop-blur">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              {trip.travelStyle}
            </span>
          </div>

          {trip.error ? (
            <p className="mt-4 rounded-2xl bg-amber-400/18 px-3 py-2 text-sm font-semibold text-amber-50 ring-1 ring-amber-200/25">
              {trip.error}
            </p>
          ) : null}
        </div>

        <div className="grid content-end gap-3 rounded-[1.5rem] bg-black/20 p-4 ring-1 ring-white/12 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-white/62">Route</p>
              <p className="mt-1 text-lg font-black">{routeLabel}</p>
            </div>
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white text-lg font-black text-slate-950">
              {destinationInitials}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <PassMetric label="Places" value={String(trip.stopCount)} />
            <PassMetric label="Mapped" value={String(trip.mappedStops)} />
            <PassMetric label="Ideas" value={String(trip.suggestionsCount)} />
          </div>

          {trip.needsLocationStops ? (
            <div className="flex items-center gap-2 rounded-2xl bg-amber-300/16 px-3 py-2 text-sm font-bold text-amber-50 ring-1 ring-amber-100/20">
              <Route className="h-4 w-4" aria-hidden="true" />
              {trip.needsLocationStops} need location
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-2xl bg-emerald-300/16 px-3 py-2 text-sm font-bold text-emerald-50 ring-1 ring-emerald-100/20">
              <Route className="h-4 w-4" aria-hidden="true" />
              Route-ready
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function PassMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/12 px-2 py-3 ring-1 ring-white/10">
      <p className="text-lg font-black leading-none">{value}</p>
      <p className="mt-1 text-[0.65rem] font-black uppercase tracking-[0.14em] text-white/58">{label}</p>
    </div>
  );
}

function buildRouteLabel(destination: string) {
  const clean = destination.replace(/,\s*(United States|USA)$/i, "").trim();
  const primary = clean.split(",")[0]?.trim();
  return primary ? `Wayline -> ${primary}` : "Wayline route";
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
