"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw, TriangleAlert, WifiOff } from "lucide-react";
import { useOptionalMobileGlobeWallet } from "@/components/dashboard/mobile-globe-wallet-shell";
import { countryCodeToFlag } from "@/lib/map/wayline-map-pins";
import {
  clearAppleMapKitTokenCache,
  loadAppleMapKitToken
} from "@/lib/map/apple-mapkit-token";
import { isNativeCapacitorRuntime } from "@/lib/native/capacitor-runtime";
import { useOptionalUnifiedMap } from "@/lib/map/unified-map-provider";
import type {
  AlmidyCoordinate,
  AlmidyLaunchGlobeTripPin,
  AlmidyMapPin,
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
  setCameraDistanceAnimated?: (distance: number, animate?: boolean) => void;
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
    span: unknown
  ) => unknown;
  CoordinateSpan?: new (latitudeDelta: number, longitudeDelta: number) => unknown;
  FeatureVisibility?: {
    Hidden?: string;
  };
  Map: new (container: HTMLElement, options?: Record<string, unknown>) => MapKitMap;
  Padding?: new (top: number, right: number, bottom: number, left: number) => unknown;
  addEventListener?: (eventName: string, handler: (event: MapKitConfigurationErrorEvent) => void) => boolean | void;
  init: (options: { authorizationCallback: (done: (token: string) => void) => void }) => void;
  initialized?: boolean;
  removeEventListener?: (eventName: string, handler: (event: MapKitConfigurationErrorEvent) => void) => boolean | void;
};

type MapKitConfigurationErrorEvent = {
  status?: string | null;
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
  kind: "activity" | "idea" | "place" | "route" | "transport" | "trip" | "user-location";
  label: string;
  subtitle?: string | null;
  tripId?: string | null;
};

type AppleMapRuntimeState = "loading" | "ready" | "offline" | "error" | "missing-token";
type MapRendererTarget = "checking" | "native" | "web";

const APPLE_MAPKIT_SCRIPT_ID = "almidy-apple-mapkit-js";
const APPLE_MAPKIT_SCRIPT_SRC = "https://cdn.apple-mapkit.com/mk/5.x.x/mapkit.js";
const APPLE_MAPKIT_SCRIPT_TIMEOUT_MS = 15_000;
const APPLE_MAP_SYSTEM_ID = "almidy-apple-map-system";
const APPLE_MAPKIT_LOG_PREFIX = "ALMIDY MAPKIT";
const APPLE_WORLD_CAMERA_DISTANCE_METERS = 10_000_000;
const APPLE_MAP_FOCUS_DISTANCE_METERS = 2_600_000;
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
  const mobileGlobeWallet = useOptionalMobileGlobeWallet();
  const nativeSyncPayload = mobileGlobeWallet?.walletRouteSync.currentPayload ?? null;
  const activeSurface = surfaceState ?? unifiedMap?.surfaceState;
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapKitMap | null>(null);
  const annotationRefs = useRef<MapKitAnnotation[]>([]);
  const initializationGenerationRef = useRef(0);
  const mapKitRuntimeRef = useRef<MapKitRuntime | null>(null);
  const runtimeStateRef = useRef<AppleMapRuntimeState>("loading");
  const [runtimeState, setRuntimeState] = useState<AppleMapRuntimeState>("loading");
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [retryRevision, setRetryRevision] = useState(0);
  const [rendererTarget, setRendererTarget] = useState<MapRendererTarget>("checking");

  useEffect(() => {
    setRendererTarget(isNativeCapacitorRuntime() ? "native" : "web");
  }, []);

  const pins = useMemo(
    () => buildAppleMapPins({
      location: activeSurface?.location,
      showCountryPin,
      surfacePins: activeSurface?.pins ?? [],
      tripPins,
      useLocationFocus
    }),
    [activeSurface?.location, activeSurface?.pins, showCountryPin, tripPins, useLocationFocus]
  );

  const selectedMapId = activeTripId ?? activeSurface?.selectedId ?? null;
  const mapMode = activeSurface?.mode ?? (defaultFocusWhenEmpty ? "launch-globe" : "country-map");
  const usesWorldCamera = defaultFocusWhenEmpty || mapMode === "globe" || mapMode === "launch-globe";
  const selectedPin = useMemo(
    () =>
      selectedMapId
        ? pins.find((pin) => pin.id === selectedMapId || pin.tripId === selectedMapId) ?? null
        : null,
    [pins, selectedMapId]
  );

  const transitionRuntime = useCallback((state: AppleMapRuntimeState, message?: string | null) => {
    runtimeStateRef.current = state;
    setRuntimeState(state);
    setRuntimeError(message ?? null);
  }, []);

  const handleMapKitConfigurationError = useCallback((event: MapKitConfigurationErrorEvent) => {
    const status = event.status?.trim() || "Unknown";

    if (!navigator.onLine) {
      transitionRuntime("offline", "Reconnect to restore the interactive Apple map.");
      return;
    }

    console.error(`${APPLE_MAPKIT_LOG_PREFIX} CONFIGURATION FAILED:`, { status });
    transitionRuntime("error", mapKitErrorMessage(status));
  }, [transitionRuntime]);

  const initializeMapKit = useCallback(async (generation: number) => {
    const isCurrentGeneration = () => initializationGenerationRef.current === generation;

    if (rendererTarget !== "web") {
      return;
    }

    if (!navigator.onLine) {
      if (isCurrentGeneration()) {
        transitionRuntime("offline", "Reconnect to restore the interactive Apple map.");
      }
      return;
    }

    try {
      const rawToken = await loadAppleMapKitToken();
      if (!isCurrentGeneration()) return;
      const token = sanitizeRuntimeMapKitToken(rawToken ?? "");

      if (!token) {
        if (!navigator.onLine) {
          transitionRuntime("offline", "Reconnect to restore the interactive Apple map.");
          return;
        }
        console.error(`${APPLE_MAPKIT_LOG_PREFIX} TOKEN MISSING: /api/mapkit-token returned no usable token.`);
        transitionRuntime("missing-token", "Apple Maps authorization is unavailable in this environment.");
        return;
      }

      if (rawToken && rawToken !== token) {
        console.error(`${APPLE_MAPKIT_LOG_PREFIX} TOKEN SANITIZED: token contained wrapping quotes, spaces, or newline characters.`);
      }

      await loadMapKitScript();
      if (!isCurrentGeneration()) return;
      const mapkit = window.mapkit;

      if (!mapkit) {
        console.error(`${APPLE_MAPKIT_LOG_PREFIX} SCRIPT READY WITHOUT RUNTIME: window.mapkit was unavailable after script load.`);
        transitionRuntime("error", "The Apple Maps library did not finish loading.");
        return;
      }

      mapKitRuntimeRef.current?.removeEventListener?.("error", handleMapKitConfigurationError);
      mapkit.removeEventListener?.("error", handleMapKitConfigurationError);
      mapkit.addEventListener?.("error", handleMapKitConfigurationError);
      mapKitRuntimeRef.current = mapkit;

      if (!mapContainerRef.current || mapRef.current) {
        transitionRuntime("ready");
        return;
      }

      if (!mapKitInitialized) {
        mapkit.init({
          authorizationCallback: (done) => {
            done(token);
          }
        });
      }
      mapKitInitialized = true;

      const initialCenter = new mapkit.Coordinate(DEFAULT_WORLD_CENTER.lat, DEFAULT_WORLD_CENTER.lng);
      const mapConstructor = mapkit.Map as MapKitMapConstructor;
      const mapType = mapConstructor.MapTypes?.Hybrid ?? mapConstructor.MapTypes?.Satellite;
      const mapOptions: Record<string, unknown> = {
        center: initialCenter,
        colorScheme: mapkit.ColorScheme?.Dark,
        isRotationEnabled: true,
        showsCompass: mapkit.FeatureVisibility?.Hidden,
        showsMapTypeControl: false,
        showsScale: mapkit.FeatureVisibility?.Hidden,
        showsUserLocationControl: false,
        showsZoomControl: false
      };

      if (mapType) {
        mapOptions.mapType = mapType;
      }

      if (usesWorldCamera) {
        mapOptions.cameraDistance = APPLE_WORLD_CAMERA_DISTANCE_METERS;
      }

      const map = createMapKitMap(mapkit, mapContainerRef.current, mapOptions);

      if (usesWorldCamera) {
        map.setCameraDistanceAnimated?.(APPLE_WORLD_CAMERA_DISTANCE_METERS, false);
      }

      mapRef.current = map;
      transitionRuntime("ready");
    } catch (initError) {
      if (!isCurrentGeneration()) return;
      if (!navigator.onLine) {
        transitionRuntime("offline", "Reconnect to restore the interactive Apple map.");
        return;
      }
      console.error(`${APPLE_MAPKIT_LOG_PREFIX} CONTEXT CRASH:`, initError);
      transitionRuntime("error", "Apple Maps could not start. Check the connection and try again.");
    }
  }, [handleMapKitConfigurationError, rendererTarget, transitionRuntime, usesWorldCamera]);

  useEffect(() => {
    const generation = initializationGenerationRef.current + 1;
    initializationGenerationRef.current = generation;
    void initializeMapKit(generation);

    return () => {
      if (initializationGenerationRef.current === generation) {
        initializationGenerationRef.current += 1;
      }
      mapKitRuntimeRef.current?.removeEventListener?.("error", handleMapKitConfigurationError);
      mapKitRuntimeRef.current = null;
      const map = mapRef.current;
      if (map && annotationRefs.current.length) {
        removeMapAnnotations(map, annotationRefs.current);
      }
      map?.destroy?.();
      mapRef.current = null;
      annotationRefs.current = [];
    };
  }, [handleMapKitConfigurationError, initializeMapKit, retryRevision]);

  useEffect(() => {
    const goOffline = () => {
      transitionRuntime("offline", "Reconnect to restore the interactive Apple map.");
    };
    const goOnline = () => {
      if (runtimeStateRef.current !== "offline") return;
      transitionRuntime("loading");
      setRetryRevision((revision) => revision + 1);
    };

    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);

    if (!navigator.onLine) {
      goOffline();
    }

    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, [transitionRuntime]);

  const retryMapKit = useCallback(() => {
    if (!navigator.onLine) {
      transitionRuntime("offline", "Reconnect to restore the interactive Apple map.");
      return;
    }

    clearAppleMapKitTokenCache();
    mapKitInitialized = false;
    transitionRuntime("loading");
    setRetryRevision((revision) => revision + 1);
  }, [transitionRuntime]);

  useEffect(() => {
    const mapkit = window.mapkit;
    const map = mapRef.current;

    if (runtimeState !== "ready" || !mapkit || !map) {
      return;
    }

    removeMapAnnotations(map, annotationRefs.current);

    const annotations = pins.map((pin) =>
      createFlagAnnotation({
        isActive: Boolean(selectedMapId && (pin.id === selectedMapId || pin.tripId === selectedMapId)),
        mapkit,
        onSelect: () => onTripPinSelect?.(pin.tripId ?? pin.id),
        pin
      })
    );

    annotationRefs.current = annotations;
    addMapAnnotations(map, annotations);

    if (selectedPin) {
      const center = new mapkit.Coordinate(selectedPin.coordinate.lat, selectedPin.coordinate.lng);

      if (selectedPin.kind === "activity") {
        const region = buildMapKitCoordinateRegion(mapkit, center, 0.012, 0.012);
        if (region && typeof map.setRegionAnimated === "function") {
          map.setRegionAnimated(region, true);
          return;
        }
      }

      map.setCenterAnimated?.(center, true);
      map.setCameraDistanceAnimated?.(
        activeSurface?.camera.rangeMeters ?? APPLE_MAP_FOCUS_DISTANCE_METERS,
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
      if (usesWorldCamera) {
        map.setCameraDistanceAnimated?.(APPLE_WORLD_CAMERA_DISTANCE_METERS, true);
      }
      return;
    }

    const center = DEFAULT_WORLD_CENTER;
    map.setCenterAnimated?.(new mapkit.Coordinate(center.lat, center.lng), false);
    if (usesWorldCamera) {
      map.setCameraDistanceAnimated?.(APPLE_WORLD_CAMERA_DISTANCE_METERS, false);
    }
  }, [activeSurface?.camera.rangeMeters, onTripPinSelect, pins, runtimeState, selectedMapId, selectedPin, selectionRevision, usesWorldCamera]);

  useEffect(() => {
    const mapkit = window.mapkit;
    const map = mapRef.current;
    if (runtimeState !== "ready" || !mapkit || !map || !nativeSyncPayload) {
      return;
    }

    map.setCenterAnimated?.(
      new mapkit.Coordinate(
        nativeSyncPayload.camera.center.lat,
        nativeSyncPayload.camera.center.lng
      ),
      true
    );
    map.setCameraDistanceAnimated?.(nativeSyncPayload.camera.altitude, true);
  }, [nativeSyncPayload, runtimeState]);

  if (rendererTarget !== "web") {
    return (
      <div
        aria-hidden="true"
        className={["pointer-events-none absolute inset-0 h-full w-full bg-transparent", className]
          .filter(Boolean)
          .join(" ")}
        data-map-instance-key={mapInstanceKey}
        data-map-presentation="native-apple-globe"
        data-map-renderer="native-mapkit-underlay"
        data-map-runtime={rendererTarget}
        data-map-system={APPLE_MAP_SYSTEM_ID}
        data-testid="native-mapkit-underlay-host"
      />
    );
  }

  if (runtimeState === "missing-token") {
    return (
      <AppleMapFallback
        className={className}
        mapInstanceKey={mapInstanceKey}
        message={runtimeError ?? "Apple Maps is not configured for this environment."}
        onRetry={retryMapKit}
        state="missing-token"
        title="Apple Maps unavailable"
      />
    );
  }

  return (
    <div
      className={["absolute inset-0 overflow-hidden bg-[#16202c]", className].filter(Boolean).join(" ")}
      data-map-instance-key={mapInstanceKey}
      data-map-mode={mapMode}
      data-map-presentation="apple-map"
      data-map-projection="mercator"
      data-map-renderer="apple-mapkit"
      data-map-runtime={runtimeState}
      data-map-system={APPLE_MAP_SYSTEM_ID}
      data-selected-map-id={selectedMapId ?? undefined}
      data-wallet-route-id={mobileGlobeWallet?.selection.routeId ?? undefined}
      data-wallet-trip-id={mobileGlobeWallet?.selection.tripId ?? undefined}
    >
      <div className="absolute inset-0 h-full w-full">
        <div ref={mapContainerRef} className="absolute inset-0 h-full w-full" />
      </div>
      {runtimeState === "loading" ? (
        <div className="absolute inset-0 grid place-items-center text-center text-xs font-bold uppercase tracking-[0.22em] text-white/52">
          Preparing Apple Maps
        </div>
      ) : null}
      {runtimeState === "error" ? (
        <AppleMapFallback
          className="absolute inset-0"
          mapInstanceKey={mapInstanceKey}
          message={runtimeError ?? "Apple Maps is temporarily unavailable."}
          onRetry={retryMapKit}
          state="runtime-error"
          title="Map loading failed"
        />
      ) : null}
      {runtimeState === "offline" ? (
        <AppleMapFallback
          className="absolute inset-0"
          mapInstanceKey={mapInstanceKey}
          message={runtimeError ?? "Reconnect to restore the interactive Apple map."}
          state="offline"
          title="You are offline"
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

  const scriptPromise = new Promise<void>((resolve, reject) => {
    let script = document.getElementById(APPLE_MAPKIT_SCRIPT_ID) as HTMLScriptElement | null;

    if (script) {
      if (script.dataset.mapkitLoadState === "failed") {
        disposeMapKitScript(script, true);
        script = null;
      } else {
        script.crossOrigin = "anonymous";
        script.setAttribute("crossorigin", "anonymous");

        if (script.dataset.mapkitLoadState === "loaded") {
          if (window.mapkit) {
            resolve();
            return;
          }

          script.dataset.mapkitLoadState = "failed";
          disposeMapKitScript(script, true);
          reject(new Error("MapKit script loaded without exposing window.mapkit."));
          return;
        }
      }
    }

    const targetScript = script ?? document.createElement("script");
    const cleanupListeners = () => {
      window.clearTimeout(timeoutId);
      targetScript.removeEventListener("load", handleLoad);
      targetScript.removeEventListener("error", handleError);
    };
    const handleLoad = () => {
      cleanupListeners();
      targetScript.dataset.mapkitLoadState = "loaded";
      resolve();
    };
    const handleError = () => {
      cleanupListeners();
      targetScript.dataset.mapkitLoadState = "failed";
      console.error(`${APPLE_MAPKIT_LOG_PREFIX} SCRIPT LOAD FAILED`, { src: APPLE_MAPKIT_SCRIPT_SRC });
      disposeMapKitScript(targetScript, true);
      reject(new Error("MapKit script failed."));
    };
    const timeoutId = window.setTimeout(() => {
      cleanupListeners();
      targetScript.dataset.mapkitLoadState = "failed";
      disposeMapKitScript(targetScript, true);
      reject(new Error("MapKit script load timed out."));
    }, APPLE_MAPKIT_SCRIPT_TIMEOUT_MS);

    targetScript.addEventListener("load", handleLoad, { once: true });
    targetScript.addEventListener("error", handleError, { once: true });

    if (!script) {
      targetScript.async = true;
      targetScript.crossOrigin = "anonymous";
      targetScript.setAttribute("crossorigin", "anonymous");
      targetScript.id = APPLE_MAPKIT_SCRIPT_ID;
      targetScript.src = APPLE_MAPKIT_SCRIPT_SRC;
      targetScript.dataset.mapkitLoadState = "loading";
      document.head.appendChild(targetScript);
    }
  });

  mapKitScriptPromise = scriptPromise;
  void scriptPromise.catch(() => {
    if (mapKitScriptPromise === scriptPromise) {
      mapKitScriptPromise = null;
    }
  });

  return scriptPromise;
}

function disposeMapKitScript(script: HTMLScriptElement, removeFromDocument: boolean) {
  script.onload = null;
  script.onerror = null;
  if (removeFromDocument) {
    script.remove();
  }
}

function sanitizeRuntimeMapKitToken(value: string) {
  return value
    .replace(/\\n/g, "")
    .replace(/[\r\n\t ]+/g, "")
    .replace(/^["']+|["']+$/g, "")
    .trim();
}

function mapKitErrorMessage(status: string) {
  if (status === "Unauthorized") {
    return "Apple Maps authorization expired. Try again to request a fresh token.";
  }

  if (status === "Too Many Requests") {
    return "Apple Maps is temporarily at capacity. Please try again shortly.";
  }

  if (status === "Network Error" || status === "Timeout") {
    return "Apple Maps could not reach the network. Check the connection and try again.";
  }

  if (status === "Bad Request" || status === "Malformed Response") {
    return "Apple Maps returned an invalid configuration response.";
  }

  return "Apple Maps could not initialize. Please try again.";
}

function buildMapKitCoordinateRegion(
  mapkit: MapKitRuntime,
  center: MapKitCoordinate,
  latitudeDelta: number,
  longitudeDelta: number
) {
  if (!mapkit.CoordinateRegion || !mapkit.CoordinateSpan) {
    return undefined;
  }

  try {
    return new mapkit.CoordinateRegion(
      center,
      new mapkit.CoordinateSpan(latitudeDelta, longitudeDelta)
    );
  } catch (regionError) {
    console.error(`${APPLE_MAPKIT_LOG_PREFIX} REGION BUILD FAILED:`, regionError);
    return undefined;
  }
}

function createMapKitMap(
  mapkit: MapKitRuntime,
  container: HTMLElement,
  options: Record<string, unknown>
) {
  try {
    return new mapkit.Map(container, options);
  } catch (mapError) {
    console.error(`${APPLE_MAPKIT_LOG_PREFIX} MAP CONSTRUCTION FAILED WITH SATELLITE OPTIONS:`, mapError);
    const fallbackOptions = { ...options };
    delete fallbackOptions.mapType;
    delete fallbackOptions.region;
    return new mapkit.Map(container, fallbackOptions);
  }
}

function buildAppleMapPins({
  location,
  showCountryPin,
  surfacePins,
  tripPins,
  useLocationFocus
}: {
  location?: AlmidyMapSurfaceState["location"];
  showCountryPin: boolean;
  surfacePins: AlmidyMapPin[];
  tripPins: AlmidyLaunchGlobeTripPin[];
  useLocationFocus: boolean;
}) {
  const pins = surfacePins
    .map(toAppleSurfacePin)
    .filter((pin): pin is AppleMapPin => Boolean(pin));

  const tripFlagPins = tripPins
    .map(toAppleTripPin)
    .filter((pin): pin is AppleMapPin => Boolean(pin));
  const existingIds = new Set(pins.map((pin) => pin.id));
  tripFlagPins.forEach((pin) => {
    if (!existingIds.has(pin.id)) {
      pins.push(pin);
    }
  });

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

function toAppleSurfacePin(pin: AlmidyMapPin): AppleMapPin | null {
  if (!Number.isFinite(pin.coordinate.lat) || !Number.isFinite(pin.coordinate.lng)) {
    return null;
  }

  return {
    coordinate: pin.coordinate,
    countryCode: pin.countryCode,
    flag: pin.flag || flagForMapPin(pin),
    id: pin.id,
    kind: appleKindForMapPin(pin),
    label: pin.label,
    subtitle: pin.subtitle ?? pin.address ?? null,
    tripId: pin.tripId
  };
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
    kind: pin.id.startsWith("activity-") ? "activity" : "trip",
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
  button.dataset.testid =
    pin.kind === "trip"
      ? "mobile-trips-globe-flag-pin"
      : pin.kind === "activity"
        ? "mobile-trips-globe-activity-pin"
        : "mobile-current-location-pin";
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

function appleKindForMapPin(pin: AlmidyMapPin): AppleMapPin["kind"] {
  if (pin.kind === "route-endpoint" || pin.kind === "route-waypoint") {
    return "route";
  }

  if (pin.kind === "transport") {
    return "transport";
  }

  if (pin.kind === "idea") {
    return "idea";
  }

  if (pin.kind === "user-location") {
    return "user-location";
  }

  return pin.kind === "trip" || pin.kind === "country" ? "trip" : "place";
}

function flagForMapPin(pin: AlmidyMapPin) {
  if (pin.kind === "transport") return "✈";
  if (pin.kind === "route-endpoint" || pin.kind === "route-waypoint") return "•";
  if (pin.kind === "place" || pin.kind === "idea") return "⌖";
  if (pin.countryCode) return countryCodeToFlag(pin.countryCode) ?? DEFAULT_LOCATION_FLAG;
  return DEFAULT_LOCATION_FLAG;
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
  onRetry,
  state,
  title
}: {
  className?: string;
  mapInstanceKey?: string;
  message: string;
  onRetry?: () => void;
  state: string;
  title: string;
}) {
  const isOffline = state === "offline";
  const StatusIcon = isOffline ? WifiOff : TriangleAlert;

  return (
    <div
      className={[
        "absolute inset-0 isolate overflow-hidden bg-[#05080d] px-8 text-center text-white",
        className
      ].filter(Boolean).join(" ")}
      data-map-instance-key={mapInstanceKey}
      data-map-renderer="apple-mapkit"
      data-map-runtime={state}
      data-map-system={APPLE_MAP_SYSTEM_ID}
      data-testid="almidy-apple-map-fallback"
    >
      <Image
        alt=""
        aria-hidden="true"
        className="absolute left-1/2 top-[8%] -z-10 h-auto w-[178vw] max-w-[62rem] -translate-x-1/2 opacity-42 grayscale-[0.2]"
        height={820}
        loading="eager"
        sizes="(max-width: 1023px) 178vw, 62rem"
        src="/globe/wayline-earth-3d-fallback.png"
        width={1200}
      />
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(5,8,13,0.18),rgba(5,8,13,0.58)_52%,rgba(5,8,13,0.96)_100%)]" />
      <div className="absolute inset-x-8 top-[18%] mx-auto flex max-w-sm flex-col items-center">
        <StatusIcon aria-hidden="true" className="mb-4 h-7 w-7 text-white/72" strokeWidth={1.8} />
        <h2 className="text-lg font-bold text-white">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-white/62">{message}</p>
        {onRetry ? (
          <button
            className="mt-5 inline-flex h-11 items-center gap-2 rounded-full border border-white/16 bg-white px-5 text-sm font-bold text-black shadow-lg transition hover:bg-white/90 focus:outline-none focus:ring-4 focus:ring-orange-400/30"
            onClick={onRetry}
            type="button"
          >
            <RotateCcw aria-hidden="true" className="h-4 w-4" />
            Try again
          </button>
        ) : null}
      </div>
    </div>
  );
}
