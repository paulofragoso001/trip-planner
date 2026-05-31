import "server-only";

import { logTravelProviderEvent } from "@/lib/travel-data/errors";
import { normalizeInventoryItem } from "@/lib/travel-data/normalize";
import { buildPlacePhotoUrl, readProviderPhoto } from "@/lib/travel-data/photo-url";
import type {
  LocationDiagnostics,
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

export async function getGooglePlacePhotoMetadata(placeId: string) {
  const apiKey = googlePlacesApiKey();
  const safePlaceId = safeQueryPreview(placeId);
  if (!apiKey || !placeId.trim()) return null;

  try {
    const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
    url.searchParams.set("place_id", placeId);
    url.searchParams.set("fields", "place_id,name,formatted_address,photos,url");
    url.searchParams.set("key", apiKey);

    const response = await fetchWithTimeout(url);
    if (!response.ok) {
      logTravelProviderEvent("place_photo_details_http_failed", {
        provider,
        providerPlaceId: safePlaceId ? "present" : "missing",
        status: response.status
      });
      return null;
    }

    const payload = await response.json();
    const result = payload?.result;
    if (!result || !Array.isArray(result.photos) || result.photos.length === 0) {
      logTravelProviderEvent("place_photo_details_empty", {
        provider,
        providerPlaceId: safePlaceId ? "present" : "missing",
        status: payload?.status || "unknown"
      });
      return null;
    }

    const metadata = googlePhotoMetadata(result);
    return {
      ...metadata,
      formattedAddress: result.formatted_address || null,
      googleMapsUri: result.url || null,
      googlePlaceUri: result.place_id
        ? `https://www.google.com/maps/place/?q=place_id:${result.place_id}`
        : null,
      providerPlaceId: result.place_id || placeId
    };
  } catch (error) {
    logTravelProviderEvent("place_photo_details_failed", {
      error: safeProviderError(error),
      provider,
      providerPlaceId: safePlaceId ? "present" : "missing"
    });
    return null;
  }
}

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
    return unresolved(query, diagnostics({
      code: "provider_not_configured",
      message: "Location matching is not configured.",
      query: query.name,
      retryable: false,
      status: "provider_failed"
    }));
  }

  const locationContext = destinationContext(query, context);
  const textQueries = buildTextQueries(query, locationContext);
  let providerResultCount = 0;
  let lastWrongCity: {
    address: string | null;
    placeId: string | null;
    query: string;
  } | null = null;
  let lastProviderError: LocationDiagnostics | null = null;
  logTravelProviderEvent("place_resolution_started", {
    locationContext,
    provider,
    query: safeQueryPreview(textQueries[0])
  });

  try {
    for (const textQuery of textQueries) {
      const url = new URL("https://maps.googleapis.com/maps/api/place/findplacefromtext/json");
      url.searchParams.set("input", textQuery);
      url.searchParams.set("inputtype", "textquery");
      url.searchParams.set("fields", "place_id,name,formatted_address,geometry,rating,user_ratings_total,types,photos");
      url.searchParams.set("key", apiKey);

      const response = await fetchWithTimeout(url);
      if (!response.ok) {
        lastProviderError = diagnostics({
          code: errorCodeForHttpStatus(response.status),
          destinationContext: locationContext,
          message: `Provider request failed with status ${response.status}.`,
          providerResultCount,
          query: textQuery,
          status: "provider_failed"
        });
        logTravelProviderEvent("place_resolution_http_failed", {
          provider,
          query: safeQueryPreview(textQuery),
          status: response.status
        });
        continue;
      }

      const payload = await response.json();
      if (payload.status && payload.status !== "OK" && payload.status !== "ZERO_RESULTS") {
        logTravelProviderEvent("place_resolution_provider_status", {
          provider,
          query: safeQueryPreview(textQuery),
          status: payload.status
        });
      }

      const candidates = Array.isArray(payload.candidates) ? payload.candidates : [];
      providerResultCount += candidates.length;
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
        continue;
      }

      if (!matchesLocationContext(candidate.formatted_address, locationContext)) {
        lastWrongCity = {
          address: candidate.formatted_address || null,
          placeId: candidate.place_id || null,
          query: textQuery
        };
        logTravelProviderEvent("place_resolution_rejected_location_mismatch", {
          address: safeAddressPreview(candidate.formatted_address),
          locationContext,
          provider,
          query: safeQueryPreview(textQuery),
          reason: "address_does_not_match_destination_context"
        });
        continue;
      }

      const item = normalizeGooglePlace(candidate, "place");
      logTravelProviderEvent("place_resolution_selected", {
        address: safeAddressPreview(item.address),
        hasCoordinates: typeof item.latitude === "number" && typeof item.longitude === "number",
        provider,
        providerItemId: item.providerItemId ? "present" : "missing",
        query: safeQueryPreview(textQuery),
        title: safeQueryPreview(item.title)
      });

      return {
        address: item.address || query.address || null,
        city: query.city || null,
        country: query.country || null,
        diagnostics: diagnostics({
          destinationContext: locationContext,
          providerResultCount,
          query: textQuery,
          selectedAddress: item.address,
          selectedPlaceId: item.providerItemId,
          status: "resolved"
        }),
        inventoryItem: item,
        latitude: item.latitude,
        longitude: item.longitude,
        placeId: item.providerItemId,
        provider
      };
    }

    const geocoded = await geocodePlaceFallback(apiKey, query, textQueries, locationContext, providerResultCount);
    if (geocoded.diagnostics?.status === "resolved") return geocoded;
    if (geocoded.diagnostics?.status === "wrong_city_rejected") return geocoded;

    if (lastWrongCity) {
      return unresolved(query, diagnostics({
        code: "wrong_city_rejected",
        destinationContext: locationContext,
        message: "Provider result was outside the trip destination.",
        providerResultCount,
        query: lastWrongCity.query,
        rejectionReason: "address_does_not_match_destination_context",
        retryable: true,
        selectedAddress: lastWrongCity.address,
        selectedPlaceId: lastWrongCity.placeId,
        status: "wrong_city_rejected"
      }));
    }

    if (lastProviderError) return unresolved(query, lastProviderError);

    return geocoded.diagnostics
      ? geocoded
      : unresolved(query, diagnostics({
          code: "provider_no_results",
          destinationContext: locationContext,
          message: "No matching places were found.",
          providerResultCount,
          query: textQueries[0] || query.name,
          status: "needs_location_confirmation"
        }));
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    logTravelProviderEvent("place_resolution_failed", {
      error: safeProviderError(error),
      provider
    });
    return unresolved(query, diagnostics({
      code: aborted ? "provider_timeout" : "provider_network_error",
      destinationContext: locationContext,
      message: aborted ? "Provider request timed out." : "Provider request failed.",
      providerResultCount,
      query: textQueries[0] || query.name,
      status: "provider_failed"
    }));
  }
}

async function geocodePlaceFallback(
  apiKey: string,
  query: PlaceResolutionQuery,
  textQueries: string[],
  locationContext: string | null,
  priorResultCount = 0
): Promise<ResolvedPlace> {
  let providerResultCount = priorResultCount;
  let lastWrongCity: {
    address: string | null;
    placeId: string | null;
    query: string;
  } | null = null;
  let lastProviderError: LocationDiagnostics | null = null;
  try {
    for (const textQuery of textQueries) {
      const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
      url.searchParams.set("address", textQuery);
      url.searchParams.set("key", apiKey);

      const response = await fetchWithTimeout(url);
      if (!response.ok) {
        lastProviderError = diagnostics({
          code: errorCodeForHttpStatus(response.status),
          destinationContext: locationContext,
          message: `Provider request failed with status ${response.status}.`,
          providerResultCount,
          query: textQuery,
          status: "provider_failed"
        });
        logTravelProviderEvent("place_geocode_http_failed", {
          provider,
          query: safeQueryPreview(textQuery),
          status: response.status
        });
        continue;
      }

      const payload = await response.json();
      if (payload.status && payload.status !== "OK" && payload.status !== "ZERO_RESULTS") {
        logTravelProviderEvent("place_geocode_provider_status", {
          provider,
          query: safeQueryPreview(textQuery),
          status: payload.status
        });
      }

      const results = Array.isArray(payload.results) ? payload.results : [];
      providerResultCount += results.length;
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
        continue;
      }

      if (!matchesLocationContext(candidate.formatted_address, locationContext)) {
        lastWrongCity = {
          address: candidate.formatted_address || null,
          placeId: candidate.place_id || null,
          query: textQuery
        };
        logTravelProviderEvent("place_geocode_rejected_location_mismatch", {
          address: safeAddressPreview(candidate.formatted_address),
          locationContext,
          provider,
          query: safeQueryPreview(textQuery),
          reason: "address_does_not_match_destination_context"
        });
        continue;
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
        diagnostics: diagnostics({
          destinationContext: locationContext,
          providerResultCount,
          query: textQuery,
          selectedAddress: item.address,
          selectedPlaceId: item.providerItemId,
          status: "resolved"
        }),
        inventoryItem: item,
        latitude: item.latitude,
        longitude: item.longitude,
        placeId: item.providerItemId,
        provider
      };
    }
    if (lastWrongCity) {
      return unresolved(query, diagnostics({
        code: "wrong_city_rejected",
        destinationContext: locationContext,
        message: "Provider result was outside the trip destination.",
        providerResultCount,
        query: lastWrongCity.query,
        rejectionReason: "address_does_not_match_destination_context",
        retryable: true,
        selectedAddress: lastWrongCity.address,
        selectedPlaceId: lastWrongCity.placeId,
        status: "wrong_city_rejected"
      }));
    }
    if (lastProviderError) return unresolved(query, lastProviderError);
    return unresolved(query, diagnostics({
      code: "provider_no_results",
      destinationContext: locationContext,
      message: "No matching places were found.",
      providerResultCount,
      query: textQueries[0] || query.name,
      status: "needs_location_confirmation"
    }));
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    logTravelProviderEvent("place_geocode_fallback_failed", {
      error: safeProviderError(error),
      provider
    });
    return unresolved(query, diagnostics({
      code: aborted ? "provider_timeout" : "provider_network_error",
      destinationContext: locationContext,
      message: aborted ? "Provider request timed out." : "Provider request failed.",
      providerResultCount,
      query: textQueries[0] || query.name,
      status: "provider_failed"
    }));
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
  const photoMetadata = googlePhotoMetadata(item);
  const photo = readProviderPhoto(photoMetadata);
  return normalizeInventoryItem({
    address: item.formatted_address || item.vicinity || null,
    category: Array.isArray(item.types) ? item.types[0] || null : null,
    description: Array.isArray(item.types) ? item.types.join(", ") : null,
    imageAlt: photo?.imageAlt || null,
    imageAttribution: photo?.attribution || null,
    imageProvider: photo?.imageProvider || null,
    imageUrl: buildPlacePhotoUrl(photoMetadata, 800),
    latitude: item.geometry?.location?.lat ?? null,
    longitude: item.geometry?.location?.lng ?? null,
    metadata: {
      businessStatus: item.business_status || null,
      ...photoMetadata,
      formattedAddress: item.formatted_address || item.vicinity || null,
      googleMapsUri: item.url || (item.place_id ? `https://www.google.com/maps/place/?q=place_id:${item.place_id}` : null),
      googlePlaceUri: item.place_id ? `https://www.google.com/maps/place/?q=place_id:${item.place_id}` : null,
      placeTypes: item.types || [],
      providerPlaceId: item.place_id || null
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

function googlePhotoMetadata(item: any) {
  const photos = Array.isArray(item.photos) ? item.photos : [];
  const primaryPhoto = photos[0] || null;
  const primaryPhotoName =
    typeof primaryPhoto?.name === "string"
      ? primaryPhoto.name.replace(/\/media$/, "")
      : null;
  const primaryPhotoReference =
    typeof primaryPhoto?.photo_reference === "string" ? primaryPhoto.photo_reference : null;
  const primaryPhotoAttributions =
    primaryPhoto?.authorAttributions || primaryPhoto?.html_attributions || [];
  const displayName =
    typeof item.displayName?.text === "string"
      ? item.displayName.text
      : typeof item.name === "string"
        ? item.name
        : null;

  return {
    displayName,
    imageAlt: displayName ? `Photo of ${displayName}` : null,
    imageAttribution: formatGoogleAttribution(primaryPhotoAttributions),
    imageProvider: primaryPhotoName || primaryPhotoReference ? "Google" : null,
    photos: photos.map((photo: any) => ({
      authorAttributions: photo?.authorAttributions || null,
      heightPx: typeof photo?.heightPx === "number" ? photo.heightPx : photo?.height || null,
      htmlAttributions: photo?.html_attributions || null,
      name: typeof photo?.name === "string" ? photo.name.replace(/\/media$/, "") : null,
      photoReference: typeof photo?.photo_reference === "string" ? photo.photo_reference : null,
      widthPx: typeof photo?.widthPx === "number" ? photo.widthPx : photo?.width || null
    })),
    primaryPhotoAttributions,
    primaryPhotoName,
    primaryPhotoReference
  };
}

function formatGoogleAttribution(value: unknown) {
  if (!Array.isArray(value)) return null;
  const labels = value
    .map((item) => {
      if (typeof item === "string") return stripHtml(item);
      if (item && typeof item === "object" && "displayName" in item) {
        return typeof item.displayName === "string" ? item.displayName : null;
      }
      return null;
    })
    .filter((item): item is string => Boolean(item));
  return labels.length ? labels.join(", ") : null;
}

function inferInventoryType(item: any): TravelInventoryItem["type"] {
  const types = Array.isArray(item.types) ? item.types.join(" ") : "";
  if (/restaurant|cafe|bar|bakery|meal/.test(types)) return "restaurant";
  if (/lodging/.test(types)) return "hotel";
  return "activity";
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

function buildTextQueries(query: PlaceResolutionQuery, locationContext: string | null) {
  const normalizedName = normalizeText(query.name);
  const variants: string[] = [];
  const push = (...parts: Array<string | null | undefined>) => {
    const value = parts.map((part) => String(part || "").trim()).filter(Boolean).join(" ");
    if (value) variants.push(value);
  };

  push(query.name, query.address, locationContext, query.country);
  push(query.name, locationContext);
  push(query.name, query.city);
  push(query.name, query.address);

  if (normalizedName === "wynwood walls" || normalizedName.includes("wynwood walls")) {
    push("Wynwood Walls", "Miami");
    push("Wynwood Walls", "Miami FL");
    push("Wynwood Walls", "2516 NW 2nd Ave Miami");
  }

  return Array.from(new Set(variants.map((part) => part.replace(/\s+/g, " ").trim()).filter(Boolean)));
}

async function fetchWithTimeout(url: URL) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    return await fetch(url, { cache: "no-store", signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
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

function unresolved(query: PlaceResolutionQuery, locationDiagnostics?: LocationDiagnostics): ResolvedPlace {
  return {
    address: query.address || null,
    city: query.city || null,
    country: query.country || null,
    diagnostics: locationDiagnostics || null,
    inventoryItem: null,
    latitude: null,
    longitude: null,
    placeId: null,
    provider: null
  };
}

function diagnostics(input: {
  code?: LocationDiagnostics["lastErrorCode"];
  destinationContext?: string | null;
  message?: string | null;
  providerResultCount?: number;
  query?: string | null;
  rejectionReason?: string | null;
  retryable?: boolean;
  selectedAddress?: string | null;
  selectedPlaceId?: string | null;
  status: LocationDiagnostics["status"];
}): LocationDiagnostics {
  return {
    attemptedAt: new Date().toISOString(),
    destinationContext: input.destinationContext ?? null,
    lastErrorCode: input.code ?? null,
    lastErrorMessageSafe: input.message ? safeProviderMessage(input.message) : null,
    provider,
    providerResultCount: input.providerResultCount ?? 0,
    query: input.query ? safeQueryPreview(input.query) : null,
    rejectionReason: input.rejectionReason ?? null,
    retryable: input.retryable ?? input.status !== "resolved",
    selectedFormattedAddress: input.selectedAddress ? safeAddressPreview(input.selectedAddress) : null,
    selectedProviderPlaceId: input.selectedPlaceId || null,
    status: input.status
  };
}

function errorCodeForHttpStatus(status: number): LocationDiagnostics["lastErrorCode"] {
  if (status === 408 || status === 504) return "provider_timeout";
  if (status === 429) return "provider_quota";
  if (status >= 400 && status < 500) return "provider_invalid_request";
  return "provider_unknown_error";
}

function safeProviderError(error: unknown) {
  return safeProviderMessage(error instanceof Error ? error.message : "Unknown provider failure.");
}

function safeProviderMessage(value: string) {
  return value.replace(/key=[^&\s]+/gi, "key=[redacted]").replace(/\s+/g, " ").slice(0, 160);
}

function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}
