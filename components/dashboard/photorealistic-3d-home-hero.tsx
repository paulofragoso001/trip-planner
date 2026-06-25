"use client";

import Image from "next/image";
import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { countryCodeToFlag } from "@/lib/map/wayline-map-pins";
import type {
  AlmidyLocationState,
  AlmidyMapCameraCommand,
  AlmidyMapPin
} from "@/lib/map/wayline-map-models";

type Photorealistic3DHomeHeroProps = {
  cameraCommand?: AlmidyMapCameraCommand | null;
  className?: string;
  location?: AlmidyLocationState;
  onLocateUser?: () => Promise<AlmidyLocationState> | void;
  pins?: AlmidyMapPin[];
};

type HeroState = "fallback";
type LaunchPhase = "fallback";

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

const HERO_EARTH_Y_NUDGE_PERCENT = 4;
const USER_PIN_SCREEN_X = 50;
const USER_PIN_SCREEN_Y = 44;
const USE_CURRENT_LOCATION_EVENT = "wayline:home-use-current-location";

const DEFAULT_COUNTRY: CountryFocus = {
  altitude: 1_850_000,
  code: "US",
  flag: "🇺🇸",
  lat: 39.8283,
  lng: -98.5795,
  name: "United States",
  pinX: 58,
  pinY: 36
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

export function Photorealistic3DHomeHero({
  cameraCommand,
  className,
  location,
  onLocateUser,
  pins = EMPTY_PINS
}: Photorealistic3DHomeHeroProps) {
  const [country, setCountry] = useState<CountryFocus>(DEFAULT_COUNTRY);
  const [reduceMotion, setReduceMotion] = useState(false);
  const heroState: HeroState = "fallback";
  const launchPhase: LaunchPhase = "fallback";

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

  const focus = country;
  const showPin = true;

  return (
    <div
      aria-hidden="true"
      className={[
        "absolute inset-0 overflow-hidden bg-[#020916]",
        className
      ]
        .filter(Boolean)
        .join(" ")}
      data-3d-enabled="false"
      data-home-hero-mode={`home-hero-mode: ${reduceMotion ? "reduced-motion" : "almidy-owned"}`}
      data-hero-mode={heroState}
      data-launch-phase={launchPhase}
      data-testid="photorealistic-3d-home-hero"
      style={{
        "--wayline-pin-x": `${focus.pinX}%`,
        "--wayline-pin-y": `${focus.source === "user" ? focus.pinY : focus.pinY - HERO_EARTH_Y_NUDGE_PERCENT}%`
      } as CSSProperties}
    >
      <div className="absolute inset-0" data-testid="earth-only-visual">
        <HomeHeroFallback reduceMotion={reduceMotion} />
        <div className="hidden" data-testid="home-3d-map-stage" />
      </div>
      <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(circle_at_var(--wayline-pin-x)_var(--wayline-pin-y),rgba(251,191,36,0.28),transparent_7%),radial-gradient(ellipse_at_50%_0%,rgba(125,194,255,0.22),transparent_33%),linear-gradient(180deg,rgba(2,9,22,0.44)_0%,rgba(2,9,22,0)_18%,rgba(2,8,20,0.1)_56%,rgba(2,8,20,0.68)_100%)]" />
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
          <div className="mx-auto grid h-12 w-12 place-items-center overflow-hidden rounded-full text-[2.35rem] leading-none shadow-[0_14px_36px_rgba(0,0,0,0.5),0_0_30px_rgba(251,146,60,0.34)]">
            <span aria-hidden="true">{focus.flag}</span>
          </div>
          <div className="mx-auto h-4 w-0.5 bg-orange-300/90 shadow-[0_0_18px_rgba(251,146,60,0.9)]" />
          <div className="mx-auto -mt-1 h-3 w-3 rotate-45 rounded-[0.2rem] bg-orange-300 shadow-[0_0_20px_rgba(251,146,60,0.85)]" />
          <div
            className="mt-2 max-w-32 truncate text-[0.62rem] font-black uppercase tracking-[0.2em] text-white/90 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]"
            data-testid="mobile-home-country-name"
          >
            {focus.name}
          </div>
        </div>
      ) : null}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-24 bg-[linear-gradient(180deg,rgba(2,9,22,0.48),transparent)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[34%] bg-[linear-gradient(180deg,transparent,rgba(2,8,20,0.62)_72%,rgba(2,8,20,0.88)_100%)]" />
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

function HomeHeroFallback({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <div
      className="absolute inset-0 z-[1] overflow-hidden bg-[radial-gradient(circle_at_50%_0%,rgba(96,165,250,0.22),transparent_25%),radial-gradient(circle_at_14%_14%,rgba(255,255,255,0.18),transparent_1px),radial-gradient(circle_at_82%_18%,rgba(255,255,255,0.16),transparent_1px),radial-gradient(circle_at_22%_32%,rgba(255,255,255,0.12),transparent_1px),radial-gradient(circle_at_74%_5%,rgba(255,255,255,0.18),transparent_1px),#020916]"
      data-earth-source="almidy-owned-globe"
      data-testid="earth-static-fallback"
    >
      <Image
        alt=""
        className={[
          "absolute left-1/2 top-[8%] h-auto w-[174vw] max-w-[54rem] -translate-x-1/2 opacity-100 brightness-[0.88] contrast-[1.22] saturate-[1.1] drop-shadow-[0_0_46px_rgba(96,165,250,0.34)]",
          reduceMotion ? "" : "wayline-home-3d-fallback-intro"
        ]
          .filter(Boolean)
          .join(" ")}
        data-testid="home-3d-fallback-image"
        height={820}
        priority
        sizes="(max-width: 1023px) 112vw, 1px"
        src="/globe/wayline-earth-3d-fallback.png"
        width={1200}
      />
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
