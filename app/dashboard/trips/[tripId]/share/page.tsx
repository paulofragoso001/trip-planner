import { loadTripSharingData } from "@/app/dashboard/trips/[tripId]/sharing/loader";
import TripSharingPage from "@/components/trip/trip-sharing-page";

type PageProps = {
  params: Promise<{ tripId: string }>;
};

export default async function Page({ params }: PageProps) {
  const { tripId } = await params;
  const data = await loadTripSharingData(tripId);

  return <TripSharingPage {...data} />;
}
