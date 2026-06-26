"use client";

import Image from "next/image";
import type { CSSProperties, PointerEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { countryCodeToFlag } from "@/lib/map/wayline-map-pins";
import type {
  AlmidyLocationState,
  AlmidyMapCameraCommand,
  AlmidyMapPin
} from "@/lib/map/wayline-map-models";

type AlmidyLaunchGlobeProps = {
  cameraCommand?: AlmidyMapCameraCommand | null;
  className?: string;
  location?: AlmidyLocationState;
  onLocateUser?: () => Promise<AlmidyLocationState> | void;
  pins?: AlmidyMapPin[];
};

type HeroState = "interactive-3d-globe";
type LaunchPhase = "interactive-3d-globe";

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

const HERO_EARTH_Y_NUDGE_PERCENT = 0;
const USER_PIN_SCREEN_X = 59;
const USER_PIN_SCREEN_Y = 49;
const USE_CURRENT_LOCATION_EVENT = "wayline:home-use-current-location";
const MAX_GLOBE_DRAG_X = 72;
const MAX_GLOBE_DRAG_Y = 28;

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

const LAUNCH_GLOBE_CITY_LABELS = [
  { label: "Vancouver", x: 15, y: 34 },
  { label: "San Francisco", x: 8, y: 40 },
  { label: "Los Angeles", x: 11, y: 45 },
  { label: "Chicago", x: 44, y: 38 },
  { label: "Toronto", x: 64, y: 38 },
  { label: "New York", x: 72, y: 40 },
  { label: "Washington", x: 73, y: 44 },
  { label: "Dallas", x: 45, y: 46 },
  { label: "Houston", x: 48, y: 51 },
  { label: "Mexico City", x: 42, y: 58 },
  { label: "Bogotá", x: 72, y: 70 },
  { label: "Lima", x: 64, y: 84 },
  { label: "Santiago", x: 72, y: 96 }
] as const;

const LAUNCH_GLOBE_REGION_LABELS = [
  { label: "NORTH", x: 43, y: 30 },
  { label: "AMERICA", x: 45, y: 36 },
  { label: "SOUTH", x: 86, y: 81 },
  { label: "AMERICA", x: 88, y: 87 }
] as const;

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

const COUNTRY_BY_TIME_ZONE_PREFIX: Array<[string, CountryFocus]> = [
  ["America/", COUNTRY_BY_CODE.US],
  ["US/", COUNTRY_BY_CODE.US],
  ["Canada/", COUNTRY_BY_CODE.CA],
  ["Europe/London", COUNTRY_BY_CODE.GB],
  ["Europe/Paris", COUNTRY_BY_CODE.FR],
  ["Europe/Madrid", COUNTRY_BY_CODE.ES],
  ["Europe/Lisbon", COUNTRY_BY_CODE.PT],
  ["Europe/Rome", COUNTRY_BY_CODE.IT],
  ["Europe/Berlin", COUNTRY_BY_CODE.DE],
  ["Europe/Amsterdam", COUNTRY_BY_CODE.NL],
  ["Europe/Athens", COUNTRY_BY_CODE.GR],
  ["Atlantic/Reykjavik", COUNTRY_BY_CODE.IS],
  ["Mexico/", COUNTRY_BY_CODE.MX],
  ["Brazil/", COUNTRY_BY_CODE.BR]
];

const focusablePinKinds = new Set<AlmidyMapPin["kind"]>([
  "country",
  "place",
  "route-endpoint",
  "route-waypoint",
  "trip",
  "user-location"
]);

const EMPTY_PINS: AlmidyMapPin[] = [];

export function AlmidyLaunchGlobe({
  cameraCommand,
  className,
  location,
  onLocateUser,
  pins = EMPTY_PINS
}: AlmidyLaunchGlobeProps) {
  const [country, setCountry] = useState<CountryFocus>(DEFAULT_COUNTRY);
  const [reduceMotion, setReduceMotion] = useState(false);
  const focus = country;
  const showPin = true;
  const heroState: HeroState = "interactive-3d-globe";
  const launchPhase: LaunchPhase = "interactive-3d-globe";

  function setLocationFocus(nextCountry: CountryFocus) {
    setCountry((currentCountry) => (shouldUpdateFocus(currentCountry, nextCountry) ? nextCountry : currentCountry));
  }

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotion = () => setReduceMotion(media.matches);

    syncMotion();
    media.addEventListener("change", syncMotion);

    return () => media.removeEventListener("change", syncMotion);
  }, []);

  useEffect(() => {
    const localeCountry = countryFromLocale(navigator.languages?.[0] || navigator.language);
    const timezoneCountry = countryFromTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);

    setCountry(localeCountry || timezoneCountry || DEFAULT_COUNTRY);

    const useCurrentLocation = () => {
      void onLocateUser?.();
    };

    window.addEventListener(USE_CURRENT_LOCATION_EVENT, useCurrentLocation);

    return () => {
      window.removeEventListener(USE_CURRENT_LOCATION_EVENT, useCurrentLocation);
    };
  }, [onLocateUser]);

  useEffect(() => {
    const nextFocus =
      focusFromCameraCommand(cameraCommand, pins) ??
      focusFromPins(pins) ??
      focusFromLocationState(location);
    if (nextFocus) {
      setLocationFocus(nextFocus);
    }
  }, [cameraCommand, location, pins]);

  useEffect(() => {
    document.documentElement.dataset.waylineHomeLaunchPhase = reduceMotion ? "done" : launchPhase;

    return () => {
      delete document.documentElement.dataset.waylineHomeLaunchPhase;
    };
  }, [launchPhase, reduceMotion]);

  return (
    <AlmidyLaunchGlobeSurface
      className={className}
      focus={focus}
      heroState={heroState}
      launchPhase={launchPhase}
      reduceMotion={reduceMotion}
      showPin={showPin}
    />
  );
}

function AlmidyLaunchGlobeSurface({
  className,
  focus,
  heroState,
  launchPhase,
  reduceMotion,
  showPin
}: {
  className?: string;
  focus: CountryFocus;
  heroState: HeroState;
  launchPhase: LaunchPhase;
  reduceMotion: boolean;
  showPin: boolean;
}) {
  return (
    <LaunchGlobeShell
      className={className}
      focus={focus}
      heroState={heroState}
      launchPhase={launchPhase}
      reduceMotion={reduceMotion}
    >
      <div className="absolute inset-0" data-testid="earth-only-visual">
        <HomeHeroCustomGlobe reduceMotion={reduceMotion} />
      </div>
      <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(circle_at_var(--wayline-pin-x)_var(--wayline-pin-y),rgba(255,118,42,0.26),transparent_5.5%),linear-gradient(180deg,rgba(0,0,0,0.78)_0%,rgba(0,0,0,0.08)_24%,rgba(0,0,0,0)_57%,rgba(0,0,0,0.62)_100%)]" />
      <LaunchGlobeLabels />
      {showPin ? (
        <div
          className="wayline-country-pin pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2 text-center"
          data-country-code={focus.code}
          data-location-source={focus.source ?? "country"}
          data-user-latitude={focus.source === "user" ? focus.lat.toFixed(5) : undefined}
          data-user-longitude={focus.source === "user" ? focus.lng.toFixed(5) : undefined}
          data-pin-coordinate={`${focus.lat.toFixed(5)},${focus.lng.toFixed(5)}`}
          data-testid="mobile-home-country-pin"
          style={{
            left: "var(--wayline-pin-x)",
            top: "var(--wayline-pin-y)"
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
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-32 bg-[linear-gradient(180deg,rgba(0,0,0,0.86),rgba(0,0,0,0.38)_42%,transparent)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[30%] bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.36)_58%,rgba(0,0,0,0.74)_100%)]" />
    </LaunchGlobeShell>
  );
}

function LaunchGlobeShell({
  children,
  className,
  focus,
  heroState,
  launchPhase,
  reduceMotion
}: {
  children: ReactNode;
  className?: string;
  focus: CountryFocus;
  heroState: HeroState;
  launchPhase: LaunchPhase;
  reduceMotion: boolean;
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
      data-launch-phase={launchPhase}
      data-map-system="almidy-interactive-3d-globe"
      data-testid="almidy-launch-globe"
      style={{
        "--wayline-pin-x": `${focus.pinX}%`,
        "--wayline-pin-y": `${focus.source === "user" ? focus.pinY : focus.pinY - HERO_EARTH_Y_NUDGE_PERCENT}%`
      } as CSSProperties}
    >
      {children}
    </div>
  );
}

function LaunchGlobeLabels() {
  return (
    <div className="pointer-events-none absolute inset-0 z-[18]" data-testid="launch-globe-labels">
      {LAUNCH_GLOBE_REGION_LABELS.map((label) => (
        <span
          className="absolute -translate-x-1/2 -translate-y-1/2 text-[1.48rem] font-black uppercase leading-none tracking-[0.24em] text-white/90 [text-shadow:0_2px_3px_rgba(0,0,0,0.92),0_0_2px_rgba(0,0,0,0.9)]"
          key={`${label.label}-${label.x}`}
          style={{ left: `${label.x}%`, top: `${label.y}%` }}
        >
          {label.label}
        </span>
      ))}
      {LAUNCH_GLOBE_CITY_LABELS.map((label) => (
        <span
          className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-[0.94rem] font-black leading-none text-white/90 [text-shadow:0_2px_3px_rgba(0,0,0,0.98),0_0_2px_rgba(0,0,0,0.9)]"
          key={label.label}
          style={{ left: `${label.x}%`, top: `${label.y}%` }}
        >
          {label.label}
          <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full border border-white/90 bg-black/50 align-middle" />
        </span>
      ))}
    </div>
  );
}

function shouldUpdateFocus(currentCountry: CountryFocus, nextCountry: CountryFocus) {
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
  if (!location?.coordinate) {
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

function focusFromPins(pins: AlmidyMapPin[]): CountryFocus | null {
  const pin =
    pins.find((candidate) => candidate.selected && candidate.kind === "user-location") ??
    pins.find((candidate) => candidate.selected && focusablePinKinds.has(candidate.kind)) ??
    pins.find((candidate) => candidate.kind === "user-location") ??
    pins.find((candidate) => focusablePinKinds.has(candidate.kind));

  if (!pin) {
    return null;
  }

  const latitude = clamp(pin.coordinate.lat, -85, 85);
  const longitude = normalizeLongitude(pin.coordinate.lng);
  const countryCode = pin.countryCode?.toUpperCase() ?? null;
  const countryFocus =
    (countryCode ? COUNTRY_BY_CODE[countryCode] : null) ??
    countryFromApproximateCoordinates(latitude, longitude) ??
    DEFAULT_COUNTRY;
  const isUserPin = pin.kind === "user-location";

  return {
    ...countryFocus,
    altitude: isUserPin ? 1_150_000 : countryFocus.altitude,
    code: countryCode || countryFocus.code,
    flag: pin.flag || countryCodeToFlag(countryCode) || countryFocus.flag,
    lat: latitude,
    lng: longitude,
    name: isUserPin
      ? pin.subtitle || countryFocus.name || userFacingLocationLabel(pin.label) || DEFAULT_COUNTRY.name
      : userFacingLocationLabel(pin.label) || pin.subtitle || countryFocus.name,
    pinX: isUserPin ? USER_PIN_SCREEN_X : countryFocus.pinX,
    pinY: isUserPin ? USER_PIN_SCREEN_Y : countryFocus.pinY,
    source: isUserPin ? "user" : "country"
  };
}

function focusFromCameraCommand(
  command: AlmidyMapCameraCommand | null | undefined,
  pins: AlmidyMapPin[]
): CountryFocus | null {
  if (!command || command.type === "openFlatMap") {
    return null;
  }

  if (command.type === "zoomToWorld") {
    return DEFAULT_COUNTRY;
  }

  const commandPin = command.pinId ? pins.find((pin) => pin.id === command.pinId) : null;
  const latitude = clamp(command.camera.center.lat, -85, 85);
  const longitude = normalizeLongitude(command.camera.center.lng);
  const countryFocus = countryFromApproximateCoordinates(latitude, longitude) ?? DEFAULT_COUNTRY;
  const isUserCommand = command.type === "focusUserLocation";

  return {
    ...countryFocus,
    altitude: isUserCommand ? 1_150_000 : command.camera.altitudeMeters ?? countryFocus.altitude,
    flag: commandPin?.flag || countryFocus.flag,
    lat: latitude,
    lng: longitude,
    name: isUserCommand
      ? countryFocus.name || userFacingLocationLabel(command.label) || DEFAULT_COUNTRY.name
      : userFacingLocationLabel(command.label) || countryFocus.name,
    pinX: isUserCommand ? USER_PIN_SCREEN_X : countryFocus.pinX,
    pinY: isUserCommand ? USER_PIN_SCREEN_Y : countryFocus.pinY,
    source: isUserCommand ? "user" : "country"
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

function HomeHeroCustomGlobe({ reduceMotion }: { reduceMotion: boolean }) {
  const dragStartRef = useRef<{ dragX: number; dragY: number; pointerId: number; x: number; y: number } | null>(null);
  const [drag, setDrag] = useState({ x: 0, y: 0 });

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (reduceMotion) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    dragStartRef.current = {
      dragX: drag.x,
      dragY: drag.y,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY
    };
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const start = dragStartRef.current;
    if (!start || start.pointerId !== event.pointerId) {
      return;
    }

    const nextX = clamp(start.dragX + (event.clientX - start.x) * 0.42, -MAX_GLOBE_DRAG_X, MAX_GLOBE_DRAG_X);
    const nextY = clamp(start.dragY + (event.clientY - start.y) * 0.22, -MAX_GLOBE_DRAG_Y, MAX_GLOBE_DRAG_Y);
    setDrag({ x: nextX, y: nextY });
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    if (dragStartRef.current?.pointerId === event.pointerId) {
      dragStartRef.current = null;
    }
  }

  return (
    <div
      className="absolute inset-0 z-[1] overflow-hidden bg-[radial-gradient(circle_at_52%_12%,rgba(255,255,255,0.36),transparent_1px),radial-gradient(circle_at_76%_7%,rgba(255,255,255,0.32),transparent_1px),radial-gradient(circle_at_24%_20%,rgba(255,255,255,0.32),transparent_1px),radial-gradient(circle_at_18%_34%,rgba(255,255,255,0.22),transparent_1px),radial-gradient(circle_at_70%_30%,rgba(255,255,255,0.34),transparent_1px),radial-gradient(circle_at_92%_24%,rgba(255,255,255,0.28),transparent_1px),#030303]"
      data-3d-interactive="true"
      data-earth-source="almidy-custom-globe"
      data-map-renderer="interactive-3d-globe"
      data-map-system="almidy-interactive-3d-globe"
      data-testid="almidy-custom-globe"
      onPointerCancel={handlePointerUp}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{
        "--launch-globe-drag-x": `${drag.x}px`,
        "--launch-globe-drag-y": `${drag.y}px`
      } as CSSProperties}
    >
      <div className="absolute inset-x-0 top-0 h-40 bg-[linear-gradient(180deg,rgba(0,0,0,0.86),rgba(0,0,0,0))]" />
      <div
        className={[
          "absolute left-[50%] top-[14%] aspect-square w-[178vw] max-w-[62rem] -translate-x-1/2 overflow-hidden rounded-full border border-sky-100/16 bg-black shadow-[inset_-72px_-100px_110px_rgba(0,0,0,0.84),inset_34px_34px_60px_rgba(255,255,255,0.18),0_0_22px_rgba(186,230,253,0.26),0_0_90px_rgba(125,211,252,0.18)] [perspective:1100px] [touch-action:none]",
          reduceMotion ? "" : "wayline-home-custom-globe-intro"
        ]
          .filter(Boolean)
          .join(" ")}
        data-globe-drag-x={drag.x.toFixed(1)}
        data-globe-drag-y={drag.y.toFixed(1)}
        data-interactive-3d="true"
        data-testid="home-custom-globe"
      >
        <div className="absolute inset-0 rounded-full will-change-transform [transform:rotateX(calc(var(--launch-globe-drag-y)*-0.09deg))_rotateY(calc(var(--launch-globe-drag-x)*0.12deg))_translate3d(var(--launch-globe-drag-x),var(--launch-globe-drag-y),0)] [transform-style:preserve-3d]">
          <Image
            alt=""
            className={[
              "absolute inset-0 h-full w-full object-cover opacity-100 brightness-[1.08] contrast-[1.08] saturate-[1.1]",
              reduceMotion ? "" : "wayline-home-custom-globe-texture"
            ]
              .filter(Boolean)
              .join(" ")}
            data-testid="home-custom-globe-texture"
            height={820}
            priority
            sizes="(max-width: 1023px) 132vw, 1px"
            src="/globe/wayline-earth-3d-fallback.png"
            width={1200}
          />
        </div>
        <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_50%_8%,rgba(255,255,255,0.28),transparent_18%),linear-gradient(112deg,rgba(0,0,0,0.1)_0%,rgba(0,0,0,0)_45%,rgba(0,0,0,0.72)_100%)]" />
        <div className="absolute inset-0 rounded-full ring-1 ring-inset ring-sky-100/24" />
      </div>
      <div className="pointer-events-none absolute left-[50%] top-[13%] aspect-square w-[182vw] max-w-[64rem] -translate-x-1/2 rounded-full border border-sky-100/12 bg-[radial-gradient(circle_at_42%_20%,rgba(255,255,255,0.16),transparent_18%),radial-gradient(circle,transparent_55%,rgba(0,0,0,0.18)_66%,rgba(0,0,0,0.84)_100%)] shadow-[0_0_80px_rgba(186,230,253,0.2)]" />
    </div>
  );
}

function countryFromLocale(locale: string | undefined) {
  if (!locale) {
    return null;
  }

  try {
    const region = new Intl.Locale(locale).region?.toUpperCase();
    return region ? COUNTRY_BY_CODE[region] ?? null : null;
  } catch {
    const region = locale.split("-").at(-1)?.toUpperCase();
    return region ? COUNTRY_BY_CODE[region] ?? null : null;
  }
}

function countryFromTimeZone(timeZone: string | undefined) {
  if (!timeZone) {
    return null;
  }

  return COUNTRY_BY_TIME_ZONE_PREFIX.find(([prefix]) => timeZone.startsWith(prefix))?.[1] ?? null;
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
