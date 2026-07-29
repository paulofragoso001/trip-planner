import type {
  PlacePhotoMetadata,
  PostcardDiscoveryCategory,
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

const STRONG_ICONIC_PLACE_TYPES = new Set([
  "beach",
  "historical_landmark",
  "monument",
  "natural_feature",
  "observation_deck",
  "tourist_attraction"
]);

const MEDIUM_ICONIC_PLACE_TYPES = new Set([
  "art_gallery",
  "cathedral",
  "church",
  "museum",
  "park",
  "place_of_worship",
  "plaza"
]);

const GENERIC_BROAD_QUERY_TYPES = new Set([
  "convention_center",
  "establishment",
  "museum",
  "point_of_interest",
  "premise"
]);

const ICONIC_TITLE_TERMS = new Set([
  "arch",
  "beach",
  "bridge",
  "castle",
  "colosseum",
  "gardens",
  "landmark",
  "monument",
  "mount",
  "mountain",
  "palace",
  "redeemer",
  "skyline",
  "statue",
  "temple",
  "tower",
  "view",
  "viewpoint"
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

  const ranked = [...unique.values()]
    .sort((a, b) => comparePostcardItems(a, b, destination, options.origin));

  if (process.env.NODE_ENV === "development") {
    ranked.slice(0, limit).forEach((item, index) => {
      const score = postcardScore(item, destination, options.origin);
      console.info("Postcard ranking:", {
        candidateCategory: item.metadata.postcardDiscoveryCategory || "destination_discovery",
        finalRank: index + 1,
        iconicTier: score.iconicTier,
        landscape: isLandscape(item),
        resolutionTier: resolutionTier(item),
        titleRelevance: Number(score.titleRelevance.toFixed(2))
      });
    });
  }

  return ranked.slice(0, limit);
}

export function selectPostcardHero(
  items: TravelInventoryItem[],
  options: PostcardRankingOptions
) {
  const ranked = rankPostcardGallery(items, {
    ...options,
    limit: POSTCARD_GALLERY_MAX_RESULTS
  });
  if (!ranked.length) return null;

  const destination = normalizeSearchText(options.destination);
  return ranked.find((item) =>
    hasUsableHeroImage(item) &&
    (iconicTier(item) >= 3 || discoveryTier(item) >= 3) &&
    postcardScore(item, destination, options.origin).heroSuitability >= 2
  ) || ranked.find(hasUsableHeroImage) || ranked[0];
}

function comparePostcardItems(
  a: TravelInventoryItem,
  b: TravelInventoryItem,
  destination: string,
  origin?: TravelLocation | null
) {
  const aScore = postcardScore(a, destination, origin);
  const bScore = postcardScore(b, destination, origin);
  const scoreDifference = bScore.total - aScore.total;
  if (scoreDifference) return scoreDifference;

  const iconicDifference = bScore.iconicTier - aScore.iconicTier;
  if (iconicDifference) return iconicDifference;

  const relevanceDifference = bScore.titleRelevance - aScore.titleRelevance;
  if (relevanceDifference) return relevanceDifference;

  const landscapeDifference = bScore.heroSuitability - aScore.heroSuitability;
  if (landscapeDifference) return landscapeDifference;

  const areaDifference = photoArea(b) - photoArea(a);
  if (areaDifference) return areaDifference;

  const reviewDifference = (b.reviewCount || 0) - (a.reviewCount || 0);
  if (reviewDifference) return reviewDifference;

  const ratingDifference = (b.rating || 0) - (a.rating || 0);
  if (ratingDifference) return ratingDifference;

  const distanceDifference = distanceForSort(a, origin) - distanceForSort(b, origin);
  if (distanceDifference) return distanceDifference;

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
  const normalizedTitle = normalizeSearchText(item.title);
  const itemText = normalizeSearchText(`${item.title} ${item.address || ""}`);
  const titleRelevance = destination
    ? tokenOverlap(normalizedTitle, destination)
    : 0;
  const localityRelevance = destination
    ? tokenOverlap(normalizeSearchText(item.address || ""), destination)
    : 0;
  const exactDestinationInTitle = destination && normalizedTitle.includes(destination) ? 1 : 0;
  const discovery = discoveryTier(item);
  const iconic = iconicTier(item);
  const iconicTitle = titleIconicTier(normalizedTitle);
  const broadQuery = !isSpecificAttractionQuery(destination);
  const specificQueryMatch = !broadQuery && titleRelevance >= 0.8 ? 24 : 0;
  const genericPenalty = broadQuery && metadata.placeTypes.some((type) =>
    GENERIC_BROAD_QUERY_TYPES.has(type.toLowerCase())
  ) ? 3 : 0;
  const landscape = width > height * 1.15 ? 3 : width >= height && width > 0 ? 1.5 : 0;
  const resolution = resolutionTier(item);
  const prominence = Math.min(2, Math.log10((item.reviewCount || 0) + 1) / 3);
  const rating = (item.rating || 0) / 5;
  const proximity = origin ? Math.max(0, 0.75 - distanceKm(origin, item) / 200) : 0;
  const total =
    discovery * 3 +
    iconic * 3 +
    iconicTitle * 2 +
    titleRelevance * 4 +
    localityRelevance * 1.5 +
    exactDestinationInTitle * 0.75 +
    specificQueryMatch +
    landscape +
    resolution +
    prominence +
    rating +
    proximity -
    genericPenalty;
  return {
    heroSuitability: landscape + resolution,
    iconicTier: Math.max(iconic, iconicTitle, discovery),
    titleRelevance,
    total
  };
}

function discoveryTier(item: TravelInventoryItem) {
  const category = item.metadata.postcardDiscoveryCategory as PostcardDiscoveryCategory | undefined;
  switch (category) {
    case "iconic_landmark":
    case "scenic_view":
      return 3;
    case "tourist_attraction":
      return 1;
    default:
      return 0;
  }
}

function iconicTier(item: TravelInventoryItem) {
  const types = photoMetadata(item).placeTypes.map((type) => type.toLowerCase());
  if (types.some((type) => STRONG_ICONIC_PLACE_TYPES.has(type))) return 3;
  if (types.some((type) => MEDIUM_ICONIC_PLACE_TYPES.has(type))) return 1;
  return 0;
}

function titleIconicTier(title: string) {
  const tokens = title.split(" ");
  return tokens.some((token) => ICONIC_TITLE_TERMS.has(token)) ? 3 : 0;
}

function resolutionTier(item: TravelInventoryItem) {
  const area = photoArea(item);
  if (area >= 6_000_000) return 3;
  if (area >= 2_000_000) return 2;
  if (area >= 800_000) return 1;
  return 0;
}

function hasUsableHeroImage(item: TravelInventoryItem) {
  if (!item.imageUrl) return false;
  const dimensions = photoMetadata(item).primaryPhotoDimensions;
  if (!dimensions?.widthPx || !dimensions?.heightPx) return false;
  return dimensions.widthPx >= dimensions.heightPx && photoArea(item) >= 800_000;
}

function isLandscape(item: TravelInventoryItem) {
  const dimensions = photoMetadata(item).primaryPhotoDimensions;
  return Boolean(
    dimensions?.widthPx &&
    dimensions?.heightPx &&
    dimensions.widthPx > dimensions.heightPx * 1.15
  );
}

function isSpecificAttractionQuery(destination: string) {
  if (!destination) return false;
  const specificTerms = [
    "cathedral",
    "church",
    "gallery",
    "museum",
    "palace",
    "temple",
    "tower"
  ];
  return specificTerms.some((term) => destination.includes(term));
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

function distanceForSort(item: TravelInventoryItem, origin?: TravelLocation | null) {
  return origin ? distanceKm(origin, item) : Number.POSITIVE_INFINITY;
}

function radians(value: number) {
  return value * Math.PI / 180;
}
