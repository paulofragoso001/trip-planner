"use client";

import { AlmidyLaunchGlobe } from "@/components/dashboard/almidy-launch-globe";
import { useOptionalUnifiedMap } from "@/lib/map/unified-map-provider";
import type { AlmidyMapSurfaceState } from "@/lib/map/wayline-map-models";

type CustomGlobeRendererProps = {
  className?: string;
  surfaceState?: AlmidyMapSurfaceState;
};

export function CustomGlobeRenderer({
  className,
  surfaceState
}: CustomGlobeRendererProps) {
  const unifiedMap = useOptionalUnifiedMap();
  const activeSurface = surfaceState ?? unifiedMap?.surfaceState;

  return (
    <div
      className="absolute inset-0"
      data-map-mode={activeSurface?.mode ?? "globe"}
      data-map-renderer="google-maps-3d"
      data-map-system="almidy-google-maps-3d"
      data-selected-map-id={activeSurface?.selectedId ?? undefined}
    >
      <AlmidyLaunchGlobe
        className={className}
        location={activeSurface?.location}
        locationStatus={unifiedMap?.locationStatus}
        onLocateUser={unifiedMap?.locateUser}
      />
    </div>
  );
}
