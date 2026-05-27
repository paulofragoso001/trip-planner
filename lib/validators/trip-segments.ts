export type TripSegmentsQuery = {
  tripId: string;
};

export type TripSegmentWriteInput = {
  bookingUrl: string | null;
  confirmationCode: string | null;
  endTime: string | null;
  kind: string;
  lat: number | null;
  lng: number | null;
  location: string | null;
  notes: string | null;
  provider: string | null;
  startTime: string | null;
  title: string;
  tripId: string;
};

type ValidationResult<TValue> =
  | { ok: true; value: TValue }
  | { details: Record<string, string>; ok: false };

export function validateTripSegmentsQuery(
  searchParams: URLSearchParams
): ValidationResult<TripSegmentsQuery> {
  const tripId = searchParams.get("tripId")?.trim();

  if (!tripId) {
    return {
      details: { tripId: "tripId is required." },
      ok: false
    };
  }

  if (tripId.length > 120) {
    return {
      details: { tripId: "Expected 120 characters or fewer." },
      ok: false
    };
  }

  return {
    ok: true,
    value: { tripId }
  };
}

export function validateTripSegmentWrite(
  value: unknown,
  searchParams?: URLSearchParams
): ValidationResult<TripSegmentWriteInput> {
  if (!isRecord(value)) {
    return { details: { body: "Expected a JSON object." }, ok: false };
  }

  const details: Record<string, string> = {};
  const tripId = readString(value.tripId, 120) || readString(searchParams?.get("tripId"), 120);
  const title = readString(value.title, 200);
  const kind = readString(value.kind, 40) || readString(value.segmentType, 40) || "activity";
  const lat = readNullableNumber(value.lat, "lat", details, -90, 90);
  const lng = readNullableNumber(value.lng, "lng", details, -180, 180);

  if (!tripId) details.tripId = "tripId is required.";
  if (!title) details.title = "title is required.";

  if (Object.keys(details).length || !tripId || !title) {
    return { details, ok: false };
  }

  return {
    ok: true,
    value: {
      bookingUrl: readNullableString(value.bookingUrl ?? value.booking_url, 1000),
      confirmationCode: readNullableString(
        value.confirmationCode ?? value.confirmation_code,
        120
      ),
      endTime: readNullableString(value.endTime ?? value.end_time, 120),
      kind,
      lat,
      lng,
      location: readNullableString(value.location, 500),
      notes: readNullableString(value.notes, 5000),
      provider: readNullableString(value.provider, 200),
      startTime: readNullableString(value.startTime ?? value.start_time, 120),
      title,
      tripId
    }
  };
}

export function validateTripSegmentPatch(
  value: unknown
): ValidationResult<Partial<Omit<TripSegmentWriteInput, "tripId">>> {
  if (!isRecord(value)) {
    return { details: { body: "Expected a JSON object." }, ok: false };
  }

  const details: Record<string, string> = {};
  const update: Partial<Omit<TripSegmentWriteInput, "tripId">> = {};

  if ("title" in value) {
    const title = readString(value.title, 200);
    if (!title) details.title = "title is required.";
    else update.title = title;
  }

  if ("kind" in value || "segmentType" in value) {
    update.kind = readString(value.kind ?? value.segmentType, 40) || "activity";
  }

  if ("startTime" in value || "start_time" in value) {
    update.startTime = readNullableString(value.startTime ?? value.start_time, 120);
  }

  if ("endTime" in value || "end_time" in value) {
    update.endTime = readNullableString(value.endTime ?? value.end_time, 120);
  }

  if ("location" in value) update.location = readNullableString(value.location, 500);
  if ("notes" in value) update.notes = readNullableString(value.notes, 5000);
  if ("provider" in value) update.provider = readNullableString(value.provider, 200);
  if ("confirmationCode" in value || "confirmation_code" in value) {
    update.confirmationCode = readNullableString(
      value.confirmationCode ?? value.confirmation_code,
      120
    );
  }
  if ("bookingUrl" in value || "booking_url" in value) {
    update.bookingUrl = readNullableString(value.bookingUrl ?? value.booking_url, 1000);
  }
  if ("lat" in value) update.lat = readNullableNumber(value.lat, "lat", details, -90, 90);
  if ("lng" in value) update.lng = readNullableNumber(value.lng, "lng", details, -180, 180);

  return Object.keys(details).length
    ? { details, ok: false }
    : { ok: true, value: update };
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
  if (value == null || value === "") return null;
  return readString(value, maxLength);
}

function readNullableNumber(
  value: unknown,
  field: string,
  details: Record<string, string>,
  min: number,
  max: number
) {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value) && value >= min && value <= max) {
    return value;
  }
  details[field] = `Expected a number from ${min} to ${max}.`;
  return null;
}
