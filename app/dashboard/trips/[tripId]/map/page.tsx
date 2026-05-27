import TripMapPage from "@/components/trip/trip-map-page";
import { loadTripMapData } from "./loader";

type PageProps = {
  params: Promise<{ tripId: string }>;
};

export default async function Page({ params }: PageProps) {
  const { tripId } = await params;
  const data = await loadTripMapData(tripId);

  return <TripMapPage {...data} />;
}
