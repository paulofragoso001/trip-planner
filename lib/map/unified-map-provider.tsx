"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode
} from "react";
import type {
  WaylineCoordinate,
  WaylineLocationState,
  WaylineMapCamera,
  WaylineMapMode,
  WaylineMapPin,
  WaylineMapRoute,
  WaylineMapSelection,
  WaylineMapSurfaceState
} from "@/lib/map/wayline-map-models";

export type LocationRequestState = "idle" | "loading" | "ready" | "error";

export type FocusTarget = {
  coordinate: WaylineCoordinate;
  id?: string | null;
  label?: string | null;
  placeId?: string | null;
  tripId?: string | null;
  zoom?: number | null;
};

export type UnifiedMapProviderProps = {
  children: ReactNode;
  initialCamera?: WaylineMapCamera;
  initialLocation?: WaylineLocationState;
  initialMode?: WaylineMapMode;
  initialPins?: WaylineMapPin[];
  initialRoutes?: WaylineMapRoute[];
};

export type UnifiedMapContextValue = {
  camera: WaylineMapCamera;
  location: WaylineLocationState;
  locationError: string | null;
  locationStatus: LocationRequestState;
  mode: WaylineMapMode;
  pins: WaylineMapPin[];
  routes: WaylineMapRoute[];
  selected: WaylineMapSelection;
  surfaceState: WaylineMapSurfaceState;
  clearSelection: () => void;
  focusPlace: (place: FocusTarget) => void;
  focusTrip: (trip: FocusTarget) => void;
  locateUser: () => Promise<WaylineLocationState>;
  openMap: (mode?: WaylineMapMode) => void;
  selectPin: (pinId: string | null) => void;
  setCamera: (camera: WaylineMapCamera) => void;
  setMode: (mode: WaylineMapMode) => void;
  setPins: (pins: WaylineMapPin[]) => void;
  setRoutes: (routes: WaylineMapRoute[]) => void;
};

const DEFAULT_CAMERA: WaylineMapCamera = {
  center: { lat: 25.7617, lng: -80.1918 },
  intent: "world",
  rangeMeters: 5_000_000,
  tilt: 35,
  zoom: 3
};

const DEFAULT_LOCATION: WaylineLocationState = {
  coordinate: null,
  permission: "unknown",
  source: "fallback"
};

const DEFAULT_SELECTION: WaylineMapSelection = {
  pinId: null,
  placeId: null,
  tripId: null
};

const UnifiedMapContext = createContext<UnifiedMapContextValue | null>(null);

export function UnifiedMapProvider({
  children,
  initialCamera = DEFAULT_CAMERA,
  initialLocation = DEFAULT_LOCATION,
  initialMode = "globe",
  initialPins = [],
  initialRoutes = []
}: UnifiedMapProviderProps) {
  const [camera, updateCamera] = useState<WaylineMapCamera>(initialCamera);
  const [location, updateLocation] = useState<WaylineLocationState>(initialLocation);
  const [locationError, setLocationError] = useState<string | null>(initialLocation.error ?? null);
  const [locationStatus, setLocationStatus] = useState<LocationRequestState>(
    initialLocation.coordinate ? "ready" : "idle"
  );
  const [mode, setMode] = useState<WaylineMapMode>(initialMode);
  const [pins, setPins] = useState<WaylineMapPin[]>(initialPins);
  const [routes, setRoutes] = useState<WaylineMapRoute[]>(initialRoutes);
  const [selected, setSelected] = useState<WaylineMapSelection>(DEFAULT_SELECTION);

  const setCamera = useCallback((nextCamera: WaylineMapCamera) => {
    updateCamera(nextCamera);
  }, []);

  const selectPin = useCallback((pinId: string | null) => {
    const pin = pinId ? pins.find((candidate) => candidate.id === pinId) : null;
    setSelected({
      pinId,
      placeId: pin?.kind === "place" || pin?.kind === "idea" ? pin.id : pin?.providerPlaceId ?? null,
      tripId: pin?.tripId ?? null
    });
    setPins((currentPins) =>
      currentPins.map((candidate) => ({
        ...candidate,
        selected: candidate.id === pinId
      }))
    );
  }, [pins]);

  const clearSelection = useCallback(() => {
    setSelected(DEFAULT_SELECTION);
    setPins((currentPins) =>
      currentPins.map((pin) => ({
        ...pin,
        selected: false
      }))
    );
  }, []);

  const focusTrip = useCallback((trip: FocusTarget) => {
    setSelected({
      pinId: trip.id ?? null,
      placeId: trip.placeId ?? null,
      tripId: trip.tripId ?? trip.id ?? null
    });
    updateCamera({
      center: trip.coordinate,
      intent: "trip",
      selectedId: trip.tripId ?? trip.id ?? null,
      zoom: trip.zoom ?? 8
    });
  }, []);

  const focusPlace = useCallback((place: FocusTarget) => {
    setSelected({
      pinId: place.id ?? null,
      placeId: place.placeId ?? place.id ?? null,
      tripId: place.tripId ?? null
    });
    updateCamera({
      center: place.coordinate,
      intent: "place",
      selectedId: place.placeId ?? place.id ?? null,
      zoom: place.zoom ?? 14
    });
  }, []);

  const openMap = useCallback((nextMode: WaylineMapMode = "map") => {
    setMode(nextMode);
  }, []);

  const locateUser = useCallback(async () => {
    setLocationStatus("loading");
    setLocationError(null);

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      const nextLocation: WaylineLocationState = {
        coordinate: null,
        error: "Location is not available in this browser.",
        permission: "unavailable",
        source: "fallback"
      };
      updateLocation(nextLocation);
      setLocationStatus("error");
      setLocationError(nextLocation.error ?? null);
      return nextLocation;
    }

    const nextLocation = await new Promise<WaylineLocationState>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            accuracyMeters: position.coords.accuracy,
            coordinate: {
              lat: clampLatitude(position.coords.latitude),
              lng: normalizeLongitude(position.coords.longitude)
            },
            label: "Current location",
            locatedAt: new Date().toISOString(),
            permission: "granted",
            source: "browser"
          });
        },
        (error) => {
          resolve({
            coordinate: null,
            error: locationErrorMessage(error),
            permission: error.code === error.PERMISSION_DENIED ? "denied" : "unavailable",
            source: "fallback"
          });
        },
        { enableHighAccuracy: true, maximumAge: 300_000, timeout: 8_000 }
      );
    });

    updateLocation(nextLocation);

    if (nextLocation.coordinate) {
      updateCamera({
        center: nextLocation.coordinate,
        intent: "user-location",
        rangeMeters: 4_500_000,
        selectedId: "user-location",
        tilt: 35,
        zoom: 8
      });
      setLocationStatus("ready");
      return nextLocation;
    }

    setLocationStatus("error");
    setLocationError(nextLocation.error ?? "Location is unavailable.");
    return nextLocation;
  }, []);

  const surfaceState = useMemo<WaylineMapSurfaceState>(
    () => ({
      camera,
      location,
      mode,
      pins,
      renderer: mode === "globe" || mode === "launch-globe" ? "custom-globe" : "google-2d",
      routes,
      selectedId: selected.pinId ?? selected.placeId ?? selected.tripId
    }),
    [camera, location, mode, pins, routes, selected]
  );

  const value = useMemo<UnifiedMapContextValue>(
    () => ({
      camera,
      location,
      locationError,
      locationStatus,
      mode,
      pins,
      routes,
      selected,
      surfaceState,
      clearSelection,
      focusPlace,
      focusTrip,
      locateUser,
      openMap,
      selectPin,
      setCamera,
      setMode,
      setPins,
      setRoutes
    }),
    [
      camera,
      clearSelection,
      focusPlace,
      focusTrip,
      locateUser,
      location,
      locationError,
      locationStatus,
      mode,
      openMap,
      pins,
      routes,
      selectPin,
      selected,
      setCamera,
      surfaceState
    ]
  );

  return (
    <UnifiedMapContext.Provider value={value}>
      {children}
    </UnifiedMapContext.Provider>
  );
}

export function useUnifiedMap() {
  const context = useContext(UnifiedMapContext);

  if (!context) {
    throw new Error("useUnifiedMap must be used within UnifiedMapProvider.");
  }

  return context;
}

export function useOptionalUnifiedMap() {
  return useContext(UnifiedMapContext);
}

function clampLatitude(latitude: number) {
  return Math.min(85, Math.max(-85, latitude));
}

function normalizeLongitude(longitude: number) {
  return ((((longitude + 180) % 360) + 360) % 360) - 180;
}

function locationErrorMessage(error: GeolocationPositionError) {
  if (error.code === error.PERMISSION_DENIED) {
    return "Location permission was denied.";
  }

  if (error.code === error.TIMEOUT) {
    return "Location lookup timed out.";
  }

  return "Location is unavailable.";
}
