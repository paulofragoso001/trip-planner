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
  autoLocate?: boolean;
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

const LAST_USER_LOCATION_KEY = "wayline:last-user-location";
const USER_LOCATION_PIN_ID = "user-location";

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
  const locationRequestRef = useRef<Promise<WaylineLocationState> | null>(null);
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

  const setCamera = useCallback((nextCamera: WaylineMapCamera) => {
    updateCamera(nextCamera);
  }, []);

  const locationPin = useMemo(
    () => userLocationPin(location, selected.pinId === USER_LOCATION_PIN_ID),
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
    const currentLocation = locationRef.current;
    if (currentLocation.source === "browser" && currentLocation.coordinate) {
      setLocationStatus("ready");
      setLocationError(null);
      updateCamera({
        center: currentLocation.coordinate,
        intent: "user-location",
        rangeMeters: 4_500_000,
        selectedId: USER_LOCATION_PIN_ID,
        tilt: 35,
        zoom: 8
      });
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

    locationRequestRef.current = new Promise<WaylineLocationState>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const coordinate = {
            lat: clampLatitude(position.coords.latitude),
            lng: normalizeLongitude(position.coords.longitude)
          };
          const googleLocation = await reverseGeocodeCoordinate(coordinate).catch(() => null);
          const nextLocation: WaylineLocationState = {
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
      updateCamera({
        center: nextLocation.coordinate,
        intent: "user-location",
        rangeMeters: 4_500_000,
        selectedId: USER_LOCATION_PIN_ID,
        tilt: 35,
        zoom: 8
      });
      setSelected({
        pinId: USER_LOCATION_PIN_ID,
        placeId: null,
        tripId: null
      });
      setLocationStatus("ready");
      setLocationError(null);
      return nextLocation;
    }

    setLocationStatus("error");
    setLocationError(nextLocation.error ?? "Location is unavailable.");
    return nextLocation;
  }, []);

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

  const surfaceState = useMemo<WaylineMapSurfaceState>(
    () => ({
      camera,
      location,
      mode,
      pins: surfacePins,
      renderer: mode === "globe" || mode === "launch-globe" ? "custom-globe" : "google-2d",
      routes,
      selectedId: selected.pinId ?? selected.placeId ?? selected.tripId
    }),
    [camera, location, mode, routes, selected, surfacePins]
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
      routes,
      selectPin,
      selected,
      setCamera,
      surfacePins,
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

function fallbackLocation(
  error: string,
  permission: WaylineLocationState["permission"],
  currentLocation: WaylineLocationState
) {
  const storedLocation = readLastKnownLocation();
  const fallback = currentLocation.coordinate ? currentLocation : storedLocation;

  if (fallback?.coordinate) {
    return {
      ...fallback,
      error,
      permission,
      source: fallback.source === "browser" ? "fallback" : fallback.source
    } satisfies WaylineLocationState;
  }

  return {
    coordinate: null,
    error,
    permission,
    source: "fallback"
  } satisfies WaylineLocationState;
}

function userLocationPin(
  location: WaylineLocationState,
  selected: boolean
): WaylineMapPin | null {
  if (!location.coordinate) {
    return null;
  }

  return {
    coordinate: location.coordinate,
    countryCode: location.countryCode ?? null,
    flag: countryFlag(location.countryCode),
    id: USER_LOCATION_PIN_ID,
    kind: "user-location",
    label: location.label || location.city || location.countryName || "Current location",
    selected,
    subtitle: location.countryName ?? null,
    tone: "orange"
  };
}

function mergeUserLocationPin(pins: WaylineMapPin[], locationPin: WaylineMapPin | null) {
  const appPins = pins.filter((pin) => pin.id !== USER_LOCATION_PIN_ID);
  return locationPin ? [locationPin, ...appPins] : appPins;
}

function readLastKnownLocation() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(LAST_USER_LOCATION_KEY);
    if (!rawValue) return null;
    const parsed = JSON.parse(rawValue) as Partial<WaylineLocationState> | null;
    if (!parsed?.coordinate) return null;
    const coordinate = parsed.coordinate as Partial<WaylineCoordinate>;
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
    } satisfies WaylineLocationState;
  } catch {
    return null;
  }
}

function persistLastKnownLocation(location: WaylineLocationState) {
  if (typeof window === "undefined" || !location.coordinate) {
    return;
  }

  try {
    window.localStorage.setItem(LAST_USER_LOCATION_KEY, JSON.stringify(location));
  } catch {
    // Storage can be unavailable in private contexts. Location still works in memory.
  }
}

function locationLabel(city?: string | null, countryName?: string | null) {
  if (city && countryName) return `${city}, ${countryName}`;
  return city || countryName || "Current location";
}

function countryFlag(countryCode?: string | null) {
  if (!countryCode || countryCode.length !== 2) {
    return null;
  }

  const codePoints = [...countryCode.toUpperCase()].map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
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
