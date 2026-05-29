import Link from "next/link";
import { RouterRefreshButton } from "@/components/dashboard/router-refresh-button";
import { TripCreateForm } from "@/components/dashboard/trip-create-form";
import { TripRowActions } from "@/components/dashboard/trip-row-actions";
import type { TripsData } from "@/app/dashboard/trips/loader";
import { EmptyState, PageHeader, SectionCard, StatusBadge } from "@/components/trip-ui";

type TripsPageProps = TripsData;

export default function TripsPage({ error, trips }: TripsPageProps) {
  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="My Trips"
        subtitle="Create, organize, and continue your travel plans."
        title="Your trip workspace"
      />

      <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        <SectionCard
          description="Set the destination first so Wayline can match AI places to the right trip."
          title="Create a new trip"
        >
          <TripCreateForm />
        </SectionCard>

        <SectionCard
          actions={<RouterRefreshButton>Refresh</RouterRefreshButton>}
          title="Confirmed plans"
        >
          <div className="mt-4 grid gap-3">
            {error ? (
              <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
                {error}
              </p>
            ) : null}
            {!error && trips.length === 0 ? (
              <EmptyState
                description="Create a trip or approve AI places to turn saved inspiration into a real itinerary."
                title="No trips yet."
              />
            ) : null}
            {trips.map((trip) => (
              <article
                className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-blue-200 hover:bg-white hover:shadow-sm"
                key={trip.id}
              >
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-xl font-black text-slate-950">{trip.name}</p>
                      <StatusBadge tone={trip.status === "Planning" ? "blue" : "green"}>
                        {trip.status}
                      </StatusBadge>
                    </div>
                    <p className="text-sm text-slate-500">{trip.destination}</p>
                    <p className="mt-1 text-sm text-slate-500">{trip.dateRange}</p>
                    <p className="mt-2 text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                      {trip.travelStyleLabel}
                    </p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3 xl:min-w-[300px]">
                    <MiniStat label="Stops" value={String(trip.stopCount)} />
                    <MiniStat label="Mapped" value={String(trip.mappedStops)} />
                    <MiniStat label="Needs location" value={String(trip.needsLocationStops)} />
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-blue-600 px-4 text-sm font-black text-white transition hover:bg-blue-700"
                    href={trip.href}
                  >
                    Open trip
                  </Link>
                  <TripRowActions
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

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white px-3 py-2 ring-1 ring-slate-200">
      <p className="text-[0.65rem] font-black uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-lg font-black text-slate-950">{value}</p>
    </div>
  );
}
