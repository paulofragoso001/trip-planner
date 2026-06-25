"use client";

import { AlmidyLaunchGlobe } from "@/components/dashboard/almidy-launch-globe";
import { ALMIDY_MAP_SYSTEM_ID } from "@/lib/map/almidy-map-visuals";
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
      data-map-renderer="custom-globe"
      data-map-system={ALMIDY_MAP_SYSTEM_ID}
      data-selected-map-id={activeSurface?.selectedId ?? undefined}
    >
      <AlmidyLaunchGlobe
        className={className}
        cameraCommand={activeSurface?.cameraCommand}
        location={activeSurface?.location}
        onLocateUser={unifiedMap?.locateUser}
        pins={activeSurface?.pins}
      />
    </div>
  );
}
