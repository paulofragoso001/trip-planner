export type TripRouteMode =
  | "flight"
  | "drive"
  | "train"
  | "bus"
  | "transfer"
  | "ferry"
  | "transportation"
  | "other";

export type TripRouteEndpoint = {
  address: string | null;
  code: string | null;
  label: string | null;
  lat: number | null;
  lng: number | null;
  placeId: string | null;
  providerMetadata?: Record<string, unknown> | null;
};

export type TripSegmentRouteMetadata = {
  arriveAt: string | null;
  carrier: string | null;
  confirmation: string | null;
  destination: TripRouteEndpoint | null;
  flightNumber: string | null;
  mode: TripRouteMode;
  origin: TripRouteEndpoint | null;
  departAt: string | null;
};

const routeModes = new Set([
  "flight",
  "drive",
  "train",
  "bus",
  "transfer",
  "ferry",
  "transport",
  "transportation"
]);

export function isRouteKind(value: string | null | undefined) {
  return routeModes.has(String(value || "").toLowerCase());
}

export function normalizeRouteMode(value: string | null | undefined): TripRouteMode {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "transport") return "transportation";
  if (
    normalized === "flight" ||
    normalized === "drive" ||
    normalized === "train" ||
    normalized === "bus" ||
    normalized === "transfer" ||
    normalized === "ferry" ||
    normalized === "transportation"
  ) {
    return normalized;
  }
  return "other";
}

export function readTripSegmentRoute(
  metadata: Record<string, unknown> | null | undefined
): TripSegmentRouteMetadata | null {
  if (!isRecord(metadata?.route)) return null;

  const route = metadata.route;
  return {
    arriveAt: readString(route.arriveAt),
    carrier: readString(route.carrier),
    confirmation: readString(route.confirmation),
    departAt: readString(route.departAt),
    destination: readRouteEndpoint(route.destination),
    flightNumber: readString(route.flightNumber),
    mode: normalizeRouteMode(readString(route.mode)),
    origin: readRouteEndpoint(route.origin)
  };
}

export function hasResolvedRoute(route: TripSegmentRouteMetadata | null | undefined) {
  return Boolean(
    route?.origin &&
      route.destination &&
      typeof route.origin.lat === "number" &&
      typeof route.origin.lng === "number" &&
      typeof route.destination.lat === "number" &&
      typeof route.destination.lng === "number"
  );
}

export function routeEndpointLabel(endpoint: TripRouteEndpoint | null | undefined) {
  return endpoint?.label || endpoint?.address || endpoint?.code || "";
}

export function routeLocationLabel(route: TripSegmentRouteMetadata | null | undefined) {
  const origin = routeEndpointLabel(route?.origin);
  const destination = routeEndpointLabel(route?.destination);
  if (origin && destination) return `${origin} to ${destination}`;
  return origin || destination || "";
}

export function routeTitleLabel(
  route: TripSegmentRouteMetadata | null | undefined,
  fallback: string
) {
  const origin = routeEndpointLabel(route?.origin);
  const destination = routeEndpointLabel(route?.destination);
  if (origin && destination) return `${origin} to ${destination}`;
  return fallback;
}

function readRouteEndpoint(value: unknown): TripRouteEndpoint | null {
  if (!isRecord(value)) return null;
  return {
    address: readString(value.address),
    code: readString(value.code),
    label: readString(value.label) || readString(value.name),
    lat: readNumber(value.lat),
    lng: readNumber(value.lng),
    placeId: readString(value.placeId) || readString(value.place_id),
    providerMetadata: isRecord(value.providerMetadata)
      ? value.providerMetadata
      : isRecord(value.provider_metadata)
        ? value.provider_metadata
        : null
  };
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
