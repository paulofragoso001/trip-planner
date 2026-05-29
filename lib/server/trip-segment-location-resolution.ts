import "server-only";

import { resolvePlace } from "@/lib/travel-data";

type SupabaseLike = {
  from: (table: string) => any;
};

type TripRow = {
  destination: string | null;
  name?: string | null;
  title?: string | null;
};

type TripSegmentRow = {
  id: string;
  kind: string | null;
  location: string | null;
  location_status: string | null;
  notes: string | null;
  provider_metadata: Record<string, unknown> | null;
  title: string | null;
};

export async function resolveUnmappedPhysicalTripSegments(
  supabase: SupabaseLike,
  userId: string,
  tripId: string,
  trip: TripRow,
  options: { limit?: number } = {}
) {
  const { data, error } = await supabase
    .from("trip_segments")
    .select("id,kind,title,location,notes,location_status,provider_metadata")
    .eq("trip_id", tripId)
    .eq("user_id", userId)
    .is("lat", null)
    .limit(options.limit || 8);

  if (error || !Array.isArray(data) || data.length === 0) {
    if (error) {
      logSegmentResolution("segment_location_retry_load_failed", {
        error: error.message,
        tripId,
        userId
      });
    }
    return { attempted: 0, resolved: 0 };
  }

  let attempted = 0;
  let resolvedCount = 0;
  const destination = trip.destination || trip.name || trip.title || null;

  for (const segment of data as TripSegmentRow[]) {
    if (!shouldRetrySegmentResolution(segment)) {
      continue;
    }

    attempted += 1;
    const context = segment.location || destination;
    const query = [segment.title, context].filter(Boolean).join(" ");
    logSegmentResolution("segment_location_retry_started", {
      category: segment.kind || null,
      context: safePreview(context),
      query: safePreview(query),
      segmentId: segment.id,
      tripId,
      userId
    });

    const resolved = await resolvePlace(
      {
        address: null,
        city: context,
        country: null,
        locationHint: context,
        name: segment.title || "Trip stop",
        sourceTitle: destination
      },
      {
        city: context,
        destination,
        tripId
      }
    );

    if (typeof resolved.latitude !== "number" || typeof resolved.longitude !== "number") {
      logSegmentResolution("segment_location_retry_unresolved", {
        provider: resolved.provider || null,
        segmentId: segment.id,
        tripId,
        userId
      });
      continue;
    }

    const { error: updateError } = await supabase
      .from("trip_segments")
      .update({
        lat: resolved.latitude,
        lng: resolved.longitude,
        location: resolved.address || segment.location || context || null,
        location_status: "resolved",
        provider: resolved.provider || "google_places",
        provider_metadata: {
          ...(isRecord(segment.provider_metadata) ? segment.provider_metadata : {}),
          providerMetadata: resolved.inventoryItem?.metadata || {},
          resolvedAt: new Date().toISOString(),
          resolutionSource: "map_retry"
        },
        provider_place_id: resolved.placeId || null
      })
      .eq("id", segment.id)
      .eq("user_id", userId);

    if (updateError) {
      logSegmentResolution("segment_location_retry_update_failed", {
        error: updateError.message,
        segmentId: segment.id,
        tripId,
        userId
      });
      continue;
    }

    resolvedCount += 1;
    logSegmentResolution("segment_location_retry_resolved", {
      address: safePreview(resolved.address),
      provider: resolved.provider || "google_places",
      providerPlaceId: resolved.placeId ? "present" : "missing",
      segmentId: segment.id,
      tripId,
      userId
    });
  }

  return { attempted, resolved: resolvedCount };
}

function shouldRetrySegmentResolution(segment: TripSegmentRow) {
  if (!segment.title?.trim()) return false;
  if (segment.location_status === "resolved") return false;

  const metadata = isRecord(segment.provider_metadata) ? segment.provider_metadata : {};
  if (metadata.activityCandidate === true) return false;

  const text = normalizeText(
    [segment.kind, segment.title, segment.location].filter(Boolean).join(" ")
  );
  return !/\b(boat tour|tour|cruise|guided|excursion|experience|meeting point|provider)\b/.test(text);
}

function logSegmentResolution(event: string, details: Record<string, unknown>) {
  console.info(
    JSON.stringify({
      area: "trip_segments",
      event,
      ...details
    })
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function safePreview(value: unknown) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, 90);
}
