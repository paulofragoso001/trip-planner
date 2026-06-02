import Link from "next/link";
import { RouterRefreshButton } from "@/components/dashboard/router-refresh-button";
import { TripCreateForm } from "@/components/dashboard/trip-create-form";
import { TripRowActions } from "@/components/dashboard/trip-row-actions";
import type { TripsData } from "@/app/dashboard/trips/loader";
import { PlacePhoto } from "@/components/place-photo";
import { EmptyState, PageHeader, SectionCard } from "@/components/trip-ui";
import { waylineCopy } from "@/lib/copy/wayline-copy";

type TripsPageProps = TripsData;

export default function TripsPage({ error, trips }: TripsPageProps) {
  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Trip wallet"
        subtitle="Create a trip pass or continue an itinerary."
        title="Trips"
      />

      <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        <SectionCard
          className="lg:sticky lg:top-24 lg:self-start"
          description="Destination helps match places."
          id="new-trip"
          title="Create a new trip"
        >
          <TripCreateForm />
        </SectionCard>

        <SectionCard
          actions={<RouterRefreshButton>Refresh</RouterRefreshButton>}
          title="Trip passes"
        >
          <div className="mt-4 grid gap-3">
            {error ? (
              <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
                {error}
              </p>
            ) : null}
            {!error && trips.length === 0 ? (
              <EmptyState
                action={
                  <div className="grid gap-2 sm:flex sm:flex-wrap">
                    <Link
                      className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-blue-600 px-4 text-sm font-black text-white"
                      href="/dashboard/imports?sample=miami#saved-inspiration"
                    >
                      Try sample inspiration
                    </Link>
                    <Link
                      className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-white px-4 text-sm font-black text-slate-800 ring-1 ring-slate-200"
                      href="#new-trip"
                    >
                      Create manually
                    </Link>
                  </div>
                }
                description={waylineCopy.emptyStates.myTrips}
                title="No trips yet."
              />
            ) : null}
            {trips.map((trip) => (
              <article
                className="rounded-[1.5rem] border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-blue-200 hover:shadow-md"
                key={trip.id}
              >
                <TripCardVisual trip={trip} />
                <div className="min-w-0">
                  <h3 className="break-words text-xl font-black leading-tight text-slate-950">
                    {trip.name}
                  </h3>
                  <p className="mt-1 break-words text-sm font-semibold text-slate-600">
                    {trip.imageUrl ? (
                      <>
                        {trip.destination} · {trip.dateRange}
                      </>
                    ) : (
                      trip.destination
                    )}
                  </p>
                  {!trip.imageUrl ? (
                    <p className="mt-1 text-sm font-semibold text-slate-500">{trip.dateRange}</p>
                  ) : null}
                  <p className="mt-4 break-words text-sm font-black text-slate-700">
                    {trip.imageUrl
                      ? `${formatCount(trip.stopCount, "place")} · ${routeReadyLabel(trip)}`
                      : `${formatCount(trip.stopCount, "place")} · ${trip.mappedStops} mapped · ${nearbyIdeasLabel(trip)}`}
                  </p>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                  <Link
                    className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-blue-600 px-4 text-sm font-black text-white transition hover:bg-blue-700 sm:w-fit"
                    href={trip.href}
                  >
                    Open trip
                  </Link>
                  <TripRowActions
                    compact
                    destination={trip.destination}
                    endDate={trip.endDate}
                    id={trip.id}
                    name={trip.name}
                    startDate={trip.startDate}
                    travelStyle={trip.travelStyle}
                  />
                </div>
              </article>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function formatCount(value: number, singular: string) {
  return `${value} ${singular}${value === 1 ? "" : "s"}`;
}

function TripCardVisual({ trip }: { trip: TripsData["trips"][number] }) {
  if (trip.imageUrl) {
    return (
      <PlacePhoto
        alt={trip.imageAlt}
        attribution={trip.imageAttribution}
        className="mb-4 aspect-[16/9] w-full rounded-2xl"
        fallbackLabel={trip.destination}
        src={trip.imageUrl}
      />
    );
  }

  return (
    <div className="mb-4 overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_18%_22%,rgba(255,255,255,0.34),transparent_28%),linear-gradient(135deg,#0f172a,#2563eb_52%,#14b8a6)] p-4 text-white shadow-sm">
      <div className="flex min-h-[7.5rem] flex-col justify-between">
        <div className="flex items-start justify-between gap-3">
          <p className="max-w-[70%] break-words text-xs font-black uppercase tracking-[0.18em] text-white/75">
            {trip.destination}
          </p>
          <span className="rounded-full bg-white/18 px-3 py-1 text-xs font-black text-white ring-1 ring-white/20">
            Trip Pass
          </span>
        </div>
        <div>
          <p className="text-sm font-semibold text-white/75">Ready when you are</p>
          <p className="mt-1 text-xs font-black uppercase tracking-[0.18em] text-white/55">
            {trip.dateRange}
          </p>
        </div>
      </div>
    </div>
  );
}

function nearbyIdeasLabel(trip: TripsData["trips"][number]) {
  if (trip.nearbyIdeasCount > 0) {
    return `${trip.nearbyIdeasCount} nearby idea${trip.nearbyIdeasCount === 1 ? "" : "s"}`;
  }
  return trip.mappedStops > 0 ? "nearby ideas" : "ideas after mapping";
}

function routeReadyLabel(trip: TripsData["trips"][number]) {
  if (trip.mappedStops > 0 && trip.needsLocationStops === 0) return "route ready";
  if (trip.mappedStops > 0) return `${trip.mappedStops} mapped`;
  return "needs locations";
}
