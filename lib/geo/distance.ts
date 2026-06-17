export type GeoPoint = {
  lat: number;
  lng: number;
};

export type DistanceUnit = "mi" | "km";

export type DistanceAnchorKind =
  | "current-location"
  | "destination"
  | "lodging"
  | "place"
  | "transport";

export type DistanceAnchorOption = {
  detail?: string | null;
  id: string;
  kind: DistanceAnchorKind;
  label: string;
  point: GeoPoint;
};

export type DistanceAnchorSource = {
  address?: string | null;
  category?: string | null;
  id: string;
  kind?: string | null;
  lat?: number | null;
  lng?: number | null;
  title: string;
};

const earthRadiusKm = 6371;

export function hasGeoPoint(value: unknown): value is GeoPoint {
  if (!value || typeof value !== "object") return false;
  const point = value as Partial<GeoPoint>;
  return Number.isFinite(point.lat) && Number.isFinite(point.lng);
}

export function haversineDistanceKm(a: GeoPoint, b: GeoPoint) {
  if (!hasGeoPoint(a) || !hasGeoPoint(b)) return null;

  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function distanceUnitForLocale(locale?: string | null): DistanceUnit {
  const normalized = (locale || "").toLowerCase();
  if (normalized === "en-us" || normalized.endsWith("-us")) return "mi";
  return "km";
}

export function distanceValueForUnit(distanceKm: number, unit: DistanceUnit) {
  return unit === "mi" ? distanceKm * 0.621371 : distanceKm;
}

export function formatDistance(distanceKm: number | null, locale?: string | null) {
  if (distanceKm === null || !Number.isFinite(distanceKm)) return null;

  const unit = distanceUnitForLocale(locale);
  const value = distanceValueForUnit(distanceKm, unit);
  if (value < 0.05) return null;

  const rounded = value < 10 ? value.toFixed(1) : String(Math.round(value));
  return `${rounded} ${unit}`;
}

export function sortByDistance<T>(
  rows: T[],
  anchor: GeoPoint | null,
  getPoint: (row: T) => GeoPoint | null
) {
  if (!anchor) return rows;

  return rows
    .map((row, index) => ({
      distanceKm: distanceFromAnchor(getPoint(row), anchor),
      index,
      row
    }))
    .sort((left, right) => {
      if (left.distanceKm === null && right.distanceKm === null) {
        return left.index - right.index;
      }
      if (left.distanceKm === null) return 1;
      if (right.distanceKm === null) return -1;
      return left.distanceKm - right.distanceKm || left.index - right.index;
    })
    .map(({ row }) => row);
}

export function getDistanceAnchorOptions(sources: DistanceAnchorSource[]) {
  const options = sources
    .filter((source) => Number.isFinite(source.lat) && Number.isFinite(source.lng))
    .map((source) => ({
      detail: source.address || null,
      id: source.id,
      kind: classifyAnchorKind(source),
      label: source.title,
      point: { lat: source.lat as number, lng: source.lng as number }
    }));

  const uniqueOptions: DistanceAnchorOption[] = [];
  const seen = new Set<string>();

  for (const option of options.sort(compareAnchorOptions)) {
    const key = `${option.kind}:${option.label.toLowerCase()}:${option.point.lat.toFixed(5)}:${option.point.lng.toFixed(5)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueOptions.push(option);
  }

  return uniqueOptions;
}

function distanceFromAnchor(point: GeoPoint | null, anchor: GeoPoint) {
  if (!point) return null;
  return haversineDistanceKm(anchor, point);
}

function classifyAnchorKind(source: DistanceAnchorSource): DistanceAnchorKind {
  const text = `${source.kind || ""} ${source.category || ""} ${source.title}`.toLowerCase();
  if (text.includes("hotel") || text.includes("lodging") || text.includes("stay")) return "lodging";
  if (
    text.includes("airport") ||
    text.includes("flight") ||
    text.includes("station") ||
    text.includes("train")
  ) {
    return "transport";
  }
  return "place";
}

function compareAnchorOptions(left: DistanceAnchorOption, right: DistanceAnchorOption) {
  const rank: Record<DistanceAnchorKind, number> = {
    lodging: 0,
    "current-location": 1,
    transport: 2,
    place: 3,
    destination: 4
  };
  return rank[left.kind] - rank[right.kind] || left.label.localeCompare(right.label);
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}
