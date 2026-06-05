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
  const hasRoutePlaces = items.length > 0;
  const hasLocationAttention = unmappedCount > 0 || activitySegments.length > 0;

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

      <aside className="grid items-start gap-4 rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div id="route-tools">
          <div className="mb-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">
              Route tools
            </p>
            <h3 className="mt-1 text-base font-black">Build this map</h3>
          </div>
          <MapTools hasMappedStops={items.length > 0} hasUnmappedStops={unmappedCount > 0} tripId={tripId} />
        </div>
        {!hasRoutePlaces ? (
          <div
            className="rounded-[1.35rem] bg-slate-50 p-3 ring-1 ring-slate-100 sm:p-4"
            data-testid="compact-route-empty-state"
          >
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
              Route places
            </p>
            <h3 className="mt-1 text-base font-black text-slate-950">
              No route places yet
            </h3>
            <p className="mt-2 max-w-xl text-sm leading-5 text-slate-600">
              Add places from Ideas or create a trip item to start building your route.
            </p>
            {hasLocationAttention ? (
              <p className="mt-2 rounded-2xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
                Some ideas need location before they can join the route.
              </p>
            ) : null}
            <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              <Link
                className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-slate-950 px-3 text-sm font-black text-white sm:w-auto sm:px-4"
                href={`/dashboard/trips/${encodeURIComponent(tripId)}/ideas`}
              >
                Open Ideas
              </Link>
              <a
                className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-white px-3 text-sm font-black text-slate-800 ring-1 ring-slate-200 sm:w-auto sm:px-4"
                href="#route-tools"
              >
                Add trip item
              </a>
            </div>
          </div>
        ) : null}
      </aside>
    </div>
  );
}
