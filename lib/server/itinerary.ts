import "server-only";

import { ApiError } from "@/lib/api/errors";
import type { CreateItineraryItemInput } from "@/lib/validators/itinerary";

export type ItineraryClient = {
  from: (table: "trip_segments") => any;
};

const segmentSelect =
  "id,trip_id,user_id,title,location,kind,start_time,end_time,lat,lng,notes,provider,confirmation_code,booking_url,position,inserted_at,updated_at";

export async function listItineraryItems(
  supabase: ItineraryClient,
  userId: string,
  tripId: string
) {
  const { data, error } = await supabase
    .from("trip_segments")
    .select(segmentSelect)
    .eq("trip_id", tripId)
    .eq("user_id", userId)
    .order("start_time", { ascending: true, nullsFirst: false })
    .order("position", { ascending: true, nullsFirst: false })
    .order("inserted_at", { ascending: true });

  if (error) {
    throw new ApiError("internal_error", "Could not load itinerary.", 500, {
      supabaseMessage: error.message
    });
  }

  return (data || []).map(mapSegmentToItineraryItem);
}

export async function createItineraryItem(
  supabase: ItineraryClient,
  userId: string,
  input: CreateItineraryItemInput
) {
  const nextPosition = await loadNextPosition(supabase, userId, input.tripId);
  const { data, error } = await supabase
    .from("trip_segments")
    .insert({
      booking_url: input.bookingUrl,
      confirmation_code: input.confirmationCode,
      end_time: input.endTime,
      kind: input.segmentType,
      lat: input.lat,
      lng: input.lng,
      location: input.location,
      notes: input.notes,
      position: nextPosition,
      provider: input.provider,
      start_time: input.dateTime,
      title: input.title,
      trip_id: input.tripId,
      user_id: userId
    })
    .select(segmentSelect)
    .single();

  if (error) {
    throw new ApiError("internal_error", "Could not create itinerary item.", 500, {
      supabaseMessage: error.message
    });
  }

  return mapSegmentToItineraryItem(data);
}

async function loadNextPosition(
  supabase: ItineraryClient,
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

function mapSegmentToItineraryItem(segment: Record<string, unknown>) {
  const dateTime = readString(segment.start_time);
  const kind = readString(segment.kind) || "activity";

  return {
    airline: null,
    arrival_airport: null,
    arrival_airport_lat: null,
    arrival_airport_lng: null,
    booking_url: readString(segment.booking_url),
    confirmation_code: readString(segment.confirmation_code),
    date: dateTime?.slice(0, 10),
    date_time: dateTime,
    departure_airport: null,
    departure_airport_lat: null,
    departure_airport_lng: null,
    estimated_departure: null,
    flight_altitude: null,
    flight_bearing: null,
    flight_lat: null,
    flight_lng: null,
    flight_number: null,
    flight_position_updated_at: null,
    flight_speed: null,
    flight_status: null,
    gate: null,
    id: segment.id,
    image_url: null,
    image_urls: [],
    last_status_checked_at: null,
    lat: readNumber(segment.lat),
    lng: readNumber(segment.lng),
    location: readString(segment.location),
    notes: readString(segment.notes),
    position: readNumber(segment.position),
    provider: readString(segment.provider),
    scheduled_departure: null,
    segment_type: kind,
    terminal: null,
    time: dateTime?.slice(11, 16),
    title: readString(segment.title) || "Trip segment",
    type: kind
  };
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
