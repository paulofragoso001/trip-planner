import {
  hasResolvedRoute,
  normalizeRouteMode,
  routeLocationLabel,
  type TripRouteEndpoint,
  type TripSegmentRouteMetadata
} from "@/lib/trip-segment-route";

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
  locationStatus?: string | null;
  notes: string | null;
  provider: string | null;
  providerMetadata?: Record<string, unknown> | null;
  providerPlaceId?: string | null;
  route?: TripSegmentRouteMetadata | null;
  routeMode?: string | null;
  endDate?: string | null;
  endClockTime?: string | null;
  startDate?: string | null;
  startClockTime?: string | null;
  startTime: string | null;
  timeZone?: string | null;
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
  const schedule = readSchedule(value, details);
  const route = readRouteInput(value, schedule);
  const lat = readNullableNumber(value.lat, "lat", details, -90, 90) ?? route?.destination?.lat ?? null;
  const lng = readNullableNumber(value.lng, "lng", details, -180, 180) ?? route?.destination?.lng ?? null;
  const providerMetadata = mergeRouteMetadata(
    readNullableRecord(value.providerMetadata ?? value.provider_metadata),
    route
  );
  const location = readNullableString(value.location, 500) || routeLocationLabel(route) || null;
  const locationStatus =
    readNullableString(value.locationStatus ?? value.location_status, 80) ||
    (route ? (hasResolvedRoute(route) ? "resolved" : "manual_location_required") : null);

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
      endClockTime: schedule.endClockTime,
      endDate: schedule.endDate,
      endTime: schedule.hasScheduleFields
        ? schedule.endTime
        : readNullableString(value.endTime ?? value.end_time, 120),
      kind,
      lat,
      lng,
      location,
      locationStatus,
      notes: readNullableString(value.notes, 5000),
      provider: readNullableString(value.provider, 200),
      providerMetadata,
      providerPlaceId: readNullableString(value.providerPlaceId ?? value.provider_place_id, 240),
      route,
      routeMode: route?.mode ?? null,
      startClockTime: schedule.startClockTime,
      startDate: schedule.startDate,
      startTime: schedule.hasScheduleFields
        ? schedule.startTime
        : readNullableString(value.startTime ?? value.start_time, 120),
      timeZone: schedule.timeZone,
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

  if (hasScheduleFields(value)) {
    const schedule = readSchedule(value, details);
    update.endClockTime = schedule.endClockTime;
    update.endDate = schedule.endDate;
    update.endTime = schedule.endTime;
    update.startClockTime = schedule.startClockTime;
    update.startDate = schedule.startDate;
    update.startTime = schedule.startTime;
    update.timeZone = schedule.timeZone;
  }

  if ("location" in value) update.location = readNullableString(value.location, 500);
  if ("locationStatus" in value || "location_status" in value) {
    update.locationStatus = readNullableString(value.locationStatus ?? value.location_status, 80);
  }
  if ("notes" in value) update.notes = readNullableString(value.notes, 5000);
  if ("provider" in value) update.provider = readNullableString(value.provider, 200);
  if ("providerMetadata" in value || "provider_metadata" in value) {
    update.providerMetadata = readNullableRecord(value.providerMetadata ?? value.provider_metadata);
  }
  const route = readRouteInput(value, hasScheduleFields(value) ? readSchedule(value, details) : null);
  if (route) {
    update.route = route;
    update.routeMode = route.mode;
    update.providerMetadata = mergeRouteMetadata(update.providerMetadata || null, route);
    if (!("location" in update)) update.location = routeLocationLabel(route) || null;
    if (!("locationStatus" in update)) {
      update.locationStatus = hasResolvedRoute(route) ? "resolved" : "manual_location_required";
    }
    if (!("lat" in update) && typeof route.destination?.lat === "number") {
      update.lat = route.destination.lat;
    }
    if (!("lng" in update) && typeof route.destination?.lng === "number") {
      update.lng = route.destination.lng;
    }
  }
  if ("providerPlaceId" in value || "provider_place_id" in value) {
    update.providerPlaceId = readNullableString(value.providerPlaceId ?? value.provider_place_id, 240);
  }
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

function readNullableRecord(value: unknown) {
  if (value == null) return null;
  return isRecord(value) ? value : null;
}

function mergeRouteMetadata(
  metadata: Record<string, unknown> | null,
  route: TripSegmentRouteMetadata | null
) {
  if (!route) return metadata;
  return {
    ...(metadata || {}),
    route: routeToRecord(route)
  };
}

function readRouteInput(
  value: Record<string, unknown>,
  schedule: ReturnType<typeof readSchedule> | null
): TripSegmentRouteMetadata | null {
  const origin = readEndpoint(value.origin ?? value.from ?? value.routeOrigin ?? value.route_origin);
  const destination = readEndpoint(
    value.destination ?? value.to ?? value.routeDestination ?? value.route_destination
  );
  const mode = readNullableString(
    value.routeMode ?? value.route_mode ?? value.transportType ?? value.transport_type,
    40
  );
  const hasRouteInput = Boolean(origin || destination || mode);
  if (!hasRouteInput) return null;

  const departAt =
    schedule?.startTime ||
    combineOptionalDateTime(value.departDate ?? value.depart_date, value.departTime ?? value.depart_time);
  const arriveAt =
    schedule?.endTime ||
    combineOptionalDateTime(value.arriveDate ?? value.arrive_date, value.arriveTime ?? value.arrive_time);

  return {
    arriveAt,
    carrier: readNullableString(value.carrier, 120),
    confirmation: readNullableString(value.confirmation ?? value.confirmationCode, 120),
    departAt,
    destination,
    flightNumber: readNullableString(value.flightNumber ?? value.flight_number, 80),
    mode: normalizeRouteMode(mode),
    origin
  };
}

function readEndpoint(value: unknown): TripRouteEndpoint | null {
  if (typeof value === "string") {
    const label = readNullableString(value, 240);
    return label
      ? { address: label, code: null, label, lat: null, lng: null, placeId: null }
      : null;
  }
  if (!isRecord(value)) return null;
  const label = readNullableString(value.label ?? value.name, 240);
  const address = readNullableString(value.address ?? value.formattedAddress, 500);
  const placeId = readNullableString(value.placeId ?? value.place_id, 240);
  const lat = typeof value.lat === "number" && Number.isFinite(value.lat) ? value.lat : null;
  const lng = typeof value.lng === "number" && Number.isFinite(value.lng) ? value.lng : null;
  const providerMetadata = readNullableRecord(value.providerMetadata ?? value.provider_metadata);

  if (!label && !address && !placeId && lat == null && lng == null) return null;

  return {
    address,
    code: readNullableString(value.code, 16),
    label: label || address,
    lat,
    lng,
    placeId,
    providerMetadata
  };
}

function routeToRecord(route: TripSegmentRouteMetadata) {
  return {
    arriveAt: route.arriveAt,
    carrier: route.carrier,
    confirmation: route.confirmation,
    departAt: route.departAt,
    destination: route.destination,
    flightNumber: route.flightNumber,
    mode: route.mode,
    origin: route.origin
  };
}

function combineOptionalDateTime(dateValue: unknown, clockValue: unknown) {
  if (typeof dateValue !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) return null;
  const clock = typeof clockValue === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(clockValue)
    ? clockValue
    : "00:00";
  return combineDateAndClockTime(dateValue, clock);
}

function hasScheduleFields(value: Record<string, unknown>) {
  return (
    "startDate" in value ||
    "start_date" in value ||
    "startClockTime" in value ||
    "start_clock_time" in value ||
    "endDate" in value ||
    "end_date" in value ||
    "endClockTime" in value ||
    "end_clock_time" in value ||
    "timeZone" in value ||
    "timezone" in value
  );
}

function readSchedule(value: Record<string, unknown>, details: Record<string, string>) {
  const startDate = readDate(value.startDate ?? value.start_date, "startDate", details);
  const startClockTime = readClockTime(
    value.startClockTime ?? value.start_clock_time,
    "startClockTime",
    details
  );
  const endClockTime = readClockTime(
    value.endClockTime ?? value.end_clock_time,
    "endClockTime",
    details
  );
  const endDate =
    readDate(value.endDate ?? value.end_date, "endDate", details) ||
    (endClockTime ? startDate : null);
  const timeZone =
    readNullableString(value.timeZone ?? value.timezone, 80) ||
    Intl.DateTimeFormat().resolvedOptions().timeZone ||
    "UTC";

  return {
    endClockTime,
    endDate,
    endTime: endDate && endClockTime ? combineDateAndClockTime(endDate, endClockTime) : null,
    hasScheduleFields: hasScheduleFields(value),
    startClockTime,
    startDate,
    startTime: startDate ? combineDateAndClockTime(startDate, startClockTime || "00:00") : null,
    timeZone
  };
}

function readDate(value: unknown, field: string, details: Record<string, string>) {
  if (value == null || value === "") return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  details[field] = "Expected date in YYYY-MM-DD format.";
  return null;
}

function readClockTime(value: unknown, field: string, details: Record<string, string>) {
  if (value == null || value === "") return null;
  if (typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return value;
  details[field] = "Expected time in HH:mm format.";
  return null;
}

function combineDateAndClockTime(date: string, clockTime: string) {
  return `${date}T${clockTime}:00.000Z`;
}
