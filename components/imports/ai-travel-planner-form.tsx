"use client";

import { WandSparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type PlannerTrip = {
  destination: string | null;
  endDate: string | null;
  id: string;
  name: string;
  startDate: string | null;
  travelStyle: string;
  travelStyleLabel: string;
};

type AiTravelPlannerFormProps = {
  trips: PlannerTrip[];
};

const DEFAULT_INTERESTS = [
  "coffee",
  "restaurants",
  "landmarks",
  "hidden gems",
  "walkable neighborhoods"
];

export function AiTravelPlannerForm({ trips }: AiTravelPlannerFormProps) {
  const router = useRouter();
  const defaultTrip = trips[0] || null;
  const [destination, setDestination] = useState(defaultTrip?.destination || "");
  const [interests, setInterests] = useState(DEFAULT_INTERESTS.join(", "));
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [selectedTripId, setSelectedTripId] = useState(defaultTrip?.id || "");
  const [travelStyle, setTravelStyle] = useState(defaultTrip?.travelStyle || "balanced");

  const selectedTrip = useMemo(
    () => trips.find((trip) => trip.id === selectedTripId) || null,
    [selectedTripId, trips]
  );
  const tripDays = countTripDays(selectedTrip);

  function selectTrip(tripId: string) {
    const trip = trips.find((candidate) => candidate.id === tripId) || null;
    setSelectedTripId(tripId);

    if (trip?.destination) {
      setDestination(trip.destination);
    }

    if (trip?.travelStyle) {
      setTravelStyle(trip.travelStyle);
    }
  }

  async function submitPlanner() {
    setPending(true);
    setMessage("Building an AI planning brief...");

    try {
      const body = bodyForPlannerRequest({
        destination,
        interests,
        selectedTrip,
        travelStyle
      });

      const response = await fetch("/api/ai-trip-planner", {
        body: JSON.stringify(body),
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json"
        },
        method: "POST"
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(readError(payload, response.status));
      }

      const count = countExtractedPlaces(payload);
      setMessage(
        count
          ? `Almidy found ${count} place${count === 1 ? "" : "s"} to review.`
          : "Almidy finished scanning. No confident places were found yet."
      );
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not generate planner candidates.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-3 shadow-sm sm:p-4">
        <div className="grid gap-3 text-slate-950">
          <select
            className="min-h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold outline-none focus:border-blue-500"
            onChange={(event) => selectTrip(event.target.value)}
            value={selectedTripId}
          >
            <option value="">Plan without attaching to a trip</option>
            {trips.map((trip) => (
              <option key={trip.id} value={trip.id}>
                {trip.name}
              </option>
            ))}
          </select>
          <input
            className="min-h-12 rounded-2xl border border-slate-200 px-4 text-sm font-semibold outline-none focus:border-blue-500"
            onChange={(event) => setDestination(event.target.value)}
            placeholder="Destination, city, or region"
            value={destination}
          />
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <select
              className="min-h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold outline-none focus:border-blue-500"
              onChange={(event) => setTravelStyle(event.target.value)}
              value={travelStyle}
            >
              {travelStyleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <div className="grid min-h-12 place-items-center rounded-2xl bg-slate-100 px-4 text-sm font-black text-slate-700">
              {tripDays ? `${tripDays} days` : "Dates TBD"}
            </div>
          </div>
          <textarea
            className="min-h-28 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium outline-none focus:border-blue-500"
            onChange={(event) => setInterests(event.target.value)}
            placeholder="Interests, saved-post themes, constraints, neighborhoods, food preferences"
            value={interests}
          />
          <button
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={pending || (!destination && !interests)}
            onClick={submitPlanner}
            type="button"
          >
            <WandSparkles className="h-4 w-4" />
            {pending ? "Scanning..." : "Find places to review"}
          </button>
          {pending ? (
            <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full w-2/3 animate-pulse rounded-full bg-blue-600" />
            </div>
          ) : null}
          {message ? (
            <p aria-live="polite" className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">
              {message}
            </p>
          ) : null}
      </div>
    </section>
  );
}

const travelStyleOptions = [
  { label: "Balanced", value: "balanced" },
  { label: "Relaxed", value: "relaxed" },
  { label: "Packed", value: "packed" },
  { label: "Food focused", value: "food_focused" },
  { label: "Culture focused", value: "culture_focused" },
  { label: "Outdoors", value: "outdoors" },
  { label: "Nightlife", value: "nightlife" },
  { label: "Family friendly", value: "family_friendly" }
];

function bodyForPlannerRequest({
  destination,
  interests,
  selectedTrip,
  travelStyle
}: {
  destination: string;
  interests: string;
  selectedTrip: PlannerTrip | null;
  travelStyle: string;
}) {
  return {
    destination: destination || selectedTrip?.destination || null,
    endDate: selectedTrip?.endDate || null,
    interests,
    startDate: selectedTrip?.startDate || null,
    travelStyle,
    tripId: selectedTrip?.id || null,
    tripName: selectedTrip?.name || null
  };
}

function countTripDays(trip: PlannerTrip | null) {
  if (!trip?.startDate || !trip.endDate) return null;
  const start = new Date(`${trip.startDate}T00:00:00.000Z`);
  const end = new Date(`${trip.endDate}T00:00:00.000Z`);
  const diff = end.getTime() - start.getTime();
  if (!Number.isFinite(diff) || diff < 0) return null;
  return Math.max(1, Math.floor(diff / 86_400_000) + 1);
}

function readError(payload: unknown, status: number) {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof payload.error === "object" &&
    payload.error !== null &&
    "message" in payload.error &&
    typeof payload.error.message === "string"
  ) {
    return payload.error.message;
  }

  return `Planner request failed (${status}).`;
}

function countExtractedPlaces(payload: unknown) {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "data" in payload &&
    typeof payload.data === "object" &&
    payload.data !== null &&
    "extractedPlaces" in payload.data &&
    Array.isArray(payload.data.extractedPlaces)
  ) {
    return payload.data.extractedPlaces.length;
  }

  return 0;
}
