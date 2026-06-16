"use client";

import Image from "next/image";
import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";

type Photorealistic3DHomeHeroProps = {
  className?: string;
};

type HeroState = "loading" | "ready3d" | "3d-static" | "fallback" | "error";

type CountryFocus = {
  altitude: number;
  code: string;
  flag: string;
  lat: number;
  lng: number;
  name: string;
  pinX: number;
  pinY: number;
};

type MapsImportLibrary = (libraryName: string) => Promise<unknown>;
type MapCameraFrame = {
  altitude: number;
  heading: number;
  lat: number;
  lng: number;
  range: number;
  tilt: number;
};

declare global {
  interface Window {
    google?: {
      maps?: {
        importLibrary?: MapsImportLibrary;
      };
    };
  }
}

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
const ENABLE_3D_HOME_GLOBE = process.env.NEXT_PUBLIC_ENABLE_3D_HOME_GLOBE === "true";
const THREE_D_CAMERA_INTRO_MS = 2_200;
const THREE_D_LOAD_TIMEOUT_MS = 4_500;

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

let googleMapsScriptPromise: Promise<void> | null = null;

export function Photorealistic3DHomeHero({ className }: Photorealistic3DHomeHeroProps) {
  const mapHostRef = useRef<HTMLDivElement | null>(null);
  const introTimerRef = useRef<number | null>(null);
  const [country, setCountry] = useState<CountryFocus>(DEFAULT_COUNTRY);
  const [heroState, setHeroState] = useState<HeroState>(ENABLE_3D_HOME_GLOBE ? "loading" : "fallback");
  const [introComplete, setIntroComplete] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

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

    return () => media.removeEventListener("change", syncMotion);
  }, []);

  useEffect(() => {
    const localeCountry = countryFromLocale(navigator.languages?.[0] || navigator.language);
    const timezoneCountry = countryFromTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);

    setCountry(localeCountry || timezoneCountry || DEFAULT_COUNTRY);

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
    if (reduceMotion) {
      return;
    }

    introTimerRef.current = window.setTimeout(() => setIntroComplete(true), 2_000);

    return () => {
      if (introTimerRef.current !== null) {
        window.clearTimeout(introTimerRef.current);
      }
    };
  }, [reduceMotion]);

  useEffect(() => {
    if (reduceMotion || !ENABLE_3D_HOME_GLOBE || !GOOGLE_MAPS_API_KEY || !mapHostRef.current) {
      mapHostRef.current?.replaceChildren();
      setHeroState("fallback");
      return;
    }

    let cancelled = false;
    let loadTimeout: number | null = null;
    let cancelCameraAnimation: (() => void) | null = null;
    const host = mapHostRef.current;
    const focus = country ?? DEFAULT_COUNTRY;
    setHeroState("loading");
    host.replaceChildren();

    loadTimeout = window.setTimeout(() => {
      if (cancelled) {
        return;
      }

      host.replaceChildren();
      setHeroState("fallback");
    }, THREE_D_LOAD_TIMEOUT_MS);

    async function mount3DMap() {
      try {
        await ensureGoogleMaps3D(GOOGLE_MAPS_API_KEY);
        const importLibrary = getMapsImportLibrary();

        if (!importLibrary) {
          throw new Error("Google Maps importLibrary unavailable");
        }

        await importLibrary("maps3d");

        if (cancelled || !host) {
          return;
        }

        if (loadTimeout !== null) {
          window.clearTimeout(loadTimeout);
          loadTimeout = null;
        }

        const mapElement = document.createElement("gmp-map-3d");
        mapElement.className = "absolute inset-0 h-full w-full";
        mapElement.setAttribute("data-testid", "home-3d-map");
        mapElement.setAttribute("mode", "hybrid");
        setMapCamera(mapElement, reduceMotion ? getSettledCamera(focus) : getStartCamera(focus));
        host.replaceChildren(mapElement);
        setHeroState("ready3d");

        if (!reduceMotion) {
          if (typeof window.requestAnimationFrame === "function") {
            cancelCameraAnimation = animateMapCamera(mapElement, focus, () => {
              if (!cancelled) {
                setHeroState("ready3d");
              }
            });
          } else {
            setMapCamera(mapElement, getSettledCamera(focus));
            setHeroState("3d-static");
          }
        }
      } catch {
        if (!cancelled) {
          if (loadTimeout !== null) {
            window.clearTimeout(loadTimeout);
            loadTimeout = null;
          }
          host.replaceChildren();
          setHeroState("fallback");
        }
      }
    }

    mount3DMap();

    return () => {
      cancelled = true;
      if (cancelCameraAnimation) {
        cancelCameraAnimation();
      }
      if (loadTimeout !== null) {
        window.clearTimeout(loadTimeout);
      }
      host.replaceChildren();
    };
  }, [country, reduceMotion]);

  const focus = country;
  const showPin =
    (heroState === "ready3d" || heroState === "3d-static" || heroState === "fallback") &&
    (introComplete || reduceMotion);

  return (
    <div
      aria-hidden="true"
      className={[
        "pointer-events-none absolute inset-0 overflow-hidden bg-[#020916]",
        className
      ]
        .filter(Boolean)
        .join(" ")}
      data-3d-enabled={ENABLE_3D_HOME_GLOBE ? "true" : "false"}
      data-home-hero-mode={`home-hero-mode: ${reduceMotion ? "reduced-motion" : heroState}`}
      data-hero-mode={heroState}
      data-testid="photorealistic-3d-home-hero"
      style={{
        "--wayline-pin-x": `${focus.pinX}%`,
        "--wayline-pin-y": `${focus.pinY}%`
      } as CSSProperties}
    >
      <div className="absolute inset-0" data-testid="earth-only-visual">
        {heroState === "loading" ? <HomeHeroLoading /> : null}
        {heroState === "fallback" ? <HomeHeroFallback reduceMotion={reduceMotion} /> : null}
        <div
          className={[
            "absolute inset-0 z-[2] overflow-hidden transition-opacity duration-700",
            heroState === "ready3d" || heroState === "3d-static" ? "opacity-100" : "opacity-0"
          ].join(" ")}
          data-testid="home-3d-map-stage"
          ref={mapHostRef}
        />
      </div>
      <div className="absolute inset-0 z-10 bg-[radial-gradient(circle_at_var(--wayline-pin-x)_var(--wayline-pin-y),rgba(251,191,36,0.3),transparent_7%),radial-gradient(ellipse_at_50%_0%,rgba(125,194,255,0.24),transparent_33%),linear-gradient(180deg,rgba(2,9,22,0)_0%,rgba(2,9,22,0.02)_36%,rgba(2,8,20,0.38)_76%,#020817_100%)]" />
      {showPin ? (
        <div
          className="wayline-country-pin absolute z-20 -translate-x-1/2 -translate-y-1/2 text-center"
          data-country-code={focus.code}
          data-testid="mobile-home-country-pin"
          style={{
            left: "var(--wayline-pin-x)",
            top: "var(--wayline-pin-y)"
          }}
        >
          <div className="mx-auto grid h-11 w-11 place-items-center rounded-full border-2 border-white/88 bg-slate-50 text-2xl shadow-[0_14px_36px_rgba(0,0,0,0.5),0_0_30px_rgba(251,146,60,0.34)]">
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
      <div className="absolute inset-x-0 top-0 z-10 h-20 bg-[linear-gradient(180deg,rgba(2,9,22,0.36),transparent)]" />
      <div className="absolute inset-x-0 bottom-0 z-10 h-[46%] bg-[linear-gradient(180deg,transparent,rgba(2,8,20,0.48)_38%,#020817_100%)]" />
    </div>
  );
}

function HomeHeroFallback({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <div
      className="absolute inset-0 z-[1] overflow-hidden bg-[radial-gradient(circle_at_50%_0%,rgba(96,165,250,0.22),transparent_25%),radial-gradient(circle_at_14%_14%,rgba(255,255,255,0.18),transparent_1px),radial-gradient(circle_at_82%_18%,rgba(255,255,255,0.16),transparent_1px),radial-gradient(circle_at_22%_32%,rgba(255,255,255,0.12),transparent_1px),radial-gradient(circle_at_74%_5%,rgba(255,255,255,0.18),transparent_1px),#020916]"
      data-earth-source="photorealistic-3d-fallback"
      data-testid="earth-static-fallback"
    >
      <Image
        alt=""
        className={[
          "absolute left-1/2 top-[-2.4rem] h-auto w-[174vw] max-w-[46rem] -translate-x-1/2 opacity-100 brightness-[0.88] contrast-[1.22] saturate-[1.1] drop-shadow-[0_0_46px_rgba(96,165,250,0.34)]",
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

function HomeHeroLoading() {
  return (
    <div
      className="absolute inset-0 z-[1] overflow-hidden bg-[#020916]"
      data-testid="home-3d-loading"
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(96,165,250,0.24),transparent_28%),radial-gradient(circle_at_14%_14%,rgba(255,255,255,0.16),transparent_1px),radial-gradient(circle_at_82%_18%,rgba(255,255,255,0.16),transparent_1px),radial-gradient(circle_at_22%_32%,rgba(255,255,255,0.1),transparent_1px),radial-gradient(circle_at_74%_5%,rgba(255,255,255,0.18),transparent_1px),linear-gradient(180deg,#041225_0%,#020916_74%,#020817_100%)]" />
      <div className="wayline-home-3d-loading-glow absolute left-1/2 top-[10%] h-[42vw] min-h-[150px] w-[154vw] max-w-[760px] -translate-x-1/2 rounded-[50%] border-t border-sky-200/30 bg-[radial-gradient(ellipse_at_50%_0%,rgba(56,189,248,0.16),transparent_55%)] opacity-80 shadow-[0_0_64px_rgba(96,165,250,0.18)]" />
      <div className="absolute inset-x-0 bottom-0 h-[60%] bg-[linear-gradient(180deg,transparent,rgba(2,9,22,0.54)_42%,#020817_100%)]" />
    </div>
  );
}

function animateMapCamera(
  mapElement: HTMLElement,
  country: CountryFocus,
  onComplete: () => void
) {
  const startedAt = performance.now();
  const startCamera = getStartCamera(country);
  const endCamera = getSettledCamera(country);
  let animationFrame: number | null = null;
  let cancelled = false;

  const run = (now: number) => {
    if (cancelled) {
      return;
    }

    const progress = Math.min((now - startedAt) / THREE_D_CAMERA_INTRO_MS, 1);
    const eased = easeOutCubic(progress);
    setMapCamera(mapElement, interpolateCamera(startCamera, endCamera, eased));
    mapElement.setAttribute("data-camera-progress", progress.toFixed(3));

    if (progress < 1) {
      animationFrame = window.requestAnimationFrame(run);
      return;
    }

    mapElement.setAttribute("data-camera-progress", "1");
    onComplete();
  };

  animationFrame = window.requestAnimationFrame(run);
  return () => {
    cancelled = true;
    if (animationFrame !== null) {
      window.cancelAnimationFrame(animationFrame);
    }
  };
}

function setMapCamera(mapElement: HTMLElement, camera: MapCameraFrame) {
  mapElement.setAttribute("center", `${camera.lat},${camera.lng},${camera.altitude}`);
  mapElement.setAttribute("heading", camera.heading.toFixed(2));
  mapElement.setAttribute("range", Math.round(camera.range).toString());
  mapElement.setAttribute("tilt", camera.tilt.toFixed(2));
}

function getStartCamera(country: CountryFocus): MapCameraFrame {
  return {
    altitude: country.altitude + 1_080_000,
    heading: 384,
    lat: country.lat + 10,
    lng: country.lng - 36,
    range: 8_200_000,
    tilt: 26
  };
}

function getSettledCamera(country: CountryFocus): MapCameraFrame {
  return {
    altitude: country.altitude + 520_000,
    heading: 318,
    lat: country.lat + 2,
    lng: country.lng - 8,
    range: 4_700_000,
    tilt: 38
  };
}

function interpolateCamera(start: MapCameraFrame, end: MapCameraFrame, progress: number): MapCameraFrame {
  return {
    altitude: interpolate(start.altitude, end.altitude, progress),
    heading: interpolate(start.heading, end.heading, progress),
    lat: interpolate(start.lat, end.lat, progress),
    lng: interpolate(start.lng, end.lng, progress),
    range: interpolate(start.range, end.range, progress),
    tilt: interpolate(start.tilt, end.tilt, progress)
  };
}

function interpolate(start: number, end: number, progress: number) {
  return start + (end - start) * progress;
}

function easeOutCubic(progress: number) {
  return 1 - Math.pow(1 - progress, 3);
}

async function ensureGoogleMaps3D(apiKey: string) {
  if (typeof window === "undefined") {
    return;
  }

  if (getMapsImportLibrary()) {
    return;
  }

  if (googleMapsScriptPromise) {
    return googleMapsScriptPromise;
  }

  googleMapsScriptPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src*="maps.googleapis.com/maps/api/js"]'
    );

    if (existingScript) {
      waitForImportLibrary(resolve, reject);
      return;
    }

    waitForExistingMapsScript(1_800)
      .then((foundExistingScript) => {
        if (foundExistingScript || getMapsImportLibrary()) {
          waitForImportLibrary(resolve, reject);
          return;
        }

        const callbackName = `__waylineHome3DMapsReady_${Date.now()}`;
        const script = document.createElement("script");
        const params = new URLSearchParams({
          callback: callbackName,
          key: apiKey,
          libraries: "maps3d",
          loading: "async",
          v: "alpha"
        });

        (window as unknown as Record<string, () => void>)[callbackName] = () => {
          delete (window as unknown as Record<string, unknown>)[callbackName];
          waitForImportLibrary(resolve, reject);
        };

        script.async = true;
        script.defer = true;
        script.onerror = () => {
          delete (window as unknown as Record<string, unknown>)[callbackName];
          reject(new Error("Google Maps 3D script failed to load"));
        };
        script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
        document.head.appendChild(script);
      })
      .catch(reject);
  });

  return googleMapsScriptPromise;
}

function waitForExistingMapsScript(timeoutMs: number) {
  return new Promise<boolean>((resolve) => {
    const startedAt = Date.now();
    const check = () => {
      if (
        getMapsImportLibrary() ||
        document.querySelector<HTMLScriptElement>('script[src*="maps.googleapis.com/maps/api/js"]')
      ) {
        resolve(true);
        return;
      }

      if (Date.now() - startedAt > timeoutMs) {
        resolve(false);
        return;
      }

      window.setTimeout(check, 80);
    };

    check();
  });
}

function getMapsImportLibrary(): MapsImportLibrary | null {
  const maybeGoogle = window.google as unknown as
    | { maps?: { importLibrary?: unknown } }
    | undefined;

  return typeof maybeGoogle?.maps?.importLibrary === "function"
    ? (maybeGoogle.maps.importLibrary as MapsImportLibrary)
    : null;
}

function waitForImportLibrary(resolve: () => void, reject: (reason?: unknown) => void) {
  const startedAt = Date.now();
  const check = () => {
    if (getMapsImportLibrary()) {
      resolve();
      return;
    }

    if (Date.now() - startedAt > 6_000) {
      reject(new Error("Google Maps importLibrary unavailable"));
      return;
    }

    window.setTimeout(check, 100);
  };

  check();
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
