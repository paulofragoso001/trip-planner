"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import { reverseGeocodeCoordinate } from "@/lib/geocode";
import {
  buildFocusCountryCommand,
  buildFocusRouteCommand,
  buildFocusTripCommand,
  buildFocusUserLocationCommand,
  buildOpenFlatMapCommand,
  buildZoomToWorldCommand
} from "@/lib/map/wayline-map-camera";
import {
  USER_LOCATION_PIN_ID,
  buildUserLocationPin,
  mergeUserLocationPin
} from "@/lib/map/wayline-map-pins";
import type {
  AlmidyCoordinate,
  AlmidyLocationState,
  AlmidyMapCamera,
  AlmidyMapCameraCommand,
  AlmidyMapMode,
  AlmidyMapPin,
  AlmidyMapRoute,
  AlmidyMapSelection,
  AlmidyMapSurfaceState
} from "@/lib/map/wayline-map-models";

export type LocationRequestState = "idle" | "loading" | "ready" | "error";

export type FocusTarget = {
  coordinate: AlmidyCoordinate;
  id?: string | null;
  label?: string | null;
  placeId?: string | null;
  tripId?: string | null;
  zoom?: number | null;
};

export type UnifiedMapProviderProps = {
  children: ReactNode;
  autoLocate?: boolean;
  initialCamera?: AlmidyMapCamera;
  initialLocation?: AlmidyLocationState;
  initialMode?: AlmidyMapMode;
  initialPins?: AlmidyMapPin[];
  initialRoutes?: AlmidyMapRoute[];
};

export type UnifiedMapContextValue = {
  camera: AlmidyMapCamera;
  location: AlmidyLocationState;
  locationError: string | null;
  locationStatus: LocationRequestState;
  mode: AlmidyMapMode;
  pins: AlmidyMapPin[];
  routes: AlmidyMapRoute[];
  selected: AlmidyMapSelection;
  surfaceState: AlmidyMapSurfaceState;
  clearSelection: () => void;
  focusCountry: (country: FocusTarget) => void;
  focusPlace: (place: FocusTarget) => void;
  focusRoute: (routeId: string) => void;
  focusTrip: (trip: FocusTarget) => void;
  locateUser: () => Promise<AlmidyLocationState>;
  openFlatMap: (mode?: AlmidyMapMode) => void;
  openMap: (mode?: AlmidyMapMode) => void;
  selectPin: (pinId: string | null) => void;
  setCamera: (camera: AlmidyMapCamera) => void;
  setMode: (mode: AlmidyMapMode) => void;
  setPins: (pins: AlmidyMapPin[]) => void;
  setRoutes: (routes: AlmidyMapRoute[]) => void;
  zoomToWorld: () => void;
};

const DEFAULT_CAMERA: AlmidyMapCamera = {
  center: { lat: 25.7617, lng: -80.1918 },
  intent: "world",
  rangeMeters: 5_000_000,
  tilt: 35,
  zoom: 3
};

const DEFAULT_LOCATION: AlmidyLocationState = {
  coordinate: null,
  permission: "unknown",
  source: "fallback"
};

const DEFAULT_SELECTION: AlmidyMapSelection = {
  pinId: null,
  placeId: null,
  tripId: null
};

const LAST_USER_LOCATION_KEY = "wayline:last-user-location";

const UnifiedMapContext = createContext<UnifiedMapContextValue | null>(null);

export function UnifiedMapProvider({
  autoLocate = false,
  children,
  initialCamera = DEFAULT_CAMERA,
  initialLocation = DEFAULT_LOCATION,
  initialMode = "globe",
  initialPins = [],
  initialRoutes = []
}: UnifiedMapProviderProps) {
  const [camera, updateCamera] = useState<AlmidyMapCamera>(initialCamera);
  const [location, updateLocation] = useState<AlmidyLocationState>(initialLocation);
  const [locationError, setLocationError] = useState<string | null>(initialLocation.error ?? null);
  const [locationStatus, setLocationStatus] = useState<LocationRequestState>(
    initialLocation.coordinate ? "ready" : "idle"
  );
  const [mode, setMode] = useState<AlmidyMapMode>(initialMode);
  const [pins, setPins] = useState<AlmidyMapPin[]>(initialPins);
  const [routes, setRoutes] = useState<AlmidyMapRoute[]>(initialRoutes);
  const [cameraCommand, setCameraCommand] = useState<AlmidyMapCameraCommand | null>(null);
  const [selected, setSelected] = useState<AlmidyMapSelection>(DEFAULT_SELECTION);
  const locationRequestRef = useRef<Promise<AlmidyLocationState> | null>(null);
  const locationRef = useRef(location);

  useEffect(() => {
    locationRef.current = location;
  }, [location]);

  useEffect(() => {
    if (initialLocation.coordinate) {
      persistLastKnownLocation(initialLocation);
      return;
    }

    const storedLocation = readLastKnownLocation();
    if (!storedLocation?.coordinate) {
      return;
    }

    updateLocation(storedLocation);
    setLocationStatus("ready");
    setLocationError(null);
  }, [initialLocation]);

  const applyCameraCommand = useCallback((command: AlmidyMapCameraCommand) => {
    updateCamera(command.camera);
    setCameraCommand(command);
    if (command.mode) {
      setMode(command.mode);
    }
  }, []);

  const setCamera = useCallback((nextCamera: AlmidyMapCamera) => {
    const command: AlmidyMapCameraCommand = {
      camera: nextCamera,
      id: `manual:${Date.now().toString(36)}`,
      type: nextCamera.intent === "world" ? "zoomToWorld" : "openFlatMap"
    };
    applyCameraCommand(command);
  }, [applyCameraCommand]);

  const focusCountry = useCallback((country: FocusTarget) => {
    const command = buildFocusCountryCommand(country);
    setSelected({
      pinId: country.id ?? null,
      placeId: country.placeId ?? null,
      tripId: country.tripId ?? null
    });
    applyCameraCommand(command);
  }, [applyCameraCommand]);

  const zoomToWorld = useCallback(() => {
    clearPinSelection(setPins);
    setSelected(DEFAULT_SELECTION);
    applyCameraCommand(buildZoomToWorldCommand());
  }, [applyCameraCommand]);

  const openFlatMap = useCallback((nextMode: AlmidyMapMode = "map") => {
    applyCameraCommand(buildOpenFlatMapCommand(nextMode, camera));
  }, [applyCameraCommand, camera]);

  const focusRoute = useCallback((routeId: string) => {
    const route = routes.find((candidate) => candidate.id === routeId);
    if (!route) {
      return;
    }

    setSelected({
      pinId: null,
      placeId: null,
      tripId: route.tripId ?? null
    });
    applyCameraCommand(buildFocusRouteCommand(route));
  }, [applyCameraCommand, routes]);

  const focusUserLocation = useCallback((nextLocation: AlmidyLocationState) => {
    const command = buildFocusUserLocationCommand(nextLocation);
    if (!command) {
      return;
    }

    applyCameraCommand(command);
    setSelected({
      pinId: USER_LOCATION_PIN_ID,
      placeId: null,
      tripId: null
    });
  }, [applyCameraCommand]);

  const locationPin = useMemo(
    () => buildUserLocationPin(location, selected.pinId === USER_LOCATION_PIN_ID),
    [location, selected.pinId]
  );

  const surfacePins = useMemo(
    () => mergeUserLocationPin(pins, locationPin),
    [locationPin, pins]
  );

  const selectPin = useCallback((pinId: string | null) => {
    const pin = pinId ? surfacePins.find((candidate) => candidate.id === pinId) : null;
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
  }, [surfacePins]);

  const clearSelection = useCallback(() => {
    setSelected(DEFAULT_SELECTION);
    clearPinSelection(setPins);
  }, []);

  const focusTrip = useCallback((trip: FocusTarget) => {
    const command = buildFocusTripCommand(trip);
    setSelected({
      pinId: trip.id ?? null,
      placeId: trip.placeId ?? null,
      tripId: trip.tripId ?? trip.id ?? null
    });
    applyCameraCommand(command);
  }, [applyCameraCommand]);

  const focusPlace = useCallback((place: FocusTarget) => {
    setSelected({
      pinId: place.id ?? null,
      placeId: place.placeId ?? place.id ?? null,
      tripId: place.tripId ?? null
    });
    applyCameraCommand({
      camera: {
        center: place.coordinate,
        intent: "place",
        selectedId: place.placeId ?? place.id ?? null,
        zoom: place.zoom ?? 14
      },
      coordinates: [place.coordinate],
      id: `focusPlace:${Date.now().toString(36)}`,
      label: place.label ?? null,
      pinId: place.id ?? null,
      tripId: place.tripId ?? null,
      type: "openFlatMap"
    });
  }, [applyCameraCommand]);

  const openMap = useCallback((nextMode: AlmidyMapMode = "map") => {
    openFlatMap(nextMode);
  }, [openFlatMap]);

  const locateUser = useCallback(async () => {
    const currentLocation = locationRef.current;
    if (currentLocation.source === "browser" && currentLocation.coordinate) {
      setLocationStatus("ready");
      setLocationError(null);
      focusUserLocation(currentLocation);
      return currentLocation;
    }

    if (locationRequestRef.current) {
      return locationRequestRef.current;
    }

    setLocationStatus("loading");
    setLocationError(null);

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      const nextLocation = fallbackLocation("Location is not available in this browser.", "unavailable", currentLocation);
      updateLocation(nextLocation);
      setLocationStatus(nextLocation.coordinate ? "ready" : "error");
      setLocationError(nextLocation.error ?? null);
      return nextLocation;
    }

    locationRequestRef.current = new Promise<AlmidyLocationState>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const coordinate = {
            lat: clampLatitude(position.coords.latitude),
            lng: normalizeLongitude(position.coords.longitude)
          };
          const googleLocation = await reverseGeocodeCoordinate(coordinate).catch(() => null);
          const nextLocation: AlmidyLocationState = {
            accuracyMeters: position.coords.accuracy,
            city: googleLocation?.city ?? null,
            coordinate,
            countryCode: googleLocation?.countryCode ?? null,
            countryName: googleLocation?.countryName ?? null,
            label: locationLabel(googleLocation?.city, googleLocation?.countryName),
            locatedAt: new Date().toISOString(),
            permission: "granted",
            source: "browser"
          };

          resolve(nextLocation);
        },
        (error) => {
          resolve(fallbackLocation(
            locationErrorMessage(error),
            error.code === error.PERMISSION_DENIED ? "denied" : "unavailable",
            currentLocation
          ));
        },
        { enableHighAccuracy: true, maximumAge: 300_000, timeout: 8_000 }
      );
    }).finally(() => {
      locationRequestRef.current = null;
    });

    const nextLocation = await locationRequestRef.current;
    updateLocation(nextLocation);

    if (nextLocation.coordinate) {
      persistLastKnownLocation(nextLocation);
      focusUserLocation(nextLocation);
      setLocationStatus("ready");
      setLocationError(null);
      return nextLocation;
    }

    setLocationStatus("error");
    setLocationError(nextLocation.error ?? "Location is unavailable.");
    return nextLocation;
  }, [focusUserLocation]);

  useEffect(() => {
    if (!autoLocate) {
      return;
    }

    let cancelled = false;

    const requestLocation = () => {
      if (!cancelled) {
        void locateUser();
      }
    };

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      return;
    }

    const permissions = navigator.permissions;
    if (!permissions?.query) {
      requestLocation();
      return () => {
        cancelled = true;
      };
    }

    permissions
      .query({ name: "geolocation" as PermissionName })
      .then((permission) => {
        if (!cancelled && permission.state !== "denied") {
          requestLocation();
        }
      })
      .catch(() => {
        requestLocation();
      });

    return () => {
      cancelled = true;
    };
  }, [autoLocate, locateUser]);

  const surfaceState = useMemo<AlmidyMapSurfaceState>(
    () => ({
      camera,
      cameraCommand,
      location,
      mode,
      pins: surfacePins,
      renderer: mode === "globe" || mode === "launch-globe" ? "custom-globe" : "google-2d",
      routes,
      selectedId: selected.pinId ?? selected.placeId ?? selected.tripId
    }),
    [camera, cameraCommand, location, mode, routes, selected, surfacePins]
  );

  const value = useMemo<UnifiedMapContextValue>(
    () => ({
      camera,
      location,
      locationError,
      locationStatus,
      mode,
      pins: surfacePins,
      routes,
      selected,
      surfaceState,
      clearSelection,
      focusCountry,
      focusPlace,
      focusRoute,
      focusTrip,
      locateUser,
      openFlatMap,
      openMap,
      selectPin,
      setCamera,
      setMode,
      setPins,
      setRoutes,
      zoomToWorld
    }),
    [
      camera,
      clearSelection,
      focusCountry,
      focusPlace,
      focusRoute,
      focusTrip,
      locateUser,
      location,
      locationError,
      locationStatus,
      mode,
      openFlatMap,
      openMap,
      routes,
      selectPin,
      selected,
      setCamera,
      surfacePins,
      surfaceState,
      zoomToWorld
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

function fallbackLocation(
  error: string,
  permission: AlmidyLocationState["permission"],
  currentLocation: AlmidyLocationState
) {
  const storedLocation = readLastKnownLocation();
  const fallback = currentLocation.coordinate ? currentLocation : storedLocation;

  if (fallback?.coordinate) {
    return {
      ...fallback,
      error,
      permission,
      source: fallback.source === "browser" ? "fallback" : fallback.source
    } satisfies AlmidyLocationState;
  }

  return {
    coordinate: null,
    error,
    permission,
    source: "fallback"
  } satisfies AlmidyLocationState;
}

function readLastKnownLocation() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(LAST_USER_LOCATION_KEY);
    if (!rawValue) return null;
    const parsed = JSON.parse(rawValue) as Partial<AlmidyLocationState> | null;
    if (!parsed?.coordinate) return null;
    const coordinate = parsed.coordinate as Partial<AlmidyCoordinate>;
    const latitude = coordinate.lat;
    const longitude = coordinate.lng;
    if (
      typeof latitude !== "number" ||
      typeof longitude !== "number" ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      return null;
    }

    return {
      accuracyMeters: typeof parsed.accuracyMeters === "number" ? parsed.accuracyMeters : null,
      city: typeof parsed.city === "string" ? parsed.city : null,
      coordinate: {
        lat: clampLatitude(latitude),
        lng: normalizeLongitude(longitude)
      },
      countryCode: typeof parsed.countryCode === "string" ? parsed.countryCode.toUpperCase() : null,
      countryName: typeof parsed.countryName === "string" ? parsed.countryName : null,
      label: typeof parsed.label === "string" ? parsed.label : null,
      locatedAt: typeof parsed.locatedAt === "string" ? parsed.locatedAt : null,
      permission: parsed.permission === "denied" ? "denied" : "granted",
      source: "fallback"
    } satisfies AlmidyLocationState;
  } catch {
    return null;
  }
}

function persistLastKnownLocation(location: AlmidyLocationState) {
  if (typeof window === "undefined" || !location.coordinate) {
    return;
  }

  try {
    window.localStorage.setItem(LAST_USER_LOCATION_KEY, JSON.stringify(location));
  } catch {
    // Storage can be unavailable in private contexts. Location still works in memory.
  }
}

function clearPinSelection(setPins: (updater: (currentPins: AlmidyMapPin[]) => AlmidyMapPin[]) => void) {
  setPins((currentPins) =>
    currentPins.map((pin) => ({
      ...pin,
      selected: false
    }))
  );
}

function locationLabel(city?: string | null, countryName?: string | null) {
  if (city && countryName) return `${city}, ${countryName}`;
  return city || countryName || "Current location";
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
