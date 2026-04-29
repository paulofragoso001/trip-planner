export type Trip = {
  id: string;
  user_id: string;
  slug: string | null;
  is_public: boolean;
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
