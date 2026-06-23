import { DashboardLoadingState } from "@/components/dashboard/dashboard-loading-state";

export default function MapLoading() {
  return (
    <DashboardLoadingState
      eyebrow="Map"
      title="Opening your route map"
      variant="globe"
    />
  );
}
