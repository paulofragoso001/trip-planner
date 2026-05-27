import { ConnectedTripMap } from "@/components/trip/connected-trip-map";
import { MapTools } from "@/components/trip/map-tools";
import type { TripMapData } from "@/app/dashboard/trips/[tripId]/map/loader";

type TripMapPageProps = TripMapData;

export default function TripMapPage({
  destination,
  error,
  items,
  searchUrl,
  tripId
}: TripMapPageProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-black">Map</h2>
        <p className="mt-2 text-sm text-slate-600">
          Connected Google Maps route preview for the selected trip stops.
        </p>
        {error ? (
          <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
            {error}
          </p>
        ) : null}
        <div className="mt-4">
          <ConnectedTripMap
            destination={destination}
            items={items}
            searchUrl={searchUrl}
          />
        </div>
      </section>

      <aside className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-base font-black">Map tools</h3>
        <MapTools tripId={tripId} />
        <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
          The map uses the shared Google Maps loader and falls back cleanly when
          <code className="mx-1 rounded bg-white px-1 py-0.5 text-xs font-bold">
            NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
          </code>
          is not configured.
        </div>
      </aside>
    </div>
  );
}
