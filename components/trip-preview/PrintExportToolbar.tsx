"use client";

import { TripButton, TripCard } from "@/components/trip-ui";

type PrintExportToolbarProps = {
  showMaps: boolean;
  showDirections: boolean;
  onToggleMaps: () => void;
  onToggleDirections: () => void;
};

export function PrintExportToolbar({
  showMaps,
  showDirections,
  onToggleMaps,
  onToggleDirections
}: PrintExportToolbarProps) {
  return (
    <TripCard
      className="sticky top-3 z-20 flex flex-wrap items-center justify-between gap-2 bg-white/95 p-3 backdrop-blur print:hidden"
      data-testid="trip-preview-toolbar"
      variant="surfaceSoft"
    >
      <div className="flex flex-wrap gap-2">
        <TripButton onClick={() => window.print()}>
          Print itinerary
        </TripButton>
        <TripButton onClick={() => window.print()} variant="primaryCompact">
          Export PDF
        </TripButton>
      </div>
      <div className="flex flex-wrap gap-2">
        <TripButton onClick={onToggleMaps} variant="subtle">
          {showMaps ? "Hide maps" : "Show maps"}
        </TripButton>
        <TripButton onClick={onToggleDirections} variant="subtle">
          {showDirections ? "Hide directions" : "Show directions"}
        </TripButton>
      </div>
    </TripCard>
  );
}
