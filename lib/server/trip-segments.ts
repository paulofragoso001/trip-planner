import "server-only";

import { ApiError } from "@/lib/api/errors";
import type {
  TripSegmentWriteInput
} from "@/lib/validators/trip-segments";

export type TripSegmentsClient = {
  from: (table: "trip_segments") => any;
};

const segmentSelect =
  "id,trip_id,user_id,title,location,kind,start_time,end_time,lat,lng,notes,provider,provider_metadata,provider_place_id,location_status,confirmation_code,booking_url,position,inserted_at,updated_at";

export async function listTripSegments(
  supabase: TripSegmentsClient,
  userId: string,
  tripId: string
) {
  const { data, error } = await supabase
    .from("trip_segments")
    .select(segmentSelect)
    .eq("trip_id", tripId)
    .eq("user_id", userId)
    .order("start_time", { ascending: true, nullsFirst: false })
    .order("inserted_at", { ascending: true });

  if (error) {
    throw new ApiError("internal_error", "Could not load trip segments.", 500, {
      supabaseMessage: error.message
    });
  }

  return data || [];
}

export async function createTripSegment(
  supabase: TripSegmentsClient,
  userId: string,
  input: TripSegmentWriteInput
) {
  const nextPosition = await loadNextPosition(supabase, userId, input.tripId);
  const providerMetadata = withScheduleMetadata(
    typeof input.lat === "number" && typeof input.lng === "number"
      ? locationMetadata(input.location, input.providerMetadata, input.providerPlaceId)
      : input.providerMetadata || {},
    input
  );
  const { data, error } = await supabase
    .from("trip_segments")
    .insert({
      booking_url: input.bookingUrl,
      confirmation_code: input.confirmationCode,
      end_time: input.endTime,
      kind: input.kind,
      lat: input.lat,
      lng: input.lng,
      location: input.location,
      location_status:
        input.locationStatus ||
        (typeof input.lat === "number" && typeof input.lng === "number"
          ? "resolved"
          : "needs_location_confirmation"),
      notes: input.notes,
      position: nextPosition,
      provider: input.provider,
      provider_place_id: input.providerPlaceId || null,
      provider_metadata: providerMetadata,
      start_time: input.startTime,
      title: input.title,
      trip_id: input.tripId,
      user_id: userId
    })
    .select(segmentSelect)
    .single();

  if (error) {
    throw new ApiError("internal_error", "Could not create trip segment.", 500, {
      supabaseMessage: error.message
    });
  }

  return data;
}

export async function updateTripSegment(
  supabase: TripSegmentsClient,
  userId: string,
  segmentId: string,
  input: Partial<Omit<TripSegmentWriteInput, "tripId">>
) {
  const updates: Record<string, unknown> = {};
  const shouldMergeMetadata =
    "providerMetadata" in input ||
    "providerPlaceId" in input ||
    hasScheduleInput(input) ||
    (typeof input.lat === "number" && typeof input.lng === "number");
  const currentMetadata = shouldMergeMetadata
    ? await loadCurrentProviderMetadata(supabase, userId, segmentId)
    : {};

  if ("bookingUrl" in input) updates.booking_url = input.bookingUrl;
  if ("confirmationCode" in input) updates.confirmation_code = input.confirmationCode;
  if ("endTime" in input) updates.end_time = input.endTime;
  if ("kind" in input) updates.kind = input.kind;
  if ("lat" in input) updates.lat = input.lat;
  if ("lng" in input) updates.lng = input.lng;
  if ("location" in input) updates.location = input.location;
  if ("locationStatus" in input) updates.location_status = input.locationStatus;
  if ("providerMetadata" in input) {
    updates.provider_metadata = withScheduleMetadata(
      { ...currentMetadata, ...(input.providerMetadata || {}) },
      input
    );
  }
  if ("providerPlaceId" in input) updates.provider_place_id = input.providerPlaceId || null;
  if (
    typeof input.lat === "number" &&
    typeof input.lng === "number"
  ) {
    updates.location_status = "resolved";
    updates.provider_metadata = withScheduleMetadata(
      {
        ...currentMetadata,
        ...locationMetadata(input.location, input.providerMetadata, input.providerPlaceId)
      },
      input
    );
  } else if ("lat" in input || "lng" in input) {
    updates.location_status = "manual_location_required";
  }
  if ("notes" in input) updates.notes = input.notes;
  if ("provider" in input) updates.provider = input.provider;
  if ("startTime" in input) updates.start_time = input.startTime;
  if (hasScheduleInput(input) && !("provider_metadata" in updates)) {
    updates.provider_metadata = withScheduleMetadata(currentMetadata, input);
  }
  if ("title" in input) updates.title = input.title;

  const { data, error } = await supabase
    .from("trip_segments")
    .update(updates)
    .eq("id", segmentId)
    .eq("user_id", userId)
    .select(segmentSelect)
    .single();

  if (error) {
    throw new ApiError("internal_error", "Could not update trip segment.", 500, {
      supabaseMessage: error.message
    });
  }

  return data;
}

async function loadCurrentProviderMetadata(
  supabase: TripSegmentsClient,
  userId: string,
  segmentId: string
) {
  const { data } = await supabase
    .from("trip_segments")
    .select("provider_metadata")
    .eq("id", segmentId)
    .eq("user_id", userId)
    .maybeSingle();

  return isRecord(data?.provider_metadata) ? data.provider_metadata : {};
}

function hasScheduleInput(input: Partial<Omit<TripSegmentWriteInput, "tripId">>) {
  return (
    "startDate" in input ||
    "startClockTime" in input ||
    "endDate" in input ||
    "endClockTime" in input ||
    "timeZone" in input
  );
}

function withScheduleMetadata(
  metadata: Record<string, unknown>,
  input: Partial<Omit<TripSegmentWriteInput, "tripId">>
) {
  if (!hasScheduleInput(input)) return metadata;

  return {
    ...metadata,
    schedule: {
      ...(isRecord(metadata.schedule) ? metadata.schedule : {}),
      endDate: input.endDate || null,
      endTime: input.endClockTime || null,
      hasEndTime: Boolean(input.endDate && input.endClockTime),
      hasStartTime: Boolean(input.startDate && input.startClockTime),
      startDate: input.startDate || null,
      startTime: input.startClockTime || null,
      timeZone: input.timeZone || null
    }
  };
}

function locationMetadata(
  location: string | null | undefined,
  providerMetadata?: Record<string, unknown> | null,
  providerPlaceId?: string | null
) {
  if (providerMetadata && Object.keys(providerMetadata).length) {
    return {
      ...providerMetadata,
      locationDiagnostics: {
        ...(isRecord(providerMetadata.locationDiagnostics)
          ? providerMetadata.locationDiagnostics
          : {}),
        attemptedAt: new Date().toISOString(),
        provider: "google_places",
        query: location || null,
        retryable: false,
        selectedFormattedAddress: location || null,
        selectedProviderPlaceId: providerPlaceId || readProviderPlaceId(providerMetadata),
        status: "manually_resolved"
      },
      manualOverride: true,
      providerPlaceId: providerPlaceId || readProviderPlaceId(providerMetadata)
    };
  }

  return {
    locationDiagnostics: {
      attemptedAt: new Date().toISOString(),
      destinationContext: null,
      lastErrorCode: null,
      lastErrorMessageSafe: null,
      provider: "wayline",
      providerResultCount: 0,
      query: location || null,
      rejectionReason: null,
      retryable: false,
      retryCount: 0,
      selectedFormattedAddress: location || null,
      selectedProviderPlaceId: providerPlaceId || null,
      status: "manually_resolved"
    },
    manualOverride: true,
    providerPlaceId: providerPlaceId || null
  };
}

function readProviderPlaceId(metadata: Record<string, unknown>) {
  return typeof metadata.providerPlaceId === "string" ? metadata.providerPlaceId : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export async function deleteTripSegment(
  supabase: TripSegmentsClient,
  userId: string,
  segmentId: string
) {
  const { error } = await supabase
    .from("trip_segments")
    .delete()
    .eq("id", segmentId)
    .eq("user_id", userId);

  if (error) {
    throw new ApiError("internal_error", "Could not delete trip segment.", 500, {
      supabaseMessage: error.message
    });
  }
}

async function loadNextPosition(
  supabase: TripSegmentsClient,
  userId: string,
  tripId: string
) {
  const { data, error } = await supabase
    .from("trip_segments")
    .select("position")
    .eq("trip_id", tripId)
    .eq("user_id", userId)
    .order("position", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return 0;
  }

  return typeof data?.position === "number" ? data.position + 1 : 0;
}
