import { DashboardLoadingState } from "@/components/dashboard/dashboard-loading-state";

export default function PlanLoading() {
  return (
    <DashboardLoadingState
      eyebrow="Plan"
      title="Loading ideas and places"
      variant="panel"
    />
  );
}
