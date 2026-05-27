import "server-only";

import { ApiError } from "@/lib/api/errors";
import type {
  TripSegmentWriteInput
} from "@/lib/validators/trip-segments";

export type TripSegmentsClient = {
  from: (table: "trip_segments") => any;
};

const segmentSelect =
  "id,trip_id,user_id,title,location,kind,start_time,end_time,lat,lng,notes,provider,confirmation_code,booking_url,position,inserted_at,updated_at";

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
      notes: input.notes,
      position: nextPosition,
      provider: input.provider,
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

  if ("bookingUrl" in input) updates.booking_url = input.bookingUrl;
  if ("confirmationCode" in input) updates.confirmation_code = input.confirmationCode;
  if ("endTime" in input) updates.end_time = input.endTime;
  if ("kind" in input) updates.kind = input.kind;
  if ("lat" in input) updates.lat = input.lat;
  if ("lng" in input) updates.lng = input.lng;
  if ("location" in input) updates.location = input.location;
  if ("notes" in input) updates.notes = input.notes;
  if ("provider" in input) updates.provider = input.provider;
  if ("startTime" in input) updates.start_time = input.startTime;
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
