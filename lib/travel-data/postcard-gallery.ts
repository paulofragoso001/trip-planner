import type {
  PlacePhotoMetadata,
  TravelInventoryItem,
  TravelLocation
} from "./types";

const COMMERCIAL_PLACE_TYPES = new Set([
  "bakery",
  "bar",
  "cafe",
  "food",
  "lodging",
  "meal_delivery",
  "meal_takeaway",
  "night_club",
  "restaurant",
  "shopping_mall",
  "store"
]);

const ICONIC_PLACE_TYPES = new Set([
  "beach",
  "historical_landmark",
  "monument",
  "museum",
  "natural_feature",
  "observation_deck",
  "park",
  "tourist_attraction"
]);

export const POSTCARD_GALLERY_MAX_DISCOVERY_REQUESTS = 3;
export const POSTCARD_GALLERY_MAX_RESULTS = 10;

export type PostcardRankingOptions = {
  destination: string;
  limit?: number;
  origin?: TravelLocation | null;
};

export function planPostcardGalleryQueries(destination: string) {
  const normalized = normalizeDisplayText(destination);
  if (!normalized) return [];

  return uniqueNormalized([
    `iconic landmarks in ${normalized}`,
    `${normalized} scenic viewpoints skyline`,
    `top tourist attractions in ${normalized}`
  ]).slice(0, POSTCARD_GALLERY_MAX_DISCOVERY_REQUESTS);
}

export function isCommercialPostcardResult(item: TravelInventoryItem) {
  return photoMetadata(item).placeTypes.some((type) =>
    COMMERCIAL_PLACE_TYPES.has(type.toLowerCase())
  );
}

export function rankPostcardGallery(
  items: TravelInventoryItem[],
  options: PostcardRankingOptions
) {
  const destination = normalizeSearchText(options.destination);
  const unique = new Map<string, TravelInventoryItem>();

  for (const item of items) {
    if (!item.imageUrl || isCommercialPostcardResult(item)) continue;
    const identity = postcardIdentity(item);
    const existing = unique.get(identity);
    if (!existing || comparePostcardItems(item, existing, destination, options.origin) < 0) {
      unique.set(identity, item);
    }
  }

  const limit = Math.min(
    Math.max(options.limit ?? 5, 1),
    POSTCARD_GALLERY_MAX_RESULTS
  );

  return [...unique.values()]
    .sort((a, b) => comparePostcardItems(a, b, destination, options.origin))
    .slice(0, limit);
}

function comparePostcardItems(
  a: TravelInventoryItem,
  b: TravelInventoryItem,
  destination: string,
  origin?: TravelLocation | null
) {
  const scoreDifference = postcardScore(b, destination, origin) - postcardScore(a, destination, origin);
  if (scoreDifference) return scoreDifference;

  const reviewDifference = (b.reviewCount || 0) - (a.reviewCount || 0);
  if (reviewDifference) return reviewDifference;

  const ratingDifference = (b.rating || 0) - (a.rating || 0);
  if (ratingDifference) return ratingDifference;

  const areaDifference = photoArea(b) - photoArea(a);
  if (areaDifference) return areaDifference;

  const titleDifference = a.title.localeCompare(b.title, "en", { sensitivity: "base" });
  if (titleDifference) return titleDifference;

  return stableTieBreaker(a).localeCompare(stableTieBreaker(b));
}

function postcardScore(
  item: TravelInventoryItem,
  destination: string,
  origin?: TravelLocation | null
) {
  const metadata = photoMetadata(item);
  const width = metadata.primaryPhotoDimensions?.widthPx || 0;
  const height = metadata.primaryPhotoDimensions?.heightPx || 0;
  const itemText = normalizeSearchText(`${item.title} ${item.address || ""}`);
  const relevance = destination && itemText.includes(destination) ? 8 : tokenOverlap(itemText, destination) * 2;
  const iconic = metadata.placeTypes.some((type) => ICONIC_PLACE_TYPES.has(type.toLowerCase())) ? 7 : 0;
  const landscape = width > height * 1.15 ? 3 : width >= height && width > 0 ? 1.5 : 0;
  const resolution = Math.min(3, photoArea(item) / 4_000_000);
  const prominence = Math.min(2.5, Math.log10((item.reviewCount || 0) + 1) / 2);
  const rating = (item.rating || 0) / 5;
  const proximity = origin ? Math.max(0, 1.5 - distanceKm(origin, item) / 100) : 0;
  return relevance + iconic + landscape + resolution + prominence + rating + proximity;
}

function photoMetadata(item: TravelInventoryItem): PlacePhotoMetadata {
  return item.metadata.placePhoto || {
    placeTypes: [],
    primaryPhotoAttributions: [],
    primaryPhotoDimensions: null,
    primaryPhotoName: null,
    primaryPhotoReference: null,
    providerPlaceId: null
  };
}

function postcardIdentity(item: TravelInventoryItem) {
  const providerID = photoMetadata(item).providerPlaceId || item.providerItemId;
  if (providerID) return `provider:${providerID}`;
  const coordinates = typeof item.latitude === "number" && typeof item.longitude === "number"
    ? `${item.latitude.toFixed(4)},${item.longitude.toFixed(4)}`
    : "";
  return `candidate:${normalizeSearchText(item.title)}|${normalizeSearchText(item.address || "")}|${coordinates}`;
}

function stableTieBreaker(item: TravelInventoryItem) {
  return photoMetadata(item).providerPlaceId || item.providerItemId || postcardIdentity(item) || item.id;
}

function photoArea(item: TravelInventoryItem) {
  const dimensions = photoMetadata(item).primaryPhotoDimensions;
  return (dimensions?.widthPx || 0) * (dimensions?.heightPx || 0);
}

function uniqueNormalized(values: string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = normalizeSearchText(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeDisplayText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeSearchText(value: string) {
  return normalizeDisplayText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokenOverlap(value: string, destination: string) {
  if (!destination) return 0;
  const tokens = new Set(destination.split(" ").filter((token) => token.length > 2));
  if (!tokens.size) return 0;
  return [...tokens].filter((token) => value.includes(token)).length / tokens.size;
}

function distanceKm(origin: TravelLocation, item: TravelInventoryItem) {
  if (typeof item.latitude !== "number" || typeof item.longitude !== "number") return 150;
  const radiusKm = 6371;
  const dLat = radians(item.latitude - origin.latitude);
  const dLon = radians(item.longitude - origin.longitude);
  const lat1 = radians(origin.latitude);
  const lat2 = radians(item.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * radiusKm * Math.asin(Math.sqrt(h));
}

function radians(value: number) {
  return value * Math.PI / 180;
}
