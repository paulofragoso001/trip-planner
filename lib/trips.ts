export const TRIP_TRAVEL_STYLES = [
  "balanced",
  "relaxed",
  "packed",
  "food_focused",
  "culture_focused",
  "outdoors",
  "nightlife",
  "family_friendly"
] as const;

export type TripTravelStyle = (typeof TRIP_TRAVEL_STYLES)[number];

export const TRIP_TRAVEL_STYLE_LABELS: Record<TripTravelStyle, string> = {
  balanced: "Balanced",
  relaxed: "Relaxed",
  packed: "Packed",
  food_focused: "Food focused",
  culture_focused: "Culture focused",
  outdoors: "Outdoors",
  nightlife: "Nightlife",
  family_friendly: "Family friendly"
};

export type Trip = {
  id: string;
  user_id: string;
  slug: string | null;
  is_public: boolean;
  title?: string | null;
  name: string;
  destination: string;
  destination_status: TripDestinationStatus;
  destination_place_id: string | null;
  destination_formatted_address: string | null;
  destination_lat: number | null;
  destination_lng: number | null;
  destination_provider_metadata: Record<string, unknown>;
  start_date: string | null;
  end_date: string | null;
  status: string;
  travel_style: TripTravelStyle;
  route: string | null;
  budget: number;
  notes: string | null;
  itinerary: unknown[];
  documents: unknown[];
  created_at: string;
  updated_at: string;
};

export type TripDestinationStatus = "manual" | "resolved" | "unresolved";

export type TripFormPayload = {
  trip_name: string;
  destination: string;
  destination_lat: number;
  destination_lng: number;
  country_code: string;
  start_date: string;
  end_date: string;
  expense_budget?: number | null;
  travel_style: TripTravelStyle;
};

export type TripFormInitialData = Partial<
  Omit<TripFormPayload, "destination_lat" | "destination_lng">
> & {
  destination_lat?: number | null;
  destination_lng?: number | null;
  destination_formatted_address?: string | null;
  destination_place_id?: string | null;
};

export type TripInput = {
  name: string;
  destination: string;
  destination_status?: TripDestinationStatus | string | null;
  destination_place_id?: string | null;
  destination_formatted_address?: string | null;
  destination_lat?: number | string | null;
  destination_lng?: number | string | null;
  destination_provider_metadata?: Record<string, unknown> | null;
  start_date?: string | null;
  end_date?: string | null;
  status?: string;
  travel_style?: TripTravelStyle | string | null;
  travelStyle?: TripTravelStyle | string | null;
  route?: string | null;
  budget?: number;
  notes?: string | null;
  itinerary?: unknown[];
  documents?: unknown[];
};

export function normalizeTripInput(input: Partial<TripInput>) {
  const destinationLat = normalizeNullableNumber(input.destination_lat);
  const destinationLng = normalizeNullableNumber(input.destination_lng);
  const hasResolvedDestination =
    normalizeDestinationStatus(input.destination_status) === "resolved" &&
    typeof destinationLat === "number" &&
    typeof destinationLng === "number";

  return {
    name: input.name?.trim(),
    destination: input.destination?.trim(),
    destination_status: hasResolvedDestination
      ? "resolved"
      : normalizeDestinationStatus(input.destination_status) === "resolved"
        ? "unresolved"
        : normalizeDestinationStatus(input.destination_status),
    destination_place_id: input.destination_place_id?.trim() || null,
    destination_formatted_address: input.destination_formatted_address?.trim() || null,
    destination_lat: destinationLat,
    destination_lng: destinationLng,
    destination_provider_metadata:
      input.destination_provider_metadata &&
      typeof input.destination_provider_metadata === "object" &&
      !Array.isArray(input.destination_provider_metadata)
        ? input.destination_provider_metadata
        : {},
    start_date: input.start_date || null,
    end_date: input.end_date || null,
    status: input.status?.trim() || "Planning",
    travel_style: normalizeTravelStyle(input.travel_style || input.travelStyle),
    route: input.route?.trim() || null,
    budget: Number(input.budget || 0),
    notes: input.notes?.trim() || null,
    itinerary: Array.isArray(input.itinerary) ? input.itinerary : [],
    documents: Array.isArray(input.documents) ? input.documents : []
  };
}

export function toTripWritePayload(trip: ReturnType<typeof normalizeTripInput>) {
  return {
    title: trip.name,
    name: trip.name,
    destination: trip.destination,
    destination_status: trip.destination_status,
    destination_place_id: trip.destination_place_id,
    destination_formatted_address: trip.destination_formatted_address,
    destination_lat: trip.destination_lat,
    destination_lng: trip.destination_lng,
    destination_provider_metadata: trip.destination_provider_metadata,
    start_date: trip.start_date,
    end_date: trip.end_date,
    status: trip.status,
    travel_style: trip.travel_style,
    route: trip.route,
    budget: trip.budget,
    notes: trip.notes
  };
}

export function mapTripRecord(record: Record<string, unknown>): Trip {
  return {
    ...record,
    name: String(record.name || record.title || "Untitled trip"),
    itinerary: Array.isArray(record.itinerary) ? record.itinerary : [],
    documents: Array.isArray(record.documents) ? record.documents : [],
    budget: Number(record.budget || 0),
    destination_status: normalizeDestinationStatus(record.destination_status),
    destination_place_id:
      typeof record.destination_place_id === "string" ? record.destination_place_id : null,
    destination_formatted_address:
      typeof record.destination_formatted_address === "string"
        ? record.destination_formatted_address
        : null,
    destination_lat: normalizeNullableNumber(record.destination_lat),
    destination_lng: normalizeNullableNumber(record.destination_lng),
    destination_provider_metadata:
      record.destination_provider_metadata &&
      typeof record.destination_provider_metadata === "object" &&
      !Array.isArray(record.destination_provider_metadata)
        ? (record.destination_provider_metadata as Record<string, unknown>)
        : {},
    travel_style: normalizeTravelStyle(record.travel_style),
    route: typeof record.route === "string" ? record.route : null,
    notes: typeof record.notes === "string" ? record.notes : null
  } as Trip;
}

export function stripTripDestinationMetadata<T extends Record<string, unknown>>(payload: T) {
  const {
    destination_formatted_address: _destinationFormattedAddress,
    destination_lat: _destinationLat,
    destination_lng: _destinationLng,
    destination_place_id: _destinationPlaceId,
    destination_provider_metadata: _destinationProviderMetadata,
    destination_status: _destinationStatus,
    ...legacyPayload
  } = payload;

  return legacyPayload;
}

export function isMissingTripDestinationMetadataColumn(message: string) {
  return (
    /destination_(status|place_id|formatted_address|lat|lng|provider_metadata)/i.test(
      message
    ) && /column|schema cache|could not find/i.test(message)
  );
}

export function normalizeTravelStyle(value: unknown): TripTravelStyle {
  return typeof value === "string" &&
    (TRIP_TRAVEL_STYLES as readonly string[]).includes(value)
    ? (value as TripTravelStyle)
    : "balanced";
}

function normalizeDestinationStatus(value: unknown): TripDestinationStatus {
  return value === "resolved" || value === "unresolved" ? value : "manual";
}

function normalizeNullableNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}
