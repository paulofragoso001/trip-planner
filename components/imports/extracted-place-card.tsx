"use client";

import { Check, GitMerge, ImageIcon, MapPin, Pencil, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AiReviewItemView } from "@/app/dashboard/imports/loader";

type TripOption = {
  destination: string | null;
  endDate?: string | null;
  id: string;
  name: string;
  startDate?: string | null;
  travelStyle?: string;
};

type ExtractedPlaceCardProps = {
  mergeTargets?: AiReviewItemView[];
  place: AiReviewItemView;
  trips: TripOption[];
};

export function ExtractedPlaceCard({ mergeTargets = [], place, trips }: ExtractedPlaceCardProps) {
  const router = useRouter();
  const [availableTrips, setAvailableTrips] = useState<TripOption[]>(trips);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState("");
  const [mergeTargetId, setMergeTargetId] = useState(mergeTargets[0]?.id || "");
  const [pending, setPending] = useState(false);
  const matchingTrip = findMatchingTrip(place, availableTrips);
  const initialTripId =
    place.tripId && tripMatchesPlace(place, availableTrips.find((trip) => trip.id === place.tripId))
      ? place.tripId
      : matchingTrip?.id || "";
  const [selectedTripId, setSelectedTripId] = useState(initialTripId);
  const [confirmMismatch, setConfirmMismatch] = useState(false);
  const selectedTrip = availableTrips.find((trip) => trip.id === selectedTripId);
  const destinationMissing = Boolean(
    selectedTripId && selectedTrip && isMissingDestination(selectedTrip.destination)
  );
  const destinationMismatch = Boolean(
    selectedTripId &&
      selectedTrip &&
      !isMissingDestination(selectedTrip.destination) &&
      !tripMatchesPlace(place, selectedTrip)
  );
  const candidateDestination = place.city || place.locationHint || place.country || "";
  const inferredTripDestination = selectedTrip ? inferDestinationFromTripName(selectedTrip.name) : "";
  const isActivityIdea = isTourOrActivityIdea(place);
  const approveDisabled =
    pending ||
    !selectedTripId ||
    destinationMissing ||
    (destinationMismatch && !confirmMismatch);

  async function patch(body: Record<string, unknown>) {
    return run(`/api/extracted-places/${place.id}`, "PATCH", body);
  }

  async function run(endpoint: string, method: "PATCH" | "POST", body: Record<string, unknown>) {
    setPending(true);
    setMessage("Working...");

    try {
      const response = await fetch(endpoint, {
        body: JSON.stringify(body),
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json"
        },
        method
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(readError(payload, response.status));
      }

      setMessage(
        endpoint.endsWith("/merge")
          ? "Merged into selected place."
          : body.status === "accepted"
            ? "Added to trip draft."
            : "Updated."
      );
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action failed.");
    } finally {
      setPending(false);
    }
  }

  async function saveEdit(formData: FormData) {
    await patch({
      category: formData.get("category"),
      name: formData.get("name"),
      travelNote: formData.get("travelNote")
    });
    setEditing(false);
  }

  async function mergeIntoTarget() {
    if (!mergeTargetId) {
      setMessage("Choose the duplicate to merge into.");
      return;
    }

    await run(`/api/extracted-places/${place.id}/merge`, "POST", {
      targetPlaceId: mergeTargetId
    });
  }

  async function createDestinationTripDraft() {
    if (!candidateDestination) return;
    setPending(true);
    setMessage(`Creating ${candidateDestination} trip draft...`);

    try {
      const response = await fetch("/api/trips", {
        body: JSON.stringify({
          destination: candidateDestination,
          name: `${candidateDestination} trip`,
          status: "Planning",
          travel_style: "balanced"
        }),
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

      const trip = payload?.trip;
      if (!trip?.id) {
        throw new Error("Trip draft was created without an id.");
      }

      const option: TripOption = {
        destination: trip.destination || candidateDestination,
        id: trip.id,
        name: trip.name || trip.title || `${candidateDestination} trip`,
        travelStyle: trip.travel_style || "balanced"
      };
      setAvailableTrips((current) => [option, ...current.filter((item) => item.id !== option.id)]);
      setSelectedTripId(option.id);
      setConfirmMismatch(false);
      setMessage(`${option.name} is ready for approval.`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create trip draft.");
    } finally {
      setPending(false);
    }
  }

  async function setSelectedTripDestination(destination: string) {
    if (!selectedTrip || !destination) return;
    setPending(true);
    setMessage(`Setting destination to ${destination}...`);

    try {
      const response = await fetch(`/api/trips/${selectedTrip.id}`, {
        body: JSON.stringify({
          destination,
          end_date: selectedTrip.endDate || null,
          name: selectedTrip.name,
          start_date: selectedTrip.startDate || null,
          status: "Planning",
          travel_style: selectedTrip.travelStyle || "balanced"
        }),
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json"
        },
        method: "PATCH"
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(readError(payload, response.status));
      }

      setAvailableTrips((current) =>
        current.map((trip) =>
          trip.id === selectedTrip.id ? { ...trip, destination } : trip
        )
      );
      setConfirmMismatch(false);
      setMessage(`Destination set to ${destination}.`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update trip destination.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
      data-testid={`ai-review-card-${place.id}`}
    >
      {editing ? (
        <form action={saveEdit} className="grid gap-3">
          <input
            className="min-h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-slate-400"
            defaultValue={place.name}
            name="name"
          />
          <select
            className="min-h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-slate-400"
            defaultValue={place.category}
            name="category"
          >
            {[
              "activity",
              "attraction",
              "restaurant",
              "nightlife",
              "shopping",
              "hotel",
              "park",
              "tour",
              "transportation",
              "neighborhood",
              "event"
            ].map((category) => (
              <option key={category} value={category}>
                {category.replace("_", " ")}
              </option>
            ))}
          </select>
          <textarea
            className="min-h-20 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
            defaultValue={place.travelNote || ""}
            name="travelNote"
          />
          <button
            className="inline-flex min-h-10 items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-black text-white disabled:opacity-60"
            disabled={pending}
            type="submit"
          >
            Save
          </button>
        </form>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-[88px_minmax(0,1fr)_auto] sm:items-start">
            <div className="grid aspect-[4/3] place-items-center rounded-2xl bg-gradient-to-br from-slate-100 to-blue-50 text-blue-700">
              <ImageIcon className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="min-w-0 text-lg font-black leading-tight text-slate-950">{place.name}</p>
                {place.reviewReason === "low_confidence" ? (
                  <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-700">
                    Low confidence
                  </span>
                ) : null}
                {place.reviewReason === "needs_location" ? (
                  <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-black text-rose-700">
                    Needs location
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                {place.sourcePlatform} · {place.category} · {Math.round(place.confidence * 100)}%
              </p>
              {place.duplicateOf ? (
                <span className="mt-2 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                  Possible duplicate
                </span>
              ) : null}
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={[
                    "h-full rounded-full",
                    place.reviewReason === "low_confidence" ? "bg-amber-500" : "bg-emerald-500"
                  ].join(" ")}
                  style={{ width: `${Math.max(8, Math.round(place.confidence * 100))}%` }}
                />
              </div>
            </div>
            <button
              aria-label={`Edit ${place.name}`}
              className="rounded-xl bg-white p-2 text-slate-600 transition hover:text-slate-950"
              onClick={() => setEditing(true)}
              type="button"
            >
              <Pencil className="h-4 w-4" />
            </button>
          </div>
          {place.address ? (
            <p className="flex items-start gap-2 text-sm font-semibold text-slate-700">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
              {place.address}
            </p>
          ) : null}
          {place.travelNote ? <p className="text-sm text-slate-600">{place.travelNote}</p> : null}
          {place.evidence.length ? (
            <div className="grid gap-2 rounded-2xl bg-slate-50 px-4 py-3">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                Why Wayline suggested this
              </p>
              <ul className="grid gap-1 text-sm text-slate-600">
                {place.evidence.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {place.reviewReason === "low_confidence" ? (
            <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
              Confirm the name and category before approving this into a draft.
            </p>
          ) : null}
          {place.reviewReason === "needs_location" ? (
            <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
              {isActivityIdea
                ? "Wayline found this as an activity idea. Add a meeting point or provider before it can appear on the map."
                : "Wayline could not map this place yet. Edit the name or add more location detail before creating the trip plan."}
            </p>
          ) : null}
          {destinationMissing ? (
            <div className="grid gap-3 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-900">
              <p>This trip does not have a destination yet. Set a destination before approving AI candidates.</p>
              <div className="flex flex-wrap gap-2">
                {candidateDestination ? (
                  <button
                    className="inline-flex min-h-9 items-center justify-center rounded-xl bg-rose-700 px-3 text-xs font-black text-white disabled:opacity-60"
                    disabled={pending}
                    onClick={() => setSelectedTripDestination(candidateDestination)}
                    type="button"
                  >
                    Set trip destination to {candidateDestination}
                  </button>
                ) : null}
                {inferredTripDestination ? (
                  <button
                    className="inline-flex min-h-9 items-center justify-center rounded-xl bg-white px-3 text-xs font-black text-rose-800 ring-1 ring-rose-200 disabled:opacity-60"
                    disabled={pending}
                    onClick={() => setSelectedTripDestination(inferredTripDestination)}
                    type="button"
                  >
                    Set destination to {inferredTripDestination}
                  </button>
                ) : null}
                {candidateDestination ? (
                  <button
                    className="inline-flex min-h-9 items-center justify-center rounded-xl bg-white px-3 text-xs font-black text-rose-800 ring-1 ring-rose-200 disabled:opacity-60"
                    disabled={pending}
                    onClick={createDestinationTripDraft}
                    type="button"
                  >
                    Create new {candidateDestination} trip draft
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
          {destinationMismatch ? (
            <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
              <p>
                This candidate appears to belong to {candidateDestination || "another destination"}, but the selected trip is {selectedTrip?.destination}.
              </p>
              <label className="mt-3 flex items-start gap-2 text-xs font-black uppercase tracking-[0.12em] text-amber-800">
                <input
                  checked={confirmMismatch}
                  className="mt-0.5"
                  onChange={(event) => setConfirmMismatch(event.target.checked)}
                  type="checkbox"
                />
                Approve into this trip anyway
              </label>
            </div>
          ) : null}
          {!selectedTripId && candidateDestination ? (
            <div className="rounded-2xl bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-900">
              <p>No matching trip found for {candidateDestination}. Create a new {candidateDestination} trip draft or select an existing trip manually.</p>
              <button
                className="mt-3 inline-flex min-h-9 items-center justify-center rounded-xl bg-blue-700 px-3 text-xs font-black text-white disabled:opacity-60"
                disabled={pending}
                onClick={createDestinationTripDraft}
                type="button"
              >
                Create new {candidateDestination} trip draft
              </button>
            </div>
          ) : null}
          <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center">
            <select
              className="min-h-12 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700"
              id={`trip-${place.id}`}
              onChange={(event) => {
                setSelectedTripId(event.target.value);
                setConfirmMismatch(false);
              }}
              value={selectedTripId}
            >
              <option value="">
              {candidateDestination ? `Choose a ${candidateDestination} trip` : "Choose a trip"}
              </option>
              {availableTrips.map((trip) => (
                <option key={trip.id} value={trip.id}>
                  {trip.name} · {isMissingDestination(trip.destination) ? "Destination not set" : trip.destination}
                </option>
              ))}
            </select>
            <button
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-black text-white transition disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 disabled:ring-1 disabled:ring-slate-300"
              disabled={approveDisabled}
              onClick={() => {
                const select = document.getElementById(`trip-${place.id}`) as HTMLSelectElement | null;
                patch({
                  confirmDestinationMismatch: confirmMismatch,
                  status: "accepted",
                  tripId: select?.value || selectedTripId
                });
              }}
              type="button"
            >
              <Check className="h-4 w-4" />
              Approve to draft
            </button>
            {mergeTargets.length ? (
              <div className="grid gap-2 sm:min-w-56">
                <select
                  aria-label={`Merge ${place.name} into duplicate`}
                  className="min-h-12 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700"
                  onChange={(event) => setMergeTargetId(event.target.value)}
                  value={mergeTargetId}
                >
                  {mergeTargets.map((target) => (
                    <option key={target.id} value={target.id}>
                      Merge into {target.name}
                    </option>
                  ))}
                </select>
                <button
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 text-sm font-black text-slate-700 disabled:opacity-60"
                  disabled={pending || !mergeTargetId}
                  onClick={mergeIntoTarget}
                  type="button"
                >
                  <GitMerge className="h-4 w-4" />
                  Merge
                </button>
              </div>
            ) : null}
            <button
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 text-sm font-black text-slate-700 disabled:opacity-60"
              disabled={pending}
              onClick={() => patch({ status: "dismissed" })}
              type="button"
            >
              <X className="h-4 w-4" />
              Dismiss
            </button>
          </div>
        </>
      )}
      {message ? (
        <p aria-live="polite" className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-600">
          {message}
        </p>
      ) : null}
    </div>
  );
}

function findMatchingTrip(
  place: AiReviewItemView,
  trips: TripOption[]
) {
  return trips.find((trip) => tripMatchesPlace(place, trip)) || null;
}

function tripMatchesPlace(
  place: AiReviewItemView,
  trip?: TripOption
) {
  if (!trip) return false;
  if (isMissingDestination(trip.destination)) return false;
  const placeContext = normalizeDestination(
    [place.city, place.locationHint, place.country, place.address].filter(Boolean).join(" ")
  );
  if (!placeContext) return true;
  const tripContext = normalizeDestination(trip.destination || "");
  if (!tripContext) return false;
  const placeTokens = placeContext.split(" ").filter((token) => token.length > 2);
  const tripTokens = tripContext.split(" ").filter((token) => token.length > 2);
  return placeTokens.some((token) => tripTokens.includes(token));
}

function isMissingDestination(value: string | null | undefined) {
  const normalized = normalizeDestination(value || "");
  return !normalized || normalized === "destination not set" || normalized === "not set";
}

function inferDestinationFromTripName(name: string) {
  const cleaned = name
    .replace(/\b(work|business|weekend|family|solo|trip|travel|planner|draft|vacation|holiday)\b/gi, " ")
    .replace(/[^a-zA-Z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const match = cleaned.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/);
  return match?.[0] || "";
}

function normalizeDestination(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isTourOrActivityIdea(place: AiReviewItemView) {
  const text = `${place.category} ${place.name} ${place.travelNote || ""}`.toLowerCase();
  return /\b(tour|activity|experience|excursion|boat tour|guided tour|cruise)\b/.test(text);
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

  return `Request failed (${status}).`;
}
