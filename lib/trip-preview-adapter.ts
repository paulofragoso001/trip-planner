import type {
  Trip,
  TripObject,
  TripObjectKind
} from "@/components/trip-preview/DashboardPage";

export type ApiTrip = {
  id: string;
  user_id?: string | null;
  slug?: string | null;
  is_public?: boolean | null;
  title?: string | null;
  name?: string | null;
  destination?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  status?: string | null;
  route?: string | null;
  budget?: number | null;
  notes?: string | null;
  itinerary?: unknown[] | null;
  documents?: unknown[] | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type ApiItineraryItem = {
  id: string;
  title?: string | null;
  location?: string | null;
  lat?: number | null;
  lng?: number | null;
  position?: number | null;
  date_time?: string | null;
  notes?: string | null;
  image_url?: string | null;
  image_urls?: string[] | null;
  segment_type?: string | null;
  type?: string | null;
  provider?: string | null;
  confirmation_code?: string | null;
  booking_url?: string | null;
};

export type ApiTripSegment = {
  id: string;
  title?: string | null;
  location?: string | null;
  kind?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  inserted_at?: string | null;
};

export type ApiTripObject = ApiItineraryItem | ApiTripSegment;

export function mapTrip(input: ApiTrip, objects: TripObject[] = []): Trip {
  const name = input.name?.trim() || input.title?.trim() || input.destination?.trim();

  return {
    id: input.id,
    userId: input.user_id ?? "",
    slug: input.slug ?? null,
    isPublic: Boolean(input.is_public),
    title: input.title ?? null,
    name: name || "Untitled trip",
    destination: input.destination ?? "",
    startDate: input.start_date ?? null,
    endDate: input.end_date ?? null,
    status: input.status ?? "planning",
    route: input.route ?? null,
    budget: input.budget ?? 0,
    notes: input.notes ?? null,
    itinerary: Array.isArray(input.itinerary) ? input.itinerary : [],
    documents: Array.isArray(input.documents) ? input.documents : [],
    createdAt: input.created_at ?? "",
    updatedAt: input.updated_at ?? "",
    objects
  };
}

export function mapTrips(trips: ApiTrip[]): Trip[] {
  return trips.map((trip) => mapTrip(trip));
}

export function mapTripObjects(input: unknown): TripObject[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input.map(mapTripObject).filter((item): item is TripObject => Boolean(item));
}

export function mapTripObject(input: unknown): TripObject | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const item = input as ApiTripObject;

  if ("segment_type" in item || "date_time" in item || "image_url" in item) {
    return {
      id: item.id,
      kind: normalizeKind(item.segment_type ?? item.type),
      title: item.title?.trim() || item.provider?.trim() || "Itinerary item",
      starttime: item.date_time ?? undefined,
      location: item.location ?? undefined,
      lat: item.lat ?? null,
      lng: item.lng ?? null,
      position: item.position ?? null,
      notes: item.notes ?? null,
      imageUrl: item.image_url ?? null,
      imageUrls: item.image_urls ?? null,
      provider: item.provider ?? null,
      confirmationCode: item.confirmation_code ?? null,
      bookingUrl: item.booking_url ?? null
    };
  }

  const segment = item as ApiTripSegment;

  return {
    id: segment.id,
    kind: normalizeKind(segment.kind),
    title: segment.title?.trim() || segment.kind?.trim() || "Itinerary item",
    starttime: segment.start_time ?? undefined,
    endtime: segment.end_time ?? undefined,
    location: segment.location ?? undefined,
    position: null,
    notes: null,
    imageUrl: null,
    imageUrls: null,
    provider: null,
    confirmationCode: null,
    bookingUrl: null
  };
}

function normalizeKind(value?: string | null): TripObjectKind {
  switch (value?.trim().toLowerCase()) {
    case "air":
    case "flight":
      return "air";
    case "hotel":
    case "lodging":
      return "hotel";
    case "meeting":
      return "meeting";
    case "transport":
    case "car":
    case "rail":
      return "transport";
    case "weather":
      return "weather";
    case "itinerary_item":
    case "note":
      return "itinerary_item";
    case "activity":
    default:
      return "activity";
  }
}
