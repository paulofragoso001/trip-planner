"use client";

import Link from "next/link";
import { MapPin, MoreHorizontal, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { TimelineItemView } from "@/app/dashboard/trips/[tripId]/timeline/types";
import { AsyncActionButton } from "@/components/dashboard/async-action-button";
import { TripSegmentDeleteButton } from "@/components/trip/trip-segment-delete-button";
import { TripSegmentForm } from "@/components/trip/trip-segment-form";

type ItineraryCardActionsProps = {
  item: TimelineItemView;
  tripId: string;
};

export function ItineraryCardActions({ item, tripId }: ItineraryCardActionsProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const hasMappedLocation = item.lat !== null && item.lng !== null;
  const canRetry =
    item.locationStatus !== "resolved" && item.locationStatus !== "needs_activity_provider";

  useEffect(() => {
    setHydrated(true);
  }, []);

  function handleSaved() {
    setEditing(false);
    router.refresh();
  }

  return (
    <div className="mt-2 border-t border-white/10 pt-2 lg:mt-3 lg:border-slate-100 lg:pt-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          {item.notes ? (
            <button
              aria-expanded={showNotes}
              className="inline-flex min-h-9 max-w-full items-center rounded-full bg-transparent px-0 text-[0.65rem] font-black uppercase tracking-[0.12em] text-slate-400 transition hover:text-white focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:opacity-60 lg:min-h-10 lg:text-xs lg:text-slate-500 lg:hover:text-slate-950"
              disabled={!hydrated}
              onClick={() => setShowNotes((value) => !value)}
              type="button"
            >
              Notes
            </button>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {hasMappedLocation ? (
            <Link
              aria-label={`View ${item.title} on map`}
              className="grid h-9 w-9 place-items-center rounded-full bg-white text-slate-950 shadow-sm transition hover:bg-slate-200 focus:outline-none focus:ring-4 focus:ring-slate-200 lg:h-11 lg:w-11 lg:bg-slate-950 lg:text-white lg:hover:bg-slate-800"
              href={`/dashboard/trips/${tripId}/map#${encodeURIComponent(item.id)}`}
              title="View on map"
            >
              <MapPin className="h-4 w-4" aria-hidden="true" />
            </Link>
          ) : null}
          <button
            aria-expanded={editing}
            aria-label={`Edit ${item.title}`}
            className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-slate-200 shadow-sm transition hover:bg-white/[0.15] focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:opacity-60 lg:h-11 lg:w-11 lg:bg-slate-100 lg:text-slate-700 lg:hover:bg-slate-200"
            disabled={!hydrated}
            onClick={() => setEditing((value) => !value)}
            title="Edit"
            type="button"
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            aria-label={`More actions for ${item.title}`}
            className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-slate-200 shadow-sm transition hover:bg-white/[0.15] focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:opacity-60 lg:h-11 lg:w-11 lg:bg-slate-100 lg:text-slate-700 lg:hover:bg-slate-200"
            disabled={!hydrated}
            type="button"
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {item.notes && showNotes ? (
        <div className="mt-3 break-words rounded-xl bg-white/[0.08] p-3 text-sm leading-6 text-slate-300 ring-1 ring-white/10 lg:bg-slate-50 lg:text-slate-600 lg:ring-0">
          <span className="mb-1 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500 lg:text-slate-400">
            Notes
          </span>
          {item.notes}
        </div>
      ) : null}

      {editing && (canRetry || item.locationStatus === "needs_activity_provider") ? (
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
              href={`/dashboard/trips/${tripId}/ideas`}
            >
              Find suggestions
            </Link>
          ) : null}
        </div>
      ) : null}

      {editing ? (
        <div className="mt-3 rounded-3xl bg-white p-3 text-slate-950 shadow-sm lg:bg-transparent lg:p-0 lg:shadow-none">
          <TripSegmentForm
            buttonLabel="Save changes"
            defaultConfirmationCode={item.confirmationCode}
            defaultEndTime={item.endAt}
            defaultHasEndTime={item.hasEndTime}
            defaultHasStartTime={item.hasStartTime}
            defaultKind={item.kind}
            defaultLat={item.lat}
            defaultLng={item.lng}
            defaultLocation={item.location === "Location not set" ? null : item.location}
            defaultNotes={item.notes}
            defaultProviderMetadata={item.providerMetadata}
            defaultStartTime={item.startAt}
            defaultTitle={item.title}
            includeCoordinates
            onCancel={() => setEditing(false)}
            onSaved={handleSaved}
            segmentId={item.id}
            tripId={tripId}
          />
          <details className="mt-2 rounded-xl bg-slate-50 px-3 py-2">
            <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.12em] text-slate-500">
              More actions
            </summary>
            <div className="mt-3">
              <TripSegmentDeleteButton segmentId={item.id} />
            </div>
          </details>
        </div>
      ) : null}
    </div>
  );
}
