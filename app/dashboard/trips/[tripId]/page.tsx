import TripOverviewPage from "@/components/trip/trip-overview-page";
import { MobileTripDirectWallet } from "@/components/dashboard/mobile-trip-direct-wallet";
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

  return (
    <>
      <div className="lg:hidden" data-testid="mobile-trip-direct-wallet-host">
        <MobileTripDirectWallet mobileWallet={wallet} tripId={tripId} />
      </div>
      <div className="hidden lg:block" data-testid="desktop-trip-overview-host">
        <TripOverviewPage {...data} />
      </div>
    </>
  );
}
