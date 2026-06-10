import TripsPage from "@/components/dashboard/trips-page";
import { loadTripsData } from "./loader";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Page() {
  const data = await loadTripsData();

  return <TripsPage {...data} />;
}
