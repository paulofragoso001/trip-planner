import { TripIdeasPage as TripIdeasPageContent } from "@/components/trip/trip-ideas-page";
import { loadTripMapData } from "../map/loader";

export default async function TripIdeasRoute({
  params
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  const data = await loadTripMapData(tripId);

  return <TripIdeasPageContent {...data} />;
}
