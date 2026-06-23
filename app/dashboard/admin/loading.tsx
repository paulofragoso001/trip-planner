import { DashboardLoadingState } from "@/components/dashboard/dashboard-loading-state";

export default function AdminLoading() {
  return (
    <DashboardLoadingState
      eyebrow="Admin"
      title="Loading operations"
      variant="panel"
    />
  );
}
