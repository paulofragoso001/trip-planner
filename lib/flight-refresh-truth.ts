import { fetchCiriumFlightStatus, type NormalizedFlightStatus } from "@/lib/cirium";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  FlightRefreshJobData,
  FlightRefreshResult
} from "@/types/flight-refresh";

type FlightTripSegment = {
  id: string;
  trip_id: string;
  user_id: string;
  title: string | null;
  flight_number: string | null;
  airline: string | null;
  start_time: string | null;
  scheduled_departure: string | null;
  estimated_departure: string | null;
  departure_airport: string | null;
  arrival_airport: string | null;
  gate: string | null;
  terminal: string | null;
  flight_status: string | null;
  flight_lat: number | null;
  flight_lng: number | null;
  flight_altitude: number | null;
  flight_bearing: number | null;
  flight_speed: number | null;
  flight_position_updated_at: string | null;
  departure_airport_lat: number | null;
  departure_airport_lng: number | null;
  arrival_airport_lat: number | null;
  arrival_airport_lng: number | null;
};

const itinerarySelect =
  "id,trip_id,user_id,title,flight_number,airline,start_time,scheduled_departure,estimated_departure,departure_airport,arrival_airport,gate,terminal,flight_status,flight_lat,flight_lng,flight_altitude,flight_bearing,flight_speed,flight_position_updated_at,departure_airport_lat,departure_airport_lng,arrival_airport_lat,arrival_airport_lng";

export async function refreshSingleFlightTruth(
  data: FlightRefreshJobData
): Promise<FlightRefreshResult> {
  const supabase = createAdminClient();

  if (!supabase) {
    throw new Error("Supabase service-role credentials are not configured.");
  }

  const { data: item, error: itemError } = await supabase
    .from("trip_segments")
    .select(itinerarySelect)
    .eq("id", data.itemId)
    .eq("trip_id", data.tripId)
    .eq("user_id", data.userId)
    .maybeSingle();

  if (itemError) {
    throw new Error(itemError.message);
  }

  if (!item) {
    throw new Error("Flight trip segment not found.");
  }

  const truth = await fetchCiriumFlightStatus({
    carrier: data.carrier,
    flightNumber: data.flightNumber,
    year: String(data.year),
    month: String(data.month),
    day: String(data.day)
  });
  const flight = truth.flight;

  if (!flight) {
    const checkedAt = new Date().toISOString();
    await supabase
      .from("trip_segments")
      .update({ last_status_checked_at: checkedAt })
      .eq("id", data.itemId)
      .eq("trip_id", data.tripId)
      .eq("user_id", data.userId);

    return {
      refreshed: true,
      cached: false,
      flightId: null,
      updatedAt: checkedAt
    };
  }

  const currentItem = item as FlightTripSegment;
  const updates = buildFlightUpdates(flight, currentItem);
  const events = buildFlightEvents(currentItem, flight);
  const { error: updateError } = await supabase
    .from("trip_segments")
    .update(updates)
    .eq("id", data.itemId)
    .eq("trip_id", data.tripId)
    .eq("user_id", data.userId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  if (events.length > 0) {
    const { error: eventError } = await supabase
      .from("flight_truth_events")
      .insert(events);

    if (eventError && !eventError.message.includes("flight_truth_events")) {
      throw new Error(eventError.message);
    }
  }

  return {
    refreshed: true,
    cached: false,
    flightId: flight.id || null,
    updatedAt: updates.last_status_checked_at
  };
}

function buildFlightUpdates(flight: NormalizedFlightStatus, item: FlightTripSegment) {
  const scheduledDeparture = normalizeDate(flight.scheduledDeparture || item.scheduled_departure);
  const estimatedDeparture = normalizeDate(flight.estimatedDeparture || item.estimated_departure);
  const startTime = estimatedDeparture || scheduledDeparture || item.start_time || null;
  const currentPosition = flight.currentPosition;
  const departurePosition = flight.departurePosition;
  const arrivalPosition = flight.arrivalPosition;

  return {
    flight_number: flight.flightNumber || item.flight_number,
    airline: flight.airline || item.airline,
    departure_airport: flight.departureAirport || item.departure_airport,
    arrival_airport: flight.arrivalAirport || item.arrival_airport,
    scheduled_departure: scheduledDeparture,
    estimated_departure: estimatedDeparture,
    start_time: startTime,
    gate: flight.departureGate || item.gate,
    terminal: flight.departureTerminal || item.terminal,
    flight_status: normalizeStatus(flight.status),
    flight_lat: currentPosition?.lat ?? item.flight_lat,
    flight_lng: currentPosition?.lng ?? item.flight_lng,
    flight_altitude: currentPosition?.altitude ?? item.flight_altitude,
    flight_bearing: currentPosition?.bearing ?? item.flight_bearing,
    flight_speed: currentPosition?.speed ?? item.flight_speed,
    flight_position_updated_at:
      currentPosition
        ? normalizeDate(currentPosition.timestamp) || flight.lastUpdated || new Date().toISOString()
        : item.flight_position_updated_at,
    departure_airport_lat: departurePosition?.lat ?? item.departure_airport_lat,
    departure_airport_lng: departurePosition?.lng ?? item.departure_airport_lng,
    arrival_airport_lat: arrivalPosition?.lat ?? item.arrival_airport_lat,
    arrival_airport_lng: arrivalPosition?.lng ?? item.arrival_airport_lng,
    last_status_checked_at: flight.lastUpdated || new Date().toISOString()
  };
}

function buildFlightEvents(item: FlightTripSegment, flight: NormalizedFlightStatus) {
  const title = item.title || flight.flightNumber || "Flight";
  const flightLabel = flight.flightNumber || item.flight_number || title;
  const base = {
    trip_id: item.trip_id,
    trip_segment_id: item.id,
    user_id: item.user_id,
    provider: "cirium",
    source_payload: {
      flightId: flight.id,
      lastUpdated: flight.lastUpdated,
      currentPosition: flight.currentPosition
    }
  };
  const events: Array<Record<string, unknown>> = [];

  addEvent(events, {
    ...base,
    event_type: mapStatusEventType(flight.status),
    message: buildStatusMessage(title, flight.status),
    previous_value: normalizeStatus(item.flight_status),
    next_value: normalizeStatus(flight.status)
  });
  addEvent(events, {
    ...base,
    event_type: "schedule_change",
    message: `${flightLabel} departure changed to ${flight.estimatedDeparture}.`,
    previous_value: normalizeDate(item.estimated_departure),
    next_value: normalizeDate(flight.estimatedDeparture)
  });
  addEvent(events, {
    ...base,
    event_type: "gate_change",
    message: `${flightLabel} now departs from gate ${flight.departureGate}.`,
    previous_value: item.gate,
    next_value: flight.departureGate
  });
  addEvent(events, {
    ...base,
    event_type: "terminal_change",
    message: `${flightLabel} now departs from terminal ${flight.departureTerminal}.`,
    previous_value: item.terminal,
    next_value: flight.departureTerminal
  });

  return events;
}

function addEvent(
  events: Array<Record<string, unknown>>,
  event: Record<string, unknown> & {
    previous_value?: string | null;
    next_value?: string | null;
  }
) {
  if (
    event.next_value &&
    normalizeComparable(event.previous_value) !== normalizeComparable(event.next_value)
  ) {
    events.push(event);
  }
}

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeDate(value: string | null | undefined) {
  const date = parseDate(value);
  return date ? date.toISOString() : null;
}

function normalizeStatus(value: string | null | undefined) {
  return value?.trim().toLowerCase().replace(/\s+/g, "_") || "scheduled";
}

function normalizeComparable(value: string | null | undefined) {
  return value?.trim().toLowerCase() || "";
}

function mapStatusEventType(status: string) {
  if (status === "cancelled") return "cancellation";
  if (status === "delayed") return "delay";
  return "status_change";
}

function buildStatusMessage(title: string, status: string) {
  if (status === "cancelled") return `${title} was cancelled.`;
  if (status === "delayed") return `${title} is delayed.`;
  return `${title} status changed to ${status}.`;
}
