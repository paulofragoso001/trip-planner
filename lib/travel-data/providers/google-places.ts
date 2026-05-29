import "server-only";

import { logTravelProviderEvent } from "@/lib/travel-data/errors";
import { normalizeInventoryItem } from "@/lib/travel-data/normalize";
import type {
  NearbyActivitySearchInput,
  PlaceResolutionQuery,
  ProviderAdapter,
  ResolvedPlace,
  TravelInventoryItem,
  TripContext
} from "@/lib/travel-data/types";

const provider = "google_places" as const;

export const googlePlacesProvider: ProviderAdapter = {
  name: provider,
  resolvePlace,
  searchNearbyActivities
};

async function resolvePlace(
  query: PlaceResolutionQuery,
  context?: TripContext
): Promise<ResolvedPlace> {
  const apiKey = googlePlacesApiKey();
  if (!apiKey) {
    logTravelProviderEvent("place_resolution_not_configured", {
      provider,
      query: safeQueryPreview(query.name)
    });
    return unresolved(query);
  }

  const locationContext = destinationContext(query, context);
  const textQuery = buildTextQuery(query, locationContext);
  logTravelProviderEvent("place_resolution_started", {
    locationContext,
    provider,
    query: safeQueryPreview(textQuery)
  });

  try {
    const url = new URL("https://maps.googleapis.com/maps/api/place/findplacefromtext/json");
    url.searchParams.set("input", textQuery);
    url.searchParams.set("inputtype", "textquery");
    url.searchParams.set("fields", "place_id,name,formatted_address,geometry,rating,user_ratings_total,types,photos");
    url.searchParams.set("key", apiKey);

    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      logTravelProviderEvent("place_resolution_http_failed", {
        provider,
        status: response.status
      });
      return geocodePlaceFallback(apiKey, query, textQuery, locationContext);
    }

    const payload = await response.json();
    if (payload.status && payload.status !== "OK" && payload.status !== "ZERO_RESULTS") {
      logTravelProviderEvent("place_resolution_provider_status", {
        provider,
        status: payload.status
      });
    }

    const candidates = Array.isArray(payload.candidates) ? payload.candidates : [];
    logTravelProviderEvent("place_resolution_candidates", {
      count: candidates.length,
      provider,
      query: safeQueryPreview(textQuery)
    });
    const candidate =
      candidates.find((item: any) =>
        matchesLocationContext(item?.formatted_address, locationContext)
      ) || candidates[0] || null;

    if (!candidate?.geometry?.location) {
      return geocodePlaceFallback(apiKey, query, textQuery, locationContext);
    }

    if (!matchesLocationContext(candidate.formatted_address, locationContext)) {
      logTravelProviderEvent("place_resolution_rejected_location_mismatch", {
        address: safeAddressPreview(candidate.formatted_address),
        locationContext,
        provider
      });
      return unresolved(query);
    }

    const item = normalizeGooglePlace(candidate, "place");
    logTravelProviderEvent("place_resolution_selected", {
      address: safeAddressPreview(item.address),
      hasCoordinates: typeof item.latitude === "number" && typeof item.longitude === "number",
      provider,
      providerItemId: item.providerItemId ? "present" : "missing",
      title: safeQueryPreview(item.title)
    });

    return {
      address: item.address || query.address || null,
      city: query.city || null,
      country: query.country || null,
      inventoryItem: item,
      latitude: item.latitude,
      longitude: item.longitude,
      placeId: item.providerItemId,
      provider
    };
  } catch (error) {
    logTravelProviderEvent("place_resolution_failed", {
      error: error instanceof Error ? error.message : "Unknown provider failure.",
      provider
    });
    return unresolved(query);
  }
}

async function geocodePlaceFallback(
  apiKey: string,
  query: PlaceResolutionQuery,
  textQuery: string,
  locationContext: string | null
): Promise<ResolvedPlace> {
  try {
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("address", textQuery);
    url.searchParams.set("key", apiKey);

    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      logTravelProviderEvent("place_geocode_http_failed", {
        provider,
        status: response.status
      });
      return unresolved(query);
    }

    const payload = await response.json();
    if (payload.status && payload.status !== "OK" && payload.status !== "ZERO_RESULTS") {
      logTravelProviderEvent("place_geocode_provider_status", {
        provider,
        status: payload.status
      });
    }

    const results = Array.isArray(payload.results) ? payload.results : [];
    logTravelProviderEvent("place_geocode_candidates", {
      count: results.length,
      provider,
      query: safeQueryPreview(textQuery)
    });
    const candidate =
      results.find((item: any) =>
        matchesLocationContext(item?.formatted_address, locationContext)
      ) || results[0] || null;

    if (!candidate?.geometry?.location) {
      return unresolved(query);
    }

    if (!matchesLocationContext(candidate.formatted_address, locationContext)) {
      logTravelProviderEvent("place_geocode_rejected_location_mismatch", {
        address: safeAddressPreview(candidate.formatted_address),
        locationContext,
        provider
      });
      return unresolved(query);
    }

    const item = normalizeInventoryItem({
      address: candidate.formatted_address || query.address || null,
      category: "geocoded_place",
      latitude: candidate.geometry.location.lat,
      longitude: candidate.geometry.location.lng,
      metadata: {
        placeTypes: candidate.types || [],
        resolver: "google_geocoding"
      },
      provider,
      providerItemId: candidate.place_id || null,
      title: query.name,
      type: "place"
    });

    return {
      address: item.address,
      city: query.city || null,
      country: query.country || null,
      inventoryItem: item,
      latitude: item.latitude,
      longitude: item.longitude,
      placeId: item.providerItemId,
      provider
    };
  } catch (error) {
    logTravelProviderEvent("place_geocode_fallback_failed", {
      error: error instanceof Error ? error.message : "Unknown provider failure.",
      provider
    });
    return unresolved(query);
  }
}

async function searchNearbyActivities(
  input: NearbyActivitySearchInput
): Promise<TravelInventoryItem[]> {
  const apiKey = googlePlacesApiKey();
  if (!apiKey) return [];

  try {
    const url = new URL("https://maps.googleapis.com/maps/api/place/nearbysearch/json");
    url.searchParams.set("location", `${input.location.latitude},${input.location.longitude}`);
    url.searchParams.set("radius", String(input.radiusMeters || 1600));
    url.searchParams.set("keyword", "things to do restaurants attractions");
    url.searchParams.set("key", apiKey);

    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return [];

    const payload = await response.json();
    const results = Array.isArray(payload.results) ? payload.results : [];
    return results
      .slice(0, Math.max(1, Math.min(input.limit || 8, 20)))
      .map((item: any) => normalizeGooglePlace(item, inferInventoryType(item)));
  } catch (error) {
    logTravelProviderEvent("nearby_activity_search_failed", {
      error: error instanceof Error ? error.message : "Unknown provider failure.",
      provider
    });
    return [];
  }
}

function normalizeGooglePlace(item: any, type: TravelInventoryItem["type"]) {
  const photoReference = Array.isArray(item.photos) ? item.photos[0]?.photo_reference : null;
  return normalizeInventoryItem({
    address: item.formatted_address || item.vicinity || null,
    category: Array.isArray(item.types) ? item.types[0] || null : null,
    description: Array.isArray(item.types) ? item.types.join(", ") : null,
    imageUrl: photoReference ? googlePhotoUrl(photoReference) : null,
    latitude: item.geometry?.location?.lat ?? null,
    longitude: item.geometry?.location?.lng ?? null,
    metadata: {
      businessStatus: item.business_status || null,
      placeTypes: item.types || []
    },
    provider,
    providerItemId: item.place_id || null,
    rating: typeof item.rating === "number" ? item.rating : null,
    reviewCount: typeof item.user_ratings_total === "number" ? item.user_ratings_total : null,
    sourceUrl: item.place_id ? `https://www.google.com/maps/place/?q=place_id:${item.place_id}` : null,
    title: item.name || "Google place",
    type
  });
}

function inferInventoryType(item: any): TravelInventoryItem["type"] {
  const types = Array.isArray(item.types) ? item.types.join(" ") : "";
  if (/restaurant|cafe|bar|bakery|meal/.test(types)) return "restaurant";
  if (/lodging/.test(types)) return "hotel";
  return "activity";
}

function googlePhotoUrl(photoReference: string) {
  const apiKey = googlePlacesApiKey();
  if (!apiKey) return null;
  const url = new URL("https://maps.googleapis.com/maps/api/place/photo");
  url.searchParams.set("maxwidth", "800");
  url.searchParams.set("photo_reference", photoReference);
  url.searchParams.set("key", apiKey);
  return url.toString();
}

function googlePlacesApiKey() {
  return (
    process.env.GOOGLE_PLACES_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    (process.env.NODE_ENV === "production" ? "" : process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) ||
    ""
  );
}

export function getGooglePlaceResolutionConfig() {
  return {
    configured: Boolean(googlePlacesApiKey()),
    serverKeyConfigured: Boolean(process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY)
  };
}

function buildTextQuery(query: PlaceResolutionQuery, locationContext: string | null) {
  const parts = [
    query.name,
    query.address,
    locationContext,
    query.country
  ].filter(Boolean);
  return Array.from(new Set(parts.map((part) => String(part).trim()).filter(Boolean))).join(" ");
}

function destinationContext(query: PlaceResolutionQuery, context?: TripContext) {
  return (
    query.city ||
    query.locationHint ||
    context?.destination ||
    context?.city ||
    query.sourceTitle ||
    null
  );
}

function matchesLocationContext(address: string | null | undefined, locationContext: string | null) {
  if (!locationContext || !address) return true;
  const normalizedAddress = normalizeText(address);
  const normalizedContext = normalizeText(locationContext);
  if (!normalizedContext) return true;

  if (normalizedContext.includes("miami")) {
    return [
      "miami",
      "miami beach",
      "south beach",
      "wynwood",
      "brickell",
      "fl",
      "florida",
      "united states"
    ].some((token) => normalizedAddress.includes(token));
  }

  if (normalizedContext.includes("barcelona")) {
    return ["barcelona", "catalonia", "catalunya", "spain", "espana"].some((token) =>
      normalizedAddress.includes(token)
    );
  }

  const contextTokens = normalizedContext
    .split(" ")
    .filter((token) => token.length > 2 && !["trip", "weekend", "travel", "planner"].includes(token));
  if (!contextTokens.length) return true;
  return contextTokens.some((token) => normalizedAddress.includes(token));
}

function safeAddressPreview(address: string | null | undefined) {
  return String(address || "").slice(0, 120);
}

function safeQueryPreview(value: string | null | undefined) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, 90);
}

function normalizeText(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function unresolved(query: PlaceResolutionQuery): ResolvedPlace {
  return {
    address: query.address || null,
    city: query.city || null,
    country: query.country || null,
    inventoryItem: null,
    latitude: null,
    longitude: null,
    placeId: null,
    provider: null
  };
}
