"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
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
import { buildPlacePhotoUrl } from "@/lib/travel-data/photo-url";

type TripCreateFormProps = {
  mode?: "default" | "mobile-pass";
  redirectOnSuccess?: boolean;
};

export function TripCreateForm({
  mode = "default",
  redirectOnSuccess = false
}: TripCreateFormProps) {
  const router = useRouter();
  const [budget, setBudget] = useState("");
  const [destination, setDestination] = useState("");
  const [destinationSelection, setDestinationSelection] =
    useState<LocationSelection | null>(null);
  const [endDate, setEndDate] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [travelStyle, setTravelStyle] = useState<TripTravelStyle>("balanced");
  const { isPending, run, state } = useWaylineAction<{ trip?: { id: string } }>();
  const mobilePassMode = mode === "mobile-pass";
  const previewImageUrl = buildPlacePhotoUrl(destinationSelection?.providerMetadata, 800);
  const previewDestination = destination.trim() || "Choose destination";
  const previewName = name.trim() || destinationNameFromLabel(previewDestination);
  const previewDates = formatPreviewDates(startDate, endDate);

  useEffect(() => {
    setHydrated(true);
  }, []);

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
      timeoutMs: 30000,
      url: "/api/trips"
    });

    if (result.status === "success") {
      const tripId = readCreatedTripId(result.data);
      setBudget("");
      setDestination("");
      setDestinationSelection(null);
      setEndDate("");
      setName("");
      setStartDate("");
      setTravelStyle("balanced");
      if (redirectOnSuccess && tripId) {
        window.location.assign(`/dashboard/trips/${encodeURIComponent(tripId)}`);
        return;
      }
      router.refresh();
    }
  }

  const message = state.status === "success" ? "Trip saved." : state.message;

  return (
    <form
      className={mobilePassMode ? "grid gap-4" : "mt-5 grid gap-4"}
      data-hydrated={hydrated ? "true" : "false"}
      data-testid={mobilePassMode ? "mobile-trip-create-form" : undefined}
      id="new-trip"
      onSubmit={createTrip}
    >
      {mobilePassMode ? (
        <div
          className="relative isolate min-h-[21rem] overflow-hidden rounded-[2rem] bg-slate-950 p-4 text-white shadow-2xl"
          data-testid="mobile-trip-create-preview"
        >
          {previewImageUrl ? (
            <img
              alt={`Photo of ${previewDestination}`}
              className="absolute inset-0 h-full w-full object-cover"
              src={previewImageUrl}
            />
          ) : (
            <div className={previewGradientForDestination(previewDestination)} aria-hidden="true" />
          )}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(255,255,255,0.24),transparent_34%),linear-gradient(135deg,rgba(2,6,23,0.18),rgba(2,6,23,0.84))]" />
          <div className="relative flex h-full min-h-[19rem] flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-black">
              <a
                className="rounded-full bg-white/14 px-3 py-2 text-white backdrop-blur"
                href="/dashboard"
              >
                Cancel
              </a>
              <button
                className="rounded-full bg-white px-4 py-2 text-slate-950 shadow-sm disabled:opacity-60"
                disabled={isPending}
                type="submit"
              >
                {isPending ? "Creating..." : "Create Trip"}
              </button>
            </div>
            <div className="text-center">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-white/60">
                Trip Pass
              </p>
              <h2 className="mt-3 break-words text-4xl font-black leading-none">
                {previewName}
              </h2>
              <p className="mt-3 text-sm font-bold text-white/78">{previewDates}</p>
              <a
                className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full bg-white/14 px-4 text-sm font-black text-white ring-1 ring-white/20 backdrop-blur"
                href="#trip-dates"
              >
                Change Dates
              </a>
            </div>
            <p className="text-center text-xs font-semibold text-white/62">
              {destinationSelection ? "Destination matched" : "Select a destination to update the pass image."}
            </p>
          </div>
        </div>
      ) : null}
      <label className="grid gap-2 text-sm font-black text-slate-800">
        Trip name
        <input
          className="min-h-12 rounded-2xl border border-slate-200 px-4 py-3 font-semibold outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
          onChange={(event) => setName(event.target.value)}
          placeholder="Miami weekend"
          required
          value={name}
        />
      </label>
      <div className="grid gap-2 text-sm font-black text-slate-800">
        <span>Destination</span>
        <GoogleMapsProvider>
          <LocationAutocomplete
            ariaLabel="Destination"
            inputClassName="w-full min-h-12 rounded-2xl border border-slate-200 px-4 py-3 font-semibold outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
            name="destination"
            onInputChange={(value) => {
              setDestination(value);
              setDestinationSelection(null);
            }}
            onSelect={(location) => {
              setDestination(location.address);
              setDestinationSelection(location);
            }}
            placeholder="Search Miami, Barcelona, Tokyo..."
            required
            value={destination}
          />
        </GoogleMapsProvider>
      </div>
      {destination.trim() && !destinationSelection ? (
        <p className="rounded-2xl bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">
          Destination saved manually. Map and AI matching may work better after selecting a Google result.
        </p>
      ) : null}
      {destinationSelection ? (
        <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-xs font-black text-emerald-800">
          Location matched. Wayline can use this destination for AI review and map planning.
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-black text-slate-800">
          Start date
          <input
            className="min-h-12 rounded-2xl border border-slate-200 px-4 py-3 font-semibold outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
            id={mobilePassMode ? "trip-dates" : undefined}
            onChange={(event) => setStartDate(event.target.value)}
            type="date"
            value={startDate}
          />
        </label>
        <label className="grid gap-2 text-sm font-black text-slate-800">
          End date
          <input
            className="min-h-12 rounded-2xl border border-slate-200 px-4 py-3 font-semibold outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
            onChange={(event) => setEndDate(event.target.value)}
            type="date"
            value={endDate}
          />
        </label>
      </div>
      <label className="grid gap-2 text-sm font-black text-slate-800">
        Expense budget
        <input
          className="min-h-12 rounded-2xl border border-slate-200 px-4 py-3 font-semibold outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
          inputMode="decimal"
          onChange={(event) => setBudget(event.target.value)}
          placeholder="Optional"
          value={budget}
        />
      </label>
      <label className="grid gap-2 text-sm font-black text-slate-800">
        Travel style
        <select
          className="min-h-12 rounded-2xl border border-slate-200 bg-white px-4 py-3 font-semibold outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
          onChange={(event) => setTravelStyle(event.target.value as TripTravelStyle)}
          value={travelStyle}
        >
          {TRIP_TRAVEL_STYLES.map((style) => (
            <option key={style} value={style}>
              {TRIP_TRAVEL_STYLE_LABELS[style]}
            </option>
          ))}
        </select>
      </label>
      <button
        className="min-h-12 rounded-2xl bg-blue-600 px-4 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Saving..." : mobilePassMode ? "Create Trip" : "Save trip"}
      </button>
      {state.status !== "idle" && message ? (
        <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
          {message}
        </p>
      ) : null}
    </form>
  );
}

function readCreatedTripId(payload: unknown) {
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

function destinationNameFromLabel(value: string) {
  const primary = value.split(",")[0]?.trim();
  return primary && primary !== "Choose destination" ? `${primary} Trip` : "New Trip";
}

function formatPreviewDates(startDate: string, endDate: string) {
  if (!startDate && !endDate) return "Add dates when you are ready";
  if (startDate && !endDate) return formatDate(startDate);
  if (!startDate && endDate) return formatDate(endDate);
  return `${formatDate(startDate)} - ${formatDate(endDate)}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    timeZone: "UTC"
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function previewGradientForDestination(destination: string) {
  const value = destination.toLowerCase();
  if (value.includes("miami")) {
    return "absolute inset-0 bg-[linear-gradient(135deg,#0f766e,#2563eb_46%,#f97316)]";
  }
  if (value.includes("barcelona")) {
    return "absolute inset-0 bg-[linear-gradient(135deg,#7c2d12,#1d4ed8_52%,#f59e0b)]";
  }
  if (value.includes("new york")) {
    return "absolute inset-0 bg-[linear-gradient(135deg,#111827,#334155_45%,#7f1d1d)]";
  }
  return "absolute inset-0 bg-[linear-gradient(135deg,#172554,#0f766e_55%,#111827)]";
}
