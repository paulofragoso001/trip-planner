import Link from "next/link";
import { ArrowLeft, MoreHorizontal, Route, Share2 } from "lucide-react";
import type { TripWorkspaceData } from "@/app/dashboard/trips/[tripId]/loader";

type TripPassHeroProps = {
  trip: TripWorkspaceData;
  tripId: string;
};

export function TripPassHero({ trip, tripId }: TripPassHeroProps) {
  const hasPhoto = Boolean(trip.heroImage.imageUrl);
  const destinationInitials = initialsForDestination(trip.destination);
  const routeReady = trip.needsLocationStops === 0 && trip.mappedStops > 0;
  const photoCredit = trip.heroImage.imageAttribution || trip.heroImage.imageSourceLabel;

  return (
    <section
      className="relative isolate min-h-[22rem] overflow-hidden rounded-[2rem] bg-slate-950 text-white shadow-[0_24px_70px_rgba(15,23,42,0.22)] ring-1 ring-black/10 sm:min-h-[24rem] sm:rounded-[2.35rem]"
      data-hero-image={hasPhoto ? "true" : "false"}
      data-testid="trip-pass-hero"
    >
      {hasPhoto ? (
        <img
          alt={trip.heroImage.imageAlt}
          className="absolute inset-0 h-full w-full object-cover"
          data-testid="trip-pass-hero-image"
          loading="lazy"
          src={trip.heroImage.imageUrl!}
        />
      ) : (
        <div
          aria-hidden="true"
          className={`absolute inset-0 ${trip.heroImage.fallbackGradient}`}
          data-testid="trip-pass-hero-fallback"
        />
      )}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(255,255,255,0.24),transparent_34%),linear-gradient(135deg,rgba(2,6,23,0.28),rgba(2,6,23,0.82)_58%,rgba(2,6,23,0.92))]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/72 via-black/28 to-transparent"
      />
      <div className="absolute -left-5 top-1/2 hidden h-10 w-10 -translate-y-1/2 rounded-full bg-[#f4f7fb] lg:block" aria-hidden="true" />
      <div className="absolute -right-5 top-1/2 hidden h-10 w-10 -translate-y-1/2 rounded-full bg-[#f4f7fb] lg:block" aria-hidden="true" />

      <div className="relative grid min-h-[22rem] content-between gap-8 p-4 sm:min-h-[24rem] sm:p-5 lg:p-6">
        <div className="flex items-center justify-between gap-3 text-sm font-black">
          <Link
            aria-label="Back to trips"
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white/14 px-3 text-white shadow-sm backdrop-blur-md transition hover:bg-white/22 focus:outline-none focus:ring-4 focus:ring-white/25"
            href="/dashboard/trips"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            <span className="hidden lg:inline">Back</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              aria-label="Share trip"
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white/14 px-3 text-white shadow-sm backdrop-blur-md transition hover:bg-white/22 focus:outline-none focus:ring-4 focus:ring-white/25"
              href={`/dashboard/trips/${encodeURIComponent(tripId)}/sharing`}
            >
              <Share2 className="h-4 w-4" aria-hidden="true" />
              <span className="hidden lg:inline">Share</span>
            </Link>
            <button
              aria-label="More trip options"
              className="grid h-11 w-11 place-items-center rounded-full bg-white/14 text-white shadow-sm backdrop-blur-md transition hover:bg-white/22 focus:outline-none focus:ring-4 focus:ring-white/25"
              type="button"
            >
              <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              {!hasPhoto ? (
                <span
                  className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white text-base font-black text-slate-950 shadow-xl"
                  data-testid="trip-pass-hero-initials"
                >
                  {destinationInitials}
                </span>
              ) : null}
              <p className="text-xs font-black uppercase tracking-[0.24em] text-white/68">
                Trip pass
              </p>
            </div>
            <h2 className="mt-3 max-w-4xl break-words text-4xl font-black uppercase leading-[0.92] tracking-tight sm:text-6xl">
              {trip.name}
            </h2>
            <p className="mt-3 max-w-2xl text-base font-bold text-white/88 sm:text-lg">
              {trip.destination}
            </p>
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold text-white/82">
              <span>{trip.dateRange}</span>
              <span>{trip.travelStyle} trip</span>
            </div>

            {trip.error ? (
              <p className="mt-4 max-w-2xl rounded-2xl bg-amber-400/18 px-3 py-2 text-sm font-semibold text-amber-50 ring-1 ring-amber-200/25">
                {trip.error}
              </p>
            ) : null}
          </div>

          <div className="grid gap-3">
            <div className="flex gap-2 overflow-x-auto pb-1 text-center sm:flex-wrap sm:justify-end sm:overflow-visible">
              <PassMetric label="Places" value={String(trip.stopCount)} />
              <PassMetric label="Mapped" value={String(trip.mappedStops)} />
              <PassMetric label="Ideas" value={String(trip.suggestionsCount)} />
              {trip.needsLocationStops > 0 ? (
                <PassMetric label="Need location" value={String(trip.needsLocationStops)} />
              ) : null}
            </div>

            <div
              className={[
                "inline-flex min-h-11 w-fit items-center gap-2 rounded-2xl px-3 text-sm font-black ring-1 backdrop-blur-md sm:justify-self-end",
                routeReady
                  ? "bg-emerald-300/18 text-emerald-50 ring-emerald-100/22"
                  : "bg-amber-300/18 text-amber-50 ring-amber-100/22"
              ].join(" ")}
            >
              <Route className="h-4 w-4" aria-hidden="true" />
              {routeReady ? "Route ready" : `${trip.needsLocationStops} need location`}
            </div>
          </div>
        </div>

        {hasPhoto && photoCredit ? (
          <p className="absolute bottom-4 right-4 max-w-[16rem] truncate rounded-full bg-black/34 px-3 py-1 text-[0.66rem] font-bold text-white/82 backdrop-blur-md">
            Photo: {photoCredit}
          </p>
        ) : null}
      </div>
    </section>
  );
}

function PassMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[5.8rem] rounded-2xl bg-white/14 px-3 py-3 ring-1 ring-white/12 backdrop-blur-md">
      <p className="text-lg font-black leading-none">{value}</p>
      <p className="mt-1 text-[0.62rem] font-black uppercase tracking-[0.14em] text-white/62">{label}</p>
    </div>
  );
}

function initialsForDestination(destination: string) {
  const words = destination
    .split(/[,\s]+/)
    .map((word) => word.trim())
    .filter(Boolean)
    .slice(0, 2);

  return words.map((word) => word[0]?.toUpperCase()).join("") || "WL";
}
