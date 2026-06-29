"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import GoogleMapsProvider from "@/components/GoogleMapsProvider";
import LocationAutocomplete, {
  type LocationSelection
} from "@/components/LocationAutocomplete";
import {
  mobileInputClassName,
  mobilePrimaryActionClassName,
  mobileSecondaryActionClassName,
  mobileSelectClassName,
  mobileTextareaClassName
} from "@/components/ui/mobile-form";
import { useAlmidyAction } from "@/hooks/use-wayline-action";
import {
  isRouteKind,
  normalizeRouteMode,
  readTripSegmentRoute,
  routeEndpointLabel,
  routeLocationLabel,
  type TripRouteEndpoint
} from "@/lib/trip-segment-route";

type TripSegmentFormProps = {
  buttonLabel?: string;
  defaultConfirmationCode?: string | null;
  defaultEndTime?: string | null;
  defaultKind?: string;
  defaultLat?: number | null;
  defaultLng?: number | null;
  defaultLocation?: string | null;
  defaultNotes?: string | null;
  defaultProviderMetadata?: Record<string, unknown> | null;
  defaultHasEndTime?: boolean;
  defaultHasStartTime?: boolean;
  defaultStartTime?: string | null;
  defaultTitle?: string;
  includeCoordinates?: boolean;
  onCancel?: () => void;
  onSaved?: () => void;
  segmentId?: string;
  tripId: string;
};

export function TripSegmentForm({
  buttonLabel = "Save trip item",
  defaultConfirmationCode = null,
  defaultEndTime = null,
  defaultKind = "place",
  defaultLat = null,
  defaultLng = null,
  defaultLocation = null,
  defaultNotes = null,
  defaultProviderMetadata = null,
  defaultHasEndTime,
  defaultHasStartTime,
  defaultStartTime = null,
  defaultTitle = "",
  includeCoordinates = false,
  onCancel,
  onSaved,
  segmentId,
  tripId
}: TripSegmentFormProps) {
  const router = useRouter();
  const defaultStart = toScheduleParts(defaultStartTime, defaultHasStartTime);
  const defaultEnd = toScheduleParts(defaultEndTime, defaultHasEndTime);
  const defaultRoute = readTripSegmentRoute(defaultProviderMetadata);
  const fallbackRouteEndpoints = splitRouteLabel(defaultLocation || defaultTitle);
  const [endClockTime, setEndClockTime] = useState(defaultEnd.clockTime);
  const [endDate, setEndDate] = useState(defaultEnd.date || defaultStart.date);
  const [kind, setKind] = useState(defaultKind);
  const [lat, setLat] = useState(defaultLat == null ? "" : String(defaultLat));
  const [lng, setLng] = useState(defaultLng == null ? "" : String(defaultLng));
  const [location, setLocation] = useState(defaultLocation || "");
  const [locationSelected, setLocationSelected] = useState(
    Boolean(defaultLocation && defaultLat != null && defaultLng != null)
  );
  const [notes, setNotes] = useState(defaultNotes || "");
  const [providerMetadata, setProviderMetadata] = useState<Record<string, unknown> | null>(null);
  const [providerPlaceId, setProviderPlaceId] = useState<string | null>(null);
  const [routeMode, setRouteMode] = useState(defaultRoute?.mode || normalizeRouteMode(defaultKind));
  const [routeOrigin, setRouteOrigin] = useState<TripRouteEndpoint | null>(
    defaultRoute?.origin || endpointFromLabel(fallbackRouteEndpoints.origin)
  );
  const [routeOriginInput, setRouteOriginInput] = useState(
    routeEndpointLabel(defaultRoute?.origin) || fallbackRouteEndpoints.origin
  );
  const [routeDestination, setRouteDestination] = useState<TripRouteEndpoint | null>(
    defaultRoute?.destination || endpointFromLabel(fallbackRouteEndpoints.destination)
  );
  const [routeDestinationInput, setRouteDestinationInput] = useState(
    routeEndpointLabel(defaultRoute?.destination) || fallbackRouteEndpoints.destination
  );
  const [routeCarrier, setRouteCarrier] = useState(defaultRoute?.carrier || "");
  const [routeConfirmation, setRouteConfirmation] = useState(
    defaultRoute?.confirmation || defaultConfirmationCode || ""
  );
  const [routeFlightNumber, setRouteFlightNumber] = useState(defaultRoute?.flightNumber || "");
  const [startClockTime, setStartClockTime] = useState(defaultStart.clockTime);
  const [startDate, setStartDate] = useState(defaultStart.date);
  const [timeZone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
  const [title, setTitle] = useState(defaultTitle);
  const [hydrated, setHydrated] = useState(false);
  const { isPending, run, state } = useAlmidyAction();
  const formType = formTypeForKind(kind);
  const copy = formCopyForType(formType);
  const isRouteSegment = formType === "flight" || formType === "transport";
  const isFlightSegment = formType === "flight";
  const isHotelSegment = formType === "hotel";
  const showsEndTime =
    isRouteSegment || formType === "activity" || formType === "hotel" || formType === "meeting";
  const usesSeparateEndDate = isRouteSegment || formType === "hotel";

  useEffect(() => {
    setHydrated(true);
  }, []);

  function handleLocationInputChange(nextLocation: string) {
    setLocation(nextLocation);
    setProviderMetadata(null);
    setProviderPlaceId(null);
    setLocationSelected(false);
    setLat("");
    setLng("");
  }

  function handleLocationSelect(selection: LocationSelection) {
    setLocation(selection.formattedAddress || selection.address);
    setLat(String(selection.lat));
    setLng(String(selection.lng));
    setProviderMetadata(selection.providerMetadata || null);
    setProviderPlaceId(selection.placeId || null);
    setLocationSelected(true);
  }

  function handleRouteEndpointInputChange(endpoint: "origin" | "destination", value: string) {
    const nextEndpoint = endpointFromLabel(value);
    if (endpoint === "origin") {
      setRouteOriginInput(value);
      setRouteOrigin(nextEndpoint);
    } else {
      setRouteDestinationInput(value);
      setRouteDestination(nextEndpoint);
    }
  }

  function handleRouteEndpointSelect(endpoint: "origin" | "destination", selection: LocationSelection) {
    const nextEndpoint = endpointFromSelection(selection);
    if (endpoint === "origin") {
      setRouteOriginInput(nextEndpoint.address || nextEndpoint.label || "");
      setRouteOrigin(nextEndpoint);
    } else {
      setRouteDestinationInput(nextEndpoint.address || nextEndpoint.label || "");
      setRouteDestination(nextEndpoint);
    }
  }

  function handleTypeChange(nextType: TripItemFormType) {
    setKind(nextType);
    if (nextType === "flight") {
      setRouteMode("flight");
    } else if (nextType === "transport") {
      setRouteMode("transfer");
    }
  }

  function handleStartDateChange(nextDate: string) {
    setStartDate(nextDate);
    if (!endDate || !usesSeparateEndDate) setEndDate(nextDate);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitKind = formType;
    const route = isRouteSegment
      ? {
          arriveAt: endDate && endClockTime ? combineDateAndClockTime(endDate, endClockTime) : null,
          carrier: routeCarrier.trim() || null,
          confirmation: routeConfirmation.trim() || null,
          departAt: startDate && startClockTime ? combineDateAndClockTime(startDate, startClockTime) : null,
          destination: normalizeEndpointForSubmit(routeDestination, routeDestinationInput),
          flightNumber: routeFlightNumber.trim() || null,
          mode: isFlightSegment ? normalizeRouteMode("flight") : normalizeRouteMode(routeMode || "transfer"),
          origin: normalizeEndpointForSubmit(routeOrigin, routeOriginInput)
        }
      : null;
    const routeReady = Boolean(
      route?.origin?.lat != null &&
        route.origin.lng != null &&
        route.destination?.lat != null &&
        route.destination.lng != null
    );
    const routeLabel = routeLocationLabel(route);
    const body: Record<string, unknown> = {
      confirmationCode: !isRouteSegment && routeConfirmation.trim() ? routeConfirmation.trim() : null,
      endClockTime,
      endDate: endDate || startDate,
      kind: submitKind,
      lat: isRouteSegment
        ? route?.destination?.lat ?? null
        : lat.trim()
          ? Number(lat)
          : null,
      lng: isRouteSegment
        ? route?.destination?.lng ?? null
        : lng.trim()
          ? Number(lng)
          : null,
      location: isRouteSegment ? routeLabel || location : location,
      locationStatus:
        isRouteSegment
          ? routeReady
            ? "resolved"
            : "manual_location_required"
          : lat.trim() && lng.trim()
          ? "resolved"
          : location.trim()
            ? "manual_location_required"
            : "needs_location_confirmation",
      notes,
      startClockTime,
      startDate,
      timeZone,
      title,
      tripId
    };

    if (route) {
      body.routeMode = route.mode;
      body.origin = route.origin;
      body.destination = route.destination;
      body.carrier = route.carrier;
      body.flightNumber = route.flightNumber;
      body.confirmation = route.confirmation;
      body.providerMetadata = {
        ...(providerMetadata || {}),
        route
      };
      body.provider = "google_places";
      body.providerPlaceId = route.destination?.placeId || route.origin?.placeId || providerPlaceId;
    }

    if (providerPlaceId || providerMetadata) {
      body.provider = "google_places";
      body.providerMetadata = route
        ? {
            ...(providerMetadata || {}),
            route
          }
        : providerMetadata;
      body.providerPlaceId = providerPlaceId;
    }

    const result = await run({
      body,
      method: segmentId ? "PATCH" : "POST",
      timeoutMs: 30000,
      url: segmentId
        ? `/api/trip-segments/${encodeURIComponent(segmentId)}`
        : "/api/trip-segments"
    });

    if (result.status === "success") {
      if (!segmentId) {
        setEndClockTime("");
        setEndDate("");
        setKind("place");
        setLat("");
        setLng("");
        setLocation("");
        setLocationSelected(false);
        setNotes("");
        setProviderMetadata(null);
        setProviderPlaceId(null);
        setRouteCarrier("");
        setRouteConfirmation("");
        setRouteDestination(null);
        setRouteDestinationInput("");
        setRouteFlightNumber("");
        setRouteOrigin(null);
        setRouteOriginInput("");
        setStartClockTime("");
        setStartDate("");
        setTitle("");
      }
      router.refresh();
      onSaved?.();
    }
  }

  const message =
    state.status === "success" ? "Trip item saved." : state.message;
  const tone =
    state.status === "success"
      ? "bg-emerald-400/12 text-emerald-100 ring-emerald-300/20 lg:bg-emerald-50 lg:text-emerald-700 lg:ring-transparent"
      : state.status === "error" || state.status === "timeout"
        ? "bg-red-400/12 text-red-100 ring-red-300/20 lg:bg-red-50 lg:text-red-700 lg:ring-transparent"
        : "bg-white/[0.06] text-white/70 ring-white/10 lg:bg-slate-50 lg:text-slate-700 lg:ring-transparent";
  const isEditing = Boolean(segmentId);
  const canSave = hydrated && Boolean(title.trim()) && !isPending;
  const fieldClass = mobileInputClassName;
  const selectClass = mobileSelectClassName;
  const textareaClass = mobileTextareaClassName;
  const groupClass =
    "divide-y divide-zinc-800/60 overflow-visible rounded-xl border border-zinc-800 bg-[#1e1e24] shadow-xl lg:border-slate-200 lg:bg-slate-50";
  const labelClass =
    "grid min-w-0 gap-1.5 px-3.5 py-3.5 text-[9px] font-extrabold uppercase tracking-[0.14em] text-zinc-500 transition-colors focus-within:bg-[#25252d] lg:text-slate-500 lg:focus-within:bg-white";

  return (
    <form
      className="flex max-h-[min(78dvh,44rem)] min-h-0 flex-col overflow-hidden rounded-[1.55rem] border border-white/10 bg-[#1f1f21] p-4 text-white shadow-[0_22px_60px_rgba(0,0,0,0.32)] lg:max-h-none lg:overflow-visible lg:rounded-2xl lg:border-slate-200 lg:bg-white lg:text-slate-950 lg:shadow-sm"
      data-testid={isEditing ? "mobile-edit-trip-item-form" : "mobile-add-trip-item-form"}
      onSubmit={submit}
    >
      <div className="shrink-0 grid grid-cols-[minmax(44px,auto)_minmax(0,1fr)_minmax(44px,auto)] items-start gap-3 border-b border-white/10 pb-3 lg:border-slate-200">
        {onCancel ? (
          <button
            className={mobileSecondaryActionClassName}
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
        ) : (
          <div aria-hidden="true" />
        )}
        <div className="min-w-0 text-center">
          <h5 className="truncate text-base font-black text-white lg:text-slate-950">
            {isEditing ? "Edit trip item" : "Add trip item"}
          </h5>
          <p className="mt-1 truncate text-xs font-semibold text-white/48 lg:text-slate-500">
            {copy.helper}
          </p>
          <p className="mt-1 text-[0.62rem] font-mono font-black uppercase tracking-[0.18em] text-orange-300/80 lg:text-amber-700">
            {copy.contextLabel}
          </p>
        </div>
        <button
          className={mobilePrimaryActionClassName}
          disabled={!canSave}
          type="submit"
        >
          {!hydrated
            ? "Prep..."
            : isPending
              ? "Saving..."
              : buttonLabel
                  .replace(/^Save trip item$/i, "Save")
                  .replace(/^Add trip item$/i, "Add")}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain pb-[calc(6rem+env(safe-area-inset-bottom))] pt-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:overflow-visible lg:pb-0">
        <div className="grid gap-4">
          <div className={groupClass}>
            <label className={labelClass}>
              Reservation type
              <select
                className={selectClass}
                onChange={(event) => handleTypeChange(event.target.value as TripItemFormType)}
                value={formType}
              >
                {tripItemTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className={labelClass}>
              {copy.titleLabel}
              <input
                className={fieldClass}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={copy.titlePlaceholder}
                required
                value={title}
              />
            </label>

            {!isRouteSegment && (formType === "restaurant" || isHotelSegment) ? (
              <label className={labelClass}>
                Confirmation / booking code
                <input
                  className={`${fieldClass} font-mono tracking-wider`}
                  onChange={(event) => setRouteConfirmation(event.target.value)}
                  placeholder="H782NG9"
                  value={routeConfirmation}
                />
              </label>
            ) : null}
          </div>

          {isRouteSegment ? (
            <div className={groupClass}>
              {!isFlightSegment ? (
                <label className={labelClass}>
                  Transport type
                  <select
                    className={selectClass}
                    onChange={(event) => setRouteMode(normalizeRouteMode(event.target.value))}
                    value={routeMode === "flight" ? "transfer" : routeMode}
                  >
                    <option value="drive">Car</option>
                    <option value="train">Train</option>
                    <option value="bus">Bus</option>
                    <option value="ferry">Ferry</option>
                    <option value="transfer">Transfer</option>
                    <option value="transfer">Rideshare</option>
                    <option value="transportation">Other transport</option>
                  </select>
                </label>
              ) : null}
              <div className="grid gap-0 divide-y divide-zinc-800/60 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
                <label className={labelClass}>
                  From
                  <GoogleMapsProvider>
                    <LocationAutocomplete
                      ariaLabel="Route origin"
                      inputClassName={fieldClass}
                      loadingMessage="Places autocomplete is loading. You can still type an origin."
                      manualWarning="Select a suggested place to map this route."
                      onInputChange={(value) => handleRouteEndpointInputChange("origin", value)}
                      onSelect={(selection) => handleRouteEndpointSelect("origin", selection)}
                      placeholder="Barcelona, Spain or BCN"
                      resolveErrorMessage="Almidy could not map that origin. Try another location."
                      unresolvedMessage="Select a mapped origin."
                      value={routeOriginInput}
                    />
                  </GoogleMapsProvider>
                </label>
                <label className={labelClass}>
                  To
                  <GoogleMapsProvider>
                    <LocationAutocomplete
                      ariaLabel="Route destination"
                      inputClassName={fieldClass}
                      loadingMessage="Places autocomplete is loading. You can still type a destination."
                      manualWarning="Select a suggested place to map this route."
                      onInputChange={(value) => handleRouteEndpointInputChange("destination", value)}
                      onSelect={(selection) => handleRouteEndpointSelect("destination", selection)}
                      placeholder="Miami, FL or MIA"
                      resolveErrorMessage="Almidy could not map that destination. Try another location."
                      unresolvedMessage="Select a mapped destination."
                      value={routeDestinationInput}
                    />
                  </GoogleMapsProvider>
                </label>
              </div>
              <div className="grid gap-0 divide-y divide-zinc-800/60 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                <label className={labelClass}>
                  {isFlightSegment ? "Airline carrier" : "Carrier"}
                  <input
                    className={fieldClass}
                    onChange={(event) => setRouteCarrier(event.target.value)}
                    placeholder={isFlightSegment ? "American Airlines" : "Brightline"}
                    value={routeCarrier}
                  />
                </label>
                <label className={labelClass}>
                  {isFlightSegment ? "Flight number" : "Route number"}
                  <input
                    className={`${fieldClass} font-mono tracking-wider`}
                    onChange={(event) => setRouteFlightNumber(event.target.value)}
                    placeholder={isFlightSegment ? "AA-2415" : "Train 101"}
                    value={routeFlightNumber}
                  />
                </label>
                <label className={labelClass}>
                  Confirmation / booking code
                  <input
                    className={`${fieldClass} font-mono tracking-wider`}
                    onChange={(event) => setRouteConfirmation(event.target.value)}
                    placeholder="ABC123"
                    value={routeConfirmation}
                  />
                </label>
              </div>
              {routeOriginInput || routeDestinationInput ? (
                <p className="px-4 pb-3 text-xs font-semibold text-white/52 lg:text-slate-500">
                  {routeOrigin?.lat != null && routeDestination?.lat != null
                    ? "Route ready."
                    : "Select origin and destination places to draw this route."}
                </p>
              ) : null}
            </div>
          ) : (
            <div className={groupClass}>
              <label className={labelClass}>
                {copy.locationLabel}
                <GoogleMapsProvider>
                  <LocationAutocomplete
                    ariaLabel="Stop location"
                    inputClassName={fieldClass}
                    loadingMessage="Places autocomplete is loading. You can still type a location."
                    manualWarning="Select a suggested place to map this item."
                    onInputChange={handleLocationInputChange}
                    onSelect={handleLocationSelect}
                    placeholder={copy.locationPlaceholder}
                    resolveErrorMessage="Almidy could not map that Google result. Try another location."
                    unresolvedMessage="Select a suggested place with a mapped location."
                    value={location}
                  />
                </GoogleMapsProvider>
                {location.trim() && !locationSelected ? (
                  <p className="mt-2 text-xs font-semibold text-orange-200/76 lg:text-amber-700">
                    Select a suggested place to map this.
                  </p>
                ) : null}
              </label>
            </div>
          )}

      <div className={`${groupClass} grid sm:grid-cols-2 sm:divide-x sm:divide-y-0`}>
        <label className={labelClass}>
          {copy.startDateLabel}
          <input
            className={fieldClass}
            onChange={(event) => handleStartDateChange(event.target.value)}
            type="date"
            value={startDate}
          />
        </label>
        <label className={labelClass}>
          {copy.startTimeLabel}
          <input
            className={fieldClass}
            onChange={(event) => setStartClockTime(event.target.value)}
            type="time"
            value={startClockTime}
          />
        </label>
      </div>

      {showsEndTime ? (
        <div className={`${groupClass} grid ${usesSeparateEndDate ? "sm:grid-cols-2 sm:divide-x sm:divide-y-0" : ""}`}>
          {usesSeparateEndDate ? (
            <label className={labelClass}>
              {copy.endDateLabel}
              <input
                className={fieldClass}
                onChange={(event) => setEndDate(event.target.value)}
                type="date"
                value={endDate}
              />
            </label>
          ) : null}
          <label className={labelClass}>
            {copy.endTimeLabel}
            <input
              className={fieldClass}
              onChange={(event) => setEndClockTime(event.target.value)}
              type="time"
              value={endClockTime}
            />
          </label>
        </div>
      ) : null}

      <details className="rounded-2xl bg-white/[0.06] px-4 py-3 ring-1 ring-white/8 lg:bg-slate-50 lg:ring-slate-200">
        <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.14em] text-white/42 lg:text-slate-500">
          Notes and details
        </summary>
        <div className="mt-3 grid gap-3">
          <label className={labelClass}>
            Notes
            <textarea
              className={textareaClass}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Add notes..."
              value={notes}
            />
          </label>
        </div>
      </details>

      {includeCoordinates ? (
        <details className="rounded-2xl bg-white/[0.06] px-4 py-3 ring-1 ring-white/8 lg:bg-slate-50 lg:ring-slate-200">
          <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.14em] text-white/42 lg:text-slate-500">
            Advanced location details
          </summary>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <label className={labelClass}>
              Latitude
              <input
                className={fieldClass}
                inputMode="decimal"
                onChange={(event) => setLat(event.target.value)}
                placeholder="Latitude"
                value={lat}
              />
            </label>
            <label className={labelClass}>
              Longitude
              <input
                className={fieldClass}
                inputMode="decimal"
                onChange={(event) => setLng(event.target.value)}
                placeholder="Longitude"
                value={lng}
              />
            </label>
          </div>
        </details>
      ) : null}

      {state.status !== "idle" && message ? (
        <p className={`rounded-2xl px-4 py-3 text-xs font-semibold ring-1 ${tone}`}>{message}</p>
      ) : null}
        </div>
      </div>
    </form>
  );
}

function toScheduleParts(value: string | null, hasExplicitTime?: boolean) {
  if (!value) return { clockTime: "", date: "" };

  return {
    clockTime: isMidnight(value) && hasExplicitTime !== true ? "" : value.slice(11, 16),
    date: value.slice(0, 10)
  };
}

function isMidnight(value: string) {
  return value.slice(11, 16) === "00:00";
}

function combineDateAndClockTime(date: string, clockTime: string) {
  return `${date}T${clockTime}:00.000Z`;
}

type TripItemFormType =
  | "activity"
  | "flight"
  | "hotel"
  | "meeting"
  | "place"
  | "restaurant"
  | "transport";

const tripItemTypeOptions: Array<{ label: string; value: TripItemFormType }> = [
  { label: "Place", value: "place" },
  { label: "Restaurant", value: "restaurant" },
  { label: "Activity", value: "activity" },
  { label: "Hotel", value: "hotel" },
  { label: "Flight", value: "flight" },
  { label: "Transport", value: "transport" },
  { label: "Meeting", value: "meeting" }
];

function formTypeForKind(kind: string): TripItemFormType {
  const normalized = kind.toLowerCase();
  if (normalized === "flight") return "flight";
  if (isRouteKind(normalized)) return "transport";
  if (normalized === "hotel" || normalized === "lodging") return "hotel";
  if (normalized === "restaurant" || normalized === "dinner") return "restaurant";
  if (normalized === "activity" || normalized === "tour") return "activity";
  if (normalized === "meeting" || normalized === "event") return "meeting";
  return "place";
}

function formCopyForType(type: TripItemFormType) {
  switch (type) {
    case "activity":
      return {
        contextLabel: "activity",
        endDateLabel: "End date",
        endTimeLabel: "End time",
        helper: "Add an activity, tour, or experience.",
        locationAriaLabel: "Activity meeting point",
        locationLabel: "Location or meeting point",
        locationPlaceholder: "Search for a meeting point...",
        startDateLabel: "Date",
        startTimeLabel: "Start time",
        titleLabel: "Activity name",
        titlePlaceholder: "Biscayne Bay boat tour"
      };
    case "flight":
      return {
        contextLabel: "flight",
        endDateLabel: "Arrival date",
        endTimeLabel: "Arrival time",
        helper: "Add a flight route with departure and arrival details.",
        locationAriaLabel: "Flight destination",
        locationLabel: "To",
        locationPlaceholder: "Miami International Airport",
        startDateLabel: "Departure date",
        startTimeLabel: "Departure time",
        titleLabel: "Flight title",
        titlePlaceholder: "American Airlines AA112"
      };
    case "hotel":
      return {
        contextLabel: "lodging",
        endDateLabel: "Check-out date",
        endTimeLabel: "Check-out time",
        helper: "Add lodging and check-in details.",
        locationAriaLabel: "Hotel location",
        locationLabel: "Hotel location",
        locationPlaceholder: "Search for hotel...",
        startDateLabel: "Check-in date",
        startTimeLabel: "Check-in time",
        titleLabel: "Hotel name",
        titlePlaceholder: "citizenM Miami Brickell"
      };
    case "meeting":
      return {
        contextLabel: "meeting",
        endDateLabel: "End date",
        endTimeLabel: "End time",
        helper: "Add a meetup, reservation, or appointment.",
        locationAriaLabel: "Meeting location",
        locationLabel: "Location",
        locationPlaceholder: "Search for meeting location...",
        startDateLabel: "Date",
        startTimeLabel: "Start time",
        titleLabel: "Meeting title",
        titlePlaceholder: "Dinner with Alex"
      };
    case "restaurant":
      return {
        contextLabel: "dining",
        endDateLabel: "End date",
        endTimeLabel: "End time",
        helper: "Add a restaurant or reservation.",
        locationAriaLabel: "Restaurant location",
        locationLabel: "Location",
        locationPlaceholder: "Search for restaurant...",
        startDateLabel: "Reservation date",
        startTimeLabel: "Reservation time",
        titleLabel: "Restaurant name",
        titlePlaceholder: "Komodo"
      };
    case "transport":
      return {
        contextLabel: "transit",
        endDateLabel: "Arrival date",
        endTimeLabel: "Arrival time",
        helper: "Add a transfer, train, bus, ferry, or rideshare.",
        locationAriaLabel: "Transport destination",
        locationLabel: "To",
        locationPlaceholder: "Miami Beach",
        startDateLabel: "Departure date",
        startTimeLabel: "Departure time",
        titleLabel: "Transport name",
        titlePlaceholder: "Transfer to hotel"
      };
    case "place":
    default:
      return {
        contextLabel: "place",
        endDateLabel: "End date",
        endTimeLabel: "End time",
        helper: "Add a mapped place to your trip.",
        locationAriaLabel: "Stop location",
        locationLabel: "Location",
        locationPlaceholder: "Search Google Places...",
        startDateLabel: "Date",
        startTimeLabel: "Start time",
        titleLabel: "Name",
        titlePlaceholder: "Wynwood Walls"
      };
  }
}

function endpointFromSelection(selection: LocationSelection): TripRouteEndpoint {
  return {
    address: selection.formattedAddress || selection.address,
    code: airportCodeFromText(selection.name || selection.address),
    label: selection.name || selection.formattedAddress || selection.address,
    lat: selection.lat,
    lng: selection.lng,
    placeId: selection.placeId || null,
    providerMetadata: selection.providerMetadata || null
  };
}

function endpointFromLabel(value: string): TripRouteEndpoint | null {
  const label = value.trim();
  if (!label) return null;
  return {
    address: label,
    code: airportCodeFromText(label),
    label,
    lat: null,
    lng: null,
    placeId: null
  };
}

function normalizeEndpointForSubmit(
  endpoint: TripRouteEndpoint | null,
  inputValue: string
): TripRouteEndpoint | null {
  const fallback = endpointFromLabel(inputValue);
  if (!endpoint) return fallback;
  return {
    ...endpoint,
    address: endpoint.address || fallback?.address || null,
    code: endpoint.code || fallback?.code || null,
    label: endpoint.label || fallback?.label || null
  };
}

function splitRouteLabel(value: string) {
  const [origin = "", destination = ""] = value
    .split(/\s+to\s+|→|-/i)
    .map((part) => part.trim())
    .filter(Boolean);
  return { destination, origin };
}

function airportCodeFromText(value: string | null | undefined) {
  const match = String(value || "").match(/\b[A-Z]{3}\b/);
  return match?.[0] || null;
}
