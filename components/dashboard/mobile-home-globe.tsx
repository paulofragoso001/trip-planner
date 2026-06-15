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
          "wayline-globe-sphere absolute left-1/2 top-[7%] h-[76vw] max-h-[540px] min-h-[330px] w-[76vw] min-w-[330px] max-w-[540px] -translate-x-1/2 rounded-full opacity-95 shadow-[0_0_90px_rgba(20,184,166,0.18),inset_-42px_-46px_80px_rgba(0,0,0,0.62),inset_30px_24px_70px_rgba(125,211,252,0.13)]",
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
        <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_42%_34%,rgba(74,222,128,0.36),transparent_8%),radial-gradient(circle_at_60%_46%,rgba(20,184,166,0.3),transparent_12%),radial-gradient(circle_at_33%_55%,rgba(34,197,94,0.24),transparent_10%),radial-gradient(circle_at_66%_31%,rgba(45,212,191,0.2),transparent_9%),radial-gradient(circle_at_47%_69%,rgba(74,222,128,0.16),transparent_12%),radial-gradient(circle_at_var(--wayline-pin-x)_var(--wayline-pin-y),rgba(250,204,21,0.28),transparent_8%),radial-gradient(circle_at_48%_48%,#0d3340,#071a31_42%,#031024_72%,#010814)]" />
        <div className="absolute inset-0 rounded-full bg-[linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(0deg,rgba(148,163,184,0.08)_1px,transparent_1px)] bg-[length:44px_44px] opacity-45 [mask-image:radial-gradient(circle,black_58%,transparent_72%)]" />
        <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_18%,rgba(255,255,255,0.22),transparent_18%),radial-gradient(circle_at_50%_50%,transparent_52%,rgba(2,6,23,0.84)_78%)]" />
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
      <div className="absolute inset-x-0 bottom-0 h-[54%] bg-[linear-gradient(180deg,transparent,rgba(2,9,22,0.72)_28%,#020916_76%)]" />
      <div
        className={[
          "wayline-orbit-line absolute left-1/2 top-[28%] h-[34vw] max-h-[240px] min-h-[150px] w-[86vw] max-w-[640px] min-w-[380px] -translate-x-1/2 rounded-[999px] border border-cyan-200/16 opacity-60",
          animated ? "wayline-orbit-drift" : ""
        ]
          .filter(Boolean)
          .join(" ")}
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
