import "server-only";

import type {
  TravelInventoryItem,
  TravelInventoryType,
  TravelProviderName
} from "@/lib/travel-data/types";

export function normalizeInventoryItem(input: {
  address?: string | null;
  availability?: Record<string, unknown> | null;
  bookingUrl?: string | null;
  cancellationPolicy?: string | null;
  category?: string | null;
  currency?: string | null;
  description?: string | null;
  durationMinutes?: number | null;
  imageAlt?: string | null;
  imageAttribution?: string | null;
  imageProvider?: string | null;
  id?: string | null;
  imageUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  metadata?: Record<string, unknown> | null;
  priceFrom?: number | null;
  provider: TravelProviderName;
  providerItemId?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
  sourceUrl?: string | null;
  title: string;
  type: TravelInventoryType;
}): TravelInventoryItem {
  const providerItemId = input.providerItemId || null;
  return {
    address: input.address || null,
    availability: input.availability || null,
    bookingUrl: input.bookingUrl || null,
    cancellationPolicy: input.cancellationPolicy || null,
    category: input.category || null,
    currency: input.currency || null,
    description: input.description || null,
    durationMinutes: normalizeInteger(input.durationMinutes),
    imageAlt: input.imageAlt || null,
    imageAttribution: input.imageAttribution || null,
    imageProvider: input.imageProvider || null,
    id: input.id || `${input.provider}:${providerItemId || stableSlug(input.title)}`,
    imageUrl: input.imageUrl || null,
    latitude: normalizeCoordinate(input.latitude),
    longitude: normalizeCoordinate(input.longitude),
    metadata: input.metadata || {},
    priceFrom: normalizeNumber(input.priceFrom),
    provider: input.provider,
    providerItemId,
    rating: normalizeNumber(input.rating),
    reviewCount: normalizeInteger(input.reviewCount),
    sourceUrl: input.sourceUrl || null,
    title: input.title.trim(),
    type: input.type
  };
}

export function stableSlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function normalizeCoordinate(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeInteger(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : null;
}
