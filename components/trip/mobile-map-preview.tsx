"use client";

import Link from "next/link";
import { MapIcon, Navigation } from "lucide-react";
import { useMemo } from "react";
import { GoogleMapRenderer } from "@/components/map/google-map-renderer";
import type { TripMapItem } from "@/components/TripMap";
import type { AlmidyMapSurfaceState } from "@/lib/map/wayline-map-models";

type MobileMapPreviewProps = {
  ctaHref?: string;
  ctaLabel?: string;
  height?: string;
  items: TripMapItem[];
  label: string;
  title: string;
};

export function MobileMapPreview({
  ctaHref,
  ctaLabel = "Open map",
  height = "18rem",
  items,
  label,
  title
}: MobileMapPreviewProps) {
  const mapSurface = useMemo(() => tripItemsToMapSurface(items), [items]);

  return (
    <section
      aria-label={title}
      className="relative min-h-[18rem] overflow-hidden bg-slate-950"
      data-map-theme="dark"
      data-testid="mobile-real-map-preview"
      style={{ minHeight: height }}
    >
      {items.length ? (
        <GoogleMapRenderer
          height={height}
          mapTheme="dark"
          surfaceState={mapSurface}
        />
      ) : (
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(rgba(59,130,246,0.16)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.16)_1px,transparent_1px),radial-gradient(circle_at_32%_24%,rgba(56,189,248,0.28),transparent_34%),linear-gradient(135deg,#08111f,#132a46_54%,#07111f)] bg-[size:72px_72px,72px_72px,auto,auto]"
        />
      )}

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-slate-950/80 to-transparent"
      />
      <p className="pointer-events-none absolute bottom-4 left-4 rounded-full bg-black/72 px-3 py-1 text-xs font-black text-white shadow-lg backdrop-blur">
        {label}
      </p>
      {ctaHref ? (
        <Link
          aria-label={ctaLabel}
          className="absolute right-4 top-4 z-10 inline-flex min-h-11 items-center justify-center rounded-full bg-black/72 px-4 text-xs font-black text-white shadow-lg ring-1 ring-white/10 backdrop-blur transition hover:bg-black/82 focus:outline-none focus:ring-4 focus:ring-orange-300/20"
          href={ctaHref}
        >
          {ctaLabel}
        </Link>
      ) : null}
      <div className="absolute right-4 top-5 z-10 grid overflow-hidden rounded-2xl bg-black/86 text-orange-400 shadow-2xl ring-1 ring-white/10 backdrop-blur">
        <button
          aria-label="Map layers"
          className="grid h-12 w-12 place-items-center border-b border-white/10"
          type="button"
        >
          <MapIcon className="h-5 w-5" aria-hidden="true" />
        </button>
        <button
          aria-label="Center route map"
          className="grid h-12 w-12 place-items-center"
          type="button"
        >
          <Navigation className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}

function tripItemsToMapSurface(items: TripMapItem[]): AlmidyMapSurfaceState {
  const firstItem = items[0];
  const center = firstItem ? { lat: firstItem.lat, lng: firstItem.lng } : { lat: 25.7617, lng: -80.1918 };

  return {
    camera: {
      center,
      intent: "trip",
      selectedId: firstItem?.id ?? null,
      zoom: items.length > 1 ? 11 : 14
    },
    location: {
      coordinate: null,
      permission: "unknown",
      source: "fallback"
    },
    mode: "route",
    pins: items.map((item, index) => ({
      coordinate: { lat: item.lat, lng: item.lng },
      id: item.id,
      imageAlt: item.imageAlt,
      imageAttribution: item.imageAttribution,
      imageUrl: item.imageUrl,
      kind: "place",
      label: item.title,
      order: item.routeOrder ?? index + 1,
      provider: item.provider,
      providerPlaceId: item.providerPlaceId,
      selected: item.id === firstItem?.id,
      subtitle: item.category,
      tone: item.id === firstItem?.id ? "orange" : "blue"
    })),
    renderer: "google-2d",
    routes: [],
    selectedId: firstItem?.id ?? null
  };
}
