import TripTimelinePage from "@/components/trip/trip-timeline-page";
import { loadTripTimelineData } from "./loader";

type PageProps = {
  params: Promise<{ tripId: string }>;
};

export default async function Page({ params }: PageProps) {
  const { tripId } = await params;
  const data = await loadTripTimelineData(tripId);

  return <TripTimelinePage {...data} />;
}
