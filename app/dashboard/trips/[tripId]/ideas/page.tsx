import { SmartSuggestionsPanel } from "@/components/trip/smart-suggestions-panel";
import { loadTripMapData } from "../map/loader";

export default async function TripIdeasPage({
  params
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  const data = await loadTripMapData(tripId);

  return (
    <div className="grid gap-4">
      {data.error ? (
        <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          {data.error}
        </p>
      ) : null}
      <SmartSuggestionsPanel
        mappedStopCount={data.items.length}
        recommendations={data.recommendations}
        tripId={tripId}
      />
    </div>
  );
}
