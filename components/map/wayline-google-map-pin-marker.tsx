"use client";

import Link from "next/link";
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
    "data-pin-country-code": pin.countryCode ?? undefined,
    "data-pin-id": pin.id,
    "data-pin-kind": pin.kind,
    "data-pin-label": label,
    "data-pin-latitude": pin.coordinate.lat.toFixed(5),
    "data-pin-longitude": pin.coordinate.lng.toFixed(5)
  };
  const markerClassName = [
    "group grid -translate-x-1/2 justify-items-center focus:outline-none",
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
  if (pin.tone === "emerald") return "#059669";
  if (pin.tone === "purple") return "#7c3aed";
  if (pin.tone === "blue") return "#2563eb";
  if (pin.tone === "slate") return "#0f172a";
  if (pin.tone === "white") return "#ffffff";
  return "#f97316";
}
