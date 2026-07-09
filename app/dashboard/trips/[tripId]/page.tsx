import TripOverviewPage from "@/components/trip/trip-overview-page";
import { loadMobileWalletViewModel } from "@/app/dashboard/mobile-wallet-loader";
import { loadTripOverviewData } from "./overview-loader";

type PageProps = {
  params: Promise<{ tripId: string }>;
};

export default async function Page({ params }: PageProps) {
  const { tripId } = await params;
  const wallet = await loadMobileWalletViewModel({
    pathname: `/dashboard/trips/${encodeURIComponent(tripId)}`
  });
  const data = wallet.selectedTrip?.overview ?? await loadTripOverviewData(tripId);

  return <TripOverviewPage {...data} />;
}
