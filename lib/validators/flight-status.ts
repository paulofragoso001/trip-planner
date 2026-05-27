const flightStatuses = [
  "scheduled",
  "on_time",
  "delayed",
  "cancelled",
  "boarding",
  "departed",
  "arrived"
] as const;

export type FlightStatusValue = (typeof flightStatuses)[number];

export type RefreshFlightStatusInput = {
  airline: string | null;
  arrivalAirport: string | null;
  departureAirport: string | null;
  estimatedDeparture: string | null;
  flightNumber: string | null;
  gate: string | null;
  itemId: string;
  scheduledDeparture: string | null;
  status: FlightStatusValue;
  terminal: string | null;
  tripId: string;
};

type ValidationResult<TValue> =
  | { ok: true; value: TValue }
  | { details: Record<string, string>; ok: false };

export function validateRefreshFlightStatus(
  value: unknown
): ValidationResult<RefreshFlightStatusInput> {
  if (!isRecord(value)) {
    return { details: { body: "Expected a JSON object." }, ok: false };
  }

  const details: Record<string, string> = {};
  const tripId = readString(value.tripId, "tripId", details, 120);
  const itemId = readString(value.itemId, "itemId", details, 120);

  if (!tripId) details.tripId = "tripId is required.";
  if (!itemId) details.itemId = "itemId is required.";

  if (Object.keys(details).length || !tripId || !itemId) {
    return { details, ok: false };
  }

  return {
    ok: true,
    value: {
      airline: readNullableString(value.airline, "airline", details, 120),
      arrivalAirport: readNullableString(value.arrivalAirport, "arrivalAirport", details, 20),
      departureAirport: readNullableString(value.departureAirport, "departureAirport", details, 20),
      estimatedDeparture: readNullableString(value.estimatedDeparture, "estimatedDeparture", details, 120),
      flightNumber: readNullableString(value.flightNumber, "flightNumber", details, 40),
      gate: readNullableString(value.gate, "gate", details, 40),
      itemId,
      scheduledDeparture: readNullableString(value.scheduledDeparture, "scheduledDeparture", details, 120),
      status: normalizeFlightStatus(value.status),
      terminal: readNullableString(value.terminal, "terminal", details, 40),
      tripId
    }
  };
}

export function normalizeFlightStatus(value: unknown): FlightStatusValue {
  const normalized =
    typeof value === "string" ? value.trim().toLowerCase().replace(/\s+/g, "_") : "";

  return flightStatuses.includes(normalized as FlightStatusValue)
    ? (normalized as FlightStatusValue)
    : "scheduled";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(
  value: unknown,
  field: string,
  details: Record<string, string>,
  maxLength: number
) {
  if (typeof value !== "string") {
    details[field] = "Expected a string.";
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) return null;
  if (trimmed.length > maxLength) {
    details[field] = `Expected ${maxLength} characters or fewer.`;
    return null;
  }

  return trimmed;
}

function readNullableString(
  value: unknown,
  field: string,
  details: Record<string, string>,
  maxLength: number
) {
  if (value == null) return null;
  return readString(value, field, details, maxLength);
}
