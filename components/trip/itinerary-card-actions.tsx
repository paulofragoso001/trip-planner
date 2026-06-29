"use client";

import Link from "next/link";
import { ExternalLink, MapPin, MoreHorizontal, Pencil } from "lucide-react";
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
  const [showExternalMaps, setShowExternalMaps] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const hasMappedLocation = item.lat !== null && item.lng !== null;
  const canRetry =
    item.locationStatus !== "resolved" && item.locationStatus !== "needs_activity_provider";
  const placeDisplay = placeDisplayForTimelineItem(item);
  const mapDisplay = placeDisplay || {
    address: item.location === "Location not set" ? null : item.location,
    name: item.title
  };
  const externalMaps = hasMappedLocation
    ? externalMapTargets({
        address: mapDisplay.address,
        lat: item.lat,
        lng: item.lng,
        name: mapDisplay.name
      })
    : null;

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    function openFromHash() {
      const hash = decodeURIComponent(window.location.hash.replace(/^#/, ""));
      if (hash === item.id) {
        setEditing(true);
        document.getElementById(item.id)?.scrollIntoView({ block: "center" });
      }
    }

    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, [item.id]);

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
              aria-label={`View ${mapDisplay.name} on map`}
              className="grid h-9 w-9 place-items-center rounded-full bg-white text-slate-950 shadow-sm transition hover:bg-slate-200 focus:outline-none focus:ring-4 focus:ring-slate-200 lg:h-11 lg:w-11 lg:bg-slate-950 lg:text-white lg:hover:bg-slate-800"
              href={`/dashboard/trips/${tripId}/map#${encodeURIComponent(item.id)}`}
              title="Route inside Almidy"
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
          <div className="relative">
            <button
              aria-expanded={showExternalMaps}
              aria-label={`Open external maps for ${mapDisplay.name}`}
              className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-slate-200 shadow-sm transition hover:bg-white/[0.15] focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:opacity-60 lg:h-11 lg:w-11 lg:bg-slate-100 lg:text-slate-700 lg:hover:bg-slate-200"
              disabled={!hydrated || !externalMaps}
              onClick={() => setShowExternalMaps((value) => !value)}
              title="Open in maps"
              type="button"
            >
              <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
            </button>
            {showExternalMaps && externalMaps ? (
              <div
                className="absolute right-0 top-[calc(100%+0.5rem)] z-[80] w-52 overflow-hidden rounded-2xl border border-white/10 bg-[#121214]/98 p-1.5 text-sm font-black text-white shadow-2xl backdrop-blur-2xl lg:border-slate-200 lg:bg-white lg:text-slate-950"
                data-testid="external-map-menu"
              >
                <a
                  className="flex min-h-11 items-center gap-2 rounded-xl px-3 py-2 transition hover:bg-white/10 lg:hover:bg-slate-50"
                  href={externalMaps.google}
                  rel="noreferrer"
                  target="_blank"
                  onClick={() => setShowExternalMaps(false)}
                >
                  <ExternalLink className="h-4 w-4 text-orange-400" aria-hidden="true" />
                  Google Maps
                </a>
                <a
                  className="flex min-h-11 items-center gap-2 rounded-xl px-3 py-2 transition hover:bg-white/10 lg:hover:bg-slate-50"
                  href={externalMaps.apple}
                  rel="noreferrer"
                  target="_blank"
                  onClick={() => setShowExternalMaps(false)}
                >
                  <ExternalLink className="h-4 w-4 text-orange-400" aria-hidden="true" />
                  Apple Maps
                </a>
              </div>
            ) : null}
          </div>
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

      {placeDisplay ? (
        <div
          className="mt-3 rounded-xl bg-white/[0.06] p-3 text-sm leading-5 text-slate-300 ring-1 ring-white/10 lg:bg-slate-50 lg:text-slate-600 lg:ring-0"
          data-testid="timeline-place-metadata"
        >
          <span className="mb-1 block text-[0.65rem] font-black uppercase tracking-[0.14em] text-slate-500 lg:text-slate-400">
            Google place
          </span>
          <p className="break-words font-black text-white lg:text-slate-950">{placeDisplay.name}</p>
          {placeDisplay.address ? (
            <p className="mt-1 break-words text-xs font-semibold text-slate-400 lg:text-slate-500">
              {placeDisplay.address}
            </p>
          ) : null}
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
        <div className="mt-3 text-white lg:rounded-3xl lg:bg-transparent lg:p-0 lg:text-slate-950 lg:shadow-none">
          <TripSegmentForm
            buttonLabel="Save changes"
            defaultConfirmationCode={item.confirmationCode}
            defaultEndTime={item.endAt}
            defaultHasEndTime={item.hasEndTime}
            defaultHasStartTime={item.hasStartTime}
            defaultKind={item.kind}
            defaultLat={item.lat}
            defaultLng={item.lng}
            defaultLocation={placeDisplay?.address || (item.location === "Location not set" ? null : item.location)}
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
          <details className="mt-2 rounded-xl bg-white/[0.06] px-3 py-2 ring-1 ring-white/8 lg:bg-slate-50 lg:ring-0">
            <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.12em] text-white/60 lg:text-slate-500">
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

function placeDisplayForTimelineItem(item: TimelineItemView) {
  const metadata = isRecord(item.providerMetadata) ? item.providerMetadata : {};
  const name = readMetadataString(metadata, ["name", "displayName", "placeName"]);
  const address = readMetadataString(metadata, ["formattedAddress", "formatted_address", "address"]);

  if (!name && !address) return null;

  const normalizedTitle = item.title.trim().toLowerCase();
  const normalizedLocation = item.location.trim().toLowerCase();
  const normalizedName = name?.toLowerCase();
  const normalizedAddress = address?.toLowerCase();

  if (
    (!name || normalizedName === normalizedTitle) &&
    (!address || normalizedAddress === normalizedLocation)
  ) {
    return null;
  }

  return {
    address: address || null,
    name: name || item.title
  };
}

function externalMapTargets({
  address,
  lat,
  lng,
  name
}: {
  address: string | null;
  lat: number | null;
  lng: number | null;
  name: string;
}) {
  if (typeof lat !== "number" || typeof lng !== "number") return null;

  const coords = `${lat},${lng}`;
  const query = address || name || coords;

  return {
    apple: `https://maps.apple.com/?q=${encodeURIComponent(query)}&ll=${coords}`,
    google: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
  };
}

function readMetadataString(metadata: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
