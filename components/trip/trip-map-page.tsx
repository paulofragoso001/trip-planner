import { ConnectedTripMap } from "@/components/trip/connected-trip-map";
import { MapTools } from "@/components/trip/map-tools";
import { SmartSuggestionsPanel } from "@/components/trip/smart-suggestions-panel";
import type { TripMapData } from "@/app/dashboard/trips/[tripId]/map/loader";

type TripMapPageProps = TripMapData;

export default function TripMapPage({
  destination,
  error,
  activitySegments,
  items,
  recommendations,
  searchUrl,
  tripId,
  unmappedCount,
  unmappedSegments
}: TripMapPageProps) {
  return (
    <div className="grid min-h-[calc(100dvh-220px)] gap-4 xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start">
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

      <aside className="self-start rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5 xl:sticky xl:top-24">
        <div className="mb-4">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">
            Route tools
          </p>
          <h3 className="mt-1 text-base font-black">Build this map</h3>
        </div>
        <MapTools hasMappedStops={items.length > 0} hasUnmappedStops={unmappedCount > 0} tripId={tripId} />
        <SmartSuggestionsPanel
          mappedStopCount={items.length}
          recommendations={recommendations}
          tripId={tripId}
        />
      </aside>
    </div>
  );
}
