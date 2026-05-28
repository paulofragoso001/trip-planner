export type ResolvePlaceInput = {
  address: string | null;
  city: string | null;
  country: string | null;
  locationHint: string | null;
  name: string;
};

export type SuggestionsInput = {
  limit: number;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  title: string | null;
  tripId: string | null;
};

type ValidationResult<TValue> =
  | { ok: true; value: TValue }
  | { details: Record<string, string>; ok: false };

export function validateResolvePlaceInput(value: unknown): ValidationResult<ResolvePlaceInput> {
  if (!isRecord(value)) return { details: { body: "Expected a JSON object." }, ok: false };
  const name = readNullableString(value.name, 300);
  if (!name) return { details: { name: "Place name is required." }, ok: false };
  return {
    ok: true,
    value: {
      address: readNullableString(value.address, 500),
      city: readNullableString(value.city, 200),
      country: readNullableString(value.country, 200),
      locationHint: readNullableString(value.locationHint ?? value.location_hint, 500),
      name
    }
  };
}

export function validateSuggestionsInput(value: unknown): ValidationResult<SuggestionsInput> {
  if (!isRecord(value)) return { details: { body: "Expected a JSON object." }, ok: false };
  const latitude = readNumber(value.latitude);
  const longitude = readNumber(value.longitude);
  const details: Record<string, string> = {};

  if (typeof latitude !== "number") details.latitude = "latitude is required.";
  if (typeof longitude !== "number") details.longitude = "longitude is required.";

  if (Object.keys(details).length) return { details, ok: false };

  return {
    ok: true,
    value: {
      latitude: latitude!,
      limit: clampInt(readNumber(value.limit), 1, 10, 5),
      longitude: longitude!,
      radiusMeters: clampInt(readNumber(value.radiusMeters ?? value.radius_meters), 250, 5000, 1600),
      title: readNullableString(value.title, 300),
      tripId: readNullableString(value.tripId ?? value.trip_id, 120)
    }
  };
}

function clampInt(value: number | null, min: number, max: number, fallback: number) {
  if (typeof value !== "number") return fallback;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readNullableString(value: unknown, maxLength: number) {
  if (value == null || value === "") return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= maxLength ? trimmed : null;
}

function readNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
