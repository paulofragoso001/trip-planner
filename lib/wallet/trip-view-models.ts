import {
  TRIP_TRAVEL_STYLE_LABELS,
  normalizeTravelStyle,
  type TripTravelStyle
} from "@/lib/trips";

export type WalletTripRecord = {
  destination?: string | null;
  destination_lat?: number | string | null;
  destination_lng?: number | string | null;
  end_date?: string | null;
  id: string;
  name?: string | null;
  start_date?: string | null;
  status?: string | null;
  title?: string | null;
  travel_style?: string | null;
};

export type WalletTripSegmentSummaryRecord = {
  lat?: number | null;
  latitude?: number | null;
  location_status?: string | null;
  lng?: number | null;
  longitude?: number | null;
  trip_id: string;
};

export type WalletTripSegmentRecord = WalletTripSegmentSummaryRecord & {
  end_time?: string | null;
  id: string;
  inserted_at?: string | null;
  kind?: string | null;
  location?: string | null;
  notes?: string | null;
  provider?: string | null;
  provider_metadata?: Record<string, unknown> | null;
  start_time?: string | null;
  title?: string | null;
};

export type WalletPlaceRecord = {
  address?: string | null;
  category?: string | null;
  city?: string | null;
  country?: string | null;
  description?: string | null;
  id: string;
  name?: string | null;
  region?: string | null;
  status?: string | null;
  travel_note?: string | null;
  trip_id?: string | null;
};

export type WalletReservationRecord = {
  created_at?: string | null;
  date_time?: string | null;
  id: string;
  location?: string | null;
  notes?: string | null;
  source_label?: string | null;
  source_type?: string | null;
  title?: string | null;
  trip_id?: string | null;
};

export type WalletTripSegmentCounts = {
  mappedStops: number;
  needsLocationStops: number;
  stopCount: number;
};

export type WalletTripSummaryModel = {
  dateRange: string;
  destination: string;
  endDate: string | null;
  href: string;
  id: string;
  name: string;
  startDate: string | null;
  status: string;
};

export type WalletTripPassModel = WalletTripSummaryModel & {
  destinationLat: number | null;
  destinationLng: number | null;
  imageAlt: string;
  imageAttribution: string | null;
  imageUrl: string | null;
  mappedStops: number;
  nearbyIdeasCount: number;
  needsLocationStops: number;
  stopCount: number;
  travelStyle: TripTravelStyle;
  travelStyleLabel: string;
};

export type WalletMapTripModel = WalletTripSummaryModel & {
  destinationLat: number | null;
  destinationLng: number | null;
  isMapped: boolean;
  mapLabel: string;
};

export type WalletTripSegmentModel = {
  dateLabel: string | null;
  href: string;
  id: string;
  isMapped: boolean;
  kind: string;
  locationLabel: string | null;
  mapLabel: string;
  position: {
    lat: number;
    lng: number;
  } | null;
  providerLabel: string | null;
  title: string;
  tripId: string;
};

export type WalletPlaceModel = {
  addressLabel: string | null;
  category: string;
  description: string | null;
  href: string;
  id: string;
  status: string;
  title: string;
  tripId: string | null;
};

export type WalletReservationModel = {
  href: string;
  id: string;
  locationLabel: string | null;
  metaLabel: string;
  sourceLabel: string;
  title: string;
  tripId: string | null;
  typeLabel: string;
};

export type WalletTripVisual = {
  imageAlt?: string | null;
  imageAttribution?: string | null;
  imageUrl?: string | null;
};

export function emptyWalletTripSegmentCounts(): WalletTripSegmentCounts {
  return {
    mappedStops: 0,
    needsLocationStops: 0,
    stopCount: 0
  };
}

export function summarizeWalletTripSegments(
  rows: WalletTripSegmentSummaryRecord[]
): Map<string, WalletTripSegmentCounts> {
  const summaries = new Map<string, WalletTripSegmentCounts>();

  for (const row of rows) {
    const current = summaries.get(row.trip_id) || emptyWalletTripSegmentCounts();
    const lat = row.lat ?? row.latitude;
    const lng = row.lng ?? row.longitude;
    const mapped = typeof lat === "number" && typeof lng === "number";

    summaries.set(row.trip_id, {
      mappedStops: current.mappedStops + (mapped ? 1 : 0),
      needsLocationStops:
        current.needsLocationStops +
        (!mapped || row.location_status === "needs_location_confirmation" ? 1 : 0),
      stopCount: current.stopCount + 1
    });
  }

  return summaries;
}

export function mapWalletTripSummary(row: WalletTripRecord): WalletTripSummaryModel {
  return {
    dateRange: formatWalletDateRange(row.start_date ?? null, row.end_date ?? null),
    destination: cleanString(row.destination) || "Destination not set",
    endDate: row.end_date ?? null,
    href: walletTripHref(row.id),
    id: row.id,
    name: cleanString(row.name) || cleanString(row.title) || "Untitled trip",
    startDate: row.start_date ?? null,
    status: cleanString(row.status) || "Planning"
  };
}

export function mapWalletTripPass(
  row: WalletTripRecord,
  options: {
    counts?: WalletTripSegmentCounts;
    nearbyIdeasCount?: number;
    visual?: WalletTripVisual;
  } = {}
): WalletTripPassModel {
  const summary = mapWalletTripSummary(row);
  const counts = options.counts || emptyWalletTripSegmentCounts();
  const travelStyle = normalizeTravelStyle(row.travel_style);

  return {
    ...summary,
    destination: cleanString(row.destination) || "No destination set",
    destinationLat: normalizeWalletNumber(row.destination_lat),
    destinationLng: normalizeWalletNumber(row.destination_lng),
    imageAlt:
      options.visual?.imageAlt ||
      (row.destination ? `Photo of ${row.destination}` : `Trip image for ${summary.name}`),
    imageAttribution: options.visual?.imageAttribution || null,
    imageUrl: options.visual?.imageUrl || null,
    mappedStops: counts.mappedStops,
    nearbyIdeasCount: options.nearbyIdeasCount || 0,
    needsLocationStops: counts.needsLocationStops,
    endDate: row.end_date ?? null,
    startDate: row.start_date ?? null,
    stopCount: counts.stopCount,
    travelStyle,
    travelStyleLabel: TRIP_TRAVEL_STYLE_LABELS[travelStyle]
  };
}

export function mapWalletTripToMapModel(row: WalletTripRecord): WalletMapTripModel {
  const summary = mapWalletTripSummary(row);
  const destinationLat = normalizeWalletNumber(row.destination_lat);
  const destinationLng = normalizeWalletNumber(row.destination_lng);

  return {
    ...summary,
    destinationLat,
    destinationLng,
    isMapped: destinationLat !== null && destinationLng !== null,
    mapLabel: destinationMapLabel(summary.destination, summary.name)
  };
}

export function mapWalletTripSegment(row: WalletTripSegmentRecord): WalletTripSegmentModel {
  const lat = normalizeWalletNumber(row.lat ?? row.latitude);
  const lng = normalizeWalletNumber(row.lng ?? row.longitude);
  const title = cleanString(row.title) || cleanString(row.location) || "Untitled trip item";

  return {
    dateLabel: formatWalletDateTime(row.start_time) || formatWalletDateTime(row.inserted_at),
    href: `${walletTripHref(row.trip_id)}/timeline`,
    id: row.id,
    isMapped: lat !== null && lng !== null,
    kind: cleanString(row.kind) || "item",
    locationLabel: cleanString(row.location),
    mapLabel: cleanString(row.location) || title,
    position: lat !== null && lng !== null ? { lat, lng } : null,
    providerLabel: cleanString(row.provider),
    title,
    tripId: row.trip_id
  };
}

export function mapWalletPlace(row: WalletPlaceRecord): WalletPlaceModel {
  const title = cleanString(row.name) || "Untitled place";
  const tripId = cleanString(row.trip_id);

  return {
    addressLabel:
      [row.address, row.city, row.region, row.country]
        .map(cleanString)
        .filter(Boolean)
        .join(", ") || null,
    category: cleanString(row.category) || "Place",
    description: cleanString(row.description) || cleanString(row.travel_note),
    href: tripId ? `${walletTripHref(tripId)}/ideas` : "/dashboard/plan",
    id: row.id,
    status: cleanString(row.status) || "needs_review",
    title,
    tripId
  };
}

export function mapWalletReservation(row: WalletReservationRecord): WalletReservationModel {
  const tripId = cleanString(row.trip_id);
  const typeLabel = reservationTypeLabel(row.source_type);
  const title = cleanString(row.title) || cleanString(row.source_label) || typeLabel;
  const dateLabel = formatWalletDateTime(row.date_time) || formatWalletDateTime(row.created_at);
  const locationLabel = cleanString(row.location);

  return {
    href: tripId ? `${walletTripHref(tripId)}/documents` : "/dashboard/imports",
    id: row.id,
    locationLabel,
    metaLabel:
      [locationLabel, dateLabel].filter(Boolean).join(" · ") ||
      cleanString(row.notes) ||
      "Trip document",
    sourceLabel: cleanString(row.source_label) || typeLabel,
    title,
    tripId,
    typeLabel
  };
}

export function formatWalletDateRange(startDate: string | null, endDate: string | null) {
  if (!startDate && !endDate) {
    return "Dates not set";
  }

  if (startDate && !endDate) {
    return formatWalletDate(startDate);
  }

  if (!startDate && endDate) {
    return formatWalletDate(endDate);
  }

  return `${formatWalletDate(startDate!)} - ${formatWalletDate(endDate!)}`;
}

export function formatWalletTravelStyle(value: string | null | undefined) {
  const travelStyle = normalizeTravelStyle(value);
  return TRIP_TRAVEL_STYLE_LABELS[travelStyle];
}

export function normalizeWalletNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function walletTripHref(id: string) {
  return `/dashboard/trips/${encodeURIComponent(id)}`;
}

function destinationMapLabel(destination: string, fallback: string) {
  const label = destination.replace(/\s*,\s*(United States|USA|US|Canada|Japan|Spain)$/i, "");
  return label.split(",")[0]?.trim() || fallback;
}

function reservationTypeLabel(value: string | null | undefined) {
  const normalized = String(value || "").toLowerCase();
  if (/email|gmail|reservation|booking/.test(normalized)) return "Reservation";
  if (/link|url|web|article/.test(normalized)) return "Link";
  if (/image|photo|screenshot/.test(normalized)) return "Photo";
  return "Document";
}

function formatWalletDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC"
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function formatWalletDateTime(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC"
  }).format(date);
}

function cleanString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
