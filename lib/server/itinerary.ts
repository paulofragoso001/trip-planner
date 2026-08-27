import "server-only";

import { ApiError } from "@/lib/api/errors";
import type { CreateItineraryItemInput } from "@/lib/validators/itinerary";

export type ItineraryClient = {
  from: (table: "trip_segments" | "budget_records" | "trip_segment_attachments") => any;
};

const segmentSelect =
  "id,trip_id,user_id,title,location,kind,start_time,end_time,lat,lng,notes,provider,confirmation_code,booking_url,position,inserted_at,updated_at,airline,arrival_airport,arrival_airport_lat,arrival_airport_lng,departure_airport,departure_airport_lat,departure_airport_lng,estimated_departure,flight_altitude,flight_bearing,flight_lat,flight_lng,flight_number,flight_position_updated_at,flight_speed,flight_status,gate,image_url,image_urls,scheduled_departure,terminal,transport_kind,company,transport_number,departure_location,departure_address,departure_lat,departure_lng,arrival_location,arrival_address,arrival_lat,arrival_lng,reservation_details";

const attachmentSelect =
  "id,segment_id,kind,display_name,storage_bucket,storage_path,external_url,mime_type,byte_size,created_at";

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
      airline: input.airline || (input.transportKind === "flight" ? input.company : null),
      arrival_airport:
        input.arrival_airport || (input.transportKind === "flight" ? input.arrivalLocation : null),
      arrival_airport_lat: input.arrival_airport_lat,
      arrival_airport_lng: input.arrival_airport_lng,
      arrival_address: input.arrivalAddress,
      arrival_lat: input.arrivalLat,
      arrival_lng: input.arrivalLng,
      arrival_location: input.arrivalLocation,
      booking_url: input.bookingUrl,
      company: input.company,
      confirmation_code: input.confirmationCode,
      departure_address: input.departureAddress,
      departure_airport:
        input.departure_airport || (input.transportKind === "flight" ? input.departureLocation : null),
      departure_airport_lat: input.departure_airport_lat,
      departure_airport_lng: input.departure_airport_lng,
      departure_lat: input.departureLat,
      departure_lng: input.departureLng,
      departure_location: input.departureLocation,
      end_time: input.endTime,
      estimated_departure: input.estimated_departure,
      flight_altitude: input.flight_altitude,
      flight_bearing: input.flight_bearing,
      flight_lat: input.flight_lat,
      flight_lng: input.flight_lng,
      flight_number:
        input.flight_number || (input.transportKind === "flight" ? input.transportNumber : null),
      flight_position_updated_at: input.flight_position_updated_at,
      flight_speed: input.flight_speed,
      flight_status: input.flight_status,
      gate: input.gate,
      image_url: input.image_url,
      image_urls: input.image_urls,
      kind: input.segmentType,
      lat: input.lat,
      lng: input.lng,
      location: input.location,
      notes: input.notes,
      position: nextPosition,
      provider: input.provider,
      reservation_details: input.reservationDetails,
      scheduled_departure:
        input.scheduled_departure || (input.transportKind === "flight" ? input.dateTime : null),
      start_time: input.dateTime,
      terminal: input.terminal,
      title: input.title,
      transport_kind: input.transportKind,
      transport_number: input.transportNumber,
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

  try {
    const budgetRecord = input.cost
      ? await createLinkedBudgetRecord(supabase, userId, input, data.id)
      : null;
    const attachments = input.attachments.length
      ? await createAttachmentRecords(supabase, userId, data.id, input.attachments)
      : [];
    return {
      ...mapSegmentToItineraryItem(data),
      budget_record: budgetRecord,
      attachments
    };
  } catch (relatedError) {
    await rollbackCreatedItem(supabase, userId, data.id);
    throw relatedError;
  }
}

async function createLinkedBudgetRecord(
  supabase: ItineraryClient,
  userId: string,
  input: CreateItineraryItemInput,
  segmentId: string
) {
  if (!input.cost) return null;
  const { data, error } = await supabase
    .from("budget_records")
    .insert({
      amount: input.cost.amount,
      category: "transport",
      currency: input.cost.currency,
      label: input.cost.label,
      metadata: { source: "itinerary_transport" },
      record_type: "actual",
      segment_id: segmentId,
      trip_id: input.tripId,
      user_id: userId
    })
    .select("id,segment_id,amount,currency,category,label,record_type")
    .single();

  if (error) {
    throw new ApiError("internal_error", "Could not save transportation cost.", 500, {
      supabaseMessage: error.message
    });
  }
  return data;
}

async function createAttachmentRecords(
  supabase: ItineraryClient,
  userId: string,
  segmentId: string,
  attachments: CreateItineraryItemInput["attachments"]
) {
  const { data, error } = await supabase
    .from("trip_segment_attachments")
    .insert(attachments.map((attachment) => ({
      byte_size: attachment.byteSize,
      display_name: attachment.displayName,
      external_url: attachment.externalUrl,
      kind: attachment.kind,
      mime_type: attachment.mimeType,
      segment_id: segmentId,
      storage_bucket: attachment.storageBucket,
      storage_path: attachment.storagePath,
      user_id: userId
    })))
    .select(attachmentSelect);

  if (error) {
    throw new ApiError("internal_error", "Could not save transportation attachments.", 500, {
      supabaseMessage: error.message
    });
  }
  return data || [];
}

async function rollbackCreatedItem(
  supabase: ItineraryClient,
  userId: string,
  segmentId: string
) {
  await supabase.from("budget_records").delete().eq("segment_id", segmentId).eq("user_id", userId);
  await supabase.from("trip_segments").delete().eq("id", segmentId).eq("user_id", userId);
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
    airline: readString(segment.airline),
    arrival_airport: readString(segment.arrival_airport),
    arrival_airport_lat: readNumber(segment.arrival_airport_lat),
    arrival_airport_lng: readNumber(segment.arrival_airport_lng),
    arrival_address: readString(segment.arrival_address),
    arrival_lat: readNumber(segment.arrival_lat),
    arrival_lng: readNumber(segment.arrival_lng),
    arrival_location: readString(segment.arrival_location),
    booking_url: readString(segment.booking_url),
    confirmation_code: readString(segment.confirmation_code),
    date: dateTime?.slice(0, 10),
    date_time: dateTime,
    company: readString(segment.company),
    departure_airport: readString(segment.departure_airport),
    departure_airport_lat: readNumber(segment.departure_airport_lat),
    departure_airport_lng: readNumber(segment.departure_airport_lng),
    departure_address: readString(segment.departure_address),
    departure_lat: readNumber(segment.departure_lat),
    departure_lng: readNumber(segment.departure_lng),
    departure_location: readString(segment.departure_location),
    estimated_departure: readString(segment.estimated_departure),
    flight_altitude: readNumber(segment.flight_altitude),
    flight_bearing: readNumber(segment.flight_bearing),
    flight_lat: readNumber(segment.flight_lat),
    flight_lng: readNumber(segment.flight_lng),
    flight_number: readString(segment.flight_number),
    flight_position_updated_at: readString(segment.flight_position_updated_at),
    flight_speed: readNumber(segment.flight_speed),
    flight_status: readString(segment.flight_status),
    gate: readString(segment.gate),
    id: segment.id,
    image_url: readString(segment.image_url),
    image_urls: Array.isArray(segment.image_urls) ? segment.image_urls : [],
    last_status_checked_at: null,
    lat: readNumber(segment.lat),
    lng: readNumber(segment.lng),
    location: readString(segment.location),
    notes: readString(segment.notes),
    position: readNumber(segment.position),
    provider: readString(segment.provider),
    reservation_details: readRecord(segment.reservation_details),
    scheduled_departure: readString(segment.scheduled_departure),
    segment_type: kind,
    terminal: readString(segment.terminal),
    time: dateTime?.slice(11, 16),
    title: readString(segment.title) || "Trip segment",
    transport_kind: readString(segment.transport_kind),
    transport_number: readString(segment.transport_number),
    type: kind
  };
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readRecord(value: unknown) {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value : {};
}
