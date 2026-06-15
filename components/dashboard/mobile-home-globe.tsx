"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";

type MobileHomeGlobeProps = {
  className?: string;
};

type CountryFocus = {
  code: string;
  flag: string;
  name: string;
  x: number;
  y: number;
};

const DEFAULT_COUNTRY: CountryFocus = {
  code: "US",
  flag: "🇺🇸",
  name: "United States",
  x: 50,
  y: 47
};

const COUNTRY_BY_CODE: Record<string, CountryFocus> = {
  AR: { code: "AR", flag: "🇦🇷", name: "Argentina", x: 54, y: 64 },
  AW: { code: "AW", flag: "🇦🇼", name: "Aruba", x: 49, y: 54 },
  BR: { code: "BR", flag: "🇧🇷", name: "Brazil", x: 58, y: 61 },
  CA: { code: "CA", flag: "🇨🇦", name: "Canada", x: 48, y: 33 },
  CL: { code: "CL", flag: "🇨🇱", name: "Chile", x: 48, y: 68 },
  CO: { code: "CO", flag: "🇨🇴", name: "Colombia", x: 50, y: 57 },
  DE: { code: "DE", flag: "🇩🇪", name: "Germany", x: 57, y: 39 },
  ES: { code: "ES", flag: "🇪🇸", name: "Spain", x: 53, y: 44 },
  FR: { code: "FR", flag: "🇫🇷", name: "France", x: 54, y: 41 },
  GB: { code: "GB", flag: "🇬🇧", name: "United Kingdom", x: 52, y: 38 },
  GR: { code: "GR", flag: "🇬🇷", name: "Greece", x: 59, y: 45 },
  IS: { code: "IS", flag: "🇮🇸", name: "Iceland", x: 45, y: 31 },
  IT: { code: "IT", flag: "🇮🇹", name: "Italy", x: 57, y: 43 },
  MX: { code: "MX", flag: "🇲🇽", name: "Mexico", x: 43, y: 52 },
  NL: { code: "NL", flag: "🇳🇱", name: "Netherlands", x: 55, y: 38 },
  PA: { code: "PA", flag: "🇵🇦", name: "Panama", x: 48, y: 56 },
  PT: { code: "PT", flag: "🇵🇹", name: "Portugal", x: 51, y: 44 },
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

export function MobileHomeGlobe({ className }: MobileHomeGlobeProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const introTimerRef = useRef<number | null>(null);
  const [enhanced, setEnhanced] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [visible, setVisible] = useState(true);
  const [introComplete, setIntroComplete] = useState(false);
  const [country, setCountry] = useState<CountryFocus | null>(null);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotion = () => {
      setReduceMotion(media.matches);
      if (media.matches) {
        setIntroComplete(true);
      }
    };

    syncMotion();
    media.addEventListener("change", syncMotion);
    const frame = window.requestAnimationFrame(() => setEnhanced(true));

    return () => {
      media.removeEventListener("change", syncMotion);
      window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    const localeCountry = countryFromLocale(navigator.languages?.[0] || navigator.language);
    const timezoneCountry = countryFromTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);

    setCountry(localeCountry || timezoneCountry);

    const permissions = navigator.permissions;

    if (!navigator.geolocation || !permissions?.query) {
      return;
    }

    let cancelled = false;

    permissions
      .query({ name: "geolocation" as PermissionName })
      .then((permission) => {
        if (cancelled || permission.state !== "granted") {
          return;
        }

        navigator.geolocation.getCurrentPosition(
          (position) => {
            if (cancelled) {
              return;
            }

            const countryFromCoordinates = countryFromApproximateCoordinates(
              position.coords.latitude,
              position.coords.longitude
            );

            if (countryFromCoordinates) {
              setCountry(countryFromCoordinates);
            }
          },
          () => undefined,
          { enableHighAccuracy: false, maximumAge: 86_400_000, timeout: 1_500 }
        );
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!enhanced || reduceMotion) {
      return;
    }

    introTimerRef.current = window.setTimeout(() => setIntroComplete(true), 3_300);

    return () => {
      if (introTimerRef.current !== null) {
        window.clearTimeout(introTimerRef.current);
      }
    };
  }, [enhanced, reduceMotion]);

  useEffect(() => {
    const root = rootRef.current;

    if (!root || !("IntersectionObserver" in window)) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => setVisible(Boolean(entry?.isIntersecting)),
      { threshold: 0.1 }
    );

    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  const animated = enhanced && !reduceMotion && visible;
  const showPin = Boolean(country) && (introComplete || reduceMotion);

  return (
    <div
      aria-hidden="true"
      className={[
        "pointer-events-none absolute inset-0 overflow-hidden bg-[#020916]",
        className
      ]
        .filter(Boolean)
        .join(" ")}
      data-testid="mobile-home-globe"
      ref={rootRef}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-12%,rgba(45,212,191,0.22),transparent_32%),radial-gradient(circle_at_82%_14%,rgba(37,99,235,0.18),transparent_32%),linear-gradient(180deg,rgba(2,9,22,0.08),#020916_84%)]" />
      <div
        className={[
          "wayline-globe-sphere absolute left-1/2 top-1/2 h-[88vw] max-h-[440px] min-h-[300px] w-[88vw] min-w-[300px] max-w-[440px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full opacity-100 shadow-[0_0_90px_rgba(20,184,166,0.24),0_0_140px_rgba(37,99,235,0.12),inset_-42px_-46px_80px_rgba(0,0,0,0.62),inset_30px_24px_70px_rgba(125,211,252,0.16)]",
          animated && !introComplete ? "wayline-globe-intro" : "",
          animated && introComplete ? "wayline-globe-drift" : ""
        ]
          .filter(Boolean)
          .join(" ")}
        style={{
          "--wayline-pin-x": `${country?.x ?? DEFAULT_COUNTRY.x}%`,
          "--wayline-pin-y": `${country?.y ?? DEFAULT_COUNTRY.y}%`
        } as CSSProperties}
      >
        <EarthGlobeSvg />
        <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_var(--wayline-pin-x)_var(--wayline-pin-y),rgba(250,204,21,0.22),transparent_9%),radial-gradient(circle_at_30%_18%,rgba(255,255,255,0.2),transparent_18%),radial-gradient(circle_at_47%_48%,transparent_48%,rgba(2,6,23,0.52)_70%,rgba(1,4,13,0.9)_91%)]" />
        <div className="absolute inset-[-1px] rounded-full ring-1 ring-cyan-100/24" />
        {showPin && country ? (
          <div
            className="wayline-country-pin absolute z-10 -translate-x-1/2 -translate-y-full text-center"
            data-country-code={country.code}
            data-testid="mobile-home-country-pin"
            style={{
              left: "var(--wayline-pin-x)",
              top: "var(--wayline-pin-y)"
            }}
          >
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full border-2 border-white/82 bg-slate-950 text-2xl shadow-[0_12px_34px_rgba(0,0,0,0.42),0_0_26px_rgba(251,146,60,0.24)]">
              <span aria-hidden="true">{country.flag}</span>
            </div>
            <div
              className="mt-1 max-w-28 truncate rounded-full bg-black/52 px-2 py-0.5 text-[0.62rem] font-black uppercase tracking-[0.12em] text-white/88 backdrop-blur"
              data-testid="mobile-home-country-name"
            >
              {country.name}
            </div>
          </div>
        ) : null}
      </div>
      <div className="absolute inset-x-0 top-0 h-36 bg-[linear-gradient(180deg,rgba(2,9,22,0.92),transparent)]" />
      <div className="absolute inset-x-0 bottom-0 h-[28%] bg-[linear-gradient(180deg,transparent,rgba(2,9,22,0.5)_42%,#020916_96%)]" />
    </div>
  );
}

function EarthGlobeSvg() {
  return (
    <svg
      className="absolute inset-0 h-full w-full"
      data-testid="mobile-home-earth-texture"
      focusable="false"
      role="presentation"
      viewBox="0 0 400 400"
    >
      <defs>
        <clipPath id="wayline-home-globe-clip">
          <circle cx="200" cy="200" r="198" />
        </clipPath>
        <radialGradient id="wayline-home-ocean" cx="38%" cy="28%" r="74%">
          <stop offset="0%" stopColor="#1b8798" />
          <stop offset="34%" stopColor="#0d5265" />
          <stop offset="72%" stopColor="#061e3f" />
          <stop offset="100%" stopColor="#020817" />
        </radialGradient>
        <linearGradient id="wayline-home-land" x1="0%" x2="100%" y1="0%" y2="100%">
          <stop offset="0%" stopColor="#6da886" />
          <stop offset="42%" stopColor="#326f60" />
          <stop offset="100%" stopColor="#173f39" />
        </linearGradient>
        <filter id="wayline-home-land-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" floodColor="#020617" floodOpacity="0.5" stdDeviation="2" />
        </filter>
      </defs>
      <g clipPath="url(#wayline-home-globe-clip)">
        <rect
          data-testid="mobile-home-earth-ocean"
          fill="url(#wayline-home-ocean)"
          height="400"
          width="400"
        />
        <g
          fill="none"
          opacity="0.24"
          stroke="#a7f3d0"
          strokeLinecap="round"
          strokeWidth="0.85"
        >
          <ellipse cx="200" cy="200" rx="190" ry="64" />
          <ellipse cx="200" cy="200" rx="190" ry="116" />
          <ellipse cx="200" cy="200" rx="74" ry="196" />
          <ellipse cx="200" cy="200" rx="132" ry="196" />
          <path d="M8 200h384" />
          <path d="M42 118c86 24 223 24 316 0" />
          <path d="M42 282c86-24 223-24 316 0" />
        </g>
        <g
          data-testid="mobile-home-earth-continents"
          fill="url(#wayline-home-land)"
          filter="url(#wayline-home-land-shadow)"
          opacity="0.94"
          stroke="#77d0b8"
          strokeOpacity="0.38"
          strokeWidth="1.1"
        >
          <path d="M56 104c12-20 32-31 58-36 20-4 50 0 68 12 10 6 14 18 25 22 15 5 32-1 45 8 10 8 12 22 5 33-8 13-24 15-39 12-18-4-34-9-50-3-11 5-13 18-22 27-11 12-29 8-38-4-7-10-6-25-16-32-11-9-30-4-41-15-8-8-3-17 5-24Z" />
          <path d="M118 157c12 5 22 15 21 28-1 15-15 24-27 19-13-5-23-22-18-35 4-11 13-15 24-12Z" />
          <path d="M151 204c18-6 36 6 43 24 5 14 17 24 25 37 8 14 5 32-6 46-10 14-12 32-27 41-14 9-28-4-29-21-2-19-11-35-21-51-8-14-2-29-7-43-5-15 5-29 22-33Z" />
          <path d="M108 60c20-13 49-17 75-12 17 3 28 11 28 21 0 12-19 16-39 13-22-2-42-5-63-2-18 2-18-10-1-20Z" />
          <path d="M216 73c17-10 45-10 60 0 11 8 7 21-8 25-16 4-43-1-55-10-7-5-4-11 3-15Z" />
          <path d="M231 120c20-24 58-32 91-20 30 10 50 34 47 62-2 19-18 28-36 22-20-7-35-1-49 12-16 14-39 16-58 5-14-8-19-22-12-36 7-13 24-16 32-27 5-7-23-4-15-18Z" />
          <path d="M260 194c21-12 51-12 78-4 20 6 40 21 44 40 4 17-9 29-30 29-21 0-34-13-54-8-18 5-27 24-47 18-18-6-25-22-17-39 5-13 13-28 26-36Z" />
          <path d="M306 270c20-5 43 3 56 19 12 14 8 30-8 37-18 8-37-2-52-15-16-13-17-35 4-41Z" />
          <path d="M82 335c57 18 154 24 242 11 34-5 46 13 15 24-56 19-191 20-260-2-31-9-29-43 3-33Z" />
        </g>
        <g fill="#9dd5c8" opacity="0.38">
          <path d="M88 246c8-8 21-8 30-2 9 6 9 18-2 23-12 5-33-5-28-21Z" />
          <path d="M334 112c12 0 25 8 28 18 3 12-11 17-24 12-13-4-20-17-4-30Z" />
          <path d="M222 316c14-4 31 3 34 14 2 10-12 17-27 12-14-4-19-17-7-26Z" />
          <path d="M278 151c7-4 17-3 23 3 5 5 3 12-5 14-10 2-24-5-18-17Z" />
        </g>
      </g>
    </svg>
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
