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
    route: typeof record.route === "string" ? record.route : null,
    notes: typeof record.notes === "string" ? record.notes : null
  } as Trip;
}
