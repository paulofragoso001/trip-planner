import { loadTripBudgetData } from "@/app/dashboard/trips/[tripId]/budget/loader";
import TripBudgetPage from "@/components/trip/trip-budget-page";

type PageProps = {
  params: Promise<{ tripId: string }>;
};

export default async function Page({ params }: PageProps) {
  const { tripId } = await params;
  const data = await loadTripBudgetData(tripId);

  return <TripBudgetPage {...data} />;
}
