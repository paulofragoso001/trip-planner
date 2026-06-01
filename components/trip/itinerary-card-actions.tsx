"use client";

import Link from "next/link";
import { MapPin, Pencil } from "lucide-react";
import { useState } from "react";
import type { TimelineItemView } from "@/app/dashboard/trips/[tripId]/timeline/types";
import { AsyncActionButton } from "@/components/dashboard/async-action-button";
import { TripSegmentDeleteButton } from "@/components/trip/trip-segment-delete-button";
import { TripSegmentForm } from "@/components/trip/trip-segment-form";

type ItineraryCardActionsProps = {
  item: TimelineItemView;
  tripId: string;
};

export function ItineraryCardActions({ item, tripId }: ItineraryCardActionsProps) {
  const [editing, setEditing] = useState(false);
  const hasMappedLocation = item.lat !== null && item.lng !== null;
  const canRetry =
    item.locationStatus !== "resolved" && item.locationStatus !== "needs_activity_provider";

  return (
    <div className="mt-3 border-t border-slate-100 pt-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {item.notes ? (
            <details>
              <summary className="cursor-pointer text-sm font-bold text-slate-700">
                Notes
              </summary>
              <p className="mt-2 break-words rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-600">
                {item.notes}
              </p>
            </details>
          ) : (
            <p className="min-h-11 py-3 text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
              Notes
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {hasMappedLocation ? (
            <Link
              aria-label={`View ${item.title} on map`}
              className="grid h-11 w-11 place-items-center rounded-full bg-slate-950 text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-200"
              href={`/dashboard/trips/${tripId}/map#${encodeURIComponent(item.id)}`}
              title="View on map"
            >
              <MapPin className="h-4 w-4" aria-hidden="true" />
            </Link>
          ) : null}
          <button
            aria-expanded={editing}
            aria-label={`${editing ? "Close edit" : "Edit"} ${item.title}`}
            className="grid h-11 w-11 place-items-center rounded-full bg-slate-100 text-slate-700 shadow-sm transition hover:bg-slate-200 focus:outline-none focus:ring-4 focus:ring-blue-100"
            onClick={() => setEditing((current) => !current)}
            title={editing ? "Close edit" : "Edit"}
            type="button"
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {canRetry || item.locationStatus === "needs_activity_provider" ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {canRetry ? (
            <AsyncActionButton
              endpoint={`/api/trip-segments/${item.id}/retry-location`}
              successMessage="Location matching updated."
            >
              Retry location
            </AsyncActionButton>
          ) : null}
          {item.locationStatus === "needs_activity_provider" ? (
            <Link
              className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-blue-50 px-4 text-sm font-bold text-blue-700 transition hover:bg-blue-100"
              href={`/dashboard/trips/${tripId}/map#smart-suggestions`}
            >
              Find suggestions
            </Link>
          ) : null}
        </div>
      ) : null}

      {editing ? (
        <div className="mt-3 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <TripSegmentForm
            buttonLabel="Save edits"
            defaultEndTime={item.endAt}
            defaultKind={item.kind}
            defaultLat={item.lat}
            defaultLng={item.lng}
            defaultLocation={item.location === "Location not set" ? null : item.location}
            defaultNotes={item.notes}
            defaultStartTime={item.startAt}
            defaultTitle={item.title}
            includeCoordinates
            segmentId={item.id}
            tripId={tripId}
          />
          <TripSegmentDeleteButton segmentId={item.id} />
        </div>
      ) : null}
    </div>
  );
}
