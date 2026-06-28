"use client";

import { AlmidyLaunchGlobe } from "@/components/dashboard/almidy-launch-globe";
import { useOptionalUnifiedMap } from "@/lib/map/unified-map-provider";
import type {
  AlmidyLaunchGlobeTripPin,
  AlmidyMapSurfaceState
} from "@/lib/map/wayline-map-models";

type CustomGlobeRendererProps = {
  activeTripId?: string | null;
  className?: string;
  defaultFocusWhenEmpty?: boolean;
  onTripPinSelect?: (tripId: string) => void;
  mapInstanceKey?: string;
  renderTripPins?: boolean;
  showCountryPin?: boolean;
  surfaceState?: AlmidyMapSurfaceState;
  tripPins?: AlmidyLaunchGlobeTripPin[];
  useLocationFocus?: boolean;
};

export function CustomGlobeRenderer({
  activeTripId,
  className,
  defaultFocusWhenEmpty,
  mapInstanceKey,
  onTripPinSelect,
  renderTripPins,
  showCountryPin,
  surfaceState,
  tripPins,
  useLocationFocus
}: CustomGlobeRendererProps) {
  const unifiedMap = useOptionalUnifiedMap();
  const activeSurface = surfaceState ?? unifiedMap?.surfaceState;

  return (
    <div
      className="absolute inset-0"
      data-map-mode={activeSurface?.mode ?? "globe"}
      data-map-renderer="google-maps-3d"
      data-map-system="almidy-google-maps-3d"
      data-map-instance-key={mapInstanceKey}
      data-selected-map-id={activeSurface?.selectedId ?? undefined}
    >
      <AlmidyLaunchGlobe
        activeTripId={activeTripId}
        className={className}
        defaultFocusWhenEmpty={defaultFocusWhenEmpty}
        location={activeSurface?.location}
        locationStatus={unifiedMap?.locationStatus}
        onLocateUser={unifiedMap?.locateUser}
        onTripPinSelect={onTripPinSelect}
        renderTripPins={renderTripPins}
        showCountryPin={showCountryPin}
        tripPins={tripPins}
        useLocationFocus={useLocationFocus}
      />
    </div>
  );
}
