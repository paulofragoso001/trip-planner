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
  isRouteKind,
  normalizeRouteMode,
  readTripSegmentRoute,
  routeEndpointLabel,
  routeLocationLabel,
  type TripRouteEndpoint
} from "@/lib/trip-segment-route";

type TripSegmentFormProps = {
  buttonLabel?: string;
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
  buttonLabel = "Save segment",
  defaultEndTime = null,
  defaultKind = "activity",
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
  const [routeConfirmation, setRouteConfirmation] = useState(defaultRoute?.confirmation || "");
  const [routeFlightNumber, setRouteFlightNumber] = useState(defaultRoute?.flightNumber || "");
  const [startClockTime, setStartClockTime] = useState(defaultStart.clockTime);
  const [startDate, setStartDate] = useState(defaultStart.date);
  const [timeZone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
  const [title, setTitle] = useState(defaultTitle);
  const [hydrated, setHydrated] = useState(false);
  const { isPending, run, state } = useWaylineAction();
  const isRouteSegment = isRouteKind(kind);

  useEffect(() => {
    setHydrated(true);
  }, []);

  function handleLocationInputChange(nextLocation: string) {
    setLocation(nextLocation);
    setProviderMetadata(null);
    setProviderPlaceId(null);
    setLocationSelected(false);
    if (!includeCoordinates) {
      setLat("");
      setLng("");
    }
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

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const route = isRouteSegment
      ? {
          arriveAt: endDate && endClockTime ? combineDateAndClockTime(endDate, endClockTime) : null,
          carrier: routeCarrier.trim() || null,
          confirmation: routeConfirmation.trim() || null,
          departAt: startDate && startClockTime ? combineDateAndClockTime(startDate, startClockTime) : null,
          destination: normalizeEndpointForSubmit(routeDestination, routeDestinationInput),
          flightNumber: routeFlightNumber.trim() || null,
          mode: normalizeRouteMode(routeMode || kind),
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
      endClockTime,
      endDate: endDate || startDate,
      kind,
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
    state.status === "success" ? "Segment saved." : state.message;
  const tone =
    state.status === "success"
      ? "bg-emerald-50 text-emerald-700"
      : state.status === "error" || state.status === "timeout"
        ? "bg-red-50 text-red-700"
        : "bg-slate-50 text-slate-700";
  const isEditing = Boolean(segmentId);
  const fieldClass = "min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100";
  const labelClass = "grid gap-1.5 text-xs font-bold uppercase tracking-[0.12em] text-slate-500";

  return (
    <form className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" onSubmit={submit}>
      {isEditing ? (
        <div className="flex items-center justify-between gap-3">
          <h5 className="text-base font-black text-slate-950">Edit place</h5>
          {onCancel ? (
            <button
              className="inline-flex min-h-10 items-center justify-center rounded-full px-3 text-xs font-black text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
              onClick={onCancel}
              type="button"
            >
              Cancel
            </button>
          ) : null}
        </div>
      ) : null}

      <label className={labelClass}>
        Title
        <input
          className={fieldClass}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Wynwood Walls"
          required
          value={title}
        />
      </label>

      {!isEditing ? (
        <label className={labelClass}>
          Type
          <select
            className={fieldClass}
            onChange={(event) => {
              setKind(event.target.value);
              if (isRouteKind(event.target.value)) {
                setRouteMode(normalizeRouteMode(event.target.value));
              }
            }}
            value={kind}
          >
            <option value="flight">Flight</option>
            <option value="drive">Drive</option>
            <option value="train">Train</option>
            <option value="bus">Bus</option>
            <option value="transfer">Transfer</option>
            <option value="ferry">Ferry</option>
            <option value="hotel">Hotel</option>
            <option value="meeting">Meeting</option>
            <option value="restaurant">Restaurant</option>
            <option value="activity">Activity</option>
            <option value="transport">Transport</option>
            <option value="note">Note</option>
          </select>
        </label>
      ) : null}

      {isRouteSegment ? (
        <div className="grid gap-3 rounded-2xl bg-slate-50 p-3">
          <label className={labelClass}>
            Transport type
            <select
              className={fieldClass}
              onChange={(event) => setRouteMode(normalizeRouteMode(event.target.value))}
              value={routeMode}
            >
              <option value="flight">Flight</option>
              <option value="drive">Drive</option>
              <option value="train">Train</option>
              <option value="bus">Bus</option>
              <option value="transfer">Transfer</option>
              <option value="ferry">Ferry</option>
              <option value="other">Other</option>
            </select>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
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
                  resolveErrorMessage="Wayline could not map that origin. Try another location."
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
                  resolveErrorMessage="Wayline could not map that destination. Try another location."
                  unresolvedMessage="Select a mapped destination."
                  value={routeDestinationInput}
                />
              </GoogleMapsProvider>
            </label>
          </div>
          {routeOriginInput || routeDestinationInput ? (
            <p className="text-xs font-semibold text-slate-500">
              {routeOrigin?.lat != null && routeDestination?.lat != null
                ? "Route ready."
                : "Add origin and destination to draw this route."}
            </p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-3">
            <label className={labelClass}>
              Carrier
              <input
                className={fieldClass}
                onChange={(event) => setRouteCarrier(event.target.value)}
                placeholder="American Airlines"
                value={routeCarrier}
              />
            </label>
            <label className={labelClass}>
              Flight / route no.
              <input
                className={fieldClass}
                onChange={(event) => setRouteFlightNumber(event.target.value)}
                placeholder="AA112"
                value={routeFlightNumber}
              />
            </label>
            <label className={labelClass}>
              Confirmation
              <input
                className={fieldClass}
                onChange={(event) => setRouteConfirmation(event.target.value)}
                placeholder="ABC123"
                value={routeConfirmation}
              />
            </label>
          </div>
        </div>
      ) : (
        <label className={labelClass}>
          Location
          <GoogleMapsProvider>
            <LocationAutocomplete
              ariaLabel="Stop location"
              inputClassName={fieldClass}
              loadingMessage="Places autocomplete is loading. You can still type a location."
              manualWarning="Select a suggested place to map this stop."
              onInputChange={handleLocationInputChange}
              onSelect={handleLocationSelect}
              placeholder="Search Google Places..."
              resolveErrorMessage="Wayline could not map that Google result. Try another location."
              unresolvedMessage="Select a suggested place with a mapped location."
              value={location}
            />
          </GoogleMapsProvider>
          {location.trim() && !locationSelected ? (
            <p className="mt-2 text-xs font-semibold text-amber-700">
              Select a suggested place to map this.
            </p>
          ) : null}
        </label>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <label className={labelClass}>
          Date
          <input
            className={fieldClass}
            onChange={(event) => {
              setStartDate(event.target.value);
              if (!endDate) setEndDate(event.target.value);
            }}
            type="date"
            value={startDate}
          />
        </label>
        <label className={labelClass}>
          {isRouteSegment ? "Departure time" : "Start time"}
          <input
            className={fieldClass}
            onChange={(event) => setStartClockTime(event.target.value)}
            type="time"
            value={startClockTime}
          />
        </label>
      </div>

      <label className={labelClass}>
        Notes
        <textarea
          className="min-h-24 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Add notes..."
          value={notes}
        />
      </label>

      {isEditing ? (
        <details className="rounded-xl bg-slate-50 px-3 py-2">
          <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.12em] text-slate-500">
            More details
          </summary>
          <div className="mt-3 grid gap-3">
            <label className={labelClass}>
              Type
              <select
                className={fieldClass}
                onChange={(event) => {
                  setKind(event.target.value);
                  if (isRouteKind(event.target.value)) {
                    setRouteMode(normalizeRouteMode(event.target.value));
                  }
                }}
                value={kind}
              >
                <option value="flight">Flight</option>
                <option value="drive">Drive</option>
                <option value="train">Train</option>
                <option value="bus">Bus</option>
                <option value="transfer">Transfer</option>
                <option value="ferry">Ferry</option>
                <option value="hotel">Hotel</option>
                <option value="meeting">Meeting</option>
                <option value="restaurant">Restaurant</option>
                <option value="activity">Activity</option>
                <option value="transport">Transport</option>
                <option value="note">Note</option>
              </select>
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className={labelClass}>
                {isRouteSegment ? "Arrival date" : "End date"}
                <input
                  className={fieldClass}
                  onChange={(event) => setEndDate(event.target.value)}
                  type="date"
                  value={endDate}
                />
              </label>
              <label className={labelClass}>
                {isRouteSegment ? "Arrival time" : "End time"}
                <input
                  className={fieldClass}
                  onChange={(event) => setEndClockTime(event.target.value)}
                  type="time"
                  value={endClockTime}
                />
              </label>
            </div>
            {includeCoordinates ? (
              <div className="grid gap-2 sm:grid-cols-2">
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
            ) : null}
          </div>
        </details>
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className={labelClass}>
              {isRouteSegment ? "Arrival date" : "End date"}
              <input
                className={fieldClass}
                onChange={(event) => setEndDate(event.target.value)}
                type="date"
                value={endDate}
              />
            </label>
            <label className={labelClass}>
              {isRouteSegment ? "Arrival time" : "End time"}
              <input
                className={fieldClass}
                onChange={(event) => setEndClockTime(event.target.value)}
                type="time"
                value={endClockTime}
              />
            </label>
          </div>
          {includeCoordinates ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                className={fieldClass}
                inputMode="decimal"
                onChange={(event) => setLat(event.target.value)}
                placeholder="Latitude"
                value={lat}
              />
              <input
                className={fieldClass}
                inputMode="decimal"
                onChange={(event) => setLng(event.target.value)}
                placeholder="Longitude"
                value={lng}
              />
            </div>
          ) : null}
        </>
      )}

      <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
        <button
          className="min-h-11 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white disabled:opacity-60"
          disabled={isPending || !hydrated}
          type="submit"
        >
          {!hydrated ? "Preparing..." : isPending ? "Saving..." : buttonLabel}
        </button>
        {onCancel ? (
          <button
            className="min-h-11 rounded-xl bg-slate-100 px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-200"
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
        ) : null}
      </div>
      {state.status !== "idle" && message ? (
        <p className={`rounded-xl px-3 py-2 text-xs font-semibold ${tone}`}>{message}</p>
      ) : null}
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
