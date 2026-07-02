"use client";

import Link from "next/link";
import {
  ALMIDY_MAP_SYSTEM_ID,
  almidyMapPinColor
} from "@/lib/map/almidy-map-visuals";
import { pinDisplayLabel, pinGlyph } from "@/lib/map/wayline-map-pins";
import type { AlmidyMapPin } from "@/lib/map/wayline-map-models";

type AlmidyGoogleMapPinMarkerProps = {
  pin: AlmidyMapPin;
  className?: string;
  href?: string | null;
  labelClassName?: string;
  onSelect?: (pinId: string) => void;
  showLabel?: boolean;
  testId?: string;
  variant?: "compact" | "flag-label";
};

export function AlmidyGoogleMapPinMarker({
  className,
  href,
  labelClassName,
  onSelect,
  pin,
  showLabel = false,
  testId,
  variant = "compact"
}: AlmidyGoogleMapPinMarkerProps) {
  const label = pinDisplayLabel(pin);
  const glyph = pinGlyph(pin);
  const markerDataAttributes = {
    "data-active": pin.selected ? "true" : "false",
    "data-country-code": pin.countryCode ?? undefined,
    "data-pin-country-code": pin.countryCode ?? undefined,
    "data-pin-id": pin.id,
    "data-pin-kind": pin.kind,
    "data-pin-label": label,
    "data-pin-latitude": pin.coordinate.lat.toFixed(5),
    "data-pin-longitude": pin.coordinate.lng.toFixed(5),
    "data-trip-id": pin.tripId ?? undefined,
    position: `${pin.coordinate.lat.toFixed(5)}, ${pin.coordinate.lng.toFixed(5)}, 0`
  };
  const markerClassName = [
    "group pointer-events-auto grid touch-manipulation -translate-x-1/2 justify-items-center focus:outline-none",
    variant === "flag-label" ? "-translate-y-full" : "-translate-y-1/2",
    className
  ]
    .filter(Boolean)
    .join(" ");
  const markerContent = (
    <>
      <span
        className={[
          "grid place-items-center rounded-full text-center font-black shadow-[0_10px_26px_rgba(0,0,0,0.55)] transition group-hover:scale-105 group-focus:ring-4 group-focus:ring-orange-400/30",
          variant === "flag-label"
            ? "min-h-10 min-w-10 text-[2.35rem] leading-none drop-shadow-[0_8px_18px_rgba(0,0,0,0.72)]"
            : "min-h-9 min-w-9 border-2 border-white px-2 text-sm text-white",
          pin.selected && variant === "compact" ? "ring-4 ring-orange-200" : "",
          pin.selected && variant === "flag-label" ? "scale-105" : ""
        ].join(" ")}
        style={variant === "compact" ? { backgroundColor: markerColor(pin) } : undefined}
      >
        {glyph}
      </span>
      {showLabel ? (
        <span
          className={[
            "mt-0.5 max-w-32 truncate whitespace-nowrap text-center text-sm font-black text-white [text-shadow:0_2px_5px_rgba(0,0,0,0.95)]",
            variant === "flag-label" ? "-mt-1" : "",
            labelClassName
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {label}
        </span>
      ) : null}
    </>
  );

  if (href) {
    return (
      <Link
        aria-label={`Open ${pin.label}`}
        className={markerClassName}
        {...markerDataAttributes}
        data-map-system={ALMIDY_MAP_SYSTEM_ID}
        data-testid={testId}
        href={href}
        title={pin.label}
      >
        {markerContent}
      </Link>
    );
  }

  return (
    <button
      aria-label={`Select ${pin.label}`}
      className={markerClassName}
      {...markerDataAttributes}
      data-map-system={ALMIDY_MAP_SYSTEM_ID}
      data-testid={testId}
      onClick={() => onSelect?.(pin.id)}
      title={pin.label}
      type="button"
    >
      {markerContent}
    </button>
  );
}

function markerColor(pin: AlmidyMapPin) {
  return almidyMapPinColor(pin.tone);
}
