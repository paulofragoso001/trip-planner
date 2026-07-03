"use client";

import Link from "next/link";
import { MapIcon, Navigation } from "lucide-react";
import { useMemo } from "react";
import { CustomGlobeRenderer } from "@/components/map/custom-globe-renderer";
import type { TripMapItem } from "@/components/TripMap";
import { countryCodeToFlag } from "@/lib/map/wayline-map-pins";

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
  const mapPins = useMemo(() => tripItemsToApplePins(items), [items]);

  return (
    <section
      aria-label={title}
      className="relative min-h-[18rem] overflow-hidden bg-slate-950"
      data-map-theme="dark"
      data-testid="mobile-real-map-preview"
      style={{ minHeight: height }}
    >
      {items.length ? (
        <CustomGlobeRenderer
          className="absolute inset-0"
          mapInstanceKey={`timeline-preview-${mapPins.map((pin) => pin.id).join("-")}`}
          showCountryPin={false}
          tripPins={mapPins}
          useLocationFocus={false}
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

function tripItemsToApplePins(items: TripMapItem[]) {
  return items.map((item, index) => {
    const countryCode = inferCountryCodeForTripItem(item);

    return {
      countryCode,
      flag: countryCodeToFlag(countryCode) ?? "•",
      id: item.id,
      label: item.title,
      lat: item.lat,
      lng: item.lng,
      subtitle: item.category,
      tripId: item.id || `timeline-pin-${index}`
    };
  });
}

function inferCountryCodeForTripItem(item: TripMapItem) {
  const text = [item.title, item.address, item.category, item.route?.destination?.address, item.route?.origin?.address]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (text.includes("brazil") || text.includes("são paulo") || text.includes("guarulhos")) return "BR";
  if (text.includes("spain") || text.includes("barcelona") || text.includes("madrid")) return "ES";
  if (text.includes("japan") || text.includes("tokyo") || text.includes("kyoto")) return "JP";
  if (text.includes("canada") || text.includes("vancouver")) return "CA";
  return "US";
}
