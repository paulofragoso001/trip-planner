"use client";

import { useJsApiLoader } from "@react-google-maps/api";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { libraries } from "@/lib/google-maps";
import { ALMIDY_MAP_SYSTEM_ID } from "@/lib/map/almidy-map-visuals";

type GoogleMapsProviderProps = {
  blockChildrenOnError?: boolean;
  blockChildrenUntilLoaded?: boolean;
  children: ReactNode;
  fallback?: ReactNode;
  loadingFallback?: ReactNode;
};

type GoogleMapsLoaderProps = GoogleMapsProviderProps & {
  apiKey: string;
};

type GoogleMapsWindow = Window & {
  gm_authFailure?: GoogleMapsAuthFailureHandler;
};

type GoogleMapsAuthFailureHandler = (() => void) & {
  __almidyGoogleMapsAuthFailure?: boolean;
};

const GOOGLE_MAPS_AUTH_FAILURE_EVENT = "almidy:google-maps-auth-failure";

function hasGoogleMapsRuntime() {
  if (typeof window === "undefined") return false;
  const googleWindow = window as Window & {
    google?: { maps?: { importLibrary?: unknown } };
  };
  return typeof googleWindow.google?.maps?.importLibrary === "function";
}

function GoogleMapsLoader({
  apiKey,
  blockChildrenOnError = false,
  blockChildrenUntilLoaded = false,
  children,
  fallback,
  loadingFallback
}: GoogleMapsLoaderProps) {
  const [runtimeAuthFailed, setRuntimeAuthFailed] = useState(false);
  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: apiKey,
    libraries,
    version: "beta"
  });
  // Keep the first client render identical to the server render. A preloaded
  // Google runtime is discovered after hydration by the effect below.
  const [hasPreloadedRuntime, setHasPreloadedRuntime] = useState(false);
  const googleMapsReady = isLoaded || hasPreloadedRuntime;

  useEffect(() => {
    if (hasPreloadedRuntime) return;
    if (hasGoogleMapsRuntime()) {
      setHasPreloadedRuntime(true);
    }
  }, [hasPreloadedRuntime]);

  useEffect(() => {
    const googleWindow = window as GoogleMapsWindow;
    const previousAuthFailure = googleWindow.gm_authFailure;
    const handleRuntimeAuthFailure = () => setRuntimeAuthFailed(true);

    window.addEventListener(GOOGLE_MAPS_AUTH_FAILURE_EVENT, handleRuntimeAuthFailure);

    const handleAuthFailure = (() => {
      window.dispatchEvent(new Event(GOOGLE_MAPS_AUTH_FAILURE_EVENT));
      if (!previousAuthFailure?.__almidyGoogleMapsAuthFailure) {
        previousAuthFailure?.();
      }
    }) as GoogleMapsAuthFailureHandler;

    handleAuthFailure.__almidyGoogleMapsAuthFailure = true;
    googleWindow.gm_authFailure = handleAuthFailure;

    return () => {
      window.removeEventListener(GOOGLE_MAPS_AUTH_FAILURE_EVENT, handleRuntimeAuthFailure);
      if (googleWindow.gm_authFailure === handleAuthFailure) {
        googleWindow.gm_authFailure = previousAuthFailure;
      }
    };
  }, []);

  if (loadError || runtimeAuthFailed) {
    if (blockChildrenOnError) {
      return fallback ?? <GoogleMapsSurfaceFallback />;
    }

    return (
      <>
        <MapWarning>
          The map could not load right now. You can still edit your trip and try again in a moment.
        </MapWarning>
        {children}
      </>
    );
  }

  if (!googleMapsReady) {
    if (blockChildrenUntilLoaded) {
      return loadingFallback ?? fallback ?? <GoogleMapsSurfaceFallback />;
    }

    return (
      <>
        <MapWarning>
          Preparing your map. Location details will appear shortly.
        </MapWarning>
        {children}
      </>
    );
  }

  return (
    <>
      {children}
    </>
  );
}

function MapWarning({ children }: { children: ReactNode }) {
  return (
    <div className="fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] left-1/2 z-30 w-[min(420px,calc(100vw-32px))] -translate-x-1/2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-center text-xs font-semibold text-amber-800 shadow-panel lg:bottom-4 lg:z-50">
      {children}
    </div>
  );
}

export function GoogleMapsSurfaceFallback({
  height = "100%",
  message = "Maps are temporarily unavailable. Your trip details are still available below.",
  placement = "center"
}: {
  height?: number | string;
  message?: string;
  placement?: "center" | "above-sheet";
}) {
  return (
    <div
      className={[
        "relative grid overflow-hidden bg-slate-950 p-6 text-center text-sm font-black text-white/78",
        placement === "above-sheet"
          ? "items-start justify-items-center pt-[min(28svh,18rem)] pb-[58svh]"
          : "place-items-center"
      ].join(" ")}
      data-map-renderer="google-map"
      data-map-runtime="unavailable"
      data-map-system={ALMIDY_MAP_SYSTEM_ID}
      data-testid="google-maps-runtime-fallback"
      style={{ height: typeof height === "number" ? `${height}px` : height }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_20%,rgba(37,99,235,0.42),transparent_31%),radial-gradient(circle_at_72%_36%,rgba(20,184,166,0.28),transparent_28%),linear-gradient(180deg,#0b1d2d,#06101d_58%,#020617)]" />
      <div className="absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:46px_46px]" />
      <div
        className="relative max-w-xs rounded-3xl border border-white/18 bg-slate-950/82 px-5 py-4 shadow-2xl backdrop-blur-xl"
        data-testid="google-maps-runtime-message"
      >
        {message}
      </div>
    </div>
  );
}

export default function GoogleMapsProvider({
  blockChildrenOnError = false,
  blockChildrenUntilLoaded = false,
  children,
  fallback,
  loadingFallback
}: GoogleMapsProviderProps) {
  const pathname = usePathname();
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const isConfigured = Boolean(apiKey && !apiKey.startsWith("YOUR_"));

  if (pathname === "/travel-dashboard") {
    return children;
  }

  if (!isConfigured) {
    if (blockChildrenOnError) {
      return fallback ?? <GoogleMapsSurfaceFallback />;
    }

    return (
      <>
        <MapWarning>
          Maps are temporarily unavailable. You can still save trips and add places.
        </MapWarning>
        {children}
      </>
    );
  }

  return (
    <GoogleMapsLoader
      apiKey={apiKey!}
      blockChildrenOnError={blockChildrenOnError}
      blockChildrenUntilLoaded={blockChildrenUntilLoaded}
      fallback={fallback}
      loadingFallback={loadingFallback}
    >
      {children}
    </GoogleMapsLoader>
  );
}
