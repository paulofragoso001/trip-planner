import "server-only";

import { buildPlacePhotoUrl, readProviderPhoto } from "@/lib/travel-data/photo-url";

export type WalletHeroImage = {
  fallbackGradient: string;
  imageAlt: string;
  imageAttribution: string | null;
  imageSourceLabel: string | null;
  imageUrl: string | null;
};

export type WalletHeroTrip = {
  destination?: string | null;
  destination_provider_metadata?: Record<string, unknown> | null;
  name?: string | null;
};

export type WalletHeroSegment = {
  id?: string | null;
  inserted_at?: string | null;
  kind?: string | null;
  position?: number | null;
  provider_metadata?: Record<string, unknown> | null;
  start_time?: string | null;
  title?: string | null;
};

export type WalletHeroRecommendation = {
  travel_inventory?: Record<string, unknown> | Record<string, unknown>[] | null;
};

export function getTripHeroImage(
  trip: WalletHeroTrip,
  segments: WalletHeroSegment[] = [],
  recommendations: WalletHeroRecommendation[] = []
): WalletHeroImage {
  const destination = trip.destination || trip.name || "Wayline trip";
  const fallbackGradient = fallbackGradientForDestination(destination);
  const destinationPhoto = imageFromProviderMetadata(
    trip.destination_provider_metadata,
    `${destination} trip photo`,
    "Destination",
    1200
  );

  if (destinationPhoto) {
    return { ...destinationPhoto, fallbackGradient };
  }

  const visualSegment = segments
    .filter((segment) => readProviderPhoto(segment.provider_metadata))
    .sort(compareHeroSegments)[0];

  if (visualSegment) {
    const segmentPhoto = imageFromProviderMetadata(
      visualSegment.provider_metadata,
      visualSegment.title ? `Photo of ${visualSegment.title}` : "Trip place photo",
      visualSegment.title || "Trip place",
      1200
    );
    if (segmentPhoto) {
      return { ...segmentPhoto, fallbackGradient };
    }
  }

  const recommendationPhoto = recommendations
    .map((recommendation) => {
      const inventory = readRecommendationInventory(recommendation);
      return inventory ? imageFromInventory(inventory) : null;
    })
    .find(Boolean);

  if (recommendationPhoto) {
    return { ...recommendationPhoto, fallbackGradient };
  }

  return getFallbackHeroImage(destination, `${destination} trip background`);
}

export function getFallbackHeroImage(destination: string, imageAlt?: string): WalletHeroImage {
  return {
    fallbackGradient: fallbackGradientForDestination(destination),
    imageAlt: imageAlt || `${destination} background`,
    imageAttribution: null,
    imageSourceLabel: null,
    imageUrl: null
  };
}

export function imageFromProviderMetadata(
  metadata: Record<string, unknown> | null | undefined,
  fallbackAlt: string,
  sourceLabel = "Google Places",
  maxWidth = 900
): Omit<WalletHeroImage, "fallbackGradient"> | null {
  const photo = readProviderPhoto(metadata);
  const imageUrl = buildPlacePhotoUrl(metadata, maxWidth);
  if (!photo || !imageUrl) return null;

  return {
    imageAlt: photo.imageAlt || fallbackAlt,
    imageAttribution: photo.attribution || null,
    imageSourceLabel: sourceLabel,
    imageUrl
  };
}

export function compareHeroSegments(a: WalletHeroSegment, b: WalletHeroSegment) {
  const priority = segmentVisualPriority(a) - segmentVisualPriority(b);
  if (priority !== 0) return priority;

  const positionA = typeof a.position === "number" ? a.position : Number.MAX_SAFE_INTEGER;
  const positionB = typeof b.position === "number" ? b.position : Number.MAX_SAFE_INTEGER;
  if (positionA !== positionB) return positionA - positionB;

  const timeA = a.start_time || "";
  const timeB = b.start_time || "";
  if (timeA !== timeB) return timeA.localeCompare(timeB);

  return (a.inserted_at || "").localeCompare(b.inserted_at || "");
}

export function fallbackGradientForDestination(destination: string) {
  const value = destination.toLowerCase();
  if (value.includes("miami")) {
    return "bg-[linear-gradient(135deg,#0f766e,#2563eb_46%,#f97316)]";
  }
  if (value.includes("barcelona")) {
    return "bg-[linear-gradient(135deg,#7c2d12,#1d4ed8_52%,#f59e0b)]";
  }
  if (value.includes("new york")) {
    return "bg-[linear-gradient(135deg,#111827,#334155_45%,#7f1d1d)]";
  }
  return "bg-[linear-gradient(135deg,#172554,#0f766e_55%,#111827)]";
}

function imageFromInventory(
  inventory: Record<string, unknown>
): Omit<WalletHeroImage, "fallbackGradient"> | null {
  const title = readString(inventory.title) || "Nearby idea";
  const metadata = isRecord(inventory.metadata) ? inventory.metadata : null;
  const imageUrl =
    readString(inventory.image_url) ||
    buildPlacePhotoUrl(metadata, 1200);

  if (!imageUrl) return null;

  const metadataPhoto = readProviderPhoto(metadata);
  return {
    imageAlt: readString(inventory.image_alt) || metadataPhoto?.imageAlt || `Photo of ${title}`,
    imageAttribution: readString(inventory.image_attribution) || metadataPhoto?.attribution || null,
    imageSourceLabel: title,
    imageUrl
  };
}

function readRecommendationInventory(recommendation: WalletHeroRecommendation) {
  const inventory = recommendation.travel_inventory;
  if (Array.isArray(inventory)) return inventory.find(isRecord) || null;
  return isRecord(inventory) ? inventory : null;
}

function segmentVisualPriority(segment: WalletHeroSegment) {
  const value = `${segment.kind || ""} ${segment.title || ""}`.toLowerCase();
  if (/landmark|attraction|museum|wall|park|garden|beach|neighborhood|district|centre|center|sagrada|wynwood/.test(value)) {
    return 1;
  }
  if (/restaurant|food|dinner|lunch|cafe|coffee|bar/.test(value)) {
    return 2;
  }
  if (/hotel|lodging|stay/.test(value)) {
    return 3;
  }
  if (/flight|airport|transport|station|terminal/.test(value)) {
    return 4;
  }
  return 5;
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
