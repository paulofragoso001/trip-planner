import TripTimelinePage from "@/components/trip/trip-timeline-page";
import { loadTripTimelineData } from "./loader";

type PageProps = {
  params: Promise<{ tripId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Page({ params, searchParams }: PageProps) {
  const { tripId } = await params;
  const query = searchParams ? await searchParams : {};
  const data = await loadTripTimelineData(tripId);
  const mode = readQueryValue(query.mode) === "map" || readQueryValue(query.view) === "map"
    ? "map"
    : "full";

  return <TripTimelinePage {...data} presentationMode={mode} />;
}

function readQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
