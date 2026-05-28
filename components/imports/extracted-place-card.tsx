"use client";

import { Check, GitMerge, ImageIcon, MapPin, Pencil, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AiReviewItemView } from "@/app/dashboard/imports/loader";

type ExtractedPlaceCardProps = {
  mergeTargets?: AiReviewItemView[];
  place: AiReviewItemView;
  trips: Array<{ destination: string | null; id: string; name: string }>;
};

export function ExtractedPlaceCard({ mergeTargets = [], place, trips }: ExtractedPlaceCardProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState("");
  const [mergeTargetId, setMergeTargetId] = useState(mergeTargets[0]?.id || "");
  const [pending, setPending] = useState(false);
  const matchingTrip = findMatchingTrip(place, trips);
  const initialTripId =
    place.tripId && tripMatchesPlace(place, trips.find((trip) => trip.id === place.tripId))
      ? place.tripId
      : matchingTrip?.id || "";
  const [selectedTripId, setSelectedTripId] = useState(initialTripId);
  const [confirmMismatch, setConfirmMismatch] = useState(false);
  const selectedTrip = trips.find((trip) => trip.id === selectedTripId);
  const destinationMismatch = Boolean(selectedTripId && selectedTrip && !tripMatchesPlace(place, selectedTrip));
  const candidateDestination = place.city || place.locationHint || place.country || "";
  const isActivityIdea = isTourOrActivityIdea(place);

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

  return (
    <div className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
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
                ? "Wayline found this as an activity idea, but it needs a meeting point or provider before it can appear on the map."
                : "Wayline could not map this place yet. Edit the name or add more location detail before creating the trip plan."}
            </p>
          ) : null}
          {destinationMismatch ? (
            <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
              <p>
                This candidate appears to belong to {candidateDestination || "another destination"}, but the selected trip is {selectedTrip?.destination || selectedTrip?.name}.
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
              <p>No matching trip found for {candidateDestination}. Create a new trip draft or select an existing trip manually.</p>
              <a className="mt-2 inline-flex text-sm font-black text-blue-700 underline" href="/dashboard/trips#new-trip">
                Create new {candidateDestination} trip draft
              </a>
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
              {trips.map((trip) => (
                <option key={trip.id} value={trip.id}>
                  {trip.name}{trip.destination ? ` · ${trip.destination}` : ""}
                </option>
              ))}
            </select>
            <button
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-black text-white disabled:opacity-60"
              disabled={pending || !selectedTripId || (destinationMismatch && !confirmMismatch)}
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
  trips: Array<{ destination: string | null; id: string; name: string }>
) {
  return trips.find((trip) => tripMatchesPlace(place, trip)) || null;
}

function tripMatchesPlace(
  place: AiReviewItemView,
  trip?: { destination: string | null; id: string; name: string }
) {
  if (!trip) return false;
  const placeContext = normalizeDestination(
    [place.city, place.locationHint, place.country, place.address].filter(Boolean).join(" ")
  );
  if (!placeContext) return true;
  const tripContext = normalizeDestination([trip.destination, trip.name].filter(Boolean).join(" "));
  if (!tripContext) return false;
  const placeTokens = placeContext.split(" ").filter((token) => token.length > 2);
  const tripTokens = tripContext.split(" ").filter((token) => token.length > 2);
  return placeTokens.some((token) => tripTokens.includes(token));
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
