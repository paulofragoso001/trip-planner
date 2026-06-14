"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import GoogleMapsProvider from "@/components/GoogleMapsProvider";
import LocationAutocomplete, {
  type LocationSelection
} from "@/components/LocationAutocomplete";
import {
  MobileField,
  MobileFormHeader,
  MobileFormSection,
  MobileFormShell,
  mobileInputClassName,
  mobilePrimaryActionClassName,
  mobileSecondaryActionClassName,
  mobileSelectClassName
} from "@/components/ui/mobile-form";
import { useWaylineAction } from "@/hooks/use-wayline-action";
import {
  TRIP_TRAVEL_STYLES,
  TRIP_TRAVEL_STYLE_LABELS,
  type TripTravelStyle
} from "@/lib/trips";

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
  const previewDates = formatPreviewDates(startDate, endDate);
  const canCreate = Boolean(name.trim() && destination.trim() && !isPending);

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
      timeoutMs: mobilePassMode ? 60000 : 30000,
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
  const messageTone =
    state.status === "success"
      ? "bg-emerald-400/12 text-emerald-100 ring-emerald-300/20 lg:bg-emerald-50 lg:text-emerald-700 lg:ring-transparent"
      : state.status === "error" || state.status === "timeout"
        ? "bg-red-400/12 text-red-100 ring-red-300/20 lg:bg-red-50 lg:text-red-700 lg:ring-transparent"
        : "bg-white/[0.06] text-white/70 ring-white/10 lg:bg-slate-50 lg:text-slate-600 lg:ring-transparent";

  if (mobilePassMode) {
    return (
      <form
        className="grid gap-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
        data-hydrated={hydrated ? "true" : "false"}
        data-testid="mobile-trip-create-form"
        id="new-trip"
        onSubmit={createTrip}
      >
        <MobileFormShell data-testid="mobile-trip-create-sheet">
          <MobileFormHeader
            leftAction={
              <a className={mobileSecondaryActionClassName} href="/dashboard">
                Cancel
              </a>
            }
            rightAction={
              <button
                className={mobilePrimaryActionClassName}
                disabled={!canCreate}
                type="submit"
              >
                {isPending ? "Creating..." : "Create"}
              </button>
            }
            subtitle={previewDates}
            title="Create Trip"
          />

          <MobileFormSection title="Trip">
            <MobileField label="Trip name">
              <input
                aria-label="Trip name"
                className={mobileInputClassName}
                onChange={(event) => setName(event.target.value)}
                placeholder="Miami weekend"
                required
                value={name}
              />
            </MobileField>
            <MobileField
              helper={
                destination.trim() && !destinationSelection
                  ? "Manual destination. Select a Google result for better maps."
                  : destinationSelection
                    ? "Destination matched for maps and planning."
                    : null
              }
              label="Destination"
            >
              <GoogleMapsProvider>
                <LocationAutocomplete
                  ariaLabel="Destination"
                  inputClassName={mobileInputClassName}
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
            </MobileField>
          </MobileFormSection>

          <MobileFormSection title="Dates">
            <MobileField label="Start date">
              <input
                aria-label="Start date"
                className={mobileInputClassName}
                id="trip-dates"
                onChange={(event) => setStartDate(event.target.value)}
                type="date"
                value={startDate}
              />
            </MobileField>
            <MobileField label="End date">
              <input
                aria-label="End date"
                className={mobileInputClassName}
                onChange={(event) => setEndDate(event.target.value)}
                type="date"
                value={endDate}
              />
            </MobileField>
          </MobileFormSection>

          <MobileFormSection title="Details">
            <MobileField label="Expense budget">
              <input
                aria-label="Expense budget"
                className={mobileInputClassName}
                inputMode="decimal"
                onChange={(event) => setBudget(event.target.value)}
                placeholder="Optional"
                value={budget}
              />
            </MobileField>
            <MobileField label="Travel style">
              <select
                aria-label="Travel style"
                className={mobileSelectClassName}
                onChange={(event) => setTravelStyle(event.target.value as TripTravelStyle)}
                value={travelStyle}
              >
                {TRIP_TRAVEL_STYLES.map((style) => (
                  <option className="bg-[#1f1f21] text-white" key={style} value={style}>
                    {TRIP_TRAVEL_STYLE_LABELS[style]}
                  </option>
                ))}
              </select>
            </MobileField>
          </MobileFormSection>

          {state.status !== "idle" && message ? (
            <div className="px-4 pb-4">
              <p className={`rounded-2xl px-4 py-3 text-sm font-semibold ring-1 ${messageTone}`}>
                {message}
              </p>
            </div>
          ) : null}
        </MobileFormShell>
      </form>
    );
  }

  return (
    <form
      className="mt-5 grid gap-4"
      data-hydrated={hydrated ? "true" : "false"}
      id="new-trip"
      onSubmit={createTrip}
    >
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
