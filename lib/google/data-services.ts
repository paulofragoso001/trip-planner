import "server-only";

import { z } from "zod";

export type GoogleCoordinate = {
  lat: number;
  lng: number;
};

export type GoogleGeocodeResult = {
  address: string | null;
  coordinate: GoogleCoordinate;
  placeId: string | null;
  types: string[];
};

export type GooglePlaceDetailsResult = {
  address: string | null;
  googleMapsUri: string | null;
  name: string | null;
  photos: unknown[];
  placeId: string;
};

export type GoogleRouteSummary = {
  distanceMeters: number;
  durationSeconds: number;
  provider: "google_distance_matrix";
};

export type GoogleTravelMode = "driving" | "walking" | "bicycling" | "transit";

const googleServiceOwners = {
  autocomplete: "google_maps_js_places",
  geocoding: "google_geocoding",
  mapRendering: "google_maps_js_vector_tiles",
  placeDetails: "google_places_details",
  reverseGeocoding: "google_geocoding",
  routes: "google_distance_matrix"
} as const;

const googleGeocodePayloadSchema = z.object({
  results: z.array(
    z.object({
      formatted_address: z.string().optional(),
      geometry: z.object({
        location: z.object({
          lat: z.number(),
          lng: z.number()
        })
      }).optional(),
      place_id: z.string().optional(),
      types: z.array(z.string()).optional()
    })
  ).optional(),
  status: z.string().optional()
});

const googlePlaceDetailsPayloadSchema = z.object({
  result: z.object({
    formatted_address: z.string().optional(),
    name: z.string().optional(),
    photos: z.array(z.unknown()).optional(),
    place_id: z.string().optional(),
    url: z.string().optional()
  }).optional(),
  status: z.string().optional()
});

const googleDistanceMatrixPayloadSchema = z.object({
  rows: z.array(
    z.object({
      elements: z.array(
        z.object({
          distance: z.object({ value: z.number().optional() }).optional(),
          duration: z.object({ value: z.number().optional() }).optional(),
          status: z.string().optional()
        })
      ).optional()
    })
  ).optional(),
  status: z.string().optional()
});

export function getGoogleDataServiceConfig() {
  return {
    configured: Boolean(googleDataApiKey()),
    owners: googleServiceOwners,
    serverKeyConfigured: Boolean(
      process.env.GOOGLE_MAPS_API_KEY ||
      process.env.GOOGLE_PLACES_API_KEY ||
      process.env.GOOGLE_ROUTES_API_KEY
    )
  };
}

export async function geocodeAddressWithGoogle(address: string) {
  const normalizedAddress = address.trim();
  const apiKey = googleDataApiKey();

  if (!apiKey || !normalizedAddress) return null;

  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", normalizedAddress);
  url.searchParams.set("key", apiKey);

  const payload = await fetchGoogleJson(url, googleGeocodePayloadSchema);
  const firstResult = payload?.results?.find((result) => result.geometry?.location) ?? null;
  const location = firstResult?.geometry?.location;

  if (!location) return null;

  return {
    address: firstResult.formatted_address || null,
    coordinate: {
      lat: location.lat,
      lng: location.lng
    },
    placeId: firstResult.place_id || null,
    types: firstResult.types || []
  } satisfies GoogleGeocodeResult;
}

export async function reverseGeocodeWithGoogle(coordinate: GoogleCoordinate) {
  const apiKey = googleDataApiKey();

  if (!apiKey || !isFiniteCoordinate(coordinate)) return null;

  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("latlng", `${coordinate.lat},${coordinate.lng}`);
  url.searchParams.set("key", apiKey);

  const payload = await fetchGoogleJson(url, googleGeocodePayloadSchema);
  const firstResult = payload?.results?.find((result) => result.geometry?.location) ?? null;
  const location = firstResult?.geometry?.location;

  if (!location) return null;

  return {
    address: firstResult.formatted_address || null,
    coordinate: {
      lat: location.lat,
      lng: location.lng
    },
    placeId: firstResult.place_id || null,
    types: firstResult.types || []
  } satisfies GoogleGeocodeResult;
}

export async function getPlaceDetailsWithGoogle(placeId: string) {
  const normalizedPlaceId = placeId.trim();
  const apiKey = googleDataApiKey();

  if (!apiKey || !normalizedPlaceId) return null;

  const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
  url.searchParams.set("place_id", normalizedPlaceId);
  url.searchParams.set("fields", "place_id,name,formatted_address,photos,url");
  url.searchParams.set("key", apiKey);

  const payload = await fetchGoogleJson(url, googlePlaceDetailsPayloadSchema);
  const result = payload?.result;

  if (!result) return null;

  return {
    address: result.formatted_address || null,
    googleMapsUri: result.url || null,
    name: result.name || null,
    photos: result.photos || [],
    placeId: result.place_id || normalizedPlaceId
  } satisfies GooglePlaceDetailsResult;
}

export async function summarizeRouteWithGoogleDistanceMatrix(
  coordinates: GoogleCoordinate[],
  options: { mode?: GoogleTravelMode } = {}
) {
  const apiKey = googleRoutesApiKey();
  const safeCoordinates = coordinates.filter(isFiniteCoordinate);

  if (!apiKey || safeCoordinates.length < 2) return null;

  const url = new URL("https://maps.googleapis.com/maps/api/distancematrix/json");
  url.searchParams.set("origins", safeCoordinates.slice(0, -1).map(formatCoordinate).join("|"));
  url.searchParams.set("destinations", safeCoordinates.slice(1).map(formatCoordinate).join("|"));
  url.searchParams.set("mode", options.mode || googleRouteMode());
  url.searchParams.set("units", "metric");
  url.searchParams.set("key", apiKey);

  const payload = await fetchGoogleJson(url, googleDistanceMatrixPayloadSchema);
  if (payload?.status !== "OK" || !Array.isArray(payload.rows)) return null;

  let distanceMeters = 0;
  let durationSeconds = 0;

  for (let index = 0; index < safeCoordinates.length - 1; index += 1) {
    const element = payload.rows[index]?.elements?.[index];
    if (element?.status !== "OK") return null;
    distanceMeters += Number(element.distance?.value || 0);
    durationSeconds += Number(element.duration?.value || 0);
  }

  return {
    distanceMeters: Math.round(distanceMeters),
    durationSeconds: Math.round(durationSeconds),
    provider: "google_distance_matrix"
  } satisfies GoogleRouteSummary;
}

async function fetchGoogleJson<TSchema extends z.ZodType>(
  url: URL,
  schema: TSchema
): Promise<z.infer<TSchema> | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);

  try {
    const response = await fetch(url, { cache: "no-store", signal: controller.signal });
    if (!response.ok) return null;
    const payload = await response.json();
    const parsed = schema.safeParse(payload);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function googleDataApiKey() {
  return (
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLE_PLACES_API_KEY ||
    (process.env.NODE_ENV === "production" ? "" : process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) ||
    ""
  );
}

function googleRoutesApiKey() {
  return process.env.GOOGLE_ROUTES_API_KEY || googleDataApiKey();
}

function googleRouteMode(): GoogleTravelMode {
  const mode = process.env.GOOGLE_ROUTE_MODE?.toLowerCase();
  return mode === "walking" || mode === "bicycling" || mode === "transit" ? mode : "driving";
}

function formatCoordinate(coordinate: GoogleCoordinate) {
  return `${coordinate.lat},${coordinate.lng}`;
}

function isFiniteCoordinate(coordinate: GoogleCoordinate) {
  return (
    Number.isFinite(coordinate.lat) &&
    Number.isFinite(coordinate.lng) &&
    Math.abs(coordinate.lat) <= 90 &&
    Math.abs(coordinate.lng) <= 180
  );
}
