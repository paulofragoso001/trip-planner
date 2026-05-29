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
          <h2 className="text-lg font-black">Trip map</h2>
          <p className="mt-1 text-sm text-slate-600">
            Your confirmed stops, needs-location ideas, and route-ready map view.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <MapSummary label="Mapped stops" value={String(items.length)} />
            <MapSummary label="Needs location" value={String(unmappedCount)} />
            <MapSummary label="Suggestions" value={String(recommendations.length)} />
          </div>
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
            tripId={tripId}
            unmappedCount={unmappedCount}
            unmappedSegments={unmappedSegments}
          />
        </div>
      </section>

      <aside className="self-start rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:sticky xl:top-24">
        <h3 className="text-base font-black">Map actions</h3>
        <MapTools tripId={tripId} />
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
    <div className="rounded-2xl bg-slate-50 px-4 py-3">
      <p className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-lg font-black text-slate-950">{value}</p>
    </div>
  );
}
