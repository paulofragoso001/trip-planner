"use client";

import Link from "next/link";
import { ArrowRight, Loader2, MapPin, Sparkles } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import GoogleMapsProvider from "@/components/GoogleMapsProvider";
import LocationAutocomplete, {
  type LocationSelection
} from "@/components/LocationAutocomplete";
import { useAlmidyAction } from "@/hooks/use-wayline-action";
import { dashboardActionRoutes } from "@/lib/dashboard/action-routes";

type CreateTripResponse = {
  trip?: { id?: string };
};

export function HomeSmartStart() {
  const [destination, setDestination] = useState("");
  const [destinationSelection, setDestinationSelection] =
    useState<LocationSelection | null>(null);
  const { isPending, run, state } = useAlmidyAction<CreateTripResponse>();
  const canCreate = destination.trim().length > 1 && !isPending;
  const createLabel = isPending ? "Creating..." : "Create trip";

  async function createTrip(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!destination.trim()) {
      return;
    }

    const result = await run({
      body: {
        budget: 0,
        destination,
        destination_formatted_address: destinationSelection?.formattedAddress || null,
        destination_lat: destinationSelection?.lat || null,
        destination_lng: destinationSelection?.lng || null,
        destination_place_id: destinationSelection?.placeId || null,
        destination_provider_metadata: destinationSelection?.providerMetadata || {},
        destination_status: destinationSelection ? "resolved" : "manual",
        end_date: "",
        name: tripNameFromDestination(destination),
        start_date: "",
        travel_style: "balanced"
      },
      method: "POST",
      timeoutMs: 30000,
      url: "/api/trips"
    });

    if (result.status === "success") {
      const tripId = readCreatedTripId(result.data);
      if (tripId) {
        window.location.assign(`/dashboard/trips/${encodeURIComponent(tripId)}`);
      }
    }
  }

  return (
    <form
      className="mt-6 overflow-visible rounded-[1.75rem] border border-white/12 bg-white p-2 text-slate-950 shadow-[0_24px_70px_rgba(2,6,23,0.26)] sm:mt-7 sm:p-3"
      data-testid="home-smart-start"
      onSubmit={createTrip}
    >
      <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-start">
        <label className="grid min-w-0 gap-2 px-2 pb-1 pt-2 sm:px-3">
          <span className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-slate-500">
            <MapPin aria-hidden="true" className="h-3.5 w-3.5 text-blue-600" />
            Where are you headed?
          </span>
          <GoogleMapsProvider>
            <LocationAutocomplete
              ariaLabel="Where are you headed?"
              inputClassName="w-full min-h-12 rounded-2xl border-0 bg-slate-50 px-4 py-3 text-base font-black text-slate-950 outline-none ring-1 ring-slate-200 transition placeholder:text-slate-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
              loadingMessage="Places are loading. You can still type a destination."
              manualWarning="You can create the trip now, or select a suggested place for better maps."
              name="home-destination"
              onInputChange={(value) => {
                setDestination(value);
                setDestinationSelection(null);
              }}
              onSelect={(location) => {
                setDestination(location.address);
                setDestinationSelection(location);
              }}
              placeholder="Search Miami, Tokyo, San Francisco..."
              value={destination}
            />
          </GoogleMapsProvider>
        </label>

        <button
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-45 lg:mt-[2.15rem]"
          data-testid="home-smart-create-trip"
          disabled={!canCreate}
          type="submit"
        >
          {isPending ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : null}
          {createLabel}
          {!isPending ? <ArrowRight aria-hidden="true" className="h-4 w-4" /> : null}
        </button>

        <Link
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 text-sm font-black text-white transition hover:bg-blue-700 lg:mt-[2.15rem]"
          href={dashboardActionRoutes.plan.addIdea}
        >
          <Sparkles aria-hidden="true" className="h-4 w-4" />
          Add idea
        </Link>
      </div>

      <div aria-live="polite" className="px-3 pb-2">
        {destinationSelection ? (
          <p className="text-xs font-black text-emerald-700">Location matched.</p>
        ) : destination.trim() ? (
          <p className="text-xs font-semibold text-amber-700">
            Select a suggestion for better maps, or create manually.
          </p>
        ) : (
          <p className="text-xs font-semibold text-slate-500">
            Create a trip pass now, or add a saved idea first.
          </p>
        )}
        {state.status === "error" || state.status === "timeout" ? (
          <p className="mt-1 text-xs font-semibold text-red-700">{state.message}</p>
        ) : null}
      </div>
    </form>
  );
}

function tripNameFromDestination(value: string) {
  const primary = value.split(",")[0]?.trim();
  return primary ? `${primary} Trip` : "New Trip";
}

function readCreatedTripId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;

  const record = payload as Record<string, unknown>;
  if (typeof record.id === "string") return record.id;

  const trip = record.trip;
  if (trip && typeof trip === "object" && typeof (trip as Record<string, unknown>).id === "string") {
    return (trip as Record<string, string>).id;
  }

  const data = record.data;
  if (data && typeof data === "object") {
    return readCreatedTripId(data);
  }

  return null;
}
