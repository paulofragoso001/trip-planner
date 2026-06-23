import DashboardPage from "@/components/dashboard/dashboard-page";
import { resolveDashboardCompatibilityRedirect } from "@/lib/dashboard/route-contracts";
import { redirect } from "next/navigation";
import { loadDashboardData } from "./loader";

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

  const data = await loadDashboardData();

  return <DashboardPage {...data} view={params.view} />;
}
