"use client";

import { Photorealistic3DHomeHero } from "@/components/dashboard/photorealistic-3d-home-hero";
import { useOptionalUnifiedMap } from "@/lib/map/unified-map-provider";
import type { WaylineMapSurfaceState } from "@/lib/map/wayline-map-models";

type CustomGlobeRendererProps = {
  className?: string;
  surfaceState?: WaylineMapSurfaceState;
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
      data-selected-map-id={activeSurface?.selectedId ?? undefined}
    >
      <Photorealistic3DHomeHero
        className={className}
        location={activeSurface?.location}
        onLocateUser={unifiedMap?.locateUser}
        pins={activeSurface?.pins}
      />
    </div>
  );
}
