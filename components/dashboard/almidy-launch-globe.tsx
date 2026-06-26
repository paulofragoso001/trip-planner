"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import GoogleMapsProvider from "@/components/GoogleMapsProvider";
import { countryCodeToFlag } from "@/lib/map/wayline-map-pins";
import type { AlmidyLocationState } from "@/lib/map/wayline-map-models";

type AlmidyLaunchGlobeProps = {
  className?: string;
  location?: AlmidyLocationState;
  locationStatus?: LocationRequestState;
  onLocateUser?: () => Promise<AlmidyLocationState> | void;
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
  className,
  location,
  locationStatus = "idle",
  onLocateUser
}: AlmidyLaunchGlobeProps) {
  const [country, setCountry] = useState<CountryFocus | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const focus = country;
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
    const nextFocus = focusFromLocationState(location);
    setCountry((currentCountry) => {
      if (!nextFocus) return null;
      return shouldUpdateFocus(currentCountry, nextFocus) ? nextFocus : currentCountry;
    });
  }, [location]);

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
        reduceMotion={reduceMotion}
      />
    </GoogleMapsProvider>
  );
}

function GoogleMaps3DLaunchGlobe({
  className,
  focus,
  heroState,
  launchPhase,
  reduceMotion
}: {
  className?: string;
  focus: CountryFocus;
  heroState: HeroState;
  launchPhase: LaunchPhase;
  reduceMotion: boolean;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<GoogleMaps3DMapElement | null>(null);
  const readyRef = useRef(false);
  const [state, setState] = useState<LaunchGlobeState>("loading-google");

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

        const center = { altitude: 0, lat: focus.lat, lng: focus.lng };
        const gestureHandling = maps3d.GestureHandling?.GREEDY ?? "GREEDY";
        const mapMode = maps3d.MapMode?.HYBRID ?? "HYBRID";
        const launchRange = cinematicRangeForFocus(focus);

        mapElement = new maps3d.Map3DElement({
          center,
          defaultUIHidden: true,
          fov: 38,
          gestureHandling,
          heading: -28,
          maxAltitude: LAUNCH_3D_MAX_ALTITUDE,
          maxTilt: 82,
          minAltitude: LAUNCH_3D_MIN_ALTITUDE,
          minTilt: 12,
          mode: mapMode,
          range: launchRange,
          tilt: 61
        });
        mapElement.className = "absolute inset-0 h-full w-full opacity-0";
        mapElement.dataset.mapRenderer = "google-maps-3d";
        mapElement.dataset.mapSystem = "almidy-google-maps-3d";
        mapElement.setAttribute("aria-label", "Interactive 3D launch globe");
        mapElement.setAttribute("data-testid", "almidy-google-maps-3d-globe");
        mapElement.setAttribute("default-ui-hidden", "true");
        mapElement.setAttribute("fov", "38");
        mapElement.setAttribute("gesture-handling", gestureHandling.toLowerCase());
        mapElement.setAttribute("max-altitude", String(LAUNCH_3D_MAX_ALTITUDE));
        mapElement.setAttribute("min-altitude", String(LAUNCH_3D_MIN_ALTITUDE));
        mapElement.setAttribute("mode", mapMode.toLowerCase());
        mapElement.setAttribute("range", String(launchRange));
        mapElement.setAttribute("tilt", "61");
        mapElement.setAttribute("data-user-latitude", focus.lat.toFixed(5));
        mapElement.setAttribute("data-user-longitude", focus.lng.toFixed(5));

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
  }, [focus]);

  if (state !== "ready" && state !== "loading-google") {
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
    <>
      {state === "ready" ? null : (
        <LaunchGlobePreflight
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
      >
        <div
          className="absolute inset-0 z-[1] overflow-hidden bg-black"
          data-map-renderer="google-maps-3d"
          data-map-system="almidy-google-maps-3d"
          data-testid="almidy-google-maps-3d-host"
          ref={containerRef}
        />
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
        <div className="pointer-events-none absolute inset-0 z-10 bg-[linear-gradient(180deg,rgba(0,0,0,0.78)_0%,rgba(0,0,0,0.08)_21%,rgba(0,0,0,0)_58%,rgba(0,0,0,0.42)_100%)]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-32 bg-[linear-gradient(180deg,rgba(0,0,0,0.9),rgba(0,0,0,0.32)_48%,transparent)]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[24%] bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.36)_58%,rgba(0,0,0,0.72)_100%)]" />
      </LaunchGlobeShell>
    </>
  );
}

function LaunchGlobePreflight({
  className,
  heroState,
  launchPhase,
  reduceMotion,
  state
}: {
  className?: string;
  heroState: HeroState;
  launchPhase: LaunchPhase;
  reduceMotion: boolean;
  state: LaunchGlobeState;
}) {
  return (
    <LaunchGlobeShell
      className={className}
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
  children,
  className,
  heroState,
  launchPhase,
  reduceMotion,
  state,
  testId = "almidy-launch-globe"
}: {
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
        "absolute inset-0 overflow-hidden bg-black",
        className
      ]
        .filter(Boolean)
        .join(" ")}
      data-home-hero-mode={`home-hero-mode: ${reduceMotion ? "reduced-motion" : "almidy-owned"}`}
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

function cinematicRangeForFocus(focus: CountryFocus) {
  return focus.source === "user" ? 12_400_000 : 14_800_000;
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
