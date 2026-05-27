import DashboardPage from "@/components/dashboard/dashboard-page";
import { loadDashboardData } from "./loader";

export default async function Page() {
  const data = await loadDashboardData();

  return <DashboardPage {...data} />;
}
