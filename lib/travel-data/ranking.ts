import "server-only";

import type { TravelInventoryItem, TravelLocation } from "@/lib/travel-data/types";

export function rankInventoryItems(
  items: TravelInventoryItem[],
  origin?: TravelLocation | null
) {
  return [...items]
    .map((item) => ({
      item,
      score: scoreInventoryItem(item, origin)
    }))
    .sort((a, b) => b.score - a.score)
    .map(({ item }) => item);
}

export function scoreInventoryItem(
  item: TravelInventoryItem,
  origin?: TravelLocation | null
) {
  const ratingScore = typeof item.rating === "number" ? item.rating / 5 : 0.45;
  const reviewScore = typeof item.reviewCount === "number"
    ? Math.min(0.25, Math.log10(item.reviewCount + 1) / 10)
    : 0;
  const proximityScore =
    origin && typeof item.latitude === "number" && typeof item.longitude === "number"
      ? Math.max(
          0,
          0.3 -
            distanceKm(origin, {
              latitude: item.latitude,
              longitude: item.longitude
            }) /
              50
        )
      : 0;

  return Number((ratingScore + reviewScore + proximityScore).toFixed(3));
}

function distanceKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
) {
  const radiusKm = 6371;
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * radiusKm * Math.asin(Math.sqrt(h));
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}
