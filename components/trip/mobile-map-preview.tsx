"use client";

import Link from "next/link";
import GoogleMapsProvider from "@/components/GoogleMapsProvider";
import TripMap, { type TripMapItem } from "@/components/TripMap";

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
  return (
    <section
      aria-label={title}
      className="relative min-h-[18rem] overflow-hidden bg-slate-950"
      data-map-theme="dark"
      data-testid="mobile-real-map-preview"
      style={{ minHeight: height }}
    >
      {items.length ? (
        <GoogleMapsProvider>
          <TripMap
            height={height}
            items={items}
            mapTheme="dark"
            selectedId={items[0]?.id ?? null}
            showRouteDetails={false}
          />
        </GoogleMapsProvider>
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
    </section>
  );
}
