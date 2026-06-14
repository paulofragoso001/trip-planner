import { TravelStatsPage } from "@/components/dashboard/travel-stats-page";

import { loadTravelStatsData } from "./loader";

type ProfileStatsPageProps = {
  searchParams?: Promise<{
    year?: string;
  }>;
};

export default async function ProfileStatsPage({ searchParams }: ProfileStatsPageProps) {
  const params = await searchParams;
  const year = parseYearParam(params?.year);
  const data = await loadTravelStatsData(year);

  return <TravelStatsPage data={data} />;
}

function parseYearParam(value: string | undefined) {
  if (value === "all") {
    return null;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : undefined;
}
