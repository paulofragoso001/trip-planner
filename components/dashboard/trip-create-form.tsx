"use client";

import { useRouter } from "next/navigation";
import { CalendarDays, ImageIcon, MapPin } from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import GoogleMapsProvider from "@/components/GoogleMapsProvider";
import LocationAutocomplete, {
  type LocationSelection
} from "@/components/LocationAutocomplete";
import {
  MobileFormShell
} from "@/components/ui/mobile-form";
import { useAlmidyAction } from "@/hooks/use-wayline-action";
import { countryCodeFromDestinationText } from "@/lib/map/wayline-map-pins";
import {
  TRIP_TRAVEL_STYLES,
  TRIP_TRAVEL_STYLE_LABELS,
  type TripFormInitialData,
  type TripFormPayload,
  type TripTravelStyle
} from "@/lib/trips";

type TripCreateFormProps = {
  formId?: string;
  initialData?: TripFormInitialData;
  mode?: "default" | "mobile-pass";
  redirectOnSuccess?: boolean;
  successRedirectHref?: string;
};

export function TripCreateForm({
  formId = "new-trip",
  initialData,
  mode = "default",
  redirectOnSuccess = false,
  successRedirectHref
}: TripCreateFormProps) {
  const router = useRouter();
  const [budget, setBudget] = useState(() =>
    initialData?.expense_budget == null ? "" : String(initialData.expense_budget)
  );
  const [destination, setDestination] = useState(() => initialData?.destination || "");
  const [destinationSelection, setDestinationSelection] = useState<LocationSelection | null>(() =>
    locationSelectionFromInitialData(initialData)
  );
  const [endDate, setEndDate] = useState(() => initialData?.end_date || "");
  const [hydrated, setHydrated] = useState(false);
  const [name, setName] = useState(() => initialData?.trip_name || "");
  const [startDate, setStartDate] = useState(() => initialData?.start_date || "");
  const [travelStyle, setTravelStyle] = useState<TripTravelStyle>(
    () => initialData?.travel_style || "balanced"
  );
  const { isPending, run, state } = useAlmidyAction<{ trip?: { id: string } }>();
  const mobilePassMode = mode === "mobile-pass";
  const previewDates = formatPreviewDates(startDate, endDate);
  const selectedCountryCode = countryCodeFromSelection(destinationSelection, destination);
  const canCreate = Boolean(
    name.trim() &&
      destination.trim() &&
      !isPending &&
      (!mobilePassMode || (destinationSelection && selectedCountryCode))
  );

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!initialData) return;

    setBudget(initialData.expense_budget == null ? "" : String(initialData.expense_budget));
    setDestination(initialData.destination || "");
    setDestinationSelection(locationSelectionFromInitialData(initialData));
    setEndDate(initialData.end_date || "");
    setName(initialData.trip_name || "");
    setStartDate(initialData.start_date || "");
    setTravelStyle(initialData.travel_style || "balanced");
  }, [initialData]);

  async function createTrip(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const budgetValue = budget.trim() ? Number(budget) : null;
    const mobilePayload = mobilePassMode
      ? buildTripFormPayload({
          budgetValue,
          destination,
          destinationSelection,
          endDate,
          name,
          startDate,
          travelStyle
        })
      : null;

    if (mobilePassMode && !mobilePayload) {
      return;
    }

    const payload = mobilePassMode
      ? {
          ...mobilePayload,
          destination_formatted_address: destinationSelection?.formattedAddress || null,
          destination_place_id: destinationSelection?.placeId || null
        }
      : {
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
      url: mobilePassMode ? "/api/v1/trips" : "/api/trips"
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
        window.location.assign(successRedirectHref || `/dashboard/trips/${encodeURIComponent(tripId)}`);
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
        className="flex min-h-0 flex-col"
        data-hydrated={hydrated ? "true" : "false"}
        data-testid="mobile-trip-create-form"
        id={formId}
        onSubmit={createTrip}
      >
        <MobileFormShell
          className="relative -mx-3 flex max-h-[calc(100dvh-1.25rem)] min-h-[calc(100dvh-5.75rem)] flex-col overflow-hidden rounded-[2.15rem] border-white/10 bg-[#807867] shadow-[0_28px_80px_rgba(0,0,0,0.42)] sm:-mx-4"
          data-testid="mobile-trip-create-sheet"
        >
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-[27rem] bg-[linear-gradient(180deg,rgba(0,0,0,0.02)_0%,rgba(91,82,64,0.22)_58%,#807867_100%),url('https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=80')] bg-cover bg-center"
          />
          <div className="pointer-events-none absolute inset-x-0 top-[21rem] h-44 bg-gradient-to-b from-transparent via-[#807867]/90 to-[#807867]" />

          <div className="relative z-10 flex min-h-0 flex-1 flex-col">
            <div className="flex shrink-0 items-center justify-between px-5 pt-5">
              <a
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/55 bg-white/70 px-5 text-[1.38rem] font-semibold text-black shadow-[0_10px_28px_rgba(0,0,0,0.18)] backdrop-blur-xl transition hover:bg-white/85 focus:outline-none focus:ring-4 focus:ring-white/30"
                href="/dashboard"
              >
                Cancel
              </a>
              <button
                aria-busy={isPending}
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-orange-500 px-7 text-[1.35rem] font-bold text-white shadow-[0_12px_32px_rgba(249,115,22,0.34)] transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-65"
                disabled={!canCreate}
                type="submit"
              >
                {isPending ? "Creating..." : "Create Trip"}
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain pb-[calc(7rem+env(safe-area-inset-bottom))] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <section className="flex min-h-[35rem] flex-col items-center justify-center px-5 pb-16 pt-80 text-center text-white">
                <label className="grid w-full max-w-[22rem] gap-2">
                  <span className="sr-only">Trip name</span>
                  <input
                    aria-label="Trip name"
                    className="w-full border-0 bg-transparent p-0 text-center text-[3rem] font-semibold leading-none tracking-normal text-white outline-none placeholder:text-white/72 focus:ring-0 min-[390px]:text-[3.45rem]"
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Trip name"
                    required
                    value={name}
                  />
                </label>
                <p className="mt-5 text-2xl font-bold text-white">
                  {previewDates === "Add dates when you are ready" ? "No date set" : previewDates}
                </p>
                <div className="mt-9 grid w-full max-w-[23rem] grid-cols-[1fr_auto_1fr] items-center gap-8 text-white/78">
                  <button
                    className="grid place-items-center gap-2 text-white/78"
                    onClick={() => document.getElementById("trip-dates")?.focus()}
                    type="button"
                  >
                    <CalendarDays className="h-9 w-9 text-white/60" aria-hidden="true" />
                    <span className="text-xl font-medium">Set Dates</span>
                  </button>
                  <div className="h-20 w-px bg-white/42" />
                  <button
                    className="grid place-items-center gap-2 text-white/78"
                    type="button"
                  >
                    <ImageIcon className="h-9 w-9 text-white/60" aria-hidden="true" />
                    <span className="text-xl font-medium">Background</span>
                  </button>
                </div>
              </section>

              <section className="px-6 pb-7">
                <div className="overflow-hidden rounded-[2rem] border border-white/46 bg-white/16 shadow-[0_18px_55px_rgba(0,0,0,0.20)] backdrop-blur-xl">
                  <div className="grid gap-2 border-b border-white/18 px-5 py-5">
                    <span className="inline-flex items-center gap-2 text-[0.7rem] font-extrabold uppercase tracking-[0.28em] text-white/58">
                      <MapPin className="h-4 w-4" aria-hidden="true" />
                      Destination
                    </span>
                    <GoogleMapsProvider>
                      <LocationAutocomplete
                        ariaLabel="Destination"
                        inputClassName="min-h-10 w-full min-w-0 border-0 bg-transparent p-0 text-[1.35rem] font-semibold leading-tight text-white outline-none placeholder:text-white/48 focus:ring-0"
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
                    <span className="text-sm font-semibold leading-6 text-white/82">
                      {destination.trim() && !destinationSelection
                        ? "Select a suggested destination to pin this trip on the map."
                        : destinationSelection
                          ? "Destination matched for maps and planning."
                          : "Choose a Google Places result so Almidy can pin the trip correctly."}
                    </span>
                  </div>

                  <label className="grid gap-2 border-b border-white/18 px-5 py-4">
                    <span className="text-[0.68rem] font-extrabold uppercase tracking-[0.28em] text-white/52">
                      Start date
                    </span>
                    <input
                      aria-label="Start date"
                      className="min-h-10 w-full min-w-0 border-0 bg-transparent p-0 text-[1.2rem] font-semibold leading-tight text-white outline-none placeholder:text-white/44 focus:ring-0"
                      id="trip-dates"
                      onChange={(event) => setStartDate(event.target.value)}
                      type="date"
                      value={startDate}
                    />
                  </label>
                  <label className="grid gap-2 border-b border-white/18 px-5 py-4">
                    <span className="text-[0.68rem] font-extrabold uppercase tracking-[0.28em] text-white/52">
                      End date
                    </span>
                    <input
                      aria-label="End date"
                      className="min-h-10 w-full min-w-0 border-0 bg-transparent p-0 text-[1.2rem] font-semibold leading-tight text-white outline-none placeholder:text-white/44 focus:ring-0"
                      onChange={(event) => setEndDate(event.target.value)}
                      type="date"
                      value={endDate}
                    />
                  </label>
                  <label className="grid gap-2 border-b border-white/18 px-5 py-4">
                    <span className="text-[0.68rem] font-extrabold uppercase tracking-[0.28em] text-white/52">
                      Expense budget
                    </span>
                    <input
                      aria-label="Expense budget"
                      className="min-h-10 w-full min-w-0 border-0 bg-transparent p-0 text-[1.2rem] font-semibold leading-tight text-white outline-none placeholder:text-white/44 focus:ring-0"
                      inputMode="decimal"
                      onChange={(event) => setBudget(event.target.value)}
                      placeholder="Optional"
                      value={budget}
                    />
                  </label>
                  <label className="grid gap-2 px-5 py-4">
                    <span className="text-[0.68rem] font-extrabold uppercase tracking-[0.28em] text-white/52">
                      Travel style
                    </span>
                    <select
                      aria-label="Travel style"
                      className="min-h-10 w-full min-w-0 border-0 bg-transparent p-0 text-[1.2rem] font-semibold leading-tight text-white outline-none focus:ring-0"
                      onChange={(event) => setTravelStyle(event.target.value as TripTravelStyle)}
                      value={travelStyle}
                    >
                      {TRIP_TRAVEL_STYLES.map((style) => (
                        <option className="bg-[#807867] text-white" key={style} value={style}>
                          {TRIP_TRAVEL_STYLE_LABELS[style]}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {state.status !== "idle" && message ? (
                  <p
                    aria-live="polite"
                    className={`mt-4 rounded-2xl px-4 py-3 text-sm font-semibold ring-1 ${messageTone}`}
                  >
                    {message}
                  </p>
                ) : null}
              </section>
            </div>
          </div>
        </MobileFormShell>
      </form>
    );
  }

  return (
    <form
      className="mt-5 grid gap-4"
      data-hydrated={hydrated ? "true" : "false"}
      id={formId}
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
          Location matched. Almidy can use this destination for AI review and map planning.
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
        aria-busy={isPending}
        className="min-h-12 rounded-2xl bg-blue-600 px-4 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Saving..." : mobilePassMode ? "Create Trip" : "Save trip"}
      </button>
      {state.status !== "idle" && message ? (
        <p
          aria-live="polite"
          className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600"
        >
          {message}
        </p>
      ) : null}
    </form>
  );
}

function buildTripFormPayload({
  budgetValue,
  destination,
  destinationSelection,
  endDate,
  name,
  startDate,
  travelStyle
}: {
  budgetValue: number | null;
  destination: string;
  destinationSelection: LocationSelection | null;
  endDate: string;
  name: string;
  startDate: string;
  travelStyle: TripTravelStyle;
}): TripFormPayload | null {
  if (!destinationSelection) return null;

  const countryCode = countryCodeFromSelection(destinationSelection, destination);
  if (!countryCode) return null;

  return {
    country_code: countryCode,
    destination: destination.trim(),
    destination_lat: destinationSelection.lat,
    destination_lng: destinationSelection.lng,
    end_date: endDate || "",
    expense_budget: Number.isFinite(budgetValue) ? budgetValue : null,
    start_date: startDate || "",
    travel_style: travelStyle,
    trip_name: name.trim()
  };
}

function countryCodeFromSelection(
  destinationSelection: LocationSelection | null,
  destination: string
) {
  const metadataCountryCode = destinationSelection?.providerMetadata?.countryCode;
  if (typeof metadataCountryCode === "string" && /^[a-z]{2}$/i.test(metadataCountryCode)) {
    return metadataCountryCode.toUpperCase();
  }

  return countryCodeFromDestinationText(
    [
      destinationSelection?.formattedAddress,
      destinationSelection?.address,
      destinationSelection?.name,
      destination
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function locationSelectionFromInitialData(
  initialData: TripFormInitialData | null | undefined
): LocationSelection | null {
  if (
    !initialData ||
    typeof initialData.destination_lat !== "number" ||
    typeof initialData.destination_lng !== "number"
  ) {
    return null;
  }

  return {
    address: initialData.destination || "",
    formattedAddress: initialData.destination_formatted_address || initialData.destination || null,
    lat: initialData.destination_lat,
    lng: initialData.destination_lng,
    placeId: initialData.destination_place_id || null,
    providerMetadata: initialData.country_code
      ? { countryCode: initialData.country_code }
      : {}
  };
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
