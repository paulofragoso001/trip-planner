const segmentTypes = [
  "flight",
  "hotel",
  "car",
  "restaurant",
  "activity",
  "transport",
  "meeting",
  "note"
] as const;

export type ItinerarySegmentType = (typeof segmentTypes)[number];

export type ItineraryQuery = {
  tripId: string;
};

export type CreateItineraryItemInput = {
  airline: string | null;
  arrival_airport: string | null;
  arrival_airport_lat: number | null;
  arrival_airport_lng: number | null;
  bookingUrl: string | null;
  confirmationCode: string | null;
  dateTime: string;
  departure_airport: string | null;
  departure_airport_lat: number | null;
  departure_airport_lng: number | null;
  endTime: string | null;
  estimated_departure: string | null;
  flight_altitude: number | null;
  flight_bearing: number | null;
  flight_lat: number | null;
  flight_lng: number | null;
  flight_number: string | null;
  flight_position_updated_at: string | null;
  flight_speed: number | null;
  flight_status: string | null;
  gate: string | null;
  image_url: string | null;
  image_urls: string[];
  isQuickSegmentPayload: boolean;
  lat: number | null;
  lng: number | null;
  location: string | null;
  notes: string | null;
  provider: string | null;
  scheduled_departure: string | null;
  segmentType: ItinerarySegmentType;
  terminal: string | null;
  title: string;
  tripId: string;
};

type ValidationResult<TValue> =
  | { ok: true; value: TValue }
  | { details: Record<string, string>; ok: false };

export function validateItineraryQuery(
  searchParams: URLSearchParams
): ValidationResult<ItineraryQuery> {
  const tripId = readString(searchParams.get("tripId"), 120);

  return tripId
    ? { ok: true, value: { tripId } }
    : { details: { tripId: "tripId is required." }, ok: false };
}

export function validateCreateItineraryItem(
  value: unknown,
  searchParams: URLSearchParams
): ValidationResult<CreateItineraryItemInput> {
  if (!isRecord(value)) {
    return { details: { body: "Expected a JSON object." }, ok: false };
  }

  const details: Record<string, string> = {};
  const tripId = readString(value.tripId, 120) || readString(searchParams.get("tripId"), 120);
  const title = readString(value.title, 200);
  const isQuickSegmentPayload = Boolean(value.template || value.startTime || value.endTime);
  const dateTime = readString(value.date_time, 120) || readString(value.startTime, 120);
  const endTime = readNullableString(value.endTime, 120);

  if (!tripId) details.tripId = "tripId is required.";
  if (!title) details.title = "title is required.";
  if (!dateTime) details.dateTime = "start time is required.";
  if (isQuickSegmentPayload && !endTime) details.endTime = "end time is required.";

  const segmentType = normalizeSegmentType(value.segment_type || value.template);
  const lat = readNullableNumber(value.lat, "lat", details);
  const lng = readNullableNumber(value.lng, "lng", details);

  if (Object.keys(details).length || !tripId || !title || !dateTime) {
    return { details, ok: false };
  }

  return {
    ok: true,
    value: {
      airline: readNullableString(value.airline, 120),
      arrival_airport: readNullableString(value.arrival_airport, 20),
      arrival_airport_lat: readNullableNumber(value.arrival_airport_lat, "arrival_airport_lat", details),
      arrival_airport_lng: readNullableNumber(value.arrival_airport_lng, "arrival_airport_lng", details),
      bookingUrl:
        readNullableString(value.booking_url, 1000) ||
        readNullableString(value.bookingUrl, 1000) ||
        readNullableString(value.virtualUrl, 1000),
      confirmationCode:
        readNullableString(value.confirmation_code, 120) ||
        readNullableString(value.confirmationCode, 120),
      dateTime,
      departure_airport: readNullableString(value.departure_airport, 20),
      departure_airport_lat: readNullableNumber(value.departure_airport_lat, "departure_airport_lat", details),
      departure_airport_lng: readNullableNumber(value.departure_airport_lng, "departure_airport_lng", details),
      endTime,
      estimated_departure: readNullableString(value.estimated_departure, 120),
      flight_altitude: readNullableNumber(value.flight_altitude, "flight_altitude", details),
      flight_bearing: readNullableNumber(value.flight_bearing, "flight_bearing", details),
      flight_lat: readNullableNumber(value.flight_lat, "flight_lat", details),
      flight_lng: readNullableNumber(value.flight_lng, "flight_lng", details),
      flight_number: readNullableString(value.flight_number, 40),
      flight_position_updated_at: readNullableString(value.flight_position_updated_at, 120),
      flight_speed: readNullableNumber(value.flight_speed, "flight_speed", details),
      flight_status: readNullableString(value.flight_status, 80),
      gate: readNullableString(value.gate, 40),
      image_url: readNullableString(value.image_url, 1000),
      image_urls: Array.isArray(value.image_urls)
        ? value.image_urls.filter((url): url is string => typeof url === "string").slice(0, 20)
        : [],
      isQuickSegmentPayload,
      lat,
      lng,
      location: readNullableString(value.location, 500),
      notes: readNullableString(value.notes, 5000),
      provider:
        readNullableString(value.provider, 200) ||
        readNullableString(value.organizer, 200),
      scheduled_departure: readNullableString(value.scheduled_departure, 120),
      segmentType,
      terminal: readNullableString(value.terminal, 40),
      title,
      tripId
    }
  };
}

function normalizeSegmentType(value: unknown): ItinerarySegmentType {
  const cleanValue = typeof value === "string" ? value.trim().toLowerCase() : "";
  return segmentTypes.includes(cleanValue as ItinerarySegmentType)
    ? (cleanValue as ItinerarySegmentType)
    : "activity";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= maxLength ? trimmed : null;
}

function readNullableString(value: unknown, maxLength: number) {
  if (value == null) return null;
  return readString(value, maxLength);
}

function readNullableNumber(
  value: unknown,
  field: string,
  details: Record<string, string>
) {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  details[field] = "Expected a finite number.";
  return null;
}
