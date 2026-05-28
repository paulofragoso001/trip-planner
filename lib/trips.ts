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

export type TripInput = {
  name: string;
  destination: string;
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
  return {
    name: input.name?.trim(),
    destination: input.destination?.trim(),
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
    travel_style: normalizeTravelStyle(record.travel_style),
    route: typeof record.route === "string" ? record.route : null,
    notes: typeof record.notes === "string" ? record.notes : null
  } as Trip;
}

export function normalizeTravelStyle(value: unknown): TripTravelStyle {
  return typeof value === "string" &&
    (TRIP_TRAVEL_STYLES as readonly string[]).includes(value)
    ? (value as TripTravelStyle)
    : "balanced";
}
