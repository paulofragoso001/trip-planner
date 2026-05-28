import "server-only";

import { ApiError } from "@/lib/api/errors";
import { fetchCiriumFlightStatus } from "@/lib/cirium";
import type { RefreshFlightStatusInput } from "@/lib/validators/flight-status";

export type FlightStatusClient = {
  from: (table: "trip_segments") => any;
};

const segmentFlightSelect =
  "id,trip_id,user_id,title,location,lat,lng,position,start_time,end_time,notes,kind,provider,confirmation_code,booking_url,flight_number,airline,departure_airport,arrival_airport,scheduled_departure,estimated_departure,gate,terminal,flight_status,last_status_checked_at,flight_lat,flight_lng,flight_altitude,flight_bearing,flight_speed,flight_position_updated_at,departure_airport_lat,departure_airport_lng,arrival_airport_lat,arrival_airport_lng";
const flightStatusColumns = [
  "flight_status",
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
];

export async function refreshItineraryFlightStatus(
  supabase: FlightStatusClient,
  userId: string,
  input: RefreshFlightStatusInput
) {
  const ciriumStatus = await maybeFetchCiriumStatus(input);
  const flightTruth = ciriumStatus?.flight;
  const estimatedDeparture = normalizeDate(
    flightTruth?.estimatedDeparture || input.estimatedDeparture
  );
  const scheduledDeparture = normalizeDate(
    flightTruth?.scheduledDeparture || input.scheduledDeparture
  );
  const updates: Record<string, string | number | null> = {
    airline: flightTruth?.airline || input.airline,
    arrival_airport: flightTruth?.arrivalAirport || input.arrivalAirport,
    departure_airport: flightTruth?.departureAirport || input.departureAirport,
    estimated_departure: estimatedDeparture,
    flight_number: flightTruth?.flightNumber || input.flightNumber,
    flight_status: flightTruth?.status || input.status,
    gate: flightTruth?.departureGate || input.gate,
    last_status_checked_at: flightTruth?.lastUpdated || new Date().toISOString(),
    scheduled_departure: scheduledDeparture,
    terminal: flightTruth?.departureTerminal || input.terminal
  };
  const currentPosition = flightTruth?.currentPosition ?? null;
  const departurePosition = flightTruth?.departurePosition ?? null;
  const arrivalPosition = flightTruth?.arrivalPosition ?? null;

  if (currentPosition) {
    updates.flight_altitude = currentPosition.altitude;
    updates.flight_bearing = currentPosition.bearing;
    updates.flight_lat = currentPosition.lat;
    updates.flight_lng = currentPosition.lng;
    updates.flight_position_updated_at =
      normalizeDate(currentPosition.timestamp) ||
      flightTruth?.lastUpdated ||
      new Date().toISOString();
    updates.flight_speed = currentPosition.speed;
  }

  if (departurePosition) {
    updates.departure_airport_lat = departurePosition.lat;
    updates.departure_airport_lng = departurePosition.lng;
  }

  if (arrivalPosition) {
    updates.arrival_airport_lat = arrivalPosition.lat;
    updates.arrival_airport_lng = arrivalPosition.lng;
  }

  if (estimatedDeparture || scheduledDeparture) {
    updates.start_time = estimatedDeparture || scheduledDeparture;
  }

  const { data, error } = await supabase
    .from("trip_segments")
    .update(updates)
    .eq("id", input.itemId)
    .eq("trip_id", input.tripId)
    .eq("user_id", userId)
    .select(segmentFlightSelect)
    .single();

  if (error) {
    if (flightStatusColumns.some((column) => error.message.includes(column))) {
      throw new ApiError(
        "not_implemented",
        "Run the itinerary flight status migrations before refreshing flight status.",
        501
      );
    }

    throw new ApiError("internal_error", "Could not refresh flight status.", 500, {
      supabaseMessage: error.message
    });
  }

  return {
    alert: buildFlightAlert(data as Record<string, unknown>),
    item: data,
    provider: ciriumStatus ? "cirium" : "manual"
  };
}

async function refreshTripSegmentFlightStatus(
  supabase: FlightStatusClient,
  userId: string,
  input: RefreshFlightStatusInput,
  status: {
    estimatedDeparture: string | null;
    flightStatus: string;
    scheduledDeparture: string | null;
  }
) {
  const checkedAt = new Date().toISOString();
  const notes = [
    `Flight status: ${status.flightStatus}`,
    status.scheduledDeparture ? `Scheduled departure: ${status.scheduledDeparture}` : null,
    status.estimatedDeparture ? `Estimated departure: ${status.estimatedDeparture}` : null,
    `Last checked: ${checkedAt}`
  ]
    .filter(Boolean)
    .join("\n");

  const { data, error } = await supabase
    .from("trip_segments")
    .update({
      notes,
      provider: "flight-status"
    })
    .eq("id", input.itemId)
    .eq("trip_id", input.tripId)
    .eq("user_id", userId)
    .select("id,title,location,kind,start_time,end_time,notes,provider")
    .single();

  if (error) {
    throw new ApiError("internal_error", "Could not refresh flight status.", 500, {
      supabaseMessage: error.message
    });
  }

  return {
    alert: `${String(data?.title || "Flight")} flight status updated.`,
    item: data,
    provider: "manual"
  };
}

async function maybeFetchCiriumStatus(input: RefreshFlightStatusInput) {
  const carrier = parseCarrier(input.flightNumber) || parseCarrier(input.airline);
  const flightNumber = parseFlightNumber(input.flightNumber);
  const departureDate = parseDepartureDate(input.scheduledDeparture || input.estimatedDeparture);

  if (
    !process.env.CIRIUM_APP_ID ||
    !process.env.CIRIUM_APP_KEY ||
    !carrier ||
    !flightNumber ||
    !departureDate
  ) {
    return null;
  }

  try {
    return await fetchCiriumFlightStatus({
      carrier,
      day: String(departureDate.getDate()),
      flightNumber,
      month: String(departureDate.getMonth() + 1),
      year: String(departureDate.getFullYear())
    });
  } catch {
    return null;
  }
}

function parseCarrier(value: string | null | undefined) {
  const cleanValue = value?.trim().toUpperCase() || "";
  return cleanValue.match(/^[A-Z0-9]{2,3}/)?.[0] ?? null;
}

function parseFlightNumber(value: string | null | undefined) {
  const cleanValue = value?.trim().toUpperCase() || "";
  return cleanValue.match(/\d{1,5}/)?.[0] ?? null;
}

function parseDepartureDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function buildFlightAlert(item: Record<string, unknown>) {
  const title = typeof item.title === "string" ? item.title : "Flight";
  const status = typeof item.flight_status === "string" ? item.flight_status : "scheduled";
  const gate = typeof item.gate === "string" ? item.gate : "";
  const terminal = typeof item.terminal === "string" ? item.terminal : "";

  if (status === "cancelled") {
    return `${title} was cancelled.`;
  }

  if (status === "delayed") {
    return `${title} is delayed${gate ? `; gate ${gate}` : ""}${terminal ? `, terminal ${terminal}` : ""}.`;
  }

  if (gate || terminal) {
    return `${title} airport details updated${gate ? `: gate ${gate}` : ""}${terminal ? `, terminal ${terminal}` : ""}.`;
  }

  return `${title} flight status updated.`;
}
