import { NextResponse } from "next/server";
import { fetchCiriumFlightStatus, type NormalizedFlightStatus } from "@/lib/cirium";
import { createAdminClient } from "@/lib/supabase/admin";

type FlightItineraryItem = {
  id: string;
  trip_id: string;
  user_id: string;
  title: string | null;
  kind: string | null;
  flight_number: string | null;
  airline: string | null;
  confirmation_code: string | null;
  start_time: string | null;
  scheduled_departure: string | null;
  estimated_departure: string | null;
  departure_airport: string | null;
  arrival_airport: string | null;
  gate: string | null;
  terminal: string | null;
  flight_status: string | null;
  last_status_checked_at: string | null;
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

type FlightTruthEvent = {
  trip_id: string;
  trip_segment_id: string;
  user_id: string;
  event_type: string;
  message: string;
  previous_value: string | null;
  next_value: string | null;
  provider: "cirium";
  source_payload: Record<string, unknown>;
};

const itinerarySelect =
  "id,trip_id,user_id,title,kind,flight_number,airline,confirmation_code,start_time,scheduled_departure,estimated_departure,departure_airport,arrival_airport,gate,terminal,flight_status,last_status_checked_at,flight_lat,flight_lng,flight_altitude,flight_bearing,flight_speed,flight_position_updated_at,departure_airport_lat,departure_airport_lng,arrival_airport_lat,arrival_airport_lng";
const workerWindowPastHours = 6;
const workerWindowFutureHours = 48;
const staleCheckMinutes = 15;
const defaultBatchSize = 40;

export async function GET(request: Request) {
  return refreshFlightStatuses(request);
}

export async function POST(request: Request) {
  return refreshFlightStatuses(request);
}

async function refreshFlightStatuses(request: Request) {
  const authError = validateJobSecret(request);

  if (authError) {
    return authError;
  }

  if (!process.env.CIRIUM_APP_ID || !process.env.CIRIUM_APP_KEY) {
    return NextResponse.json(
      { error: "Cirium credentials are not configured." },
      { status: 503 }
    );
  }

  const supabase = createAdminClient();

  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase service-role credentials are not configured." },
      { status: 503 }
    );
  }

  const url = new URL(request.url);
  const batchSize = parseBatchSize(url.searchParams.get("limit"));
  const now = new Date();
  const { data, error } = await supabase
    .from("trip_segments")
    .select(itinerarySelect)
    .or("kind.eq.flight,kind.eq.air,flight_number.not.is.null,confirmation_code.not.is.null")
    .order("start_time", { ascending: true, nullsFirst: false })
    .limit(batchSize * 3);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const candidates = ((data || []) as FlightItineraryItem[])
    .filter((item) => shouldRefreshFlight(item, now))
    .slice(0, batchSize);
  const results = await Promise.all(
    candidates.map((item) => refreshFlightItem(supabase, item, now))
  );
  const refreshed = results.filter((result) => result.ok).length;
  const failed = results.filter((result) => !result.ok).length;

  return NextResponse.json({
    ok: true,
    scanned: data?.length || 0,
    eligible: candidates.length,
    refreshed,
    failed,
    results
  });
}

function validateJobSecret(request: Request) {
  const configuredSecret = process.env.FLIGHT_REFRESH_CRON_SECRET || process.env.CRON_SECRET;

  if (!configuredSecret) {
    return NextResponse.json(
      { error: "Flight refresh cron secret is not configured." },
      { status: 503 }
    );
  }

  const authHeader = request.headers.get("authorization") || "";
  const bearerToken = authHeader.match(/^Bearer\s+(.+)$/i)?.[1];
  const headerToken = request.headers.get("x-cron-secret");

  if (bearerToken !== configuredSecret && headerToken !== configuredSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}

async function refreshFlightItem(
  supabase: ReturnType<typeof createAdminClient>,
  item: FlightItineraryItem,
  now: Date
) {
  if (!supabase) {
    return { ok: false, itemId: item.id, error: "Supabase admin client unavailable." };
  }

  const lookup = resolveFlightLookup(item);

  if (!lookup) {
    return {
      ok: false,
      itemId: item.id,
      error: "Missing carrier, flight number, or departure date."
    };
  }

  try {
    const truth = await fetchCiriumFlightStatus(lookup);
    const flight = truth.flight;

    if (!flight) {
      await supabase
        .from("trip_segments")
        .update({ last_status_checked_at: now.toISOString() })
        .eq("id", item.id);

      return { ok: true, itemId: item.id, changed: false, eventCount: 0 };
    }

    const updates = buildFlightUpdates(flight, item, now);
    const events = buildFlightEvents(item, flight);
    const { error: updateError } = await supabase
      .from("trip_segments")
      .update(updates)
      .eq("id", item.id)
      .eq("trip_id", item.trip_id)
      .eq("user_id", item.user_id);

    if (updateError) {
      return { ok: false, itemId: item.id, error: updateError.message };
    }

    if (events.length > 0) {
      await insertFlightEvents(supabase, events);
    }

    return {
      ok: true,
      itemId: item.id,
      changed: events.length > 0,
      eventCount: events.length
    };
  } catch (error) {
    return {
      ok: false,
      itemId: item.id,
      error: error instanceof Error ? error.message : "Could not refresh flight."
    };
  }
}

function shouldRefreshFlight(item: FlightItineraryItem, now: Date) {
  const status = normalizeStatus(item.flight_status);
  const flightDate = parseDate(
    item.scheduled_departure || item.estimated_departure || item.start_time
  );
  const lastCheckedAt = parseDate(item.last_status_checked_at);
  const unresolved = status !== "arrived" && status !== "cancelled";

  if (!unresolved || !flightDate) {
    return false;
  }

  const windowStart = new Date(now.getTime() - workerWindowPastHours * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + workerWindowFutureHours * 60 * 60 * 1000);
  const staleThreshold = new Date(now.getTime() - staleCheckMinutes * 60 * 1000);

  return (
    flightDate >= windowStart &&
    flightDate <= windowEnd &&
    (!lastCheckedAt || lastCheckedAt <= staleThreshold)
  );
}

function resolveFlightLookup(item: FlightItineraryItem) {
  const flightText = item.flight_number || item.confirmation_code || "";
  const carrier = parseCarrier(flightText) || parseCarrier(item.airline);
  const flightNumber = parseFlightNumber(flightText);
  const departureDate = parseDate(
    item.scheduled_departure || item.estimated_departure || item.start_time
  );

  if (!carrier || !flightNumber || !departureDate) {
    return null;
  }

  return {
    carrier,
    flightNumber,
    year: String(departureDate.getFullYear()),
    month: String(departureDate.getMonth() + 1),
    day: String(departureDate.getDate())
  };
}

function buildFlightUpdates(
  flight: NormalizedFlightStatus,
  item: FlightItineraryItem,
  now: Date
) {
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
        ? normalizeDate(currentPosition.timestamp) || flight.lastUpdated || now.toISOString()
        : item.flight_position_updated_at,
    departure_airport_lat: departurePosition?.lat ?? item.departure_airport_lat,
    departure_airport_lng: departurePosition?.lng ?? item.departure_airport_lng,
    arrival_airport_lat: arrivalPosition?.lat ?? item.arrival_airport_lat,
    arrival_airport_lng: arrivalPosition?.lng ?? item.arrival_airport_lng,
    last_status_checked_at: flight.lastUpdated || now.toISOString()
  };
}

function buildFlightEvents(
  item: FlightItineraryItem,
  flight: NormalizedFlightStatus
): FlightTruthEvent[] {
  const title = item.title || flight.flightNumber || "Flight";
  const flightLabel = flight.flightNumber || item.flight_number || title;
  const eventBase = {
    trip_id: item.trip_id,
    trip_segment_id: item.id,
    user_id: item.user_id,
    provider: "cirium" as const,
    source_payload: {
      flightId: flight.id,
      lastUpdated: flight.lastUpdated,
      currentPosition: flight.currentPosition
    }
  };
  const events: FlightTruthEvent[] = [];

  addEvent(events, {
    ...eventBase,
    event_type: mapStatusEventType(flight.status),
    message: buildStatusMessage(title, flight.status),
    previous_value: normalizeStatus(item.flight_status),
    next_value: normalizeStatus(flight.status)
  });
  addEvent(events, {
    ...eventBase,
    event_type: "schedule_change",
    message: `${flightLabel} departure changed to ${flight.estimatedDeparture}.`,
    previous_value: normalizeDate(item.estimated_departure),
    next_value: normalizeDate(flight.estimatedDeparture)
  });
  addEvent(events, {
    ...eventBase,
    event_type: "gate_change",
    message: `${flightLabel} now departs from gate ${flight.departureGate}.`,
    previous_value: item.gate,
    next_value: flight.departureGate
  });
  addEvent(events, {
    ...eventBase,
    event_type: "terminal_change",
    message: `${flightLabel} now departs from terminal ${flight.departureTerminal}.`,
    previous_value: item.terminal,
    next_value: flight.departureTerminal
  });

  return events;
}

function addEvent(
  events: FlightTruthEvent[],
  event: FlightTruthEvent
) {
  if (
    event.next_value &&
    normalizeComparable(event.previous_value) !== normalizeComparable(event.next_value)
  ) {
    events.push(event);
  }
}

async function insertFlightEvents(
  supabase: NonNullable<ReturnType<typeof createAdminClient>>,
  events: FlightTruthEvent[]
) {
  const { error } = await supabase.from("flight_truth_events").insert(events);

  if (error && !error.message.includes("flight_truth_events")) {
    throw new Error(error.message);
  }
}

function parseBatchSize(value: string | null) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return defaultBatchSize;
  }

  return Math.min(parsed, 100);
}

function parseCarrier(value: string | null | undefined) {
  const cleanValue = value?.trim().toUpperCase() || "";
  return cleanValue.match(/^[A-Z0-9]{2,3}/)?.[0] ?? null;
}

function parseFlightNumber(value: string | null | undefined) {
  const cleanValue = value?.trim().toUpperCase() || "";
  return cleanValue.match(/\d{1,5}/)?.[0] ?? null;
}

function parseDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

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

function normalizeComparable(value: string | null | undefined) {
  return value?.trim().toLowerCase() || "";
}
