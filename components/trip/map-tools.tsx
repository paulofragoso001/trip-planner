"use client";

import { ChevronDown, Loader2 } from "lucide-react";
import { useState } from "react";
import { GeneratePlanButton } from "@/components/trip/generate-plan-button";
import { TripSegmentForm } from "@/components/trip/trip-segment-form";
import { waylineCopy } from "@/lib/copy/wayline-copy";

export function MapTools({
  hasMappedStops = false,
  hasUnmappedStops = false,
  tripId
}: {
  hasMappedStops?: boolean;
  hasUnmappedStops?: boolean;
  tripId: string;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  async function shareView() {
    try {
      await window.navigator.clipboard?.writeText(window.location.href);
      setMessage("Map view link copied.");
    } catch {
      setMessage("Map view ready to share.");
    }
  }

  async function retryAllLocations() {
    setRetrying(true);
    setMessage("Retrying location matching...");
    try {
      const response = await fetch(`/api/trips/${tripId}/retry-locations`, {
        headers: { Accept: "application/json" },
        method: "POST"
      });
      if (!response.ok) throw new Error("Location matching is temporarily unavailable.");
      setMessage("Location matching updated. Refreshing...");
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Location matching is temporarily unavailable.");
    } finally {
      setRetrying(false);
    }
  }

  return (
    <div className="mt-4 grid gap-3">
      <GeneratePlanButton context="map" tripId={tripId} />
      {hasUnmappedStops ? (
        <button
          className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-left font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
          disabled={retrying}
          onClick={retryAllLocations}
          type="button"
        >
          {retrying ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Retry all locations
        </button>
      ) : null}
      <details className="group rounded-2xl bg-slate-100 text-left transition open:bg-white open:ring-1 open:ring-slate-200">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-semibold marker:hidden">
          Add trip item
          <ChevronDown className="h-4 w-4 text-slate-500 transition group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="border-t border-slate-200 p-3">
          <TripSegmentForm
            buttonLabel="Save trip item"
            defaultKind="place"
            tripId={tripId}
          />
        </div>
      </details>
      {!hasMappedStops ? (
        <p className="rounded-2xl bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-900">
          {waylineCopy.suggestions.noMappedStops}
        </p>
      ) : null}
      <button
        className="rounded-2xl bg-slate-100 px-4 py-3 text-left font-semibold transition hover:bg-slate-200"
        onClick={shareView}
        type="button"
      >
        Share view
      </button>
      {message ? (
        <p className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-600">
          {message}
        </p>
      ) : null}
    </div>
  );
}
