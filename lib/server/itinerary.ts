import "server-only";

import { ApiError } from "@/lib/api/errors";
import type { CreateItineraryItemInput } from "@/lib/validators/itinerary";

export type ItineraryClient = {
  from: (table: "itinerary_items" | "trip_segments") => any;
};

const baseItinerarySelect =
  "id,title,location,lat,lng,position,date_time,notes,image_url,image_urls,segment_type,provider,confirmation_code,booking_url";
const itinerarySelect =
  "id,title,location,lat,lng,position,date_time,notes,image_url,image_urls,segment_type,provider,confirmation_code,booking_url,flight_number,airline,departure_airport,arrival_airport,scheduled_departure,estimated_departure,gate,terminal,flight_status,last_status_checked_at,flight_lat,flight_lng,flight_altitude,flight_bearing,flight_speed,flight_position_updated_at,departure_airport_lat,departure_airport_lng,arrival_airport_lat,arrival_airport_lng";
const missingItineraryItemsTableMessage =
  "Could not find the table 'public.itinerary_items'";
const segmentSelect = "id,title,location,kind,start_time,end_time,inserted_at";

export async function listItineraryItems(
  supabase: ItineraryClient,
  userId: string,
  tripId: string
) {
  const { data, error } = await supabase
    .from("itinerary_items")
    .select(itinerarySelect)
    .eq("trip_id", tripId)
    .eq("user_id", userId)
    .order("date_time", { ascending: true, nullsFirst: false })
    .order("position", { ascending: true, nullsFirst: false });

  if (error && !error.message.includes(missingItineraryItemsTableMessage)) {
    if (isMissingFlightStatusColumnError(error.message)) {
      return listBaseItineraryItems(supabase, userId, tripId);
    }

    throw new ApiError("internal_error", "Could not load itinerary.", 500, {
      supabaseMessage: error.message
    });
  }

  if (!error) {
    return data || [];
  }

  return listFallbackTripSegments(supabase, userId, tripId);
}

export async function createItineraryItem(
  supabase: ItineraryClient,
  userId: string,
  input: CreateItineraryItemInput
) {
  const { data: latestItem, error: latestItemError } = await supabase
    .from("itinerary_items")
    .select("position")
    .eq("trip_id", input.tripId)
    .eq("user_id", userId)
    .order("position", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (latestItemError?.message.includes(missingItineraryItemsTableMessage)) {
    return createFallbackTripSegment(supabase, userId, input);
  }

  if (latestItemError) {
    throw new ApiError("internal_error", "Could not create itinerary item.", 500, {
      supabaseMessage: latestItemError.message
    });
  }

  const nextPosition =
    typeof latestItem?.position === "number" ? latestItem.position + 1 : 0;
  const itemPayload = {
    airline: input.airline,
    arrival_airport: input.arrival_airport,
    arrival_airport_lat: input.arrival_airport_lat,
    arrival_airport_lng: input.arrival_airport_lng,
    booking_url: input.bookingUrl,
    confirmation_code: input.confirmationCode,
    date_time: input.dateTime,
    departure_airport: input.departure_airport,
    departure_airport_lat: input.departure_airport_lat,
    departure_airport_lng: input.departure_airport_lng,
    estimated_departure: input.estimated_departure,
    flight_altitude: input.flight_altitude,
    flight_bearing: input.flight_bearing,
    flight_lat: input.flight_lat,
    flight_lng: input.flight_lng,
    flight_number: input.flight_number,
    flight_position_updated_at: input.flight_position_updated_at,
    flight_speed: input.flight_speed,
    flight_status: input.flight_status,
    gate: input.gate,
    image_url: input.image_url,
    image_urls: input.image_urls,
    lat: input.lat,
    lng: input.lng,
    location: input.location,
    notes: input.notes,
    position: nextPosition,
    provider: input.provider,
    scheduled_departure: input.scheduled_departure,
    segment_type: input.segmentType,
    terminal: input.terminal,
    title: input.title,
    trip_id: input.tripId,
    user_id: userId
  };

  const { data, error } = await supabase
    .from("itinerary_items")
    .insert(itemPayload)
    .select(itinerarySelect)
    .single();

  if (error) {
    if (isMissingFlightStatusColumnError(error.message)) {
      const { data: baseData, error: baseError } = await supabase
        .from("itinerary_items")
        .insert(stripFlightStatusFields(itemPayload))
        .select(baseItinerarySelect)
        .single();

      if (!baseError) {
        return withEmptyFlightStatus(baseData);
      }
    }

    return createFallbackTripSegment(supabase, userId, input);
  }

  return data;
}

async function listBaseItineraryItems(
  supabase: ItineraryClient,
  userId: string,
  tripId: string
) {
  const { data, error } = await supabase
    .from("itinerary_items")
    .select(baseItinerarySelect)
    .eq("trip_id", tripId)
    .eq("user_id", userId)
    .order("date_time", { ascending: true, nullsFirst: false })
    .order("position", { ascending: true, nullsFirst: false });

  if (error) {
    throw new ApiError("internal_error", "Could not load itinerary.", 500, {
      supabaseMessage: error.message
    });
  }

  return (data || []).map(withEmptyFlightStatus);
}

async function listFallbackTripSegments(
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
    .order("inserted_at", { ascending: true });

  if (error) {
    throw new ApiError("internal_error", "Could not load itinerary fallback.", 500, {
      supabaseMessage: error.message
    });
  }

  return (data || []).map(mapSegmentToItineraryItem);
}

async function createFallbackTripSegment(
  supabase: ItineraryClient,
  userId: string,
  input: CreateItineraryItemInput
) {
  const { data, error } = await supabase
    .from("trip_segments")
    .insert({
      end_time: input.endTime,
      kind: input.segmentType,
      location: input.location,
      start_time: input.dateTime,
      title: input.title,
      trip_id: input.tripId,
      user_id: userId
    })
    .select(segmentSelect)
    .single();

  if (error) {
    throw new ApiError("internal_error", "Could not create itinerary fallback.", 500, {
      supabaseMessage: error.message
    });
  }

  return mapSegmentToItineraryItem(data);
}

function mapSegmentToItineraryItem(segment: Record<string, unknown>) {
  const dateTime = readString(segment.start_time);

  return {
    airline: null,
    arrival_airport: null,
    arrival_airport_lat: null,
    arrival_airport_lng: null,
    booking_url: null,
    confirmation_code: null,
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
    lat: null,
    lng: null,
    location: segment.location,
    notes: null,
    position: null,
    provider: null,
    scheduled_departure: null,
    segment_type: readString(segment.kind) || "activity",
    terminal: null,
    time: dateTime?.slice(11, 16),
    title: segment.title,
    type: readString(segment.kind) || "activity"
  };
}

function withEmptyFlightStatus(item: Record<string, unknown>) {
  return {
    ...item,
    airline: null,
    arrival_airport: null,
    arrival_airport_lat: null,
    arrival_airport_lng: null,
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
    last_status_checked_at: null,
    scheduled_departure: null,
    terminal: null
  };
}

function stripFlightStatusFields(item: Record<string, unknown>) {
  const {
    airline,
    arrival_airport,
    arrival_airport_lat,
    arrival_airport_lng,
    departure_airport,
    departure_airport_lat,
    departure_airport_lng,
    estimated_departure,
    flight_altitude,
    flight_bearing,
    flight_lat,
    flight_lng,
    flight_number,
    flight_position_updated_at,
    flight_speed,
    flight_status,
    gate,
    scheduled_departure,
    terminal,
    ...baseItem
  } = item;

  return baseItem;
}

function isMissingFlightStatusColumnError(message: string) {
  return [
    "flight_number",
    "airline",
    "departure_airport",
    "arrival_airport",
    "scheduled_departure",
    "estimated_departure",
    "flight_status",
    "last_status_checked_at",
    "flight_lat",
    "flight_lng",
    "flight_altitude",
    "flight_bearing",
    "flight_speed",
    "flight_position_updated_at",
    "departure_airport_lat",
    "departure_airport_lng",
    "arrival_airport_lat",
    "arrival_airport_lng"
  ].some((column) => message.includes(column));
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
