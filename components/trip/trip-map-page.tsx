import { ConnectedTripMap } from "@/components/trip/connected-trip-map";
import { MapTools } from "@/components/trip/map-tools";
import type { TripMapData } from "@/app/dashboard/trips/[tripId]/map/loader";
import Link from "next/link";

type TripMapPageProps = TripMapData;

export default function TripMapPage({
  destination,
  error,
  activitySegments,
  items,
  searchUrl,
  tripId,
  unmappedCount,
  unmappedSegments
}: TripMapPageProps) {
  return (
    <div className="grid min-h-[calc(100dvh-220px)] gap-4">
      <section className="relative min-w-0">
        <h2 className="sr-only">Map</h2>
        {error ? (
          <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
            {error}
          </p>
        ) : null}
        <ConnectedTripMap
          destination={destination}
          items={items}
          searchUrl={searchUrl}
          tripId={tripId}
          activitySegments={activitySegments}
          unmappedCount={unmappedCount}
          unmappedSegments={unmappedSegments}
        />
      </section>

      <aside className="grid gap-4 rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div>
          <div className="mb-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">
              Route tools
            </p>
            <h3 className="mt-1 text-base font-black">Build this map</h3>
          </div>
          <MapTools hasMappedStops={items.length > 0} hasUnmappedStops={unmappedCount > 0} tripId={tripId} />
        </div>
        <div className="rounded-[1.35rem] bg-slate-50 p-4 ring-1 ring-slate-100">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
            Route places
          </p>
          <h3 className="mt-1 text-base font-black text-slate-950">
            Your route places appear here.
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Open Ideas to find places near your route.
          </p>
          <Link
            className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-slate-950 px-4 text-sm font-black text-white sm:w-auto"
            href={`/dashboard/trips/${tripId}/ideas`}
          >
            Open Ideas
          </Link>
        </div>
      </aside>
    </div>
  );
}
