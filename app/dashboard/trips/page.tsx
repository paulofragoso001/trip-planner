import TripsPage from "@/components/dashboard/trips-page";
import { loadTripsData } from "./loader";

export default async function Page() {
  const data = await loadTripsData();

  return <TripsPage {...data} />;
}
