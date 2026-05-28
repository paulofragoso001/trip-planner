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
  for (const provider of providers) {
    if (!provider.resolvePlace) continue;
    const resolved = await provider.resolvePlace(query, context);
    if (typeof resolved.latitude === "number" && typeof resolved.longitude === "number") {
      return resolved;
    }
  }

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

export async function searchNearbyActivities(
  input: NearbyActivitySearchInput
): Promise<TravelInventoryItem[]> {
  const results = await Promise.all(
    providers
      .filter((provider) => provider.searchNearbyActivities)
      .map((provider) => provider.searchNearbyActivities!(input))
  );
  return rankInventoryItems(results.flat(), input.location).slice(0, input.limit || 5);
}

export type {
  NearbyActivitySearchInput,
  PlaceResolutionQuery,
  ResolvedPlace,
  TravelInventoryItem,
  TripContext
};
