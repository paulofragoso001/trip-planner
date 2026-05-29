import "server-only";

import { resolvePlace } from "@/lib/travel-data";
import type { LocationDiagnostics } from "@/lib/travel-data/types";

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
  lat?: number | null;
  lng?: number | null;
  kind: string | null;
  location: string | null;
  location_status: string | null;
  notes: string | null;
  provider_metadata: Record<string, unknown> | null;
  title: string | null;
  trip_id?: string;
};

const retryableLocationStatuses = [
  "needs_location_confirmation",
  "wrong_city_rejected",
  "provider_failed",
  "manual_location_required",
  "unresolved"
] as const;

export async function resolveUnmappedPhysicalTripSegments(
  supabase: SupabaseLike,
  userId: string,
  tripId: string,
  trip: TripRow,
  options: { limit?: number } = {}
) {
  const { data, error } = await supabase
    .from("trip_segments")
    .select("id,kind,title,location,notes,lat,lng,location_status,provider_metadata")
    .eq("trip_id", tripId)
    .eq("user_id", userId)
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

  return resolveTripSegmentLocations(
    supabase,
    userId,
    tripId,
    trip,
    data as TripSegmentRow[]
  );
}

export async function retryTripSegmentLocation(
  supabase: SupabaseLike,
  userId: string,
  segmentId: string,
  options: { force?: boolean } = {}
) {
  const { data: segment, error } = await supabase
    .from("trip_segments")
    .select("id,trip_id,kind,title,location,notes,lat,lng,location_status,provider_metadata")
    .eq("id", segmentId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !segment) {
    throw new Error("Trip stop not found.");
  }

  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .select("destination,name,title")
    .eq("id", segment.trip_id)
    .eq("user_id", userId)
    .maybeSingle();

  if (tripError || !trip) {
    throw new Error("Trip not found.");
  }

  return resolveOneTripSegmentLocation(
    supabase,
    userId,
    segment.trip_id,
    trip,
    segment as TripSegmentRow,
    options
  );
}

export async function resolveTripSegmentLocations(
  supabase: SupabaseLike,
  userId: string,
  tripId: string,
  trip: TripRow,
  segments?: TripSegmentRow[]
) {
  const rows = segments || [];
  let attempted = 0;
  let resolved = 0;
  let failed = 0;
  let skippedActivity = 0;
  let wrongCityRejected = 0;

  for (const segment of rows) {
    const eligibility = retryEligibility(segment);
    if (eligibility === "activity") {
      skippedActivity += 1;
      await markActivityProviderNeeded(supabase, userId, segment);
      continue;
    }
    if (eligibility !== "eligible") continue;

    attempted += 1;
    const result = await resolveOneTripSegmentLocation(supabase, userId, tripId, trip, segment);
    if (result.status === "resolved") resolved += 1;
    else if (result.status === "wrong_city_rejected") wrongCityRejected += 1;
    else failed += 1;
  }

  return { attempted, failed, resolved, skippedActivity, wrongCityRejected };
}

async function resolveOneTripSegmentLocation(
  supabase: SupabaseLike,
  userId: string,
  tripId: string,
  trip: TripRow,
  segment: TripSegmentRow,
  options: { force?: boolean } = {}
) {
  if (!options.force && segment.location_status === "resolved") {
    return { segment, status: "resolved" };
  }

  const eligibility = retryEligibility(segment, options);
  if (eligibility === "activity") {
    const updated = await markActivityProviderNeeded(supabase, userId, segment);
    return { segment: updated || segment, status: "needs_activity_provider" };
  }
  if (eligibility !== "eligible") {
    return { segment, status: segment.location_status || "manual_location_required" };
  }

  const destination = trip.destination || trip.name || trip.title || null;
  const context = destination || segment.location || null;
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

  const diagnostics = mergeLocationDiagnostics(segment.provider_metadata, resolved.diagnostics, {
    destinationContext: context,
    query,
    status:
      typeof resolved.latitude === "number" && typeof resolved.longitude === "number"
        ? "resolved"
        : statusFromDiagnostics(resolved.diagnostics)
  });

  if (typeof resolved.latitude !== "number" || typeof resolved.longitude !== "number") {
    const nextStatus = statusFromDiagnostics(resolved.diagnostics);
    const { data: updated } = await supabase
      .from("trip_segments")
      .update({
        location_status: nextStatus,
        provider_metadata: {
          ...(isRecord(segment.provider_metadata) ? segment.provider_metadata : {}),
          locationDiagnostics: diagnostics
        }
      })
      .eq("id", segment.id)
      .eq("user_id", userId)
      .select("id,trip_id,kind,title,location,notes,lat,lng,location_status,provider_metadata")
      .maybeSingle();

    logSegmentResolution("segment_location_retry_unresolved", {
      provider: resolved.provider || resolved.diagnostics?.provider || null,
      providerResultCount: diagnostics.providerResultCount,
      rejectionReason: diagnostics.rejectionReason,
      segmentId: segment.id,
      status: nextStatus,
      tripId,
      userId
    });
    return { segment: updated || segment, status: nextStatus };
  }

  const { data: updated, error: updateError } = await supabase
    .from("trip_segments")
    .update({
      lat: resolved.latitude,
      lng: resolved.longitude,
      location: resolved.address || segment.location || context || null,
      location_status: "resolved",
      provider: resolved.provider || "google_places",
      provider_metadata: {
        ...(isRecord(segment.provider_metadata) ? segment.provider_metadata : {}),
        activityCandidate: false,
        locationDiagnostics: diagnostics,
        providerMetadata: resolved.inventoryItem?.metadata || {},
        resolvedAt: new Date().toISOString(),
        resolutionSource: "map_retry"
      },
      provider_place_id: resolved.placeId || null
    })
    .eq("id", segment.id)
    .eq("user_id", userId)
    .select("id,trip_id,kind,title,location,notes,lat,lng,location_status,provider_metadata")
    .maybeSingle();

  if (updateError) {
    logSegmentResolution("segment_location_retry_update_failed", {
      error: updateError.message,
      segmentId: segment.id,
      tripId,
      userId
    });
    return { segment, status: "provider_failed" };
  }

  logSegmentResolution("segment_location_retry_resolved", {
    address: safePreview(resolved.address),
    provider: resolved.provider || "google_places",
    providerPlaceId: resolved.placeId ? "present" : "missing",
    providerResultCount: diagnostics.providerResultCount,
    segmentId: segment.id,
    tripId,
    userId
  });

  return { segment: updated || segment, status: "resolved" };
}

function retryEligibility(segment: TripSegmentRow, options: { force?: boolean } = {}) {
  if (!segment.title?.trim()) return false;
  if (!options.force && segment.location_status === "resolved") return false;

  const metadata = isRecord(segment.provider_metadata) ? segment.provider_metadata : {};
  const text = normalizeText(
    [segment.kind, segment.title, segment.location].filter(Boolean).join(" ")
  );
  const isTourLike =
    /\b(boat tour|tour|cruise|guided|excursion|experience|meeting point|provider)\b/.test(text);
  if (metadata.activityCandidate === true || isTourLike) return "activity";
  const status = segment.location_status || "unresolved";
  return retryableLocationStatuses.includes(status as any) ? "eligible" : false;
}

async function markActivityProviderNeeded(
  supabase: SupabaseLike,
  userId: string,
  segment: TripSegmentRow
) {
  if (segment.location_status === "needs_activity_provider") return segment;
  const diagnostics = mergeLocationDiagnostics(segment.provider_metadata, null, {
    query: segment.title,
    status: "needs_activity_provider"
  });
  const { data } = await supabase
    .from("trip_segments")
    .update({
      location_status: "needs_activity_provider",
      provider_metadata: {
        ...(isRecord(segment.provider_metadata) ? segment.provider_metadata : {}),
        activityCandidate: true,
        locationDiagnostics: diagnostics
      }
    })
    .eq("id", segment.id)
    .eq("user_id", userId)
    .select("id,trip_id,kind,title,location,notes,lat,lng,location_status,provider_metadata")
    .maybeSingle();
  return data;
}

function statusFromDiagnostics(diagnostics?: LocationDiagnostics | null) {
  if (diagnostics?.status === "wrong_city_rejected") return "wrong_city_rejected";
  if (diagnostics?.lastErrorCode === "provider_not_configured") return "provider_failed";
  if (diagnostics?.lastErrorCode === "provider_timeout") return "provider_failed";
  if (diagnostics?.lastErrorCode === "provider_quota") return "provider_failed";
  if (diagnostics?.lastErrorCode === "provider_network_error") return "provider_failed";
  if (diagnostics?.status === "provider_failed") return "provider_failed";
  return "needs_location_confirmation";
}

function mergeLocationDiagnostics(
  metadata: Record<string, unknown> | null,
  diagnostics: LocationDiagnostics | null | undefined,
  fallback: Partial<LocationDiagnostics>
): LocationDiagnostics {
  const previous = isRecord(metadata?.locationDiagnostics)
    ? metadata.locationDiagnostics
    : null;
  return {
    attemptedAt: diagnostics?.attemptedAt || new Date().toISOString(),
    destinationContext:
      diagnostics?.destinationContext ?? readString(fallback.destinationContext) ?? null,
    lastErrorCode: diagnostics?.lastErrorCode ?? null,
    lastErrorMessageSafe: diagnostics?.lastErrorMessageSafe ?? null,
    provider: diagnostics?.provider || null,
    providerResultCount: diagnostics?.providerResultCount ?? 0,
    query: diagnostics?.query || readString(fallback.query) || null,
    rejectionReason: diagnostics?.rejectionReason || null,
    retryable: diagnostics?.retryable ?? true,
    retryCount: Number(previous?.retryCount || 0) + 1,
    selectedFormattedAddress: diagnostics?.selectedFormattedAddress || null,
    selectedProviderPlaceId: diagnostics?.selectedProviderPlaceId || null,
    status: diagnostics?.status || fallback.status || "needs_location_confirmation"
  } as LocationDiagnostics & { retryCount: number };
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

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
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
