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
    <div className="grid min-h-[calc(100dvh-220px)] gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
      <section className="relative flex min-h-[520px] min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm sm:min-h-[620px]">
        <h2 className="sr-only">Map</h2>
        {items.length ? (
          <div className="pointer-events-none absolute left-4 right-4 top-4 z-10 grid grid-cols-3 gap-2 sm:left-5 sm:right-auto sm:w-[420px]">
            <MapSummary label="Route ready" value={`${items.length}/${items.length + unmappedCount}`} />
            <MapSummary label="Needs location" value={String(unmappedCount)} />
            <MapSummary label="Adventure" value="Preview" />
          </div>
        ) : null}
        {error ? (
          <p className="mx-5 mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
            {error}
          </p>
        ) : null}
        <div className="min-h-0 flex-1 p-3 sm:p-4">
          <ConnectedTripMap
            destination={destination}
            items={items}
            searchUrl={searchUrl}
            tripId={tripId}
            activitySegments={activitySegments}
            unmappedCount={unmappedCount}
            unmappedSegments={unmappedSegments}
          />
        </div>
      </section>

      <aside className="self-start rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 xl:sticky xl:top-24">
        <div className="mb-4">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">
            Trip places
          </p>
          <h3 className="mt-1 text-base font-black">Today</h3>
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

function MapSummary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/95 px-3 py-2.5 shadow-sm ring-1 ring-slate-200 backdrop-blur sm:px-4 sm:py-3">
      <p className="text-[0.65rem] font-black uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-base font-black text-slate-950 sm:text-lg">{value}</p>
    </div>
  );
}
