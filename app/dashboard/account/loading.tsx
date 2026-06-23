import { DashboardLoadingState } from "@/components/dashboard/dashboard-loading-state";

export default function AccountLoading() {
  return (
    <DashboardLoadingState
      eyebrow="Account"
      title="Loading settings"
      variant="panel"
    />
  );
}
