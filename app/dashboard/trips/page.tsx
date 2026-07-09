import TripsPage from "@/components/dashboard/trips-page";
import { loadMobileWalletViewModel } from "../mobile-wallet-loader";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Page() {
  const wallet = await loadMobileWalletViewModel({
    pathname: "/dashboard/trips"
  });

  return (
    <TripsPage
      error={wallet.error}
      heroImage={wallet.heroImagery}
      mobileWallet={wallet}
      trips={wallet.trips}
    />
  );
}
