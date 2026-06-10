import { TravelStatsPage } from "@/components/dashboard/travel-stats-page";

import { loadTravelStatsData } from "./loader";

export default async function ProfileStatsPage() {
  const data = await loadTravelStatsData();

  return <TravelStatsPage data={data} />;
}
