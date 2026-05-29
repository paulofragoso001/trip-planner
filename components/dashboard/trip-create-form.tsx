"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";
import GoogleMapsProvider from "@/components/GoogleMapsProvider";
import LocationAutocomplete, {
  type LocationSelection
} from "@/components/LocationAutocomplete";
import { useWaylineAction } from "@/hooks/use-wayline-action";
import {
  TRIP_TRAVEL_STYLES,
  TRIP_TRAVEL_STYLE_LABELS,
  type TripTravelStyle
} from "@/lib/trips";

export function TripCreateForm() {
  const router = useRouter();
  const [budget, setBudget] = useState("");
  const [destination, setDestination] = useState("");
  const [destinationSelection, setDestinationSelection] =
    useState<LocationSelection | null>(null);
  const [endDate, setEndDate] = useState("");
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [travelStyle, setTravelStyle] = useState<TripTravelStyle>("balanced");
  const { isPending, run, state } = useWaylineAction<{ trip?: { id: string } }>();

  async function createTrip(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload = {
      budget: Number(budget || 0),
      destination,
      destination_formatted_address: destinationSelection?.formattedAddress || null,
      destination_lat: destinationSelection?.lat || null,
      destination_lng: destinationSelection?.lng || null,
      destination_place_id: destinationSelection?.placeId || null,
      destination_provider_metadata: destinationSelection?.providerMetadata || {},
      destination_status: destinationSelection ? "resolved" : "manual",
      end_date: endDate,
      name,
      start_date: startDate,
      travel_style: travelStyle
    };
    const result = await run({
      body: payload,
      method: "POST",
      timeoutMs: 5000,
      url: "/api/trips"
    });

    if (result.status === "success") {
      setBudget("");
      setDestination("");
      setDestinationSelection(null);
      setEndDate("");
      setName("");
      setStartDate("");
      setTravelStyle("balanced");
      router.refresh();
    }
  }

  const message = state.status === "success" ? "Trip saved." : state.message;

  return (
    <form className="mt-5 grid gap-4" id="new-trip" onSubmit={createTrip}>
      <input
        className="rounded-2xl border border-slate-200 px-4 py-3"
        onChange={(event) => setName(event.target.value)}
        placeholder="Trip name"
        required
        value={name}
      />
      <GoogleMapsProvider>
        <LocationAutocomplete
          ariaLabel="Destination"
          inputClassName="w-full rounded-2xl border border-slate-200 px-4 py-3"
          name="destination"
          onInputChange={(value) => {
            setDestination(value);
            setDestinationSelection(null);
          }}
          onSelect={(location) => {
            setDestination(location.address);
            setDestinationSelection(location);
          }}
          placeholder="Destination"
          required
          value={destination}
        />
      </GoogleMapsProvider>
      {destination.trim() && !destinationSelection ? (
        <p className="rounded-2xl bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">
          Destination saved manually. Map and AI matching may work better after selecting a Google result.
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <input
          className="rounded-2xl border border-slate-200 px-4 py-3"
          onChange={(event) => setStartDate(event.target.value)}
          type="date"
          value={startDate}
        />
        <input
          className="rounded-2xl border border-slate-200 px-4 py-3"
          onChange={(event) => setEndDate(event.target.value)}
          type="date"
          value={endDate}
        />
      </div>
      <input
        className="rounded-2xl border border-slate-200 px-4 py-3"
        inputMode="decimal"
        onChange={(event) => setBudget(event.target.value)}
        placeholder="Budget"
        value={budget}
      />
      <select
        className="rounded-2xl border border-slate-200 bg-white px-4 py-3"
        onChange={(event) => setTravelStyle(event.target.value as TripTravelStyle)}
        value={travelStyle}
      >
        {TRIP_TRAVEL_STYLES.map((style) => (
          <option key={style} value={style}>
            {TRIP_TRAVEL_STYLE_LABELS[style]}
          </option>
        ))}
      </select>
      <button
        className="rounded-2xl bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Saving..." : "Save trip"}
      </button>
      {state.status !== "idle" && message ? (
        <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
          {message}
        </p>
      ) : null}
    </form>
  );
}
