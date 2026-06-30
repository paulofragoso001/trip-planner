"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import GoogleMapsProvider from "@/components/GoogleMapsProvider";
import { countryCodeToFlag } from "@/lib/map/wayline-map-pins";
import type {
  AlmidyLaunchGlobeTripPin,
  AlmidyLocationState
} from "@/lib/map/wayline-map-models";

type AlmidyLaunchGlobeProps = {
  activeTripId?: string | null;
  className?: string;
  defaultFocusWhenEmpty?: boolean;
  location?: AlmidyLocationState;
  locationStatus?: LocationRequestState;
  onLocateUser?: () => Promise<AlmidyLocationState> | void;
  onTripPinSelect?: (tripId: string) => void;
  renderTripPins?: boolean;
  showCountryPin?: boolean;
  tripPins?: AlmidyLaunchGlobeTripPin[];
  useLocationFocus?: boolean;
};

type HeroState = "google-maps-3d";
type LaunchPhase = "google-maps-3d";
type LaunchGlobeState =
  | "loading-location"
  | "missing-location"
  | "loading-google"
  | "ready"
  | "google-auth-failed"
  | "google-script-failed"
  | "google-runtime-failed"
  | "container-invalid";
type LocationRequestState = "idle" | "loading" | "ready" | "error";

type GoogleMaps3DLatLngAltitude = {
  altitude?: number;
  lat: number;
  lng: number;
};

type TripPinCoordinate = {
  lat: number;
  lng: number;
};

type GoogleMaps3DMapElement = HTMLElement & {
  center?: GoogleMaps3DLatLngAltitude;
  defaultUIHidden?: boolean;
  fov?: number;
  gestureHandling?: string;
  heading?: number;
  maxAltitude?: number;
  maxTilt?: number;
  minAltitude?: number;
  minTilt?: number;
  mode?: string;
  range?: number;
  tilt?: number;
};

type GoogleMaps3DMarkerElement = HTMLElement & {
  altitudeMode?: string;
  position?: GoogleMaps3DLatLngAltitude;
};

type GoogleMaps3DLibrary = {
  GestureHandling?: {
    GREEDY: string;
  };
  Map3DElement: new (options?: Partial<GoogleMaps3DMapElement>) => GoogleMaps3DMapElement;
  MapMode?: {
    HYBRID: string;
    SATELLITE?: string;
  };
};

type CountryFocus = {
  altitude: number;
  code: string;
  flag: string;
  lat: number;
  lng: number;
  name: string;
  pinX: number;
  pinY: number;
  source?: "country" | "user";
};

const USER_PIN_SCREEN_X = 59;
const USER_PIN_SCREEN_Y = 49;
const USE_CURRENT_LOCATION_EVENT = "wayline:home-use-current-location";
const LAUNCH_3D_MAX_ALTITUDE = 34_000_000;
const LAUNCH_3D_MIN_ALTITUDE = 180_000;
const LAUNCH_3D_MIN_TILT = 0;
const LAUNCH_CAMERA_FOV = 42;
const LAUNCH_CAMERA_HEADING = 0;
const LAUNCH_CAMERA_RANGE = 0;
const LAUNCH_CAMERA_TARGET = { altitude: 6_500_000, lat: 35, lng: -97 };
const LAUNCH_CAMERA_TILT = 0;
const TRIP_OVERVIEW_CAMERA_ALTITUDE = 4_600_000;
const USER_LOCATION_CAMERA_ALTITUDE = 15_000;
const USER_LOCATION_MARKER_TAG = "gmp-marker";

const DEFAULT_COUNTRY: CountryFocus = {
  altitude: 1_850_000,
  code: "US",
  flag: "🇺🇸",
  lat: 39.8283,
  lng: -98.5795,
  name: "United States",
  pinX: 59,
  pinY: 49
};

const COUNTRY_BY_CODE: Record<string, CountryFocus> = {
  AR: { altitude: 1_900_000, code: "AR", flag: "🇦🇷", lat: -38.4161, lng: -63.6167, name: "Argentina", pinX: 57, pinY: 74 },
  AW: { altitude: 1_350_000, code: "AW", flag: "🇦🇼", lat: 12.5211, lng: -69.9683, name: "Aruba", pinX: 54, pinY: 58 },
  BR: { altitude: 2_150_000, code: "BR", flag: "🇧🇷", lat: -14.235, lng: -51.9253, name: "Brazil", pinX: 66, pinY: 72 },
  CA: { altitude: 2_450_000, code: "CA", flag: "🇨🇦", lat: 56.1304, lng: -106.3468, name: "Canada", pinX: 45, pinY: 29 },
  CL: { altitude: 1_800_000, code: "CL", flag: "🇨🇱", lat: -35.6751, lng: -71.543, name: "Chile", pinX: 54, pinY: 78 },
  CO: { altitude: 1_550_000, code: "CO", flag: "🇨🇴", lat: 4.5709, lng: -74.2973, name: "Colombia", pinX: 55, pinY: 62 },
  DE: { altitude: 1_250_000, code: "DE", flag: "🇩🇪", lat: 51.1657, lng: 10.4515, name: "Germany", pinX: 78, pinY: 35 },
  ES: { altitude: 1_250_000, code: "ES", flag: "🇪🇸", lat: 40.4637, lng: -3.7492, name: "Spain", pinX: 75, pinY: 45 },
  FR: { altitude: 1_250_000, code: "FR", flag: "🇫🇷", lat: 46.2276, lng: 2.2137, name: "France", pinX: 77, pinY: 39 },
  GB: { altitude: 1_150_000, code: "GB", flag: "🇬🇧", lat: 55.3781, lng: -3.436, name: "United Kingdom", pinX: 73, pinY: 33 },
  GR: { altitude: 1_100_000, code: "GR", flag: "🇬🇷", lat: 39.0742, lng: 21.8243, name: "Greece", pinX: 82, pinY: 47 },
  IS: { altitude: 900_000, code: "IS", flag: "🇮🇸", lat: 64.9631, lng: -19.0208, name: "Iceland", pinX: 64, pinY: 26 },
  IT: { altitude: 1_100_000, code: "IT", flag: "🇮🇹", lat: 41.8719, lng: 12.5674, name: "Italy", pinX: 79, pinY: 44 },
  MX: { altitude: 1_750_000, code: "MX", flag: "🇲🇽", lat: 23.6345, lng: -102.5528, name: "Mexico", pinX: 43, pinY: 57 },
  NL: { altitude: 950_000, code: "NL", flag: "🇳🇱", lat: 52.1326, lng: 5.2913, name: "Netherlands", pinX: 77, pinY: 35 },
  PA: { altitude: 1_250_000, code: "PA", flag: "🇵🇦", lat: 8.538, lng: -80.7821, name: "Panama", pinX: 54, pinY: 59 },
  PT: { altitude: 1_150_000, code: "PT", flag: "🇵🇹", lat: 39.3999, lng: -8.2245, name: "Portugal", pinX: 73, pinY: 45 },
  US: DEFAULT_COUNTRY
};

export function AlmidyLaunchGlobe({
  activeTripId,
  className,
  defaultFocusWhenEmpty = false,
  location,
  locationStatus = "idle",
  onLocateUser,
  onTripPinSelect,
  renderTripPins = true,
  showCountryPin = true,
  tripPins = [],
  useLocationFocus = true
}: AlmidyLaunchGlobeProps) {
  const [country, setCountry] = useState<CountryFocus | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const focus = country ?? focusFromTripPins(tripPins) ?? (defaultFocusWhenEmpty ? DEFAULT_COUNTRY : null);
  const heroState: HeroState = "google-maps-3d";
  const launchPhase: LaunchPhase = "google-maps-3d";

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotion = () => setReduceMotion(media.matches);

    syncMotion();
    media.addEventListener("change", syncMotion);

    return () => media.removeEventListener("change", syncMotion);
  }, []);

  useEffect(() => {
    const useCurrentLocation = () => {
      void onLocateUser?.();
    };

    window.addEventListener(USE_CURRENT_LOCATION_EVENT, useCurrentLocation);

    return () => {
      window.removeEventListener(USE_CURRENT_LOCATION_EVENT, useCurrentLocation);
    };
  }, [onLocateUser]);

  useEffect(() => {
    if (!useLocationFocus) {
      setCountry(null);
      return;
    }

    const nextFocus = focusFromLocationState(location);
    setCountry((currentCountry) => {
      if (!nextFocus) return null;
      return shouldUpdateFocus(currentCountry, nextFocus) ? nextFocus : currentCountry;
    });
  }, [location, useLocationFocus]);

  useEffect(() => {
    document.documentElement.dataset.waylineHomeLaunchPhase = reduceMotion ? "done" : launchPhase;

    return () => {
      delete document.documentElement.dataset.waylineHomeLaunchPhase;
    };
  }, [launchPhase, reduceMotion]);

  if (!focus) {
    const state: LaunchGlobeState = locationStatus === "loading" ? "loading-location" : "missing-location";

    return (
      <LaunchGlobePreflight
        className={className}
        heroState={heroState}
        launchPhase={launchPhase}
        reduceMotion={reduceMotion}
        state={state}
      />
    );
  }

  return (
    <GoogleMapsProvider
      blockChildrenOnError
      blockChildrenUntilLoaded
      fallback={
        <LaunchGlobePreflight
          className={className}
          heroState={heroState}
          launchPhase={launchPhase}
          reduceMotion={reduceMotion}
          state="google-script-failed"
        />
      }
      loadingFallback={
        <LaunchGlobePreflight
          className={className}
          heroState={heroState}
          launchPhase={launchPhase}
          reduceMotion={reduceMotion}
          state="loading-google"
        />
      }
    >
      <GoogleMaps3DLaunchGlobe
        className={className}
        focus={focus}
        heroState={heroState}
        launchPhase={launchPhase}
        onTripPinSelect={onTripPinSelect}
        reduceMotion={reduceMotion}
        renderTripPins={renderTripPins}
        showCountryPin={showCountryPin}
        activeTripId={activeTripId}
        tripPins={tripPins}
      />
    </GoogleMapsProvider>
  );
}

function GoogleMaps3DLaunchGlobe({
  activeTripId,
  className,
  focus,
  heroState,
  launchPhase,
  onTripPinSelect,
  reduceMotion,
  renderTripPins,
  showCountryPin,
  tripPins
}: {
  activeTripId?: string | null;
  className?: string;
  focus: CountryFocus;
  heroState: HeroState;
  launchPhase: LaunchPhase;
  onTripPinSelect?: (tripId: string) => void;
  reduceMotion: boolean;
  renderTripPins: boolean;
  showCountryPin: boolean;
  tripPins: AlmidyLaunchGlobeTripPin[];
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<GoogleMaps3DMapElement | null>(null);
  const activeTripIdRef = useRef(activeTripId);
  const focusRef = useRef(focus);
  const onTripPinSelectRef = useRef(onTripPinSelect);
  const readyRef = useRef(false);
  const renderTripPinsRef = useRef(renderTripPins);
  const tripPinsRef = useRef(tripPins);
  const [state, setState] = useState<LaunchGlobeState>("loading-google");
  const shellUserLocationCenter = userCameraCenterForFocus(focus);
  const shellTripOverviewCenter = tripCameraCenterForPins(tripPins, activeTripId);
  const shellCameraCenter = shellUserLocationCenter ?? shellTripOverviewCenter ?? LAUNCH_CAMERA_TARGET;
  const shellCameraIntent = shellUserLocationCenter
    ? "user-location"
    : shellTripOverviewCenter
      ? "trip-overview"
      : "launch";

  useEffect(() => {
    onTripPinSelectRef.current = onTripPinSelect;
  }, [onTripPinSelect]);

  useEffect(() => {
    activeTripIdRef.current = activeTripId;
    focusRef.current = focus;
    renderTripPinsRef.current = renderTripPins;
    tripPinsRef.current = tripPins;

    if (readyRef.current && mapRef.current) {
      syncGoogle3DMapCameraAndMarkers(mapRef.current, {
        activeTripId,
        focus,
        onTripPinSelect: (tripId) => onTripPinSelectRef.current?.(tripId),
        renderTripPins,
        tripPins
      });
    }
  }, [activeTripId, focus, renderTripPins, tripPins]);

  useEffect(() => {
    let cancelled = false;
    let failed = false;
    let mapElement: GoogleMaps3DMapElement | null = null;
    let observer: MutationObserver | null = null;
    let runtimeErrorPoll: number | null = null;
    const authFailureEvent = "almidy:google-maps-auth-failure";

    const hasNativeGoogleError = () => {
      const text = mapElement?.textContent ?? "";
      return (
        text.includes("Oops! Something went wrong") ||
        text.includes("This page didn't load Google Maps correctly") ||
        text.includes("This page didn’t load Google Maps correctly")
      );
    };

    const failClosed = (nextState: LaunchGlobeState = "google-runtime-failed") => {
      if (cancelled) return;
      failed = true;
      observer?.disconnect();
      if (runtimeErrorPoll) {
        window.clearInterval(runtimeErrorPoll);
        runtimeErrorPoll = null;
      }
      mapElement?.remove();
      readyRef.current = false;
      setState(nextState);
    };

    const revealWhenInitialized = () => {
      if (cancelled || failed) return;
      window.requestAnimationFrame(() => {
        if (cancelled || failed) return;
        readyRef.current = true;
        mapElement?.classList.remove("opacity-0");
        mapElement?.classList.add("opacity-100");
        setState("ready");
      });
    };

    async function mountGoogle3D() {
      const container = containerRef.current;
      if (!container || !window.google?.maps?.importLibrary) {
        failClosed("google-runtime-failed");
        return;
      }

      try {
        const bounds = container.getBoundingClientRect();
        if (bounds.width < 1 || bounds.height < 1) {
          failClosed("container-invalid");
          return;
        }

        const maps3d = await window.google.maps.importLibrary(
          "maps3d" as Parameters<typeof window.google.maps.importLibrary>[0]
        ) as unknown as GoogleMaps3DLibrary;
        if (cancelled || !containerRef.current) {
          return;
        }

        const currentFocus = focusRef.current;
        const currentTripPins = tripPinsRef.current;
        const currentActiveTripId = activeTripIdRef.current;
        const userLocationCenter = userCameraCenterForFocus(currentFocus);
        const tripOverviewCenter = tripCameraCenterForPins(currentTripPins, currentActiveTripId);
        const center = userLocationCenter ?? tripOverviewCenter ?? LAUNCH_CAMERA_TARGET;
        const gestureHandling = maps3d.GestureHandling?.GREEDY ?? "GREEDY";
        const mapMode = maps3d.MapMode?.HYBRID ?? "HYBRID";

        mapElement = new maps3d.Map3DElement({
          center,
          defaultUIHidden: true,
          fov: LAUNCH_CAMERA_FOV,
          gestureHandling,
          heading: LAUNCH_CAMERA_HEADING,
          maxAltitude: LAUNCH_3D_MAX_ALTITUDE,
          maxTilt: 82,
          minAltitude: LAUNCH_3D_MIN_ALTITUDE,
          minTilt: LAUNCH_3D_MIN_TILT,
          mode: mapMode,
          range: LAUNCH_CAMERA_RANGE,
          tilt: LAUNCH_CAMERA_TILT
        });
        mapElement.className = "absolute inset-0 h-full w-full opacity-0";
        mapElement.dataset.mapRenderer = "google-maps-3d";
        mapElement.dataset.mapSystem = "almidy-google-maps-3d";
        mapElement.setAttribute("aria-label", "Interactive 3D launch globe");
        mapElement.setAttribute("data-testid", "almidy-google-maps-3d-globe");
        mapElement.setAttribute("default-ui-hidden", "true");
        mapElement.setAttribute("data-camera-altitude", String(center.altitude));
        mapElement.setAttribute("data-camera-latitude", center.lat.toFixed(5));
        mapElement.setAttribute("data-camera-longitude", center.lng.toFixed(5));
        mapElement.setAttribute("fov", String(LAUNCH_CAMERA_FOV));
        mapElement.setAttribute("gesture-handling", gestureHandling.toLowerCase());
        mapElement.setAttribute("heading", String(LAUNCH_CAMERA_HEADING));
        mapElement.setAttribute("max-altitude", String(LAUNCH_3D_MAX_ALTITUDE));
        mapElement.setAttribute("min-altitude", String(LAUNCH_3D_MIN_ALTITUDE));
        mapElement.setAttribute("min-tilt", String(LAUNCH_3D_MIN_TILT));
        mapElement.setAttribute("mode", mapMode.toLowerCase());
        mapElement.setAttribute("range", String(LAUNCH_CAMERA_RANGE));
        mapElement.setAttribute("tilt", String(LAUNCH_CAMERA_TILT));
        syncGoogle3DMapCameraAndMarkers(mapElement, {
          activeTripId: currentActiveTripId,
          focus: currentFocus,
          onTripPinSelect: (tripId) => onTripPinSelectRef.current?.(tripId),
          renderTripPins: renderTripPinsRef.current,
          tripPins: currentTripPins
        });

        const handleError = () => failClosed("google-runtime-failed");
        const handleSteady = () => revealWhenInitialized();
        mapElement.addEventListener("gmp-error", handleError, { once: true });
        mapElement.addEventListener("gmp-map-id-error", handleError, { once: true });
        mapElement.addEventListener("gmp-steadychange", handleSteady, { once: true });
        observer = new MutationObserver(() => {
          if (hasNativeGoogleError()) {
            failClosed("google-runtime-failed");
          }
        });
        observer.observe(mapElement, { childList: true, subtree: true });
        container.replaceChildren(mapElement);
        mapRef.current = mapElement;
        revealWhenInitialized();
        runtimeErrorPoll = window.setInterval(() => {
          if (hasNativeGoogleError()) {
            failClosed("google-runtime-failed");
          }
        }, 120);
      } catch {
        if (!cancelled) {
          failClosed("google-runtime-failed");
        }
      }
    }

    readyRef.current = false;
    setState("loading-google");
    const handleAuthFailure = () => failClosed("google-auth-failed");
    window.addEventListener(authFailureEvent, handleAuthFailure);
    void mountGoogle3D();

    return () => {
      cancelled = true;
      window.removeEventListener(authFailureEvent, handleAuthFailure);
      if (runtimeErrorPoll) {
        window.clearInterval(runtimeErrorPoll);
      }
      observer?.disconnect();
      mapRef.current = null;
      mapElement?.remove();
    };
  }, []);

  if (state !== "ready" && state !== "loading-google") {
    return (
      <LaunchGlobePreflight
        cameraCenter={shellCameraCenter}
        cameraIntent={shellCameraIntent}
        className={className}
        heroState={heroState}
        launchPhase={launchPhase}
        reduceMotion={reduceMotion}
        state={state}
      />
    );
  }

  return (
    <>
      {state === "ready" ? null : (
        <LaunchGlobePreflight
          cameraCenter={shellCameraCenter}
          cameraIntent={shellCameraIntent}
          className={className}
          heroState={heroState}
          launchPhase={launchPhase}
          reduceMotion={reduceMotion}
          state="loading-google"
        />
      )}
      <LaunchGlobeShell
        className={[
          className,
          state === "ready" ? "" : "pointer-events-none opacity-0"
        ].filter(Boolean).join(" ")}
        heroState={heroState}
        launchPhase={launchPhase}
        reduceMotion={reduceMotion}
        state={state}
        testId={state === "ready" ? "almidy-launch-globe" : "almidy-google-maps-3d-preflight"}
        cameraCenter={shellCameraCenter}
        cameraIntent={shellCameraIntent}
      >
        <div
          className="absolute inset-0 z-0 h-full min-h-[100dvh] w-full overflow-hidden bg-black"
          data-map-renderer="google-maps-3d"
          data-map-system="almidy-google-maps-3d"
          data-testid="almidy-google-maps-3d-host"
          ref={containerRef}
        />
        {showCountryPin ? (
          <div
            className="wayline-country-pin pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2 text-center"
            data-country-code={focus.code}
            data-location-source={focus.source ?? "country"}
            data-pin-coordinate={`${focus.lat.toFixed(5)},${focus.lng.toFixed(5)}`}
            data-testid="mobile-home-country-pin"
            data-user-latitude={focus.lat.toFixed(5)}
            data-user-longitude={focus.lng.toFixed(5)}
            style={{
              left: "59%",
              top: "49%"
            }}
          >
            <div className="mx-auto h-6 w-6 rounded-full border-[3px] border-white bg-orange-500 shadow-[0_4px_14px_rgba(0,0,0,0.48),0_0_18px_rgba(255,114,42,0.62)]" />
            <div
              className="sr-only"
              data-testid="mobile-home-country-name"
            >
              {focus.name}
            </div>
          </div>
        ) : null}
        <div className="pointer-events-none absolute inset-0 z-10 bg-[linear-gradient(180deg,rgba(0,0,0,0.78)_0%,rgba(0,0,0,0.08)_21%,rgba(0,0,0,0)_58%,rgba(0,0,0,0.42)_100%)]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-32 bg-[linear-gradient(180deg,rgba(0,0,0,0.9),rgba(0,0,0,0.32)_48%,transparent)]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[24%] bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.36)_58%,rgba(0,0,0,0.72)_100%)]" />
      </LaunchGlobeShell>
    </>
  );
}

function LaunchGlobePreflight({
  cameraCenter,
  cameraIntent,
  className,
  heroState,
  launchPhase,
  reduceMotion,
  state
}: {
  cameraCenter?: GoogleMaps3DLatLngAltitude;
  cameraIntent?: "launch" | "trip-overview" | "user-location";
  className?: string;
  heroState: HeroState;
  launchPhase: LaunchPhase;
  reduceMotion: boolean;
  state: LaunchGlobeState;
}) {
  return (
    <LaunchGlobeShell
      className={className}
      cameraCenter={cameraCenter}
      cameraIntent={cameraIntent}
      heroState={heroState}
      launchPhase={launchPhase}
      reduceMotion={reduceMotion}
      state={state}
    >
      <div
        className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(circle_at_50%_20%,rgba(30,64,175,0.22),transparent_34%),linear-gradient(180deg,rgba(0,0,0,0.92)_0%,rgba(0,0,0,0.58)_31%,rgba(0,0,0,0.76)_100%)]"
        data-map-runtime={state}
        data-testid="almidy-launch-globe-state"
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-32 bg-[linear-gradient(180deg,rgba(0,0,0,0.86),rgba(0,0,0,0.38)_42%,transparent)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[30%] bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.36)_58%,rgba(0,0,0,0.74)_100%)]" />
    </LaunchGlobeShell>
  );
}

function LaunchGlobeShell({
  cameraCenter,
  cameraIntent,
  children,
  className,
  heroState,
  launchPhase,
  reduceMotion,
  state,
  testId = "almidy-launch-globe"
}: {
  cameraCenter?: GoogleMaps3DLatLngAltitude;
  cameraIntent?: "launch" | "trip-overview" | "user-location";
  children: ReactNode;
  className?: string;
  heroState: HeroState;
  launchPhase: LaunchPhase;
  reduceMotion: boolean;
  state: LaunchGlobeState;
  testId?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={[
        "absolute inset-0 h-[100dvh] min-h-[100dvh] w-screen overflow-hidden bg-black",
        className
      ]
        .filter(Boolean)
        .join(" ")}
      data-home-hero-mode={`home-hero-mode: ${reduceMotion ? "reduced-motion" : "almidy-owned"}`}
      data-camera-altitude={cameraCenter?.altitude !== undefined ? String(cameraCenter.altitude) : undefined}
      data-camera-intent={cameraIntent}
      data-camera-latitude={cameraCenter ? cameraCenter.lat.toFixed(5) : undefined}
      data-camera-longitude={cameraCenter ? cameraCenter.lng.toFixed(5) : undefined}
      data-hero-mode={heroState}
      data-launch-globe-state={state}
      data-launch-phase={launchPhase}
      data-map-system="almidy-google-maps-3d"
      data-testid={testId}
    >
      {children}
    </div>
  );
}

function userCameraCenterForFocus(focus: CountryFocus): GoogleMaps3DLatLngAltitude | null {
  if (focus.source !== "user") {
    return null;
  }

  return {
    altitude: USER_LOCATION_CAMERA_ALTITUDE,
    lat: focus.lat,
    lng: focus.lng
  };
}

function tripCameraCenterForPins(
  pins: AlmidyLaunchGlobeTripPin[],
  activeTripId?: string | null
): GoogleMaps3DLatLngAltitude | null {
  const anchorPin =
    (activeTripId ? pins.find((pin) => (pin.tripId ?? pin.id) === activeTripId) : null) ??
    pins.find((pin) => tripPinCoordinate(pin));
  const coordinate = anchorPin ? tripPinCoordinate(anchorPin) : null;

  if (!coordinate) {
    return null;
  }

  return {
    altitude: TRIP_OVERVIEW_CAMERA_ALTITUDE,
    lat: coordinate.lat,
    lng: coordinate.lng
  };
}

function syncGoogle3DMapCameraAndMarkers(
  mapElement: GoogleMaps3DMapElement,
  {
    activeTripId,
    focus,
    onTripPinSelect,
    renderTripPins,
    tripPins
  }: {
    activeTripId?: string | null;
    focus: CountryFocus;
    onTripPinSelect?: (tripId: string) => void;
    renderTripPins: boolean;
    tripPins: AlmidyLaunchGlobeTripPin[];
  }
) {
  const userLocationCenter = userCameraCenterForFocus(focus);
  const tripOverviewCenter = tripCameraCenterForPins(tripPins, activeTripId);
  const center = userLocationCenter ?? tripOverviewCenter ?? LAUNCH_CAMERA_TARGET;
  mapElement.center = center;
  mapElement.setAttribute("data-camera-altitude", String(center.altitude));
  mapElement.setAttribute("data-camera-latitude", center.lat.toFixed(5));
  mapElement.setAttribute("data-camera-longitude", center.lng.toFixed(5));
  mapElement.setAttribute("data-user-latitude", focus.lat.toFixed(5));
  mapElement.setAttribute("data-user-longitude", focus.lng.toFixed(5));
  mapElement.setAttribute(
    "data-camera-intent",
    userLocationCenter ? "user-location" : tripOverviewCenter ? "trip-overview" : "launch"
  );

  mapElement
    .querySelectorAll('[data-almidy-marker-kind="user"],[data-almidy-marker-kind="trip"]')
    .forEach((marker) => marker.remove());

  if (userLocationCenter) {
    mapElement.appendChild(createUserLocationMarker(focus));
  }

  if (!renderTripPins) {
    return;
  }

  tripPins.forEach((pin) => {
    const tripMarker = createTripFlagMarker(
      pin,
      activeTripId ? activeTripId === (pin.tripId ?? pin.id) : false,
      onTripPinSelect
    );
    if (tripMarker) {
      mapElement.appendChild(tripMarker);
    }
  });
}

function createUserLocationMarker(focus: CountryFocus) {
  const marker = document.createElement(USER_LOCATION_MARKER_TAG) as GoogleMaps3DMarkerElement;
  const position = { altitude: 0, lat: focus.lat, lng: focus.lng };
  marker.altitudeMode = "CLAMP_TO_GROUND";
  marker.position = position;
  applyMarkerStacking(marker, 30);
  marker.setAttribute("altitude-mode", "clamp-to-ground");
  marker.setAttribute("data-almidy-marker-kind", "user");
  marker.setAttribute("data-country-code", focus.code);
  marker.setAttribute("data-testid", "almidy-google-maps-3d-user-marker");
  marker.setAttribute("position", formatMarkerPosition(position));
  marker.textContent = focus.flag;
  return marker;
}

function createTripFlagMarker(
  pin: AlmidyLaunchGlobeTripPin,
  isActive: boolean,
  onTripPinSelect?: (tripId: string) => void
) {
  const coordinate = tripPinCoordinate(pin);
  if (!coordinate) {
    return null;
  }

  const tripId = pin.tripId ?? pin.id;
  const marker = document.createElement(USER_LOCATION_MARKER_TAG) as GoogleMaps3DMarkerElement;
  const position = { altitude: 0, lat: coordinate.lat, lng: coordinate.lng };
  marker.altitudeMode = "CLAMP_TO_GROUND";
  marker.position = position;
  applyMarkerStacking(marker, isActive ? 45 : 40);
  marker.setAttribute("altitude-mode", "clamp-to-ground");
  marker.setAttribute("aria-label", `Select ${pin.label}`);
  marker.setAttribute("data-active", isActive ? "true" : "false");
  marker.setAttribute("data-almidy-marker-kind", "trip");
  marker.setAttribute("data-country-code", pin.countryCode);
  marker.setAttribute("data-pin-latitude", coordinate.lat.toFixed(5));
  marker.setAttribute("data-pin-longitude", coordinate.lng.toFixed(5));
  marker.setAttribute("data-testid", "mobile-trips-globe-flag-pin");
  marker.setAttribute("data-trip-id", tripId);
  marker.setAttribute("position", formatMarkerPosition(position));
  marker.className = "mobile-trips-map-marker";
  marker.addEventListener("click", () => onTripPinSelect?.(tripId));

  const content = document.createElement("button");
  content.type = "button";
  content.className = "pointer-events-auto touch-manipulation text-center focus:outline-none";
  content.addEventListener("click", (event) => {
    event.stopPropagation();
    onTripPinSelect?.(tripId);
  });

  const flag = document.createElement("span");
  flag.className = [
    "mx-auto grid h-11 w-11 place-items-center overflow-hidden rounded-full border-[2.5px] bg-white text-2xl leading-none shadow-[0_4px_0_rgba(0,0,0,0.95),0_10px_24px_rgba(0,0,0,0.36)] transition duration-200",
    isActive ? "scale-125 border-orange-500 ring-4 ring-orange-400/60" : "border-black ring-1 ring-white/75"
  ].join(" ");
  flag.setAttribute("aria-hidden", "true");
  flag.textContent = pin.flag;

  const label = document.createElement("span");
  label.className = [
    "mt-1 block max-w-28 truncate rounded px-1.5 py-0.5 text-[0.72rem] font-black leading-none [text-shadow:0_2px_2px_rgba(0,0,0,0.95),0_0_8px_rgba(0,0,0,0.85)]",
    isActive ? "bg-orange-600 text-white" : "bg-black/56 text-white"
  ].join(" ");
  label.textContent = pin.label;

  content.append(flag, label);
  marker.appendChild(content);

  return marker;
}

function applyMarkerStacking(marker: HTMLElement, zIndex: number) {
  marker.style.overflow = "visible";
  marker.style.pointerEvents = "auto";
  marker.style.position = "relative";
  marker.style.transformStyle = "preserve-3d";
  marker.style.zIndex = String(zIndex);
}

function formatMarkerPosition(position: GoogleMaps3DLatLngAltitude) {
  return `${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}, ${Math.round(position.altitude ?? 0)}`;
}

function focusFromTripPins(pins: AlmidyLaunchGlobeTripPin[]) {
  const firstKnownCountry = pins
    .map((pin) => COUNTRY_BY_CODE[pin.countryCode.toUpperCase()])
    .find(Boolean);

  if (!firstKnownCountry) {
    return pins.length ? DEFAULT_COUNTRY : null;
  }

  return firstKnownCountry;
}

function tripPinCoordinate(pin: AlmidyLaunchGlobeTripPin): TripPinCoordinate | null {
  const lat = typeof pin.lat === "number" ? pin.lat : Number(pin.lat);
  const lng = typeof pin.lng === "number" ? pin.lng : Number(pin.lng);

  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return {
      lat,
      lng: normalizeLongitude(lng)
    };
  }

  return null;
}

function shouldUpdateFocus(currentCountry: CountryFocus | null, nextCountry: CountryFocus) {
  if (!currentCountry) {
    return true;
  }

  if (currentCountry.source !== nextCountry.source || currentCountry.code !== nextCountry.code) {
    return true;
  }

  if (nextCountry.source !== "user") {
    return currentCountry.name !== nextCountry.name;
  }

  return distanceBetweenCoordinates(
    currentCountry.lat,
    currentCountry.lng,
    nextCountry.lat,
    nextCountry.lng
  ) > 0.25;
}

function focusFromLocationState(location: AlmidyLocationState | undefined): CountryFocus | null {
  if (!location?.coordinate || location.source !== "browser") {
    return null;
  }

  const latitude = clamp(location.coordinate.lat, -85, 85);
  const longitude = normalizeLongitude(location.coordinate.lng);
  const countryCode = location.countryCode?.toUpperCase() ?? null;
  const countryFocus =
    (countryCode ? COUNTRY_BY_CODE[countryCode] : null) ??
    countryFromApproximateCoordinates(latitude, longitude) ??
    DEFAULT_COUNTRY;

  return {
    ...countryFocus,
    altitude: 1_150_000,
    code: countryCode || countryFocus.code,
    flag: countryCodeToFlag(countryCode) || countryFocus.flag,
    lat: latitude,
    lng: longitude,
    name: location.countryName || countryFocus.name || location.city || userFacingLocationLabel(location.label) || DEFAULT_COUNTRY.name,
    pinX: USER_PIN_SCREEN_X,
    pinY: USER_PIN_SCREEN_Y,
    source: "user"
  };
}

function userFacingLocationLabel(label: string | null | undefined) {
  return label && label !== "Current location" ? label : null;
}

function distanceBetweenCoordinates(
  startLatitude: number,
  startLongitude: number,
  endLatitude: number,
  endLongitude: number
) {
  const earthRadiusKm = 6371;
  const latitudeDelta = degreesToRadians(endLatitude - startLatitude);
  const longitudeDelta = degreesToRadians(endLongitude - startLongitude);
  const startLatitudeRadians = degreesToRadians(startLatitude);
  const endLatitudeRadians = degreesToRadians(endLatitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(startLatitudeRadians) * Math.cos(endLatitudeRadians) * Math.sin(longitudeDelta / 2) ** 2;

  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function degreesToRadians(value: number) {
  return (value * Math.PI) / 180;
}


function countryFromApproximateCoordinates(latitude: number, longitude: number) {
  if (latitude >= 24 && latitude <= 50 && longitude >= -125 && longitude <= -66) return COUNTRY_BY_CODE.US;
  if (latitude >= 42 && latitude <= 84 && longitude >= -142 && longitude <= -52) return COUNTRY_BY_CODE.CA;
  if (latitude >= 14 && latitude <= 33 && longitude >= -118 && longitude <= -86) return COUNTRY_BY_CODE.MX;
  if (latitude >= -34 && latitude <= 6 && longitude >= -74 && longitude <= -34) return COUNTRY_BY_CODE.BR;
  if (latitude >= -56 && latitude <= -17 && longitude >= -76 && longitude <= -66) return COUNTRY_BY_CODE.CL;
  if (latitude >= -56 && latitude <= -21 && longitude >= -74 && longitude <= -53) return COUNTRY_BY_CODE.AR;
  if (latitude >= -5 && latitude <= 13 && longitude >= -82 && longitude <= -66) return COUNTRY_BY_CODE.CO;
  if (latitude >= 35 && latitude <= 59 && longitude >= -10 && longitude <= 2) return COUNTRY_BY_CODE.GB;
  if (latitude >= 41 && latitude <= 51 && longitude >= -5 && longitude <= 10) return COUNTRY_BY_CODE.FR;
  if (latitude >= 36 && latitude <= 44 && longitude >= -10 && longitude <= 4) return COUNTRY_BY_CODE.ES;
  if (latitude >= 36 && latitude <= 47 && longitude >= 6 && longitude <= 19) return COUNTRY_BY_CODE.IT;
  if (latitude >= 47 && latitude <= 55 && longitude >= 5 && longitude <= 16) return COUNTRY_BY_CODE.DE;
  if (latitude >= 50 && latitude <= 54 && longitude >= 3 && longitude <= 8) return COUNTRY_BY_CODE.NL;
  if (latitude >= 36 && latitude <= 42 && longitude >= 19 && longitude <= 29) return COUNTRY_BY_CODE.GR;
  if (latitude >= 63 && latitude <= 67 && longitude >= -25 && longitude <= -13) return COUNTRY_BY_CODE.IS;

  return null;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeLongitude(longitude: number) {
  return ((((longitude + 180) % 360) + 360) % 360) - 180;
}
