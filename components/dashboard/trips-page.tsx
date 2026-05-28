import Link from "next/link";
import { RouterRefreshButton } from "@/components/dashboard/router-refresh-button";
import { TripCreateForm } from "@/components/dashboard/trip-create-form";
import { TripRowActions } from "@/components/dashboard/trip-row-actions";
import type { TripsData } from "@/app/dashboard/trips/loader";

type TripsPageProps = TripsData;

export default function TripsPage({ error, trips }: TripsPageProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-black">Trips database</h2>
        <p className="mt-2 text-sm text-slate-600">
          Create, edit, and select trips from one place.
        </p>

        <TripCreateForm />
      </section>

      <section className="grid gap-4">
        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black">Trip list</h2>
            <RouterRefreshButton>Refresh</RouterRefreshButton>
          </div>
          <div className="mt-4 grid gap-3">
            {error ? (
              <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
                {error}
              </p>
            ) : null}
            {!error && trips.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-600">
                <p className="font-bold text-slate-900">No trips yet.</p>
                <p className="mt-1">Create a trip to start building a real itinerary.</p>
              </div>
            ) : null}
            {trips.map((trip) => (
              <div
                className="rounded-2xl border border-slate-200 px-4 py-4 text-left"
                key={trip.id}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-lg font-semibold">{trip.name}</p>
                    <p className="text-sm text-slate-500">{trip.destination}</p>
                    <p className="mt-1 text-sm text-slate-500">{trip.dateRange}</p>
                    <p className="mt-1 text-xs font-semibold uppercase text-slate-400">
                      {trip.travelStyleLabel}
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">
                    {trip.status}
                  </span>
                </div>
                <Link
                  className="mt-3 inline-flex rounded-xl bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700"
                  href={trip.href}
                >
                  Open workspace
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
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}
