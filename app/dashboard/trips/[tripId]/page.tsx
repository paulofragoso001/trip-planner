import TripOverviewPage from "@/components/trip/trip-overview-page";
import { loadTripOverviewData } from "./overview-loader";

type PageProps = {
  params: Promise<{ tripId: string }>;
};

export default async function Page({ params }: PageProps) {
  const { tripId } = await params;
  const data = await loadTripOverviewData(tripId);

  return <TripOverviewPage {...data} />;
}
