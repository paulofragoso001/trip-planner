import "server-only";

import { googlePlacesProvider } from "@/lib/travel-data/providers/google-places";
import { getYourGuideProvider } from "@/lib/travel-data/providers/getyourguide";
import { viatorProvider } from "@/lib/travel-data/providers/viator";
import { eventsProvider } from "@/lib/travel-data/providers/events";
import { flightsProvider } from "@/lib/travel-data/providers/flights";
import { hotelsProvider } from "@/lib/travel-data/providers/hotels";
import { rankInventoryItems } from "@/lib/travel-data/ranking";
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

export async function searchNearbyActivities(
  input: NearbyActivitySearchInput
): Promise<TravelInventoryItem[]> {
  const results = await Promise.allSettled(
    providers
      .filter((provider) => provider.searchNearbyActivities)
      .map((provider) => provider.searchNearbyActivities!(input))
  );
  return rankInventoryItems(
    results.flatMap((result) => (result.status === "fulfilled" ? result.value : [])),
    input.location
  ).slice(0, input.limit || 5);
}

export type {
  NearbyActivitySearchInput,
  PlaceResolutionQuery,
  ResolvedPlace,
  TravelInventoryItem,
  TripContext
};
