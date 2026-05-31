import "server-only";

export type TravelProviderName =
  | "google_places"
  | "viator"
  | "getyourguide"
  | "eventbrite"
  | "ticketmaster"
  | "amadeus"
  | "duffel"
  | "booking"
  | "wayline";

export type TravelInventoryType =
  | "activity"
  | "event"
  | "flight"
  | "hotel"
  | "place"
  | "restaurant"
  | "tour";

export type TravelInventoryItem = {
  address: string | null;
  availability: Record<string, unknown> | null;
  bookingUrl: string | null;
  cancellationPolicy: string | null;
  category: string | null;
  currency: string | null;
  description: string | null;
  durationMinutes: number | null;
  imageAlt: string | null;
  imageAttribution: string | null;
  imageProvider: string | null;
  id: string;
  imageUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  metadata: Record<string, unknown>;
  priceFrom: number | null;
  provider: TravelProviderName;
  providerItemId: string | null;
  rating: number | null;
  reviewCount: number | null;
  sourceUrl: string | null;
  title: string;
  type: TravelInventoryType;
};

export type TripRecommendationStatus = "booked" | "dismissed" | "saved" | "suggested";

export type TripRecommendation = {
  createdAt: string;
  id: string;
  inventoryItemId: string;
  recommendationType: string;
  reason: string | null;
  score: number | null;
  status: TripRecommendationStatus;
  tripId: string;
  tripSegmentId: string | null;
};

export type PlaceResolutionQuery = {
  address?: string | null;
  city?: string | null;
  country?: string | null;
  locationHint?: string | null;
  name: string;
  sourceTitle?: string | null;
};

export type ResolvedPlace = {
  address: string | null;
  city: string | null;
  country: string | null;
  diagnostics?: LocationDiagnostics | null;
  inventoryItem: TravelInventoryItem | null;
  latitude: number | null;
  longitude: number | null;
  placeId: string | null;
  provider: TravelProviderName | null;
};

export type LocationMatchStatus =
  | "resolved"
  | "needs_location_confirmation"
  | "needs_activity_provider"
  | "wrong_city_rejected"
  | "provider_failed"
  | "manual_location_required"
  | "manually_resolved";

export type TravelProviderErrorCode =
  | "provider_timeout"
  | "provider_quota"
  | "provider_no_results"
  | "provider_invalid_request"
  | "provider_not_configured"
  | "provider_network_error"
  | "provider_unknown_error"
  | "wrong_city_rejected";

export type LocationDiagnostics = {
  attemptedAt: string;
  destinationContext: string | null;
  lastErrorCode: TravelProviderErrorCode | null;
  lastErrorMessageSafe: string | null;
  provider: TravelProviderName | null;
  providerResultCount: number;
  query: string | null;
  rejectionReason: string | null;
  retryable: boolean;
  retryCount?: number;
  selectedFormattedAddress: string | null;
  selectedProviderPlaceId: string | null;
  status: LocationMatchStatus;
};

export type TravelLocation = {
  address?: string | null;
  latitude: number;
  longitude: number;
  title?: string | null;
};

export type TripContext = {
  city?: string | null;
  destination?: string | null;
  endDate?: string | null;
  startDate?: string | null;
  travelStyle?: string | null;
  tripId?: string | null;
};

export type NearbyActivitySearchInput = {
  limit?: number;
  location: TravelLocation;
  radiusMeters?: number;
  tripContext?: TripContext;
};

export type ProviderAdapter = {
  name: TravelProviderName;
  resolvePlace?: (query: PlaceResolutionQuery, context?: TripContext) => Promise<ResolvedPlace>;
  searchNearbyActivities?: (
    input: NearbyActivitySearchInput
  ) => Promise<TravelInventoryItem[]>;
};
