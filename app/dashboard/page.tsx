import DashboardPage from "@/components/dashboard/dashboard-page";
import { resolveDashboardCompatibilityRedirect } from "@/lib/dashboard/route-contracts";
import { redirect } from "next/navigation";
import { loadMobileWalletViewModel } from "./mobile-wallet-loader";

export default async function Page({
  searchParams
}: {
  searchParams?: Promise<{ view?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const compatibilityRedirect = resolveDashboardCompatibilityRedirect(params.view);
  if (compatibilityRedirect) {
    redirect(compatibilityRedirect);
  }

  const mobileWalletSearchParams = new URLSearchParams();
  if (params.view) {
    mobileWalletSearchParams.set("view", params.view);
  }

  const wallet = await loadMobileWalletViewModel({
    pathname: "/dashboard",
    searchParams: mobileWalletSearchParams
  });
  const data = wallet.dashboard;

  if (!data) {
    throw new Error("Dashboard wallet data did not hydrate.");
  }

  return <DashboardPage {...data} mobileWallet={wallet} view={params.view} />;
}
