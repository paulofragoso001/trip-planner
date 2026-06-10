import { ConnectedTripMap } from "@/components/trip/connected-trip-map";
import { MapTools } from "@/components/trip/map-tools";
import type { TripMapData } from "@/app/dashboard/trips/[tripId]/map/loader";

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
    <div className="grid gap-0 lg:gap-4">
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

      {hasRoutePlaces ? (
        <details className="hidden rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5 lg:block">
          <summary className="cursor-pointer text-base font-black text-slate-950">
            Add trip item
          </summary>
          {hasLocationAttention ? (
            <p className="mt-3 rounded-2xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
              Some ideas need location before they can join the route.
            </p>
          ) : null}
          <div className="mt-4" id="route-tools">
            <MapTools hasMappedStops={items.length > 0} hasUnmappedStops={unmappedCount > 0} tripId={tripId} />
          </div>
        </details>
      ) : null}
    </div>
  );
}
