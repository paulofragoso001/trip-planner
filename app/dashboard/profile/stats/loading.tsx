import { DashboardLoadingState } from "@/components/dashboard/dashboard-loading-state";

export default function StatsLoading() {
  return (
    <DashboardLoadingState
      eyebrow="Stats"
      title="Loading travel insights"
      variant="panel"
    />
  );
}
