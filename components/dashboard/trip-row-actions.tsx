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

type TripRowActionsProps = {
  destination: string;
  endDate: string | null;
  id: string;
  name: string;
  startDate: string | null;
  travelStyle: TripTravelStyle;
};

export function TripRowActions({
  destination,
  endDate,
  id,
  name,
  startDate,
  travelStyle
}: TripRowActionsProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [nextDestination, setNextDestination] = useState(destination);
  const [nextDestinationSelection, setNextDestinationSelection] =
    useState<LocationSelection | null>(null);
  const [nextEndDate, setNextEndDate] = useState(endDate || "");
  const [nextName, setNextName] = useState(name);
  const [nextStartDate, setNextStartDate] = useState(startDate || "");
  const [nextTravelStyle, setNextTravelStyle] =
    useState<TripTravelStyle>(travelStyle);
  const { isPending, run, state } = useWaylineAction();

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await run({
      body: {
        destination: nextDestination,
        destination_formatted_address: nextDestinationSelection?.formattedAddress || null,
        destination_lat: nextDestinationSelection?.lat || null,
        destination_lng: nextDestinationSelection?.lng || null,
        destination_place_id: nextDestinationSelection?.placeId || null,
        destination_provider_metadata: nextDestinationSelection?.providerMetadata || {},
        destination_status: nextDestinationSelection ? "resolved" : "manual",
        end_date: nextEndDate,
        name: nextName,
        start_date: nextStartDate,
        travel_style: nextTravelStyle
      },
      method: "PATCH",
      timeoutMs: 5000,
      url: `/api/trips/${encodeURIComponent(id)}`
    });

    if (result.status === "success") {
      setEditing(false);
      router.refresh();
    }
  }

  async function deleteTrip() {
    const result = await run({
      method: "DELETE",
      timeoutMs: 5000,
      url: `/api/trips/${encodeURIComponent(id)}`
    });

    if (result.status === "success") {
      router.refresh();
    }
  }

  return (
    <div className="mt-3 grid gap-2">
      <div className="flex flex-wrap gap-2">
        <button
          className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700"
          onClick={() => setEditing((current) => !current)}
          type="button"
        >
          {editing ? "Close edit" : "Edit"}
        </button>
        <button
          className="rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700 disabled:opacity-60"
          disabled={isPending}
          onClick={deleteTrip}
          type="button"
        >
          {isPending ? "Working..." : "Delete"}
        </button>
      </div>
      {editing ? (
        <form className="grid gap-2 rounded-2xl bg-slate-50 p-3" onSubmit={save}>
          <input
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            onChange={(event) => setNextName(event.target.value)}
            required
            value={nextName}
          />
          <GoogleMapsProvider>
            <LocationAutocomplete
              ariaLabel="Trip destination"
              inputClassName="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              onInputChange={(value) => {
                setNextDestination(value);
                setNextDestinationSelection(null);
              }}
              onSelect={(location) => {
                setNextDestination(location.address);
                setNextDestinationSelection(location);
              }}
              placeholder="Destination"
              required
              value={nextDestination}
            />
          </GoogleMapsProvider>
          {nextDestination.trim() && !nextDestinationSelection ? (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
              Destination saved manually. Map and AI matching may work better after selecting a Google result.
            </p>
          ) : null}
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              onChange={(event) => setNextStartDate(event.target.value)}
              type="date"
              value={nextStartDate}
            />
            <input
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              onChange={(event) => setNextEndDate(event.target.value)}
              type="date"
              value={nextEndDate}
            />
          </div>
          <select
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            onChange={(event) =>
              setNextTravelStyle(event.target.value as TripTravelStyle)
            }
            value={nextTravelStyle}
          >
            {TRIP_TRAVEL_STYLES.map((style) => (
              <option key={style} value={style}>
                {TRIP_TRAVEL_STYLE_LABELS[style]}
              </option>
            ))}
          </select>
          <button
            className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
            disabled={isPending}
            type="submit"
          >
            {isPending ? "Saving..." : "Save changes"}
          </button>
        </form>
      ) : null}
      {state.status === "error" ? (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
