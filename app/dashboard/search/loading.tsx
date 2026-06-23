import { DashboardLoadingState } from "@/components/dashboard/dashboard-loading-state";

export default function SearchLoading() {
  return (
    <DashboardLoadingState
      eyebrow="Search"
      title="Preparing travel search"
      variant="panel"
    />
  );
}
