"use client";

import dynamic from "next/dynamic";
import type { DashboardTimelineItem } from "@/components/DraggableList";

const TripMapTab = dynamic(
  () => import("@/components/trip-map-tab").then((mod) => mod.TripMapTab),
  {
    ssr: false,
    loading: () => (
      <div className="mt-5 rounded-2xl border border-dashed border-black/15 bg-[#f7f6f2] p-4 text-sm font-semibold text-slate-500">
        Loading trip map...
      </div>
    )
  }
);

type MapPanelLoaderProps = {
  items: DashboardTimelineItem[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
};

export function MapPanelLoader({ items, selectedId, onSelect }: MapPanelLoaderProps) {
  return (
    <TripMapTab
      className="mt-5"
      items={items}
      selectedId={selectedId}
      onSelect={onSelect}
    />
  );
}
