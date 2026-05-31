"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import GoogleMapsProvider from "@/components/GoogleMapsProvider";
import { PlacePhoto } from "@/components/place-photo";
import TripMap, { type TripMapItem } from "@/components/TripMap";
import type { UnmappedMapSegment } from "@/app/dashboard/trips/[tripId]/map/loader";
import { waylineCopy } from "@/lib/copy/wayline-copy";

type ConnectedTripMapProps = {
  destination: string | null;
  items: TripMapItem[];
  searchUrl: string | null;
  tripId: string;
  activitySegments?: UnmappedMapSegment[];
  unmappedCount?: number;
  unmappedSegments?: UnmappedMapSegment[];
};

export function ConnectedTripMap({
  destination,
  items,
  searchUrl,
  tripId,
  activitySegments = [],
  unmappedCount = 0,
  unmappedSegments = []
}: ConnectedTripMapProps) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(items[0]?.id ?? null);
  const [pendingRetry, setPendingRetry] = useState<string | null>(null);
  const [retryMessage, setRetryMessage] = useState<string | null>(null);
  const selectedItem = items.find((item) => item.id === selectedId) ?? items[0];

  async function retryLocation(segmentId: string) {
    setPendingRetry(segmentId);
    setRetryMessage("Retrying location matching...");
    try {
      const response = await fetch(`/api/trip-segments/${segmentId}/retry-location`, {
        headers: { Accept: "application/json" },
        method: "POST"
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(readError(payload, "Location matching is temporarily unavailable."));
      const status = payload?.data?.status;
      setRetryMessage(status === "resolved" ? "Location matched." : "Location still needs attention.");
      router.refresh();
    } catch (error) {
      setRetryMessage(error instanceof Error ? error.message : "Location matching is temporarily unavailable.");
    } finally {
      setPendingRetry(null);
    }
  }

  return (
    <div className="grid h-full min-h-0 gap-4" data-testid="connected-trip-map">
      {items.length ? (
        <GoogleMapsProvider>
          <div className="min-h-[320px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 sm:min-h-[420px]">
            <TripMap
              height="clamp(320px, 58dvh, 520px)"
              items={items}
              selectedId={selectedId}
              onSelect={setSelectedId}
              travelMode="TRANSIT"
            />
          </div>
        </GoogleMapsProvider>
      ) : (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-sm text-slate-600">
          <p className="font-bold text-slate-950">No mapped places yet.</p>
          <p className="mt-1">
            {waylineCopy.emptyStates.map}
          </p>
          {unmappedCount ? (
            <p className="mt-3 rounded-2xl bg-amber-50 px-4 py-3 font-semibold text-amber-800">
              {unmappedCount} place{unmappedCount === 1 ? "" : "s"} need confirmed locations.
            </p>
          ) : null}
          {!unmappedCount && activitySegments.length ? (
            <p className="mt-3 rounded-2xl bg-blue-50 px-4 py-3 font-semibold text-blue-900">
              You have unscheduled activities, but no mapped places yet.
            </p>
          ) : null}
          <div className="mt-4 grid gap-2 sm:flex sm:flex-wrap">
            {unmappedCount ? (
              <RetryAllButton tripId={tripId} />
            ) : null}
            <Link
              className="inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-blue-600 px-4 text-sm font-bold text-white transition hover:bg-blue-700 sm:w-auto"
              href="/dashboard/imports#ai-review"
            >
              Go to AI Review
            </Link>
            <Link
              className="inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-white px-4 text-sm font-bold text-slate-800 ring-1 ring-slate-200 transition hover:bg-slate-100 sm:w-auto"
              href={`/dashboard/trips/${encodeURIComponent(tripId)}/timeline#new-plan`}
            >
              Add location manually
            </Link>
            {searchUrl ? (
              <a
                className="inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-white px-4 text-sm font-bold text-slate-800 ring-1 ring-slate-200 transition hover:bg-slate-100 sm:w-auto"
                href={searchUrl}
                rel="noreferrer"
                target="_blank"
              >
                Search {destination || "destination"}
              </a>
            ) : null}
          </div>
        </div>
      )}

      {items.length && unmappedCount ? (
        <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          Some places need confirmed locations.
        </div>
      ) : null}

      {items.length ? (
        selectedItem ? (
          <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:grid-cols-[96px_minmax(0,1fr)] sm:items-center">
            <PlacePhoto
              alt={selectedItem.imageAlt || `Photo of ${selectedItem.title}`}
              attribution={selectedItem.imageAttribution}
              className="h-28 w-full rounded-2xl sm:h-24 sm:w-24"
              src={selectedItem.imageUrl}
            />
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-600">
                Selected place
              </p>
              <h3 className="mt-1 break-words text-base font-black text-slate-950">
                {selectedItem.title}
              </h3>
            </div>
          </div>
        ) : null
      ) : null}

      {items.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((item, index) => {
            const active = item.id === selectedItem?.id;

            return (
              <button
                aria-current={active ? "true" : undefined}
                className={[
                  "min-h-16 rounded-xl border px-4 py-3 text-left text-sm transition",
                  active
                    ? "border-blue-300 bg-blue-50 text-blue-950"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                ].join(" ")}
                key={item.id}
                onClick={() => setSelectedId(item.id)}
                type="button"
              >
                <span className="flex items-center gap-3">
                  <PlacePhoto
                    alt={item.imageAlt || `Photo of ${item.title}`}
                    attribution={item.imageAttribution}
                    className="h-14 w-14 shrink-0 rounded-xl"
                    src={item.imageUrl}
                  />
                  <span className="min-w-0">
                    <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                      Place {index + 1}
                    </span>
                    <span className="mt-1 block break-words font-semibold">{item.title}</span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      {unmappedSegments.length ? (
        <div className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-3 text-sm sm:p-4">
          <p className="font-black text-slate-950">Needs location</p>
          {unmappedSegments.slice(0, 5).map((segment) => (
            <div className="rounded-xl bg-slate-50 px-3 py-3" key={segment.id}>
              <p className="break-words font-bold text-slate-800">{segment.title}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                {copyForLocationStatus(segment)}
              </p>
              {segment.safeRejectedAddress ? (
                <p className="mt-1 text-xs text-slate-500">
                  Found outside this trip: {segment.safeRejectedAddress}
                </p>
              ) : null}
              <div className="mt-3 grid gap-2 sm:flex sm:flex-wrap">
                <button
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-3 text-xs font-black text-slate-800 ring-1 ring-slate-200 disabled:opacity-60"
                  disabled={Boolean(pendingRetry)}
                  onClick={() => retryLocation(segment.id)}
                  type="button"
                >
                  {pendingRetry === segment.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  Retry location
                </button>
                <Link
                  className="inline-flex min-h-11 items-center justify-center rounded-xl bg-white px-3 text-xs font-black text-slate-800 ring-1 ring-slate-200"
                  href={`/dashboard/trips/${encodeURIComponent(tripId)}/timeline#new-plan`}
                >
                  Add location manually
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {activitySegments.length ? (
        <div className="grid gap-2 rounded-2xl border border-blue-100 bg-blue-50 p-3 text-sm sm:p-4">
          <p className="font-black text-blue-950">Unscheduled activities</p>
          {activitySegments.slice(0, 5).map((segment) => (
            <div className="rounded-xl bg-white/80 px-3 py-3" key={segment.id}>
              <p className="break-words font-bold text-blue-950">{segment.title}</p>
              <p className="mt-1 text-xs font-semibold text-blue-800">
                {waylineCopy.location.activityIdea}
              </p>
              <div className="mt-3 grid gap-2 sm:flex sm:flex-wrap">
                <Link
                  className="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-3 text-xs font-black text-white"
                  href="#smart-suggestions"
                >
                  Find suggestions
                </Link>
                <Link
                  className="inline-flex min-h-11 items-center justify-center rounded-xl bg-white px-3 text-xs font-black text-blue-900 ring-1 ring-blue-100"
                  href={`/dashboard/trips/${encodeURIComponent(tripId)}/timeline#new-plan`}
                >
                  Add meeting point
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {retryMessage ? (
        <p aria-live="polite" className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">
          {retryMessage}
        </p>
      ) : null}
    </div>
  );
}

function RetryAllButton({ tripId }: { tripId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function retryAll() {
    setPending(true);
    try {
      await fetch(`/api/trips/${tripId}/retry-locations`, {
        headers: { Accept: "application/json" },
        method: "POST"
      });
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-bold text-white transition hover:bg-slate-800 disabled:opacity-60 sm:w-auto"
      disabled={pending}
      onClick={retryAll}
      type="button"
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      Retry all locations
    </button>
  );
}

function copyForLocationStatus(segment: UnmappedMapSegment) {
  if (segment.locationStatus === "wrong_city_rejected") {
    return waylineCopy.location.wrongCity;
  }
  if (segment.locationStatus === "provider_failed") {
    return waylineCopy.location.providerFailed;
  }
  if (segment.locationStatus === "manual_location_required") {
    return "Add a confirmed location before this stop appears on the map.";
  }
  return waylineCopy.location.needsLocation;
}

function readError(payload: unknown, fallback: string) {
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
  return fallback;
}
