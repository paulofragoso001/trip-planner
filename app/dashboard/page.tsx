import DashboardPage from "@/components/dashboard/dashboard-page";
import { loadDashboardData } from "./loader";

export default async function Page({
  searchParams
}: {
  searchParams?: Promise<{ view?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const data = await loadDashboardData();

  return <DashboardPage {...data} view={params.view} />;
}
