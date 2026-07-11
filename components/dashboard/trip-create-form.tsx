"use client";

import { useRouter } from "next/navigation";
import { CalendarDays, ImageIcon } from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import GoogleMapsProvider from "@/components/GoogleMapsProvider";
import { AppleLocationAutocomplete } from "@/components/AppleLocationAutocomplete";
import LocationAutocomplete, {
  type LocationSelection
} from "@/components/LocationAutocomplete";
import {
  MobileFormShell
} from "@/components/ui/mobile-form";
import { useAlmidyAction } from "@/hooks/use-wayline-action";
import { countryCodeFromDestinationText } from "@/lib/map/wayline-map-pins";
import { isNativeCapacitorRuntime } from "@/lib/native/capacitor-runtime";
import { buildPlacePhotoUrl } from "@/lib/travel-data/photo-url";
import {
  TRIP_TRAVEL_STYLES,
  TRIP_TRAVEL_STYLE_LABELS,
  type TripFormInitialData,
  type TripFormPayload,
  type TripTravelStyle
} from "@/lib/trips";

type DestinationInputSource = "initial" | "name" | "manual" | "selected";

export type WalletLayer = "myTrips" | "createTrip" | "datePicker" | "backgroundPicker";

export type TripDraft = {
  name: string;
  startDate: string | null;
  endDate: string | null;
  backgroundImageUrl: string | null;
  backgroundColor: string | null;
  destinationMetadata?: unknown;
};

type TripCreateFormProps = {
  draft?: TripDraft;
  formId?: string;
  initialData?: TripFormInitialData;
  mode?: "default" | "mobile-pass";
  onCancel?: () => void;
  onDraftChange?: (draft: TripDraft) => void;
  onOpenBackgroundPicker?: () => void;
  onOpenDatePicker?: () => void;
  redirectOnSuccess?: boolean;
  successRedirectHref?: string;
};

export function TripCreateForm({
  draft,
  formId = "new-trip",
  initialData,
  mode = "default",
  onCancel,
  onDraftChange,
  onOpenBackgroundPicker,
  onOpenDatePicker,
  redirectOnSuccess = false,
  successRedirectHref
}: TripCreateFormProps) {
  const router = useRouter();
  const [budget, setBudget] = useState(() =>
    initialData?.expense_budget == null ? "" : String(initialData.expense_budget)
  );
  const [customHeroImageUrl, setCustomHeroImageUrl] = useState(() => draft?.backgroundImageUrl || "");
  const [destination, setDestination] = useState(() => initialData?.destination || "");
  const [destinationInputSource, setDestinationInputSource] = useState<DestinationInputSource>(
    () => initialData?.destination ? "initial" : "name"
  );
  const [destinationSelection, setDestinationSelection] = useState<LocationSelection | null>(() =>
    locationSelectionFromInitialData(initialData)
  );
  const [endDate, setEndDate] = useState(() => draft?.endDate || initialData?.end_date || "");
  const [hydrated, setHydrated] = useState(false);
  const [name, setName] = useState(() => draft?.name || initialData?.trip_name || "");
  const [startDate, setStartDate] = useState(() => draft?.startDate || initialData?.start_date || "");
  const [travelStyle, setTravelStyle] = useState<TripTravelStyle>(
    () => initialData?.travel_style || "balanced"
  );
  const [useAppleAutocomplete, setUseAppleAutocomplete] = useState(false);
  const { isPending, run, state } = useAlmidyAction<{ trip?: { id: string } }>();
  const mobilePassMode = mode === "mobile-pass";
  const previewDates = formatPreviewDates(startDate, endDate);
  const selectedCountryCode = countryCodeFromSelection(destinationSelection, destination);
  const destinationPreviewLabel = destinationPreviewText(destinationSelection, destination, name);
  const heroImageUrl = customHeroImageUrl || tripHeroImageUrl(destinationSelection, destinationPreviewLabel);
  const heroBackgroundColor = draft?.backgroundColor || "#807867";
  const canCreate = Boolean(
    name.trim() &&
      destination.trim() &&
      !isPending &&
      (!mobilePassMode || (destinationSelection && selectedCountryCode))
  );

  useEffect(() => {
    setUseAppleAutocomplete(
      isNativeCapacitorRuntime() || window.matchMedia("(pointer: coarse)").matches
    );
  }, []);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!draft) return;

    setName(draft.name);
    setStartDate(draft.startDate || "");
    setEndDate(draft.endDate || "");
    setCustomHeroImageUrl(draft.backgroundImageUrl || "");
  }, [draft]);

  useEffect(() => {
    return () => {
      if (customHeroImageUrl.startsWith("blob:")) {
        URL.revokeObjectURL(customHeroImageUrl);
      }
    };
  }, [customHeroImageUrl]);

  useEffect(() => {
    if (!initialData) return;

    setBudget(initialData.expense_budget == null ? "" : String(initialData.expense_budget));
    setDestination(initialData.destination || "");
    setDestinationInputSource(initialData.destination ? "initial" : "name");
    setDestinationSelection(locationSelectionFromInitialData(initialData));
    setEndDate(initialData.end_date || "");
    setName(initialData.trip_name || "");
    setStartDate(initialData.start_date || "");
    setTravelStyle(initialData.travel_style || "balanced");
  }, [initialData]);

  useEffect(() => {
    if (!mobilePassMode || initialData) {
      return;
    }

    const inferredDates = inferDatesFromTripName(name);
    setStartDate(inferredDates.startDate);
    setEndDate(inferredDates.endDate);
    updateDraft({
      endDate: inferredDates.endDate || null,
      startDate: inferredDates.startDate || null
    });

    if (destinationInputSource !== "name") {
      return;
    }

    const inferredDestination = inferDestinationFromTripName(name);
    setDestination(inferredDestination);
    setDestinationSelection(null);

    if (!inferredDestination || typeof window === "undefined") {
      return;
    }

    let active = true;
    const timer = window.setTimeout(async () => {
      const resolvedLocation = await resolveLocationFromQuery(inferredDestination);
      if (!active || !resolvedLocation) {
        return;
      }

      setDestination(resolvedLocation.address);
      setDestinationSelection(resolvedLocation);
    }, 450);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [destinationInputSource, initialData, mobilePassMode, name]);

  function updateDraft(nextValues: Partial<TripDraft>) {
    if (!draft || !onDraftChange) {
      return;
    }

    onDraftChange({
      ...draft,
      name,
      startDate: startDate || null,
      endDate: endDate || null,
      backgroundImageUrl: customHeroImageUrl || null,
      backgroundColor: draft.backgroundColor,
      ...nextValues
    });
  }

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
      setCustomHeroImageUrl("");
      updateDraft({
        backgroundColor: null,
        backgroundImageUrl: null,
        endDate: null,
        name: "",
        startDate: null
      });
      setDestination("");
      setDestinationInputSource("name");
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

  function cancelMobileCreate() {
    if (onCancel) {
      onCancel();
      return;
    }

    window.location.assign("/dashboard");
  }

  if (mobilePassMode) {
    return (
      <form
        className="flex min-h-0 flex-col outline-none focus:outline-none focus-visible:outline-none"
        data-hydrated={hydrated ? "true" : "false"}
        data-testid="mobile-trip-create-form"
        id={formId}
        onSubmit={createTrip}
      >
        <MobileFormShell
          className="relative mx-auto flex h-[calc(100dvh-0.75rem)] min-h-[38rem] w-full max-w-[31rem] flex-col overflow-hidden rounded-[2.15rem] border-0 bg-[#807867] shadow-[0_28px_80px_rgba(0,0,0,0.42)] outline-none"
          data-testid="mobile-trip-create-sheet"
        >
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{ backgroundColor: heroBackgroundColor }}
          />
          {heroImageUrl ? (
            <img
              alt=""
              aria-hidden="true"
              className="absolute inset-x-0 top-0 h-[27rem] w-full object-cover transition-opacity duration-500"
              src={heroImageUrl}
            />
          ) : null}
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-[27rem]"
            style={{
              background: `linear-gradient(180deg,rgba(0,0,0,0.02)_0%,rgba(91,82,64,0.22)_58%,${heroBackgroundColor}_100%)`
            }}
          />
          <div
            className="pointer-events-none absolute inset-x-0 top-[21rem] h-44"
            style={{
              background: `linear-gradient(180deg,transparent,${heroBackgroundColor}E6,${heroBackgroundColor})`
            }}
          />

          <div className="relative z-10 flex min-h-0 flex-1 flex-col">
            <div className="flex shrink-0 items-center justify-between px-5 pt-[calc(env(safe-area-inset-top)+1rem)]">
              <button
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/55 bg-white/70 px-5 text-[1.38rem] font-semibold text-black shadow-[0_10px_28px_rgba(0,0,0,0.18)] backdrop-blur-xl transition hover:bg-white/85 focus:outline-none focus:ring-4 focus:ring-white/30"
                onClick={cancelMobileCreate}
                type="button"
              >
                Cancel
              </button>
              <button
                aria-busy={isPending}
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-orange-500 px-7 text-[1.35rem] font-bold text-white shadow-[0_12px_32px_rgba(249,115,22,0.34)] transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-65"
                disabled={!canCreate}
                type="submit"
              >
                {isPending ? "Creating..." : "Create Trip"}
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-hidden">
              <section className="flex h-full flex-col items-center justify-center px-5 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-20 text-center text-white">
                <label className="grid w-full max-w-[22rem] gap-2">
                  <span className="sr-only">Trip name</span>
                  <input
                    aria-label="Trip name"
                    className="w-full border-0 bg-transparent p-0 text-center text-[3rem] font-semibold leading-none tracking-normal text-white outline-none placeholder:text-white/72 focus:ring-0 min-[390px]:text-[3.45rem]"
                    onChange={(event) => {
                      const nextName = event.target.value;
                      setName(nextName);
                      updateDraft({ name: nextName });
                      if (destinationInputSource === "initial" && !destinationSelection) {
                        setDestinationInputSource("name");
                      }
                    }}
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
                    onClick={onOpenDatePicker}
                    type="button"
                  >
                    <CalendarDays className="h-9 w-9 text-white/60" aria-hidden="true" />
                    <span className="text-xl font-medium">Set Dates</span>
                  </button>
                  <div className="h-20 w-px bg-white/42" />
                  <button
                    className="grid place-items-center gap-2 text-white/78"
                    onClick={onOpenBackgroundPicker}
                    type="button"
                  >
                    <ImageIcon className="h-9 w-9 text-white/60" aria-hidden="true" />
                    <span className="text-xl font-medium">Background</span>
                  </button>
                </div>
                <p className="mt-8 max-w-[19rem] text-sm font-semibold leading-6 text-white/72">
                  Type a destination in the trip name, like Miami weekend or Paris Sep 12-15.
                </p>
                <div className="mt-5 grid w-full max-w-[22rem] gap-2 text-left">
                  <label className="text-xs font-black uppercase tracking-[0.14em] text-white/70" htmlFor="mobile-trip-destination">
                    Destination
                  </label>
                  {useAppleAutocomplete ? (
                    <AppleLocationAutocomplete
                      ariaLabel="Destination"
                      id="mobile-trip-destination"
                      inputClassName="min-h-12 w-full rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-base font-semibold text-white outline-none placeholder:text-white/50 focus:border-white/40 focus:ring-4 focus:ring-orange-300/20"
                      name="destination"
                      onInputChange={(value) => {
                        setDestination(value);
                        setDestinationInputSource("manual");
                        setDestinationSelection(null);
                      }}
                      onSelect={(location) => {
                        setDestination(location.address);
                        setDestinationInputSource("selected");
                        setDestinationSelection(location);
                      }}
                      placeholder="Search Miami, Barcelona, Tokyo..."
                      required
                      value={destination}
                    />
                  ) : (
                    <GoogleMapsProvider>
                      <LocationAutocomplete
                        ariaLabel="Destination"
                        inputClassName="min-h-12 w-full rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-base font-semibold text-white outline-none placeholder:text-white/50 focus:border-white/40 focus:ring-4 focus:ring-orange-300/20"
                        name="destination"
                        onInputChange={(value) => {
                          setDestination(value);
                          setDestinationInputSource("manual");
                          setDestinationSelection(null);
                        }}
                        onSelect={(location) => {
                          setDestination(location.address);
                          setDestinationInputSource("selected");
                          setDestinationSelection(location);
                        }}
                        placeholder="Search Miami, Barcelona, Tokyo..."
                        required
                        value={destination}
                      />
                    </GoogleMapsProvider>
                  )}
                </div>
              </section>
              {state.status !== "idle" && message ? (
                <p
                  aria-live="polite"
                  className={`absolute inset-x-5 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-20 rounded-2xl px-4 py-3 text-sm font-semibold ring-1 ${messageTone}`}
                >
                  {message}
                </p>
              ) : null}
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
        {useAppleAutocomplete ? (
          <AppleLocationAutocomplete
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
        ) : (
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
        )}
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

function destinationPreviewText(
  destinationSelection: LocationSelection | null,
  destination: string,
  name: string
) {
  return (
    destinationSelection?.name ||
    destinationSelection?.formattedAddress ||
    destinationSelection?.address ||
    inferDestinationFromTripName(name) ||
    destination.trim() ||
    "travel destination"
  );
}

function tripHeroImageUrl(
  destinationSelection: LocationSelection | null,
  locationText: string
) {
  const placePhotoUrl = buildPlacePhotoUrl(destinationSelection?.providerMetadata, 1200);
  if (placePhotoUrl) {
    return placePhotoUrl;
  }

  return "";
}

function inferDestinationFromTripName(value: string) {
  const normalized = value
    .replace(/[“”]/g, "\"")
    .replace(/[‘’]/g, "'")
    .trim();

  if (!normalized) {
    return "";
  }

  const patterns = [
    /\b(?:trip|travel|vacation|holiday|getaway|weekend|honeymoon|visit|journey)\s+(?:to|in|at|for)\s+(.+)$/i,
    /^(.+?)\s+(?:trip|travel|vacation|holiday|getaway|weekend|honeymoon|journey)$/i,
    /^(.+?)\s+(?:itinerary|adventure|escape)$/i
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    const candidate = cleanDestinationCandidate(match?.[1] || "");
    if (candidate) {
      return candidate;
    }
  }

  return cleanDestinationCandidate(normalized);
}

function cleanDestinationCandidate(value: string) {
  return value
    .replace(/\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+\d{1,2}(?:\s*(?:-|to|through|until)\s*(?:\w+\.?\s*)?\d{1,2})?\b/gi, " ")
    .replace(/\b\d{4}-\d{2}-\d{2}(?:\s*(?:-|to|through|until)\s*\d{4}-\d{2}-\d{2})?\b/g, " ")
    .replace(/\b(?:my|our|the|a|an|first|next|new|summer|winter|spring|fall|autumn)\b/gi, " ")
    .replace(/[|/\\()[\]{}]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function inferDatesFromTripName(value: string) {
  const normalized = value.replace(/[–—]/g, "-");
  const isoRange = normalized.match(
    /\b(\d{4}-\d{2}-\d{2})(?:\s*(?:-|to|through|until)\s*(\d{4}-\d{2}-\d{2}))?\b/i
  );

  if (isoRange) {
    return {
      endDate: isoRange[2] || "",
      startDate: isoRange[1]
    };
  }

  const monthRange = normalized.match(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{1,2})(?:\s*(?:-|to|through|until)\s*(?:(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s*)?(\d{1,2}))?/i
  );

  if (!monthRange) {
    return { endDate: "", startDate: "" };
  }

  const currentYear = new Date().getFullYear();
  const startMonthIndex = monthIndexFromName(monthRange[1]);
  const endMonthIndex = monthIndexFromName(monthRange[3] || monthRange[1]);
  const startDate = dateInputValue(currentYear, startMonthIndex, Number(monthRange[2]));
  const endDate = monthRange[4]
    ? dateInputValue(currentYear, endMonthIndex, Number(monthRange[4]))
    : "";

  return { endDate, startDate };
}

function monthIndexFromName(value: string) {
  const key = value.toLowerCase().slice(0, 3);
  return ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(key);
}

function dateInputValue(year: number, monthIndex: number, day: number) {
  if (monthIndex < 0 || day < 1 || day > 31) {
    return "";
  }

  const date = new Date(Date.UTC(year, monthIndex, day));
  if (date.getUTCMonth() !== monthIndex || date.getUTCDate() !== day) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

async function resolveLocationFromQuery(query: string): Promise<LocationSelection | null> {
  const serverResolvedLocation = await resolveLocationFromServer(query);
  if (serverResolvedLocation) {
    return serverResolvedLocation;
  }

  const places = await waitForGooglePlaces();

  if (!places?.AutocompleteSuggestion?.fetchAutocompleteSuggestions) {
    return null;
  }

  try {
    const response = await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
      input: query
    });
    const prediction = response.suggestions.find((suggestion) => suggestion.placePrediction)?.placePrediction;

    if (!prediction) {
      return null;
    }

    const place = prediction.toPlace();
    const { place: resolvedPlace } = await place.fetchFields({
      fields: ["id", "displayName", "formattedAddress", "location", "types", "googleMapsURI", "photos"]
    });

    return locationSelectionFromGooglePlace(
      resolvedPlace,
      prediction.mainText?.text || prediction.text?.text || query
    );
  } catch {
    return null;
  }
}

async function resolveLocationFromServer(query: string): Promise<LocationSelection | null> {
  try {
    const response = await fetch("/api/travel-data/resolve-place", {
      body: JSON.stringify({
        address: null,
        city: null,
        country: null,
        locationHint: null,
        name: query
      }),
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json"
      },
      method: "POST"
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    const resolved = payload?.data?.resolved;
    const inventoryItem = resolved?.inventoryItem;
    const lat = readNumber(resolved?.latitude ?? inventoryItem?.latitude);
    const lng = readNumber(resolved?.longitude ?? inventoryItem?.longitude);
    const address = readString(resolved?.address) || readString(inventoryItem?.address) || query;

    if (typeof lat !== "number" || typeof lng !== "number") {
      return null;
    }

    const metadata = isRecord(inventoryItem?.metadata) ? inventoryItem.metadata : {};
    const title = readString(inventoryItem?.title) || query;

    return {
      address,
      formattedAddress: readString(inventoryItem?.address) || address,
      lat,
      lng,
      name: title,
      placeId: readString(resolved?.placeId) || readString(inventoryItem?.providerItemId),
      providerMetadata: {
        ...metadata,
        address,
        formattedAddress: readString(inventoryItem?.address) || address,
        formatted_address: readString(inventoryItem?.address) || address,
        imageAlt: readString(inventoryItem?.imageAlt) || metadata.imageAlt || `Photo of ${title}`,
        imageAttribution: readString(inventoryItem?.imageAttribution) || metadata.imageAttribution || null,
        imageProvider: readString(inventoryItem?.imageProvider) || metadata.imageProvider || null,
        name: title,
        provider: resolved?.provider || inventoryItem?.provider || "google_places",
        providerPlaceId: readString(resolved?.placeId) || readString(inventoryItem?.providerItemId) || metadata.providerPlaceId || null,
        source: "trip_name_server_resolution"
      }
    };
  } catch {
    return null;
  }
}

async function waitForGooglePlaces() {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    if (window.google?.maps?.places?.AutocompleteSuggestion) {
      return window.google.maps.places;
    }

    await new Promise((resolve) => window.setTimeout(resolve, 250));
  }

  return window.google?.maps?.places;
}

function locationSelectionFromGooglePlace(
  place: google.maps.places.Place,
  fallbackName: string
): LocationSelection | null {
  const lat = readGoogleCoordinate(place.location || undefined, "lat");
  const lng = readGoogleCoordinate(place.location || undefined, "lng");
  const address = place.formattedAddress || place.displayName || fallbackName;
  const primaryPhoto = readGooglePlacePhoto(place);

  if (!address || typeof lat !== "number" || typeof lng !== "number") {
    return null;
  }

  return {
    address,
    formattedAddress: place.formattedAddress || null,
    lat,
    lng,
    name: place.displayName || fallbackName,
    placeId: place.id || null,
    providerMetadata: {
      address,
      formattedAddress: place.formattedAddress || null,
      formatted_address: place.formattedAddress || null,
      googleMapsUri: place.googleMapsURI || null,
      imageAlt: `Photo of ${place.displayName || fallbackName}`,
      imageAttribution: primaryPhoto.attribution,
      imageProvider: primaryPhoto.name ? "Google" : null,
      name: place.displayName || fallbackName,
      primaryPhotoAttributions: primaryPhoto.authorAttributions,
      primaryPhotoName: primaryPhoto.name,
      provider: "google_places",
      providerPlaceId: place.id || null,
      source: "trip_name_autocomplete",
      types: place.types || []
    }
  };
}

function readGoogleCoordinate(
  location: { lat?: number | (() => number); lng?: number | (() => number) } | undefined,
  key: "lat" | "lng"
) {
  const value = location?.[key];

  return typeof value === "function" ? value() : value;
}

function readNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function readGooglePlacePhoto(place: google.maps.places.Place) {
  const photos = Array.isArray(place.photos) ? place.photos : [];
  const primaryPhoto = photos[0] as
    | {
        authorAttributions?: unknown;
        name?: string;
      }
    | undefined;

  return {
    attribution: formatGooglePhotoAttribution(primaryPhoto?.authorAttributions),
    authorAttributions: primaryPhoto?.authorAttributions || null,
    name: typeof primaryPhoto?.name === "string" ? primaryPhoto.name.replace(/\/media$/, "") : null
  };
}

function formatGooglePhotoAttribution(value: unknown) {
  if (!Array.isArray(value)) {
    return null;
  }

  const labels = value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const record = item as Record<string, unknown>;
      return typeof record.displayName === "string"
        ? record.displayName
        : typeof record.name === "string"
          ? record.name
          : null;
    })
    .filter((item): item is string => Boolean(item));

  return labels.length ? labels.join(", ") : null;
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
