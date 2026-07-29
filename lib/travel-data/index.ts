import "server-only";

import { ApiError } from "@/lib/api/errors";
import { googlePlacesProvider } from "@/lib/travel-data/providers/google-places";
import { getYourGuideProvider } from "@/lib/travel-data/providers/getyourguide";
import { viatorProvider } from "@/lib/travel-data/providers/viator";
import { eventsProvider } from "@/lib/travel-data/providers/events";
import { flightsProvider } from "@/lib/travel-data/providers/flights";
import { hotelsProvider } from "@/lib/travel-data/providers/hotels";
import { rankInventoryItems } from "@/lib/travel-data/ranking";
import {
  POSTCARD_GALLERY_MAX_RESULTS,
  planPostcardGalleryQueries,
  rankPostcardGallery,
  selectPostcardHero
} from "@/lib/travel-data/postcard-gallery";
import type {
  NearbyActivitySearchInput,
  PlaceResolutionQuery,
  ResolvedPlace,
  TravelInventoryItem,
  TripContext
} from "@/lib/travel-data/types";

const providers = [
  googlePlacesProvider,
  viatorProvider,
  getYourGuideProvider,
  eventsProvider,
  flightsProvider,
  hotelsProvider
];

export async function resolvePlace(
  query: PlaceResolutionQuery,
  context?: TripContext
): Promise<ResolvedPlace> {
  let lastUnresolved: ResolvedPlace | null = null;
  for (const provider of providers) {
    if (!provider.resolvePlace) continue;
    const resolved = await provider.resolvePlace(query, context).catch((error) => ({
      address: query.address || null,
      city: query.city || null,
      country: query.country || null,
      diagnostics: {
        attemptedAt: new Date().toISOString(),
        destinationContext: context?.destination || context?.city || query.locationHint || null,
        lastErrorCode: "provider_unknown_error" as const,
        lastErrorMessageSafe:
          error instanceof Error ? error.message.replace(/\s+/g, " ").slice(0, 160) : "Provider failed.",
        provider: provider.name,
        providerResultCount: 0,
        query: query.name,
        rejectionReason: null,
        retryable: true,
        selectedFormattedAddress: null,
        selectedProviderPlaceId: null,
        status: "provider_failed" as const
      },
      inventoryItem: null,
      latitude: null,
      longitude: null,
      placeId: null,
      provider: provider.name
    }));
    if (typeof resolved.latitude === "number" && typeof resolved.longitude === "number") {
      return resolved;
    }
    lastUnresolved = resolved;
  }

  return {
    address: query.address || null,
    city: query.city || null,
    country: query.country || null,
    diagnostics: lastUnresolved?.diagnostics || null,
    inventoryItem: null,
    latitude: null,
    longitude: null,
    placeId: null,
    provider: null
  };
}

export async function resolvePlaceWithPostcardHero(
  query: PlaceResolutionQuery,
  context?: TripContext
): Promise<ResolvedPlace> {
  const resolved = await resolvePlace(query, context);
  if (
    typeof resolved.latitude !== "number" ||
    typeof resolved.longitude !== "number" ||
    !resolved.inventoryItem
  ) {
    return resolved;
  }

  const destination = canonicalPostcardDestination(query);
  if (!destination) return resolved;

  try {
    const location = {
      latitude: resolved.latitude,
      longitude: resolved.longitude,
      title: destination
    };
    const candidates = await searchNearbyActivities({
      limit: POSTCARD_GALLERY_MAX_RESULTS,
      location,
      purpose: "postcard_gallery",
      radiusMeters: 5000
    });
    const hero = selectPostcardHero(candidates, {
      destination,
      limit: POSTCARD_GALLERY_MAX_RESULTS,
      origin: location
    });
    if (!hero?.imageUrl) return resolved;

    return {
      ...resolved,
      inventoryItem: {
        ...resolved.inventoryItem,
        imageAlt: hero.imageAlt,
        imageAttribution: hero.imageAttribution,
        imageProvider: hero.imageProvider,
        imageUrl: hero.imageUrl
      }
    };
  } catch {
    // Postcard discovery is an optional quality enhancement. The existing
    // representative place photo remains the reliable hero fallback.
    return resolved;
  }
}

export async function searchNearbyActivities(
  input: NearbyActivitySearchInput
): Promise<TravelInventoryItem[]> {
  if (input.purpose === "postcard_gallery") {
    const queries = planPostcardGalleryQueries(input.location.title || "");
    if (!queries.length) return [];
    const postcardRequests = providers.flatMap((provider) =>
      provider.searchPostcardGalleryQuery
        ? queries.map((query) => provider.searchPostcardGalleryQuery!(input, query))
        : []
    );
    const postcardResults = await Promise.allSettled(postcardRequests);
    if (
      postcardRequests.length > 0 &&
      postcardResults.every((result) => result.status === "rejected")
    ) {
      throw new ApiError(
        "bad_gateway",
        "Destination images are temporarily unavailable.",
        502
      );
    }
    return rankPostcardGallery(
      postcardResults.flatMap((result) => result.status === "fulfilled" ? result.value : []),
      {
        destination: input.location.title || "",
        limit: input.limit || 5,
        origin: input.location
      }
    );
  }

  const results = await Promise.allSettled(
    providers
      .filter((provider) => provider.searchNearbyActivities)
      .map((provider) => provider.searchNearbyActivities!(input))
  );
  const ranked = rankInventoryItems(
    results.flatMap((result) => (result.status === "fulfilled" ? result.value : [])),
    input.location
  );
  return ranked.slice(0, input.limit || 5);
}

function canonicalPostcardDestination(query: PlaceResolutionQuery) {
  return (query.sourceTitle || query.name).trim();
}

export type {
  NearbyActivitySearchInput,
  PlaceResolutionQuery,
  ResolvedPlace,
  TravelInventoryItem,
  TripContext
};
