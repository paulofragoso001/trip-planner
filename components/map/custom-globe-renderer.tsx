"use client";

import {
  GoogleMap,
  OverlayView
} from "@react-google-maps/api";
import { useCallback, useEffect, useMemo, useRef } from "react";
import GoogleMapsProvider, { GoogleMapsSurfaceFallback } from "@/components/GoogleMapsProvider";
import { AlmidyLaunchGlobe } from "@/components/dashboard/almidy-launch-globe";
import {
  ALMIDY_MAP_SYSTEM_ID,
  almidyGoogleCountryMapStyles
} from "@/lib/map/almidy-map-visuals";
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
  selectionRevision?: number;
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
  selectionRevision,
  showCountryPin,
  surfaceState,
  tripPins,
  useLocationFocus
}: CustomGlobeRendererProps) {
  const unifiedMap = useOptionalUnifiedMap();
  const activeSurface = surfaceState ?? unifiedMap?.surfaceState;

  if (renderTripPins) {
    return (
      <TripsOverviewMapRenderer
        activeSurface={activeSurface}
        activeTripId={activeTripId}
        className={className}
        mapInstanceKey={mapInstanceKey}
        onTripPinSelect={onTripPinSelect}
        selectionRevision={selectionRevision}
        tripPins={tripPins ?? []}
      />
    );
  }

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

type TripsOverviewMapRendererProps = {
  activeSurface?: AlmidyMapSurfaceState;
  activeTripId?: string | null;
  className?: string;
  mapInstanceKey?: string;
  onTripPinSelect?: (tripId: string) => void;
  selectionRevision?: number;
  tripPins: AlmidyLaunchGlobeTripPin[];
};

const overviewFallbackCenter = { lat: 28.5, lng: -81.5 };

function TripsOverviewMapRenderer(props: TripsOverviewMapRendererProps) {
  return (
    <GoogleMapsProvider
      blockChildrenOnError
      fallback={
        <GoogleMapsSurfaceFallback
          height="100%"
          message="Maps are temporarily unavailable. Your saved trips are still available below."
          placement="above-sheet"
        />
      }
    >
      <LoadedTripsOverviewMapRenderer {...props} />
    </GoogleMapsProvider>
  );
}

function LoadedTripsOverviewMapRenderer({
  activeSurface,
  activeTripId,
  className,
  mapInstanceKey,
  onTripPinSelect,
  selectionRevision,
  tripPins
}: TripsOverviewMapRendererProps) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const visiblePins = useMemo(() => tripPins.map(toResolvedTripPin).filter(isResolvedTripPin), [tripPins]);
  const activePin = useMemo(
    () => activeTripId
      ? visiblePins.find((pin) => (pin.tripId ?? pin.id) === activeTripId) ?? null
      : null,
    [activeTripId, visiblePins]
  );
  const mapReady =
    typeof window !== "undefined" &&
    typeof window.google?.maps?.Map === "function" &&
    typeof window.google?.maps?.LatLngBounds === "function";
  const center = visiblePins[0]?.coordinate ?? overviewFallbackCenter;

  const fitPins = useCallback((map: google.maps.Map) => {
    if (!mapReady || visiblePins.length === 0) {
      map.panTo(overviewFallbackCenter);
      map.setZoom(3);
      return;
    }

    if (visiblePins.length === 1) {
      map.panTo(visiblePins[0].coordinate);
      map.setZoom(5);
      return;
    }

    const bounds = new window.google.maps.LatLngBounds();
    visiblePins.forEach((pin) => bounds.extend(pin.coordinate));
    map.fitBounds(bounds, { bottom: 132, left: 56, right: 56, top: 96 });
  }, [mapReady, visiblePins]);

  useEffect(() => {
    if (mapRef.current) {
      fitPins(mapRef.current);
    }
  }, [fitPins]);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !activePin) return;

    const target = new window.google.maps.LatLng(
      activePin.coordinate.lat,
      activePin.coordinate.lng
    );
    mapRef.current.panTo(target);
    mapRef.current.setZoom(5);
  }, [activePin, mapReady, selectionRevision]);

  const handleMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    fitPins(map);
  }, [fitPins]);

  const handleMapUnmount = useCallback(() => {
    mapRef.current = null;
  }, []);

  if (!mapReady) {
    return (
      <div
        className="absolute inset-0 grid place-items-center bg-[#1a1b20] text-center text-xs font-bold tracking-[0.2em] text-white/40"
        data-map-renderer="google-map"
        data-map-runtime="preparing"
        data-map-system={ALMIDY_MAP_SYSTEM_ID}
        data-testid="almidy-trips-map-preflight"
      >
        Preparing map canvas
      </div>
    );
  }

  return (
    <div
      className={["absolute inset-0 overflow-visible bg-[#1a1b20]", className].filter(Boolean).join(" ")}
      data-map-mode={activeSurface?.mode ?? "country-map"}
      data-map-renderer="google-map"
      data-map-system={ALMIDY_MAP_SYSTEM_ID}
      data-map-instance-key={mapInstanceKey}
      data-selected-map-id={activeSurface?.selectedId ?? undefined}
    >
      <GoogleMap
        center={center}
        mapContainerStyle={{ height: "100%", width: "100%" }}
        onLoad={handleMapLoad}
        onUnmount={handleMapUnmount}
        options={{
          backgroundColor: "#1a1b20",
          clickableIcons: false,
          colorScheme: window.google.maps.ColorScheme?.DARK,
          disableDefaultUI: true,
          fullscreenControl: false,
          gestureHandling: "greedy",
          mapTypeId: "roadmap",
          streetViewControl: false,
          styles: almidyGoogleCountryMapStyles,
          zoomControl: false
        }}
        zoom={3}
      >
        {visiblePins.map((pin) => (
          <OverlayView
            key={pin.id}
            mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
            position={pin.coordinate}
          >
            <TripFlagPin
              isActive={(pin.tripId ?? pin.id) === activeTripId}
              onSelect={() => onTripPinSelect?.(pin.tripId ?? pin.id)}
              pin={pin}
            />
          </OverlayView>
        ))}
      </GoogleMap>
    </div>
  );
}

type ResolvedTripPin = AlmidyLaunchGlobeTripPin & {
  coordinate: google.maps.LatLngLiteral;
};

function toResolvedTripPin(pin: AlmidyLaunchGlobeTripPin): ResolvedTripPin | null {
  const lat = Number(pin.lat);
  const lng = Number(pin.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return {
    ...pin,
    coordinate: { lat, lng }
  };
}

function isResolvedTripPin(pin: ResolvedTripPin | null): pin is ResolvedTripPin {
  return Boolean(pin);
}

function TripFlagPin({
  isActive,
  onSelect,
  pin
}: {
  isActive: boolean;
  onSelect: () => void;
  pin: ResolvedTripPin;
}) {
  const tripId = pin.tripId ?? pin.id;
  const position = `${pin.coordinate.lat.toFixed(5)}, ${pin.coordinate.lng.toFixed(5)}, 0`;
  const markerPositionAttribute = { position };

  return (
    <button
      aria-label={`Select ${pin.label}`}
      className="group pointer-events-auto relative flex -translate-x-1/2 -translate-y-full touch-manipulation flex-col items-center overflow-visible text-center focus:outline-none"
      data-active={isActive ? "true" : "false"}
      data-almidy-marker-kind="trip"
      data-country-code={pin.countryCode}
      data-pin-latitude={pin.coordinate.lat.toFixed(5)}
      data-pin-longitude={pin.coordinate.lng.toFixed(5)}
      data-testid="mobile-trips-globe-flag-pin"
      data-trip-id={tripId}
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
      {...markerPositionAttribute}
      style={{
        overflow: "visible",
        pointerEvents: "auto",
        position: "relative",
        transformStyle: "preserve-3d",
        zIndex: isActive ? 45 : 40
      }}
      type="button"
    >
      <span
        aria-hidden="true"
        className={[
          "grid h-11 w-11 place-items-center overflow-hidden rounded-full border-[2.5px] bg-white text-2xl leading-none shadow-[0_4px_0_rgba(0,0,0,0.95),0_10px_24px_rgba(0,0,0,0.36)] transition duration-200",
          isActive ? "scale-125 border-orange-500 ring-4 ring-orange-400/60" : "border-black ring-1 ring-white/75"
        ].join(" ")}
      >
        {pin.flag}
      </span>
      <span
        className={[
          "mt-1 block max-w-28 truncate rounded px-1.5 py-0.5 text-[0.72rem] font-black leading-none [text-shadow:0_2px_2px_rgba(0,0,0,0.95),0_0_8px_rgba(0,0,0,0.85)]",
          isActive ? "bg-orange-600 text-white" : "bg-black/56 text-white"
        ].join(" ")}
      >
        {pin.label}
      </span>
    </button>
  );
}
