import TripTimelinePage from "@/components/trip/trip-timeline-page";
import { loadTripTimelineData } from "./loader";

type PageProps = {
  params: Promise<{ tripId: string }>;
  searchParams?: Promise<{ mode?: string | string[] }>;
};

export default async function Page({ params, searchParams }: PageProps) {
  const { tripId } = await params;
  const query = await searchParams;
  const data = await loadTripTimelineData(tripId);
  const presentationMode = query?.mode === "map" ? "map" : "full";

  return <TripTimelinePage {...data} presentationMode={presentationMode} />;
}
