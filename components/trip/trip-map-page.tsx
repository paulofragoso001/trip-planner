import { ConnectedTripMap } from "@/components/trip/connected-trip-map";
import { MapTools } from "@/components/trip/map-tools";
import { SmartSuggestionsPanel } from "@/components/trip/smart-suggestions-panel";
import type { TripMapData } from "@/app/dashboard/trips/[tripId]/map/loader";

type TripMapPageProps = TripMapData;

export default function TripMapPage({
  destination,
  error,
  items,
  recommendations,
  searchUrl,
  tripId,
  unmappedCount,
  unmappedSegments
}: TripMapPageProps) {
  return (
    <div className="grid min-h-[calc(100dvh-220px)] gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <section className="flex min-h-[560px] min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-black">Map</h2>
          <p className="mt-1 text-sm text-slate-600">
            Connected Google Maps route preview for the selected trip stops.
          </p>
        </div>
        {error ? (
          <p className="mx-5 mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
            {error}
          </p>
        ) : null}
        <div className="min-h-0 flex-1 p-4">
          <ConnectedTripMap
            destination={destination}
            items={items}
            searchUrl={searchUrl}
            unmappedCount={unmappedCount}
            unmappedSegments={unmappedSegments}
          />
        </div>
      </section>

      <aside className="self-start rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:sticky xl:top-24">
        <h3 className="text-base font-black">Map tools</h3>
        <MapTools tripId={tripId} />
        <div className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
          The map uses the shared Google Maps loader and falls back cleanly when
          <code className="mx-1 rounded bg-white px-1 py-0.5 text-xs font-bold">
            NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
          </code>
          is not configured.
        </div>
        <SmartSuggestionsPanel
          recommendations={recommendations}
          tripId={tripId}
        />
      </aside>
    </div>
  );
}
