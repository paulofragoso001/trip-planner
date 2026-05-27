"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  mapTripObjects,
  mapTrips,
  type ApiTrip
} from "@/lib/trip-preview-adapter";
import {
  getApiErrorMessage,
  readLegacyArrayOrField
} from "@/lib/api/client";

export type TripObjectKind =
  | "air"
  | "hotel"
  | "meeting"
  | "activity"
  | "transport"
  | "weather"
  | "itinerary_item";

export interface TripObject {
  id: string;
  kind: TripObjectKind;
  title: string;
  starttime?: string;
  endtime?: string;
  location?: string;
  lat?: number | null;
  lng?: number | null;
  notes?: string | null;
  imageUrl?: string | null;
  imageUrls?: string[] | null;
  provider?: string | null;
  confirmationCode?: string | null;
  bookingUrl?: string | null;
  position?: number | null;
}

export interface Trip {
  id: string;
  userId: string;
  slug: string | null;
  isPublic: boolean;
  title?: string | null;
  name: string;
  destination: string;
  startDate: string | null;
  endDate: string | null;
  status: string;
  route: string | null;
  budget: number;
  notes: string | null;
  itinerary: unknown[];
  documents: unknown[];
  createdAt: string;
  updatedAt: string;
  objects?: TripObject[];
}

export interface TripListProps {
  trips: Trip[];
  selectedTripId: string | null;
  onSelectTrip: (tripId: string) => void;
  loading?: boolean;
}

export interface TripPreviewPageProps {
  trip: Trip | null;
  loading?: boolean;
  printMode?: boolean;
}

async function fetchTrips(): Promise<Trip[]> {
  const response = await fetch("/api/trips", {
    cache: "no-store",
    headers: { Accept: "application/json" }
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || `Failed to load trips: ${response.status}`);
  }

  const rawTrips = Array.isArray(payload) ? payload : payload.trips || [];
  return mapTrips(rawTrips as ApiTrip[]);
}

async function fetchItinerary(tripId: string): Promise<TripObject[]> {
  const response = await fetch(`/api/itinerary?tripId=${encodeURIComponent(tripId)}`, {
    cache: "no-store",
    headers: { Accept: "application/json" }
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(getApiErrorMessage(payload, `Failed to load itinerary: ${response.status}`));
  }

  return mapTripObjects(readLegacyArrayOrField<unknown>(payload, "itinerary", []));
}

async function fetchTripSegments(tripId: string): Promise<TripObject[]> {
  const response = await fetch(
    `/api/trip-segments?tripId=${encodeURIComponent(tripId)}`,
    {
      cache: "no-store",
      headers: { Accept: "application/json" }
    }
  );
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(getApiErrorMessage(payload, `Failed to load trip segments: ${response.status}`));
  }

  return mapTripObjects(readLegacyArrayOrField<unknown>(payload, "segments", []));
}

function TripList({
  trips,
  selectedTripId,
  onSelectTrip,
  loading = false
}: TripListProps) {
  if (loading) return <div aria-live="polite">Loading trips...</div>;

  return (
    <div className="grid gap-3">
      {trips.map((trip) => {
        const selected = trip.id === selectedTripId;

        return (
          <button
            aria-current={selected ? "true" : undefined}
            className={
              selected
                ? "rounded-2xl border bg-white p-4 text-left font-semibold ring-2 ring-black"
                : "rounded-2xl border bg-white p-4 text-left font-semibold"
            }
            data-testid={`trip-card-${trip.id}`}
            key={trip.id}
            onClick={() => onSelectTrip(trip.id)}
            type="button"
          >
            <div>{trip.title ?? trip.name}</div>
            <div className="text-sm opacity-70">{trip.destination}</div>
            <div className="text-xs opacity-60">
              {trip.startDate} to {trip.endDate}
            </div>
          </button>
        );
      })}
    </div>
  );
}

export function TripPreviewPage({
  trip,
  loading = false,
  printMode = false
}: TripPreviewPageProps) {
  if (loading) return <div aria-live="polite">Loading preview...</div>;
  if (!trip) return <div>Select a trip to view details.</div>;

  return (
    <div className="rounded-3xl border bg-white p-6" data-testid="trip-preview">
      <h1 className="text-3xl font-black">{trip.title ?? trip.name}</h1>
      <p className="text-sm opacity-70">{trip.destination}</p>
      <p className="text-sm opacity-70">
        {trip.startDate} to {trip.endDate}
      </p>
      {!printMode ? (
        <div className="mt-4 flex gap-2">
          <button type="button">Print itinerary</button>
          <button type="button">Export PDF</button>
        </div>
      ) : null}
      <div className="mt-6 grid gap-4">
        {(trip.objects ?? []).map((obj) => (
          <article className="rounded-2xl border p-4" key={obj.id}>
            <div className="text-xs uppercase tracking-wide opacity-60">
              {obj.kind}
            </div>
            <h2 className="mt-1 font-bold">{obj.title}</h2>
            <p className="text-sm opacity-70">{obj.location}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [tripsLoading, setTripsLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState(
    "Select a trip to view details."
  );

  const selectedTrip = useMemo(
    () => trips.find((trip) => trip.id === selectedTripId) ?? null,
    [trips, selectedTripId]
  );

  useEffect(() => {
    let active = true;

    async function loadTrips() {
      setTripsLoading(true);
      setErrorMessage(null);
      setStatusMessage("Loading trips...");

      try {
        const loadedTrips = await fetchTrips();
        if (!active) return;

        setTrips(loadedTrips);
        setSelectedTripId((current) => current ?? loadedTrips[0]?.id ?? null);
        setStatusMessage(loadedTrips.length ? "" : "No trips yet.");
      } catch {
        if (!active) return;

        setTrips([]);
        setSelectedTripId(null);
        setErrorMessage("Could not load trips.");
        setStatusMessage("Select a trip to view details.");
      } finally {
        if (active) setTripsLoading(false);
      }
    }

    loadTrips();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadSelectedTripData(tripId: string) {
      setPreviewLoading(true);
      setErrorMessage(null);

      try {
        const itineraryObjects = await fetchItinerary(tripId);
        const objects = itineraryObjects.length
          ? itineraryObjects
          : await fetchTripSegments(tripId);

        if (!active) return;

        setTrips((current) =>
          current.map((trip) => (trip.id === tripId ? { ...trip, objects } : trip))
        );
      } catch {
        if (!active) return;
        setErrorMessage("Could not load trip details.");
      } finally {
        if (active) setPreviewLoading(false);
      }
    }

    if (selectedTripId) {
      loadSelectedTripData(selectedTripId);
    }

    return () => {
      active = false;
    };
  }, [selectedTripId]);

  useEffect(() => {
    if (!selectedTrip) {
      setStatusMessage("Select a trip to view details.");
      return;
    }

    setStatusMessage(`Selected trip: ${selectedTrip.title ?? selectedTrip.name}.`);
  }, [selectedTrip]);

  return (
    <main className="min-h-screen bg-[#f7f6f2] p-6 text-[#221d17]">
      <div
        aria-live="assertive"
        className="sr-only"
        data-testid="dashboard-live-region"
      >
        {errorMessage ?? statusMessage}
      </div>
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[360px_1fr]">
        <aside className="rounded-3xl border border-black/10 bg-white p-5">
          <h2 className="text-xl font-black">Trips</h2>
          <div className="mt-4">
            <TripList
              loading={tripsLoading}
              onSelectTrip={setSelectedTripId}
              selectedTripId={selectedTripId}
              trips={trips}
            />
          </div>
        </aside>

        <section className="rounded-3xl border border-black/10 bg-white p-5">
          <TripPreviewPage
            loading={tripsLoading || previewLoading}
            trip={selectedTrip}
          />
        </section>
      </div>
    </main>
  );
}
