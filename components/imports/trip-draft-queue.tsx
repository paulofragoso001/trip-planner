"use client";

import { ArrowRight, CalendarDays, Loader2, Map, Route } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { TripDraftView } from "@/app/dashboard/imports/loader";
import { waylineCopy } from "@/lib/copy/wayline-copy";

type TripDraftQueueProps = {
  drafts: TripDraftView[];
};

export function TripDraftQueue({ drafts }: TripDraftQueueProps) {
  const router = useRouter();
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function createTripPlan(draft: TripDraftView) {
    setActiveDraftId(draft.id);
    setMessage(`Creating ${draft.tripName}...`);

    try {
      for (const place of draft.places) {
        const response = await fetch(`/api/extracted-places/${place.id}/promote`, {
          body: JSON.stringify({ tripId: draft.tripId }),
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json"
          },
          method: "POST"
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(readError(payload, response.status));
        }
      }

      const generateResponse = await fetch(`/api/trips/${draft.tripId}/itinerary/generate`, {
        headers: { Accept: "application/json" },
        method: "POST"
      });

      if (!generateResponse.ok) {
        const payload = await generateResponse.json().catch(() => ({}));
        throw new Error(readError(payload, generateResponse.status));
      }

      setMessage("Trip plan created.");
      router.push(`/dashboard/trips/${draft.tripId}/timeline`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create trip plan.");
    } finally {
      setActiveDraftId(null);
    }
  }

  return (
    <section className="rounded-[1.5rem] border border-slate-200 bg-white p-3 shadow-sm sm:rounded-[2rem] sm:p-5">
      <div className="grid gap-3 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">
            Trip plan
          </p>
          <h3 className="mt-1 text-xl font-black tracking-tight text-slate-950">
            Create trip plan
          </h3>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
            Build the confirmed plan when the draft looks right.
          </p>
        </div>
        <span className="inline-flex min-h-9 w-fit items-center rounded-full bg-slate-100 px-3 text-xs font-black text-slate-600">
          {drafts.length} draft{drafts.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="mt-4 grid gap-4">
        {drafts.map((draft) => {
          const pending = activeDraftId === draft.id;

          return (
            <article
              className="grid gap-4 rounded-[1.25rem] border border-slate-200 bg-slate-50 p-3 sm:rounded-3xl sm:p-4"
              key={draft.id}
            >
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                <div>
                  <p className="break-words text-lg font-black text-slate-950">{draft.tripName}</p>
                  <p className="mt-1 break-words text-sm font-semibold text-slate-600">
                    {draft.destination}
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-[auto_auto]">
                  <Link
                    className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-white px-5 text-sm font-black text-slate-800 shadow-sm transition hover:bg-slate-100"
                    href={`/dashboard/trips/${draft.tripId}`}
                  >
                    Edit trip
                  </Link>
                  <button
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={pending}
                    onClick={() => createTripPlan(draft)}
                    type="button"
                  >
                    {pending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ArrowRight className="h-4 w-4" />
                    )}
                    Create Trip Plan
                  </button>
                </div>
              </div>

              <dl className="grid grid-cols-3 gap-2">
                <div className="rounded-2xl bg-white px-3 py-3 sm:px-4">
                  <dt className="flex items-center gap-1.5 text-[0.65rem] font-black uppercase tracking-[0.12em] text-slate-500 sm:gap-2 sm:text-xs sm:tracking-[0.16em]">
                    <Map className="h-3.5 w-3.5" />
                    Places
                  </dt>
                  <dd className="mt-1 text-base font-black text-slate-950 sm:text-lg">
                    {draft.placeCount}
                  </dd>
                </div>
                <div className="rounded-2xl bg-white px-3 py-3 sm:px-4">
                  <dt className="flex items-center gap-1.5 text-[0.65rem] font-black uppercase tracking-[0.12em] text-slate-500 sm:gap-2 sm:text-xs sm:tracking-[0.16em]">
                    <CalendarDays className="h-3.5 w-3.5" />
                    Dates
                  </dt>
                  <dd className="mt-1 break-words text-xs font-black text-slate-950 sm:text-sm">
                    {draft.suggestedDates}
                  </dd>
                </div>
                <div className="rounded-2xl bg-white px-3 py-3 sm:px-4">
                  <dt className="flex items-center gap-1.5 text-[0.65rem] font-black uppercase tracking-[0.12em] text-slate-500 sm:gap-2 sm:text-xs sm:tracking-[0.16em]">
                    <Route className="h-3.5 w-3.5" />
                    Route
                  </dt>
                  <dd className="mt-1 break-words text-xs font-black text-slate-950 sm:text-sm">
                    {draft.routeStatus}
                  </dd>
                </div>
              </dl>

              <div className="grid gap-2">
                {draft.places.slice(0, 4).map((place) => (
                  <div
                    className="rounded-2xl bg-white px-4 py-3 text-sm"
                    key={place.id}
                  >
                    <p className="break-words font-black text-slate-950">{place.name}</p>
                    <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                      {place.category.replace("_", " ")} · {Math.round(place.confidence * 100)}%
                    </p>
                  </div>
                ))}
                {draft.places.length > 4 ? (
                  <p className="px-1 text-xs font-bold text-slate-500">
                    +{draft.places.length - 4} more approved places
                  </p>
                ) : null}
              </div>
            </article>
          );
        })}

        {drafts.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 px-4 py-8 text-sm text-slate-600">
            <p className="font-black text-slate-950">No trip drafts yet.</p>
            <p className="mt-1 max-w-2xl leading-6">
              {waylineCopy.emptyStates.tripDrafts}
            </p>
          </div>
        ) : null}
      </div>

      {message ? (
        <p aria-live="polite" className="mt-4 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">
          {message}
        </p>
      ) : null}
    </section>
  );
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
