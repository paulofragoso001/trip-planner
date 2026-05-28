import "server-only";

import { logTravelProviderEvent } from "@/lib/travel-data/errors";
import { normalizeInventoryItem } from "@/lib/travel-data/normalize";
import type {
  NearbyActivitySearchInput,
  PlaceResolutionQuery,
  ProviderAdapter,
  ResolvedPlace,
  TravelInventoryItem
} from "@/lib/travel-data/types";

const provider = "google_places" as const;

export const googlePlacesProvider: ProviderAdapter = {
  name: provider,
  resolvePlace,
  searchNearbyActivities
};

async function resolvePlace(query: PlaceResolutionQuery): Promise<ResolvedPlace> {
  const apiKey = googlePlacesApiKey();
  if (!apiKey) {
    return unresolved(query);
  }

  const textQuery = [
    query.name,
    query.address,
    query.locationHint,
    query.city,
    query.country,
    query.sourceTitle
  ]
    .filter(Boolean)
    .join(" ");

  try {
    const url = new URL("https://maps.googleapis.com/maps/api/place/findplacefromtext/json");
    url.searchParams.set("input", textQuery);
    url.searchParams.set("inputtype", "textquery");
    url.searchParams.set("fields", "place_id,name,formatted_address,geometry,rating,user_ratings_total,types,photos");
    url.searchParams.set("key", apiKey);

    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      return geocodePlaceFallback(apiKey, query, textQuery);
    }

    const payload = await response.json();
    const candidate = Array.isArray(payload.candidates) ? payload.candidates[0] : null;

    if (!candidate?.geometry?.location) {
      return geocodePlaceFallback(apiKey, query, textQuery);
    }

    const item = normalizeGooglePlace(candidate, "place");
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
  textQuery: string
): Promise<ResolvedPlace> {
  try {
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("address", textQuery);
    url.searchParams.set("key", apiKey);

    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return unresolved(query);

    const payload = await response.json();
    const candidate = Array.isArray(payload.results) ? payload.results[0] : null;

    if (!candidate?.geometry?.location) {
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
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
    ""
  );
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
