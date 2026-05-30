"use client";

import dynamic from "next/dynamic";
import type { Trip } from "@/lib/trips";

const TimelineImportPanel = dynamic(
  () => import("@/components/timeline-import-panel").then((mod) => mod.TimelineImportPanel),
  {
    ssr: false,
    loading: () => (
      <div className="mt-6 rounded-2xl border border-dashed border-black/15 bg-[#f7f6f2] p-4 text-sm font-semibold text-slate-500">
        Loading itinerary and import tools...
      </div>
    )
  }
);

type TimelineImportPanelLoaderProps = {
  trip: Trip;
};

export function TimelineImportPanelLoader({ trip }: TimelineImportPanelLoaderProps) {
  return <TimelineImportPanel trip={trip} />;
}
