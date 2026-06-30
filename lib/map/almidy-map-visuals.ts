import type { AlmidyMapPinTone } from "@/lib/map/wayline-map-models";

export const ALMIDY_MAP_SYSTEM_ID = "almidy-map-system";

export const almidyMapColors = {
  background: "#020916",
  land: "#123f45",
  landMuted: "#172033",
  pinBlue: "#2563eb",
  pinEmerald: "#059669",
  pinOrange: "#f97316",
  pinPurple: "#7c3aed",
  pinSlate: "#0f172a",
  route: "#f97316",
  routeMuted: "#2563eb",
  routeResolved: "#0f172a",
  routeResolvedActive: "#059669",
  water: "#061331"
} as const;

export function almidyMapPinColor(tone: AlmidyMapPinTone | null | undefined) {
  if (tone === "blue") return almidyMapColors.pinBlue;
  if (tone === "emerald") return almidyMapColors.pinEmerald;
  if (tone === "purple") return almidyMapColors.pinPurple;
  if (tone === "slate") return almidyMapColors.pinSlate;
  if (tone === "white") return "#ffffff";
  return almidyMapColors.pinOrange;
}

export const almidyGoogleMapDarkStyles: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: almidyMapColors.landMuted }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#e2e8f0" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: almidyMapColors.background }, { weight: 3 }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#334155" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#0f3b35" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#1f2937" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: almidyMapColors.pinSlate }] },
  { featureType: "road", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#94a3b8" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: almidyMapColors.water }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#60a5fa" }] }
];

export const almidyGoogleCountryMapStyles: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#252832" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#b9bdc7" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#161920" }, { weight: 3.5 }] },
  { featureType: "administrative.country", elementType: "geometry.stroke", stylers: [{ color: "#5b6270" }, { weight: 1.35 }] },
  { featureType: "administrative.province", elementType: "geometry.stroke", stylers: [{ color: "#3e4654" }, { weight: 0.8 }] },
  { featureType: "administrative.land_parcel", stylers: [{ visibility: "off" }] },
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#2f3440" }] },
  { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: "#343a45" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "road", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#111827" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#6f7d92" }] }
];
