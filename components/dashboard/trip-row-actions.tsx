"use client";

import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import GoogleMapsProvider from "@/components/GoogleMapsProvider";
import LocationAutocomplete, {
  type LocationSelection
} from "@/components/LocationAutocomplete";
import { useAlmidyAction } from "@/hooks/use-wayline-action";
import {
  TRIP_TRAVEL_STYLES,
  TRIP_TRAVEL_STYLE_LABELS,
  type TripTravelStyle
} from "@/lib/trips";

type TripRowActionsProps = {
  compact?: boolean;
  destination: string;
  endDate: string | null;
  id: string;
  name: string;
  startDate: string | null;
  travelStyle: TripTravelStyle;
};

export function TripRowActions({
  compact = false,
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
  const { isPending, run, state } = useAlmidyAction();
  const [optimisticDelete, setOptimisticDelete] = useState(false);
  const [pendingIntent, setPendingIntent] = useState<"delete" | "save" | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const wasEditing = editing;
    setPendingIntent("save");
    setEditing(false);

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
      router.refresh();
    } else {
      setEditing(wasEditing);
    }

    setPendingIntent(null);
  }

  async function deleteTrip() {
    setPendingIntent("delete");
    setOptimisticDelete(true);

    const result = await run({
      method: "DELETE",
      timeoutMs: 5000,
      url: `/api/trips/${encodeURIComponent(id)}`
    });

    if (result.status === "success") {
      setConfirmingDelete(false);
      router.refresh();
    } else {
      setOptimisticDelete(false);
    }

    setPendingIntent(null);
  }

  if (optimisticDelete) {
    return (
      <div className={compact ? "grid gap-2" : "mt-3 grid gap-2"}>
        <div
          aria-live="polite"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-100 px-3 text-xs font-bold text-slate-700"
        >
          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
          Deleting trip...
        </div>
        {state.status === "error" || state.status === "timeout" ? (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
            {state.message}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className={compact ? "grid gap-2" : "mt-3 grid gap-2"}>
      <div className={compact ? "flex justify-end" : "grid grid-cols-2 gap-2 sm:flex sm:flex-wrap"}>
        <button
          className={
            compact
              ? "inline-flex min-h-11 items-center justify-center rounded-full bg-slate-100 px-4 text-xs font-black text-slate-700 transition hover:bg-slate-200"
              : "min-h-11 rounded-xl bg-slate-100 px-3 text-xs font-bold text-slate-700"
          }
          aria-busy={isPending && pendingIntent === "save"}
          disabled={isPending}
          onClick={() => setEditing((current) => !current)}
          type="button"
        >
          {editing ? "Close edit" : "Edit"}
        </button>
        {!compact ? (
          confirmingDelete ? (
            <div className="grid gap-2 rounded-xl bg-red-50 p-2 text-xs font-semibold text-red-800">
              <p>Delete this trip and its itinerary?</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  className="min-h-11 rounded-xl bg-white px-3 font-bold text-slate-700 ring-1 ring-red-100 disabled:opacity-60"
                  disabled={isPending}
                  onClick={() => setConfirmingDelete(false)}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  aria-busy={isPending && pendingIntent === "delete"}
                  className="min-h-11 rounded-xl bg-red-600 px-3 font-bold text-white disabled:opacity-60"
                  disabled={isPending}
                  onClick={deleteTrip}
                  type="button"
                >
                  {isPending && pendingIntent === "delete" ? "Deleting..." : "Confirm delete"}
                </button>
              </div>
            </div>
          ) : (
            <button
              className="min-h-11 rounded-xl bg-red-50 px-3 text-xs font-bold text-red-700 disabled:opacity-60"
              disabled={isPending}
              onClick={() => setConfirmingDelete(true)}
              type="button"
            >
              Delete
            </button>
          )
        ) : null}
      </div>
      {isPending && pendingIntent === "save" && !editing ? (
        <p
          aria-live="polite"
          className="inline-flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700"
        >
          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
          Saving changes...
        </p>
      ) : null}
      {editing ? (
        <form className="grid gap-2 rounded-2xl bg-slate-50 p-3" onSubmit={save}>
          <input
            className="min-h-11 rounded-xl border border-slate-200 px-3 text-sm"
            onChange={(event) => setNextName(event.target.value)}
            required
            value={nextName}
          />
          <GoogleMapsProvider>
            <LocationAutocomplete
              ariaLabel="Trip destination"
              inputClassName="w-full min-h-11 rounded-xl border border-slate-200 px-3 text-sm"
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
              className="min-h-11 rounded-xl border border-slate-200 px-3 text-sm"
              onChange={(event) => setNextStartDate(event.target.value)}
              type="date"
              value={nextStartDate}
            />
            <input
              className="min-h-11 rounded-xl border border-slate-200 px-3 text-sm"
              onChange={(event) => setNextEndDate(event.target.value)}
              type="date"
              value={nextEndDate}
            />
          </div>
          <select
            className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"
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
            aria-busy={isPending && pendingIntent === "save"}
            className="min-h-11 rounded-xl bg-blue-600 px-3 text-xs font-bold text-white disabled:opacity-60"
            disabled={isPending}
            type="submit"
          >
            {isPending && pendingIntent === "save" ? "Saving..." : "Save changes"}
          </button>
          {compact ? (
            confirmingDelete ? (
              <div className="grid gap-2 rounded-xl bg-red-50 p-2 text-xs font-semibold text-red-800">
                <p>Delete this trip and its itinerary?</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    className="min-h-11 rounded-xl bg-white px-3 font-bold text-slate-700 ring-1 ring-red-100 disabled:opacity-60"
                    disabled={isPending}
                    onClick={() => setConfirmingDelete(false)}
                    type="button"
                  >
                    Cancel
                  </button>
                  <button
                    aria-busy={isPending && pendingIntent === "delete"}
                    className="min-h-11 rounded-xl bg-red-600 px-3 font-bold text-white disabled:opacity-60"
                    disabled={isPending}
                    onClick={deleteTrip}
                    type="button"
                  >
                    {isPending && pendingIntent === "delete" ? "Deleting..." : "Confirm delete"}
                  </button>
                </div>
              </div>
            ) : (
              <button
                className="min-h-11 rounded-xl bg-red-50 px-3 text-xs font-bold text-red-700 disabled:opacity-60"
                disabled={isPending}
                onClick={() => setConfirmingDelete(true)}
                type="button"
              >
                Delete trip
              </button>
            )
          ) : null}
        </form>
      ) : null}
      {state.status === "error" || state.status === "timeout" ? (
        <p
          aria-live="polite"
          className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700"
        >
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
