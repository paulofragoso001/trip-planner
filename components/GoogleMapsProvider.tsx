"use client";

import { useJsApiLoader } from "@react-google-maps/api";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { libraries } from "@/lib/google-maps";
import { ALMIDY_MAP_SYSTEM_ID } from "@/lib/map/almidy-map-visuals";

type GoogleMapsProviderProps = {
  blockChildrenOnError?: boolean;
  children: ReactNode;
  fallback?: ReactNode;
};

type GoogleMapsLoaderProps = GoogleMapsProviderProps & {
  apiKey: string;
};

type GoogleMapsWindow = Window & {
  gm_authFailure?: () => void;
};

function GoogleMapsLoader({
  apiKey,
  blockChildrenOnError = false,
  children,
  fallback
}: GoogleMapsLoaderProps) {
  const [runtimeAuthFailed, setRuntimeAuthFailed] = useState(false);
  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: apiKey,
    libraries,
    version: "beta"
  });

  useEffect(() => {
    const googleWindow = window as GoogleMapsWindow;
    const previousAuthFailure = googleWindow.gm_authFailure;

    const handleAuthFailure = () => {
      setRuntimeAuthFailed(true);
      previousAuthFailure?.();
    };

    googleWindow.gm_authFailure = handleAuthFailure;

    return () => {
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

  if (!isLoaded) {
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
  message = "Maps are temporarily unavailable. Your trip details are still available below."
}: {
  height?: number | string;
  message?: string;
}) {
  return (
    <div
      className="relative grid place-items-center overflow-hidden bg-slate-950 p-6 text-center text-sm font-black text-white/78"
      data-map-renderer="google-map"
      data-map-runtime="unavailable"
      data-map-system={ALMIDY_MAP_SYSTEM_ID}
      data-testid="google-maps-runtime-fallback"
      style={{ height: typeof height === "number" ? `${height}px` : height }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_20%,rgba(37,99,235,0.42),transparent_31%),radial-gradient(circle_at_72%_36%,rgba(20,184,166,0.28),transparent_28%),linear-gradient(180deg,#0b1d2d,#06101d_58%,#020617)]" />
      <div className="absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:46px_46px]" />
      <div className="relative max-w-xs rounded-3xl border border-white/12 bg-slate-950/72 px-5 py-4 shadow-2xl backdrop-blur-xl">
        {message}
      </div>
    </div>
  );
}

export default function GoogleMapsProvider({
  blockChildrenOnError = false,
  children,
  fallback
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
      fallback={fallback}
    >
      {children}
    </GoogleMapsLoader>
  );
}
