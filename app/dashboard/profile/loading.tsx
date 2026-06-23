import { DashboardLoadingState } from "@/components/dashboard/dashboard-loading-state";

export default function ProfileLoading() {
  return (
    <DashboardLoadingState
      eyebrow="Profile"
      title="Loading account controls"
      variant="panel"
    />
  );
}
