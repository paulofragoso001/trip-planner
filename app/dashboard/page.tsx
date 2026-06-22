import DashboardPage from "@/components/dashboard/dashboard-page";
import { redirect } from "next/navigation";
import { loadDashboardData } from "./loader";

export default async function Page({
  searchParams
}: {
  searchParams?: Promise<{ view?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  if (params.view === "trips") {
    redirect("/dashboard/trips");
  }

  const data = await loadDashboardData();

  return <DashboardPage {...data} view={params.view} />;
}
