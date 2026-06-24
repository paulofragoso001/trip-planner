"use client";

import {
  GoogleMap,
  OverlayView,
  Polyline
} from "@react-google-maps/api";
import { useCallback, useEffect, useMemo, useRef } from "react";
import GoogleMapsProvider from "@/components/GoogleMapsProvider";
import { AlmidyGoogleMapPinMarker } from "@/components/map/wayline-google-map-pin-marker";
import { useOptionalUnifiedMap } from "@/lib/map/unified-map-provider";
import type {
  AlmidyCoordinate,
  AlmidyMapCameraCommand,
  AlmidyMapRoute,
  AlmidyMapSurfaceState
} from "@/lib/map/wayline-map-models";

type GoogleMapRendererProps = {
  className?: string;
  height?: number | string;
  mapTheme?: "default" | "dark";
  onPinSelect?: (pinId: string) => void;
  surfaceState?: AlmidyMapSurfaceState;
};

const fallbackCenter: AlmidyCoordinate = { lat: 25.7617, lng: -80.1918 };
const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
const mapsConfigured = Boolean(mapsApiKey && !mapsApiKey.startsWith("YOUR_"));

export function GoogleMapRenderer(props: GoogleMapRendererProps) {
  return (
    <GoogleMapsProvider>
      <LoadedGoogleMapRenderer {...props} />
    </GoogleMapsProvider>
  );
}

function LoadedGoogleMapRenderer({
  className,
  height = "100%",
  mapTheme = "default",
  onPinSelect,
  surfaceState
}: GoogleMapRendererProps) {
  const unifiedMap = useOptionalUnifiedMap();
  const activeSurface = surfaceState ?? unifiedMap?.surfaceState;
  const mapRef = useRef<google.maps.Map | null>(null);
  const lastCameraCommandIdRef = useRef<string | null>(null);
  const pins = activeSurface?.pins ?? [];
  const routes = activeSurface?.routes ?? [];
  const routePaths = useMemo(() => routes.map(routePathForRoute).filter(hasRoutePath), [routes]);
  const mapReady =
    typeof window !== "undefined" &&
    typeof window.google?.maps?.Map === "function" &&
    typeof window.google?.maps?.LatLngBounds === "function";
  const center = activeSurface?.camera.center ?? pins[0]?.coordinate ?? routePaths[0]?.[0] ?? fallbackCenter;
  const containerStyle = useMemo(
    () => ({
      height: typeof height === "number" ? `${height}px` : height,
      width: "100%"
    }),
    [height]
  );

  const syncMapCamera = useCallback((map: google.maps.Map) => {
    if (!mapReady) {
      return;
    }

    if (activeSurface?.cameraCommand) {
      applyGoogleCameraCommand(map, activeSurface.cameraCommand);
      lastCameraCommandIdRef.current = activeSurface.cameraCommand.id;
      return;
    }

    const bounds = new window.google.maps.LatLngBounds();
    let pointCount = 0;

    pins.forEach((pin) => {
      bounds.extend(pin.coordinate);
      pointCount += 1;
    });
    routePaths.flat().forEach((point) => {
      bounds.extend(point);
      pointCount += 1;
    });

    if (pointCount > 1) {
      map.fitBounds(bounds, { bottom: 120, left: 64, right: 64, top: 96 });
    } else {
      map.panTo(center);
      map.setZoom(activeSurface?.camera.zoom ?? 10);
    }
  }, [activeSurface?.camera.zoom, activeSurface?.cameraCommand, center, mapReady, pins, routePaths]);

  useEffect(() => {
    if (!mapRef.current) {
      return;
    }

    if (
      activeSurface?.cameraCommand &&
      activeSurface.cameraCommand.id !== lastCameraCommandIdRef.current
    ) {
      applyGoogleCameraCommand(mapRef.current, activeSurface.cameraCommand);
      lastCameraCommandIdRef.current = activeSurface.cameraCommand.id;
      return;
    }

    syncMapCamera(mapRef.current);
  }, [activeSurface?.cameraCommand, syncMapCamera]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !activeSurface?.selectedId) {
      return;
    }

    const selectedPin = pins.find((pin) => pin.id === activeSurface.selectedId);

    if (selectedPin) {
      map.panTo(selectedPin.coordinate);
      map.setZoom(activeSurface.camera.zoom ?? 14);
    }
  }, [activeSurface?.camera.zoom, activeSurface?.selectedId, pins]);

  if (!mapsConfigured) {
    return <MapUnavailable height={height} message="Maps are temporarily unavailable." />;
  }

  if (!mapReady || !activeSurface) {
    return <MapUnavailable height={height} message="Preparing your map." />;
  }

  const googleMaps = window.google.maps;

  return (
    <div
      className={className}
      data-map-mode={activeSurface.mode}
      data-map-renderer="google-map"
      data-map-theme={mapTheme}
      data-selected-map-id={activeSurface.selectedId ?? undefined}
    >
      <GoogleMap
        center={center}
        mapContainerStyle={containerStyle}
        onLoad={(map) => {
          mapRef.current = map;
          syncMapCamera(map);
        }}
        options={{
          backgroundColor: mapTheme === "dark" ? "#07182b" : undefined,
          clickableIcons: true,
          colorScheme: mapTheme === "dark" ? googleMaps.ColorScheme?.DARK : undefined,
          disableDefaultUI: true,
          fullscreenControl: false,
          gestureHandling: "greedy",
          mapTypeId: activeSurface.mode === "satellite" ? "satellite" : undefined,
          streetViewControl: false,
          styles: mapTheme === "dark" ? darkMapStyles : undefined,
          zoomControl: false
        }}
        zoom={activeSurface.camera.zoom ?? 10}
      >
        {routePaths.map((path, index) => (
          <Polyline
            key={routes[index]?.id ?? `route-${index}`}
            path={path}
            options={{
              geodesic: true,
              strokeColor: routes[index]?.selected ? "#f97316" : "#2563eb",
              strokeOpacity: routes[index]?.selected ? 0.92 : 0.78,
              strokeWeight: routes[index]?.selected ? 5 : 4
            }}
          />
        ))}

        {pins.map((pin) => (
          <OverlayView
            key={pin.id}
            mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
            position={pin.coordinate}
          >
            <AlmidyGoogleMapPinMarker
              onSelect={(pinId) => {
                unifiedMap?.selectPin(pinId);
                onPinSelect?.(pinId);
              }}
              pin={pin}
            />
          </OverlayView>
        ))}
      </GoogleMap>
    </div>
  );
}

function routePathForRoute(route: AlmidyMapRoute) {
  if (route.path?.length) {
    return route.path;
  }

  return [route.origin.coordinate, route.destination.coordinate];
}

function hasRoutePath(path: AlmidyCoordinate[]): path is [AlmidyCoordinate, AlmidyCoordinate, ...AlmidyCoordinate[]] {
  return path.length > 1;
}

function applyGoogleCameraCommand(map: google.maps.Map, command: AlmidyMapCameraCommand) {
  const googleMaps = window.google?.maps;
  const coordinates = command.coordinates ?? [];

  if (
    command.type === "focusRoute" ||
    command.type === "zoomToWorld" ||
    coordinates.length > 1
  ) {
    const bounds = googleMaps?.LatLngBounds ? new googleMaps.LatLngBounds() : null;
    coordinates.forEach((coordinate) => bounds?.extend(coordinate));

    if (bounds && coordinates.length > 1) {
      map.fitBounds(bounds, command.padding ?? { bottom: 120, left: 64, right: 64, top: 96 });
    } else {
      map.panTo(command.camera.center);
      map.setZoom(command.camera.zoom ?? (command.type === "zoomToWorld" ? 2 : 10));
    }
  } else {
    map.panTo(command.camera.center);
    map.setZoom(command.camera.zoom ?? 10);
  }

  if (typeof command.camera.tilt === "number") {
    map.setTilt(command.camera.tilt);
  }

  if (typeof command.camera.heading === "number") {
    map.setHeading(command.camera.heading);
  }
}

function MapUnavailable({
  height,
  message
}: {
  height: number | string;
  message: string;
}) {
  return (
    <div
      className="grid place-items-center rounded-3xl bg-slate-950 p-6 text-center text-sm font-bold text-white/70"
      data-map-renderer="google-map"
      style={{ height: typeof height === "number" ? `${height}px` : height }}
    >
      {message}
    </div>
  );
}

const darkMapStyles: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#172033" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#e2e8f0" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#020617" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#334155" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#1f2937" }] },
  { featureType: "road", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#082f49" }] }
];
