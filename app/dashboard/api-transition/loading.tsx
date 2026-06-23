import { DashboardLoadingState } from "@/components/dashboard/dashboard-loading-state";

export default function ApiTransitionLoading() {
  return (
    <DashboardLoadingState
      eyebrow="API"
      title="Loading transition checks"
      variant="panel"
    />
  );
}
