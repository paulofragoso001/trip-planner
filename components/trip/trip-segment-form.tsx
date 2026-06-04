"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import GoogleMapsProvider from "@/components/GoogleMapsProvider";
import LocationAutocomplete, {
  type LocationSelection
} from "@/components/LocationAutocomplete";
import { useWaylineAction } from "@/hooks/use-wayline-action";

type TripSegmentFormProps = {
  buttonLabel?: string;
  defaultEndTime?: string | null;
  defaultKind?: string;
  defaultLat?: number | null;
  defaultLng?: number | null;
  defaultLocation?: string | null;
  defaultNotes?: string | null;
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
  const [startClockTime, setStartClockTime] = useState(defaultStart.clockTime);
  const [startDate, setStartDate] = useState(defaultStart.date);
  const [timeZone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
  const [title, setTitle] = useState(defaultTitle);
  const [hydrated, setHydrated] = useState(false);
  const { isPending, run, state } = useWaylineAction();

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

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body: Record<string, unknown> = {
      endClockTime,
      endDate: endDate || startDate,
      kind,
      lat: lat.trim() ? Number(lat) : null,
      lng: lng.trim() ? Number(lng) : null,
      location,
      locationStatus:
        lat.trim() && lng.trim()
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

    if (providerPlaceId || providerMetadata) {
      body.provider = "google_places";
      body.providerMetadata = providerMetadata;
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
            onChange={(event) => setKind(event.target.value)}
            value={kind}
          >
            <option value="flight">Flight</option>
            <option value="hotel">Hotel</option>
            <option value="meeting">Meeting</option>
            <option value="restaurant">Restaurant</option>
            <option value="activity">Activity</option>
            <option value="transport">Transport</option>
            <option value="note">Note</option>
          </select>
        </label>
      ) : null}

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
          Start time
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
                onChange={(event) => setKind(event.target.value)}
                value={kind}
              >
                <option value="flight">Flight</option>
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
                End date
                <input
                  className={fieldClass}
                  onChange={(event) => setEndDate(event.target.value)}
                  type="date"
                  value={endDate}
                />
              </label>
              <label className={labelClass}>
                End time
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
              End date
              <input
                className={fieldClass}
                onChange={(event) => setEndDate(event.target.value)}
                type="date"
                value={endDate}
              />
            </label>
            <label className={labelClass}>
              End time
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
