"use client";

import Image from "next/image";
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
  x: 58,
  y: 28
};

const COUNTRY_BY_CODE: Record<string, CountryFocus> = {
  AR: { code: "AR", flag: "🇦🇷", name: "Argentina", x: 57, y: 74 },
  AW: { code: "AW", flag: "🇦🇼", name: "Aruba", x: 54, y: 58 },
  BR: { code: "BR", flag: "🇧🇷", name: "Brazil", x: 66, y: 72 },
  CA: { code: "CA", flag: "🇨🇦", name: "Canada", x: 45, y: 29 },
  CL: { code: "CL", flag: "🇨🇱", name: "Chile", x: 54, y: 78 },
  CO: { code: "CO", flag: "🇨🇴", name: "Colombia", x: 55, y: 62 },
  DE: { code: "DE", flag: "🇩🇪", name: "Germany", x: 78, y: 35 },
  ES: { code: "ES", flag: "🇪🇸", name: "Spain", x: 75, y: 45 },
  FR: { code: "FR", flag: "🇫🇷", name: "France", x: 77, y: 39 },
  GB: { code: "GB", flag: "🇬🇧", name: "United Kingdom", x: 73, y: 33 },
  GR: { code: "GR", flag: "🇬🇷", name: "Greece", x: 82, y: 47 },
  IS: { code: "IS", flag: "🇮🇸", name: "Iceland", x: 64, y: 26 },
  IT: { code: "IT", flag: "🇮🇹", name: "Italy", x: 79, y: 44 },
  MX: { code: "MX", flag: "🇲🇽", name: "Mexico", x: 43, y: 57 },
  NL: { code: "NL", flag: "🇳🇱", name: "Netherlands", x: 77, y: 35 },
  PA: { code: "PA", flag: "🇵🇦", name: "Panama", x: 54, y: 59 },
  PT: { code: "PT", flag: "🇵🇹", name: "Portugal", x: 73, y: 45 },
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
  const focus = country ?? DEFAULT_COUNTRY;

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
      style={{
        "--wayline-pin-x": `${focus.x}%`,
        "--wayline-pin-y": `${focus.y}%`
      } as CSSProperties}
    >
      <div
        className="absolute inset-0 overflow-hidden"
        data-earth-source="clean-earth-only-fallback"
        data-testid="mobile-home-earth-photorealistic"
      >
        <Image
          alt=""
          className={[
            "wayline-earth-image object-cover object-[52%_50%] opacity-100 brightness-[0.94] contrast-[1.08] saturate-[1.06]",
            animated && !introComplete ? "wayline-earth-intro" : ""
          ]
            .filter(Boolean)
            .join(" ")}
          data-testid="mobile-home-earth-image"
          fill
          priority
          sizes="(max-width: 1023px) 100vw, 1px"
          src="/globe/wayline-earth-hero.png"
        />
      </div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_var(--wayline-pin-x)_var(--wayline-pin-y),rgba(251,191,36,0.24),transparent_9%),radial-gradient(circle_at_22%_12%,rgba(147,197,253,0.18),transparent_24%),linear-gradient(180deg,rgba(2,9,22,0.05),rgba(2,9,22,0.02)_48%,#020916_100%)]" />
      {showPin && country ? (
        <div
          className="wayline-country-pin absolute z-20 -translate-x-1/2 -translate-y-full text-center"
          data-country-code={country.code}
          data-testid="mobile-home-country-pin"
          style={{
            left: "var(--wayline-pin-x)",
            top: "var(--wayline-pin-y)"
          }}
        >
          <div className="mx-auto grid h-11 w-11 place-items-center rounded-full border-2 border-white/88 bg-slate-50 text-2xl shadow-[0_12px_34px_rgba(0,0,0,0.42),0_0_26px_rgba(251,146,60,0.24)]">
            <span aria-hidden="true">{country.flag}</span>
          </div>
          <div
            className="mt-1 max-w-28 truncate rounded-full bg-black/54 px-2 py-0.5 text-[0.62rem] font-black uppercase tracking-[0.12em] text-white/88 backdrop-blur"
            data-testid="mobile-home-country-name"
          >
            {country.name}
          </div>
        </div>
      ) : null}
      <div className="absolute inset-x-0 top-0 h-36 bg-[linear-gradient(180deg,rgba(2,9,22,0.7),transparent)]" />
      <div className="absolute inset-x-0 bottom-0 h-[54%] bg-[linear-gradient(180deg,transparent,rgba(2,9,22,0.48)_48%,#020817_100%)]" />
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
