"use client";

import Link from "next/link";
import { useState } from "react";
import { GeneratePlanButton } from "@/components/trip/generate-plan-button";
import { TripSegmentForm } from "@/components/trip/trip-segment-form";

export function MapTools({ tripId }: { tripId: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [filtersEnabled, setFiltersEnabled] = useState(true);

  async function shareView() {
    try {
      await window.navigator.clipboard?.writeText(window.location.href);
      setMessage("Map view link copied.");
    } catch {
      setMessage("Map view ready to share.");
    }
  }

  return (
    <div className="mt-4 grid gap-3">
      <GeneratePlanButton context="map" tripId={tripId} />
      <Link
        className="rounded-2xl bg-slate-100 px-4 py-3 text-left font-semibold transition hover:bg-slate-200"
        href={`/dashboard/trips/${encodeURIComponent(tripId)}/timeline#new-plan`}
      >
        Add pin
      </Link>
      <TripSegmentForm
        buttonLabel="Save map pin"
        defaultKind="activity"
        includeCoordinates
        tripId={tripId}
      />
      <button
        className="rounded-2xl bg-slate-100 px-4 py-3 text-left font-semibold transition hover:bg-slate-200"
        onClick={() => {
          setFiltersEnabled((current) => !current);
          setMessage(`Stop filters ${filtersEnabled ? "hidden" : "shown"}.`);
        }}
        type="button"
      >
        {filtersEnabled ? "Hide stop filters" : "Show stop filters"}
      </button>
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
