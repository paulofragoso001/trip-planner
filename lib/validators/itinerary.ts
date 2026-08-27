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

const transportationKinds = [
  "flight",
  "car",
  "train",
  "car_rental",
  "transfer",
  "cruise",
  "walk",
  "bus",
  "bike",
  "ferry",
  "motorcycle"
] as const;

export type TransportationKind = (typeof transportationKinds)[number];

export type ItineraryAttachmentInput = {
  displayName: string;
  kind: "file" | "photo" | "link";
  mimeType: string | null;
  byteSize: number | null;
  storageBucket: string | null;
  storagePath: string | null;
  externalUrl: string | null;
};

export type ItineraryCostInput = {
  amount: number;
  currency: string;
  label: string;
};

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
  transportKind: TransportationKind | null;
  company: string | null;
  transportNumber: string | null;
  departureLocation: string | null;
  departureAddress: string | null;
  departureLat: number | null;
  departureLng: number | null;
  arrivalLocation: string | null;
  arrivalAddress: string | null;
  arrivalLat: number | null;
  arrivalLng: number | null;
  reservationDetails: Record<string, string>;
  cost: ItineraryCostInput | null;
  attachments: ItineraryAttachmentInput[];
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
  const tripId = readString(value.tripId ?? value.tripID, 120) || readString(searchParams.get("tripId"), 120);
  const title = readString(value.title, 200);
  const isQuickSegmentPayload = Boolean(value.template || value.startTime || value.endTime);
  const dateTime =
    readString(value.date_time, 120) ||
    readString(value.startTime, 120) ||
    readString(value.startAt, 120);
  const endTime = readNullableString(value.endTime ?? value.endAt, 120);
  const departure = isRecord(value.departure) ? value.departure : {};
  const arrival = isRecord(value.arrival) ? value.arrival : {};

  if (!tripId) details.tripId = "tripId is required.";
  if (!title) details.title = "title is required.";
  if (!dateTime) details.dateTime = "start time is required.";
  if (isQuickSegmentPayload && !endTime) details.endTime = "end time is required.";

  const lat = readNullableNumber(value.lat, "lat", details);
  const lng = readNullableNumber(value.lng, "lng", details);
  const normalizedCategoryKind = normalizeTransportationKind(value.kind);
  const categoryKind = transportationKinds.includes(normalizedCategoryKind as TransportationKind)
    ? normalizedCategoryKind
    : null;
  const transportKind = readTransportationKind(
    value.transport_kind || value.transportKind || categoryKind,
    details
  );
  const cost = readCost(value.cost, title || "Transportation", details);
  const attachments = readAttachments(value.attachments, details);
  const reservationDetails = readStringRecord(value.reservation_details || value.reservation, "reservation", details);
  const segmentType = transportKind
    ? (transportKind === "flight" ? "flight" : "transport")
    : normalizeSegmentType(value.segment_type || value.template);
  const arrivalAirportLat = readNullableNumber(value.arrival_airport_lat, "arrival_airport_lat", details);
  const arrivalAirportLng = readNullableNumber(value.arrival_airport_lng, "arrival_airport_lng", details);
  const departureAirportLat = readNullableNumber(value.departure_airport_lat, "departure_airport_lat", details);
  const departureAirportLng = readNullableNumber(value.departure_airport_lng, "departure_airport_lng", details);
  const departureLat =
    readNullableNumber(value.departure_lat ?? departure.latitude, "departure_lat", details) ?? departureAirportLat;
  const departureLng =
    readNullableNumber(value.departure_lng ?? departure.longitude, "departure_lng", details) ?? departureAirportLng;
  const arrivalLat =
    readNullableNumber(value.arrival_lat ?? arrival.latitude, "arrival_lat", details) ?? arrivalAirportLat;
  const arrivalLng =
    readNullableNumber(value.arrival_lng ?? arrival.longitude, "arrival_lng", details) ?? arrivalAirportLng;
  const flightAltitude = readNullableNumber(value.flight_altitude, "flight_altitude", details);
  const flightBearing = readNullableNumber(value.flight_bearing, "flight_bearing", details);
  const flightLat = readNullableNumber(value.flight_lat, "flight_lat", details);
  const flightLng = readNullableNumber(value.flight_lng, "flight_lng", details);
  const flightSpeed = readNullableNumber(value.flight_speed, "flight_speed", details);

  if (transportKind && !endTime) details.endTime = "Transportation requires an end time.";
  if ((departureLat == null) !== (departureLng == null)) {
    details.departureCoordinates = "Departure latitude and longitude must be provided together.";
  }
  if ((arrivalLat == null) !== (arrivalLng == null)) {
    details.arrivalCoordinates = "Arrival latitude and longitude must be provided together.";
  }

  if (Object.keys(details).length || !tripId || !title || !dateTime) {
    return { details, ok: false };
  }

  return {
    ok: true,
    value: {
      airline: readNullableString(value.airline, 120),
      arrival_airport: readNullableString(value.arrival_airport, 20),
      arrival_airport_lat: arrivalAirportLat,
      arrival_airport_lng: arrivalAirportLng,
      bookingUrl:
        readNullableString(value.booking_url, 1000) ||
        readNullableString(value.bookingUrl, 1000) ||
        readNullableString(value.virtualUrl, 1000),
      confirmationCode:
        readNullableString(value.confirmation_code, 120) ||
        readNullableString(value.confirmationCode, 120) ||
        readNullableString(reservationDetails.confirmationCode, 120) ||
        readNullableString(reservationDetails.confirmation_code, 120),
      dateTime,
      departure_airport: readNullableString(value.departure_airport, 20),
      departure_airport_lat: departureAirportLat,
      departure_airport_lng: departureAirportLng,
      endTime,
      estimated_departure: readNullableString(value.estimated_departure, 120),
      flight_altitude: flightAltitude,
      flight_bearing: flightBearing,
      flight_lat: flightLat,
      flight_lng: flightLng,
      flight_number: readNullableString(value.flight_number, 40),
      flight_position_updated_at: readNullableString(value.flight_position_updated_at, 120),
      flight_speed: flightSpeed,
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
      notes:
        readNullableString(value.notes, 5000) ||
        readNullableString(value.note, 5000),
      provider:
        readNullableString(value.provider, 200) ||
        readNullableString(value.organizer, 200),
      scheduled_departure: readNullableString(value.scheduled_departure, 120),
      segmentType,
      terminal: readNullableString(value.terminal, 40),
      title,
      tripId,
      transportKind,
      company: readNullableString(value.company, 200) || readNullableString(value.airline, 120),
      transportNumber:
        readNullableString(value.transport_number, 40) ||
        readNullableString(value.transportNumber, 40) ||
        readNullableString(value.flight_number, 40),
      departureLocation:
        readNullableString(value.departure_location, 500) ||
        readNullableString(departure.name, 500) ||
        readNullableString(value.departure_airport, 120),
      departureAddress:
        readNullableString(value.departure_address, 500) ||
        readNullableString(departure.address, 500),
      departureLat,
      departureLng,
      arrivalLocation:
        readNullableString(value.arrival_location, 500) ||
        readNullableString(arrival.name, 500) ||
        readNullableString(value.arrival_airport, 120),
      arrivalAddress:
        readNullableString(value.arrival_address, 500) ||
        readNullableString(arrival.address, 500),
      arrivalLat,
      arrivalLng,
      reservationDetails,
      cost,
      attachments
    }
  };
}

function readTransportationKind(
  value: unknown,
  details: Record<string, string>
): TransportationKind | null {
  if (value == null) return null;
  if (typeof value !== "string") {
    details.transportKind = "Expected a transportation kind.";
    return null;
  }
  const normalized = normalizeTransportationKind(value);
  if (transportationKinds.includes(normalized as TransportationKind)) {
    return normalized as TransportationKind;
  }
  details.transportKind = "Unsupported transportation kind.";
  return null;
}

function normalizeTransportationKind(value: unknown) {
  return typeof value === "string"
    ? value.trim().toLowerCase().replace(/[ -]+/g, "_")
    : "";
}

function readCost(
  value: unknown,
  fallbackLabel: string,
  details: Record<string, string>
): ItineraryCostInput | null {
  if (value == null) return null;
  if (!isRecord(value)) {
    details.cost = "Expected a cost object.";
    return null;
  }
  const amount = typeof value.amount === "number" ? value.amount : Number(value.amount);
  const currency = typeof value.currency === "string" ? value.currency.trim().toUpperCase() : "";
  const label = readString(value.label, 200) || fallbackLabel;
  if (!Number.isFinite(amount) || amount <= 0 || amount > 9999999999.99) {
    details.cost = "Cost amount must be a positive finite number.";
    return null;
  }
  if (!/^[A-Z]{3}$/.test(currency)) {
    details.costCurrency = "Cost currency must be a three-letter ISO code.";
    return null;
  }
  return { amount, currency, label };
}

function readAttachments(
  value: unknown,
  details: Record<string, string>
): ItineraryAttachmentInput[] {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > 20) {
    details.attachments = "Attachments must be an array containing at most 20 items.";
    return [];
  }

  const attachments: ItineraryAttachmentInput[] = [];
  value.forEach((item, index) => {
    if (!isRecord(item)) {
      details[`attachments.${index}`] = "Expected an attachment object.";
      return;
    }
    const kind = item.kind;
    const displayName = readString(item.display_name ?? item.displayName, 255);
    const storageBucket = readNullableString(item.storage_bucket ?? item.storageBucket, 100);
    const storagePath = readNullableString(item.storage_path ?? item.storagePath, 1000);
    const externalUrl = readHttpURL(item.external_url ?? item.externalUrl ?? item.url, 2000);
    const mimeType = readNullableString(item.mime_type ?? item.mimeType, 255);
    const byteSize = readOptionalInteger(item.byte_size ?? item.byteSize);

    if (kind !== "file" && kind !== "photo" && kind !== "link") {
      details[`attachments.${index}.kind`] = "Attachment kind must be file, photo, or link.";
      return;
    }
    if (!displayName) {
      details[`attachments.${index}.displayName`] = "Attachment display name is required.";
      return;
    }
    if (kind === "link" ? !externalUrl : (!storageBucket || !storagePath)) {
      details[`attachments.${index}.source`] = kind === "link"
        ? "Link attachments require an HTTP or HTTPS URL."
        : "File and photo attachments require a Storage bucket and object path.";
      return;
    }
    attachments.push({
      displayName,
      kind,
      mimeType,
      byteSize,
      storageBucket: kind === "link" ? null : storageBucket,
      storagePath: kind === "link" ? null : storagePath,
      externalUrl: kind === "link" ? externalUrl : null
    });
  });
  return attachments;
}

function readStringRecord(
  value: unknown,
  field: string,
  details: Record<string, string>
) {
  if (value == null) return {};
  if (!isRecord(value)) {
    details[field] = "Expected an object.";
    return {};
  }
  const result: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value)) {
    const cleanKey = readString(key, 80);
    const cleanValue = readString(raw, 500);
    if (cleanKey && cleanValue) result[cleanKey] = cleanValue;
  }
  return result;
}

function readHttpURL(value: unknown, maxLength: number) {
  const string = readNullableString(value, maxLength);
  if (!string) return null;
  try {
    const url = new URL(string);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function readOptionalInteger(value: unknown) {
  if (value == null) return null;
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
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
