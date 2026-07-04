"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { countryCodeToFlag } from "@/lib/map/wayline-map-pins";
import { loadAppleMapKitToken } from "@/lib/map/apple-mapkit-token";
import { useOptionalUnifiedMap } from "@/lib/map/unified-map-provider";
import type {
  AlmidyCoordinate,
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

type MapKitCoordinate = {
  latitude: number;
  longitude: number;
};

type MapKitAnnotation = {
  addEventListener?: (eventName: string, handler: () => void) => void;
  element?: HTMLElement;
  selected?: boolean;
};

type MapKitMap = {
  addAnnotation?: (annotation: MapKitAnnotation) => void;
  addAnnotations?: (annotations: MapKitAnnotation[]) => void;
  annotations?: MapKitAnnotation[];
  center?: MapKitCoordinate;
  destroy?: () => void;
  removeAnnotation?: (annotation: MapKitAnnotation) => void;
  removeAnnotations?: (annotations: MapKitAnnotation[]) => void;
  setRegionAnimated?: (region: unknown, animate?: boolean) => void;
  setCenterAnimated?: (coordinate: MapKitCoordinate, animate?: boolean) => void;
  showAnnotations?: (
    annotations: MapKitAnnotation[],
    options?: { animate?: boolean; padding?: unknown }
  ) => void;
  showItems?: (
    annotations: MapKitAnnotation[],
    options?: { animate?: boolean; padding?: unknown }
  ) => void;
};

type MapKitRuntime = {
  Annotation: new (
    coordinate: MapKitCoordinate,
    elementFactory: () => HTMLElement,
    options?: Record<string, unknown>
  ) => MapKitAnnotation;
  ColorScheme?: {
    Dark?: string;
  };
  Coordinate: new (latitude: number, longitude: number) => MapKitCoordinate;
  CoordinateRegion?: new (
    center: MapKitCoordinate,
    span: { latitudeDelta: number; longitudeDelta: number }
  ) => unknown;
  FeatureVisibility?: {
    Hidden?: string;
  };
  Map: new (container: HTMLElement, options?: Record<string, unknown>) => MapKitMap;
  Padding?: new (top: number, right: number, bottom: number, left: number) => unknown;
  init: (options: { authorizationCallback: (done: (token: string) => void) => void }) => void;
  initialized?: boolean;
};

type MapKitMapConstructor = MapKitRuntime["Map"] & {
  MapTypes?: {
    Hybrid?: string;
    Satellite?: string;
  };
};

declare global {
  interface Window {
    mapkit?: MapKitRuntime;
  }
}

type AppleMapPin = {
  id: string;
  coordinate: AlmidyCoordinate;
  countryCode?: string | null;
  flag: string;
  kind: "trip" | "user-location";
  label: string;
  subtitle?: string | null;
  tripId?: string | null;
};

const APPLE_MAPKIT_SCRIPT_ID = "almidy-apple-mapkit-js";
const APPLE_MAPKIT_SCRIPT_SRC = "https://cdn.apple-mapkit.com/mk/5.x.x/mapkit.js";
const APPLE_MAP_SYSTEM_ID = "almidy-apple-map-system";
const DEFAULT_WORLD_CENTER: AlmidyCoordinate = { lat: 28.5, lng: -81.5 };
const DEFAULT_LOCATION_FLAG = "•";

let mapKitScriptPromise: Promise<void> | null = null;
let mapKitInitialized = false;

export function CustomGlobeRenderer({
  activeTripId,
  className,
  defaultFocusWhenEmpty,
  mapInstanceKey,
  onTripPinSelect,
  selectionRevision,
  showCountryPin = true,
  surfaceState,
  tripPins = [],
  useLocationFocus = true
}: CustomGlobeRendererProps) {
  const unifiedMap = useOptionalUnifiedMap();
  const activeSurface = surfaceState ?? unifiedMap?.surfaceState;
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapKitMap | null>(null);
  const annotationRefs = useRef<MapKitAnnotation[]>([]);
  const [runtimeState, setRuntimeState] = useState<"loading" | "ready" | "error" | "missing-token">("loading");

  const pins = useMemo(
    () => buildAppleMapPins({
      location: activeSurface?.location,
      showCountryPin,
      tripPins,
      useLocationFocus
    }),
    [activeSurface?.location, showCountryPin, tripPins, useLocationFocus]
  );

  const selectedPin = useMemo(
    () =>
      activeTripId
        ? pins.find((pin) => (pin.tripId ?? pin.id) === activeTripId) ?? null
        : null,
    [activeTripId, pins]
  );

  const initializeMapKit = useCallback(async () => {
    try {
      const token = await loadAppleMapKitToken();

      if (!token) {
        setRuntimeState("missing-token");
        return;
      }

      await loadMapKitScript();
      const mapkit = window.mapkit;

      if (!mapkit || !mapContainerRef.current || mapRef.current) {
        setRuntimeState(mapkit ? "ready" : "error");
        return;
      }

      if (!mapKitInitialized) {
        mapkit.init({
          authorizationCallback: (done) => {
            done(token);
          }
        });
        mapKitInitialized = true;
      }

      const initialCenter = new mapkit.Coordinate(DEFAULT_WORLD_CENTER.lat, DEFAULT_WORLD_CENTER.lng);
      const mapConstructor = mapkit.Map as MapKitMapConstructor;
      const mapType = mapConstructor.MapTypes?.Hybrid ?? mapConstructor.MapTypes?.Satellite;
      const initialRegion = mapkit.CoordinateRegion
        ? new mapkit.CoordinateRegion(initialCenter, { latitudeDelta: 90, longitudeDelta: 180 })
        : undefined;
      const map = new mapkit.Map(mapContainerRef.current, {
        center: initialCenter,
        colorScheme: mapkit.ColorScheme?.Dark,
        isRotationEnabled: false,
        mapType,
        region: initialRegion,
        showsCompass: mapkit.FeatureVisibility?.Hidden,
        showsMapTypeControl: false,
        showsScale: mapkit.FeatureVisibility?.Hidden,
        showsUserLocationControl: false,
        showsZoomControl: false
      });

      mapRef.current = map;
      setRuntimeState("ready");
    } catch {
      setRuntimeState("error");
    }
  }, []);

  useEffect(() => {
    void initializeMapKit();

    return () => {
      const map = mapRef.current;
      if (map && annotationRefs.current.length) {
        removeMapAnnotations(map, annotationRefs.current);
      }
      map?.destroy?.();
      mapRef.current = null;
      annotationRefs.current = [];
    };
  }, [initializeMapKit]);

  useEffect(() => {
    const mapkit = window.mapkit;
    const map = mapRef.current;

    if (runtimeState !== "ready" || !mapkit || !map) {
      return;
    }

    removeMapAnnotations(map, annotationRefs.current);

    const annotations = pins.map((pin) =>
      createFlagAnnotation({
        isActive: (pin.tripId ?? pin.id) === activeTripId,
        mapkit,
        onSelect: () => onTripPinSelect?.(pin.tripId ?? pin.id),
        pin
      })
    );

    annotationRefs.current = annotations;
    addMapAnnotations(map, annotations);

    if (selectedPin) {
      map.setCenterAnimated?.(
        new mapkit.Coordinate(selectedPin.coordinate.lat, selectedPin.coordinate.lng),
        true
      );
      return;
    }

    if (annotations.length > 0) {
      const padding = mapkit.Padding ? new mapkit.Padding(80, 44, 260, 44) : undefined;
      if (typeof map.showItems === "function") {
        map.showItems(annotations, { animate: true, padding });
      } else {
        map.showAnnotations?.(annotations, { animate: true, padding });
      }
      return;
    }

    const center = DEFAULT_WORLD_CENTER;
    map.setCenterAnimated?.(new mapkit.Coordinate(center.lat, center.lng), false);
  }, [activeTripId, onTripPinSelect, pins, runtimeState, selectedPin, selectionRevision]);

  if (runtimeState === "missing-token") {
    return (
      <AppleMapFallback
        className={className}
        mapInstanceKey={mapInstanceKey}
        message="Apple Maps is not configured for this environment."
        state="missing-token"
      />
    );
  }

  return (
    <div
      className={["absolute inset-0 overflow-hidden bg-[#16202c]", className].filter(Boolean).join(" ")}
      data-map-instance-key={mapInstanceKey}
      data-map-mode={activeSurface?.mode ?? (defaultFocusWhenEmpty ? "launch-globe" : "country-map")}
      data-map-renderer="apple-mapkit"
      data-map-runtime={runtimeState}
      data-map-system={APPLE_MAP_SYSTEM_ID}
      data-selected-map-id={activeTripId ?? activeSurface?.selectedId ?? undefined}
    >
      <div ref={mapContainerRef} className="absolute inset-0 h-full w-full" />
      {runtimeState === "loading" ? (
        <div className="absolute inset-0 grid place-items-center text-center text-xs font-bold uppercase tracking-[0.22em] text-white/52">
          Preparing Apple Maps
        </div>
      ) : null}
      {runtimeState === "error" ? (
        <AppleMapFallback
          className="absolute inset-0"
          mapInstanceKey={mapInstanceKey}
          message="Apple Maps is temporarily unavailable."
          state="runtime-error"
        />
      ) : null}
    </div>
  );
}

function loadMapKitScript() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("MapKit is browser-only."));
  }

  if (window.mapkit) {
    return Promise.resolve();
  }

  if (mapKitScriptPromise) {
    return mapKitScriptPromise;
  }

  mapKitScriptPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.getElementById(APPLE_MAPKIT_SCRIPT_ID) as HTMLScriptElement | null;

    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener("error", () => reject(new Error("MapKit script failed.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.async = true;
    script.crossOrigin = "anonymous";
    script.id = APPLE_MAPKIT_SCRIPT_ID;
    script.src = APPLE_MAPKIT_SCRIPT_SRC;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("MapKit script failed."));
    document.head.appendChild(script);
  });

  return mapKitScriptPromise;
}

function buildAppleMapPins({
  location,
  showCountryPin,
  tripPins,
  useLocationFocus
}: {
  location?: AlmidyMapSurfaceState["location"];
  showCountryPin: boolean;
  tripPins: AlmidyLaunchGlobeTripPin[];
  useLocationFocus: boolean;
}) {
  const pins = tripPins
    .map(toAppleTripPin)
    .filter((pin): pin is AppleMapPin => Boolean(pin));

  if (
    showCountryPin &&
    useLocationFocus &&
    location?.source === "browser" &&
    location.coordinate
  ) {
    pins.unshift({
      coordinate: location.coordinate,
      countryCode: location.countryCode,
      flag: location.countryCode ? countryCodeToFlag(location.countryCode) ?? DEFAULT_LOCATION_FLAG : DEFAULT_LOCATION_FLAG,
      id: "browser-location",
      kind: "user-location",
      label: location.city || location.countryName || "Current location",
      subtitle: location.countryName ?? null
    });
  }

  return pins;
}

function toAppleTripPin(pin: AlmidyLaunchGlobeTripPin): AppleMapPin | null {
  const lat = Number(pin.lat);
  const lng = Number(pin.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return {
    coordinate: { lat, lng },
    countryCode: pin.countryCode,
    flag: pin.flag || countryCodeToFlag(pin.countryCode) || DEFAULT_LOCATION_FLAG,
    id: pin.id,
    kind: "trip",
    label: pin.label,
    subtitle: pin.subtitle,
    tripId: pin.tripId
  };
}

function createFlagAnnotation({
  isActive,
  mapkit,
  onSelect,
  pin
}: {
  isActive: boolean;
  mapkit: MapKitRuntime;
  onSelect: () => void;
  pin: AppleMapPin;
}) {
  const coordinate = new mapkit.Coordinate(pin.coordinate.lat, pin.coordinate.lng);
  const annotation = new mapkit.Annotation(
    coordinate,
    () => createFlagAnnotationElement({ isActive, onSelect, pin }),
    {
      anchorOffset: new DOMPoint(0, -42),
      clusteringIdentifier: pin.kind === "trip" ? "almidy-trip" : undefined,
      data: pin,
      selected: isActive,
      title: pin.label
    }
  );

  annotation.addEventListener?.("select", onSelect);
  annotation.selected = isActive;
  return annotation;
}

function createFlagAnnotationElement({
  isActive,
  onSelect,
  pin
}: {
  isActive: boolean;
  onSelect: () => void;
  pin: AppleMapPin;
}) {
  const tripId = pin.tripId ?? pin.id;
  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute("aria-label", `Select ${pin.label}`);
  button.dataset.active = isActive ? "true" : "false";
  button.dataset.almidyMarkerKind = pin.kind;
  button.dataset.countryCode = pin.countryCode ?? "";
  button.dataset.pinLatitude = pin.coordinate.lat.toFixed(5);
  button.dataset.pinLongitude = pin.coordinate.lng.toFixed(5);
  button.dataset.testid = pin.kind === "trip" ? "mobile-trips-globe-flag-pin" : "mobile-current-location-pin";
  button.dataset.tripId = tripId;
  button.style.pointerEvents = "auto";
  button.className = [
    "group pointer-events-auto flex -translate-x-1/2 -translate-y-full touch-manipulation flex-col items-center overflow-visible text-center focus:outline-none",
    isActive ? "z-50" : "z-40"
  ].join(" ");

  const flag = document.createElement("span");
  flag.setAttribute("aria-hidden", "true");
  flag.className = [
    "grid h-11 w-11 place-items-center overflow-hidden rounded-full border-[2.5px] bg-white text-2xl leading-none shadow-[0_4px_0_rgba(0,0,0,0.95),0_10px_24px_rgba(0,0,0,0.36)] transition duration-200",
    isActive ? "scale-125 border-orange-500 ring-4 ring-orange-400/60" : "border-black ring-1 ring-white/75"
  ].join(" ");
  flag.textContent = pin.flag;

  const label = document.createElement("span");
  label.className = [
    "mt-1 block max-w-28 truncate rounded px-1.5 py-0.5 text-[0.72rem] font-black leading-none [text-shadow:0_2px_2px_rgba(0,0,0,0.95),0_0_8px_rgba(0,0,0,0.85)]",
    isActive ? "bg-orange-600 text-white" : "bg-black/56 text-white"
  ].join(" ");
  label.textContent = pin.label;

  button.append(flag, label);
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    onSelect();
  });

  return button;
}

function addMapAnnotations(map: MapKitMap, annotations: MapKitAnnotation[]) {
  if (annotations.length === 0) return;

  if (typeof map.addAnnotations === "function") {
    map.addAnnotations(annotations);
    return;
  }

  annotations.forEach((annotation) => map.addAnnotation?.(annotation));
}

function removeMapAnnotations(map: MapKitMap, annotations: MapKitAnnotation[]) {
  if (annotations.length === 0) return;

  if (typeof map.removeAnnotations === "function") {
    map.removeAnnotations(annotations);
    return;
  }

  annotations.forEach((annotation) => map.removeAnnotation?.(annotation));
}

function AppleMapFallback({
  className,
  mapInstanceKey,
  message,
  state
}: {
  className?: string;
  mapInstanceKey?: string;
  message: string;
  state: string;
}) {
  return (
    <div
      className={[
        "absolute inset-0 grid place-items-center bg-[#16202c] px-8 text-center text-xs font-bold uppercase tracking-[0.18em] text-white/56",
        className
      ].filter(Boolean).join(" ")}
      data-map-instance-key={mapInstanceKey}
      data-map-renderer="apple-mapkit"
      data-map-runtime={state}
      data-map-system={APPLE_MAP_SYSTEM_ID}
      data-testid="almidy-apple-map-preflight"
    >
      {message}
    </div>
  );
}
