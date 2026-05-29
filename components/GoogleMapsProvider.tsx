"use client";

import { useJsApiLoader } from "@react-google-maps/api";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { libraries } from "@/lib/google-maps";

type GoogleMapsProviderProps = {
  children: ReactNode;
};

type GoogleMapsLoaderProps = GoogleMapsProviderProps & {
  apiKey: string;
};

function GoogleMapsLoader({ apiKey, children }: GoogleMapsLoaderProps) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: apiKey,
    libraries,
    version: "beta"
  });

  if (loadError) {
    return (
      <>
        <MapWarning>
          Google Maps could not load. Check API key and referrer restrictions.
        </MapWarning>
        {children}
      </>
    );
  }

  if (!isLoaded) {
    return (
      <>
        <MapWarning>
          Google Maps is loading. Map-dependent panels will fill in when it is ready.
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
    <div className="fixed bottom-4 left-1/2 z-50 w-[min(420px,calc(100vw-32px))] -translate-x-1/2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-center text-xs font-semibold text-amber-800 shadow-panel">
      {children}
    </div>
  );
}

export default function GoogleMapsProvider({ children }: GoogleMapsProviderProps) {
  const pathname = usePathname();
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const isConfigured = Boolean(apiKey && !apiKey.startsWith("YOUR_"));

  if (pathname === "/travel-dashboard") {
    return children;
  }

  if (!isConfigured) {
    return (
      <>
        <MapWarning>
          Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to enable Google Maps.
        </MapWarning>
        {children}
      </>
    );
  }

  return <GoogleMapsLoader apiKey={apiKey!}>{children}</GoogleMapsLoader>;
}
