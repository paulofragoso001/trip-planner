"use client";

import dynamic from "next/dynamic";
import type { DashboardTimelineItem } from "@/components/DraggableList";

const FlightStatusPanel = dynamic(
  () => import("@/components/flight-status-panel").then((mod) => mod.FlightStatusPanel),
  {
    ssr: false,
    loading: () => (
      <div className="mt-5 rounded-2xl border border-dashed border-black/15 bg-[#f7f6f2] p-4 text-sm font-semibold text-slate-500">
        Loading flight status tools...
      </div>
    )
  }
);

type FlightPanelLoaderProps = {
  flights: DashboardTimelineItem[];
  onRefreshFlightStatuses?: () => Promise<void>;
  refreshing?: boolean;
};

export function FlightPanelLoader({
  flights,
  onRefreshFlightStatuses,
  refreshing
}: FlightPanelLoaderProps) {
  return (
    <FlightStatusPanel
      flights={flights}
      onRefreshFlightStatuses={onRefreshFlightStatuses}
      refreshing={refreshing}
    />
  );
}
