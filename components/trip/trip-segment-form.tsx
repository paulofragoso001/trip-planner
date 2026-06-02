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
      timeoutMs: 7000,
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

  return (
    <form className="grid gap-3 rounded-2xl bg-slate-50 p-3" onSubmit={submit}>
      <input
        className="min-h-11 rounded-xl border border-slate-200 px-3 text-sm"
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Title"
        required
        value={title}
      />
      <select
        className="min-h-11 rounded-xl border border-slate-200 px-3 text-sm"
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
      <div>
        <GoogleMapsProvider>
          <LocationAutocomplete
            ariaLabel="Stop location"
            inputClassName="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
            loadingMessage="Places autocomplete is loading. You can still type a location."
            manualWarning="Select a suggested place to map this stop."
            onInputChange={handleLocationInputChange}
            onSelect={handleLocationSelect}
            placeholder="Search location"
            resolveErrorMessage="Wayline could not map that Google result. Try another location."
            unresolvedMessage="Select a suggested place with a mapped location."
            value={location}
          />
        </GoogleMapsProvider>
        {location.trim() && !locationSelected ? (
          <p className="mt-2 text-xs font-semibold text-amber-700">
            Select a suggested place to map this stop.
          </p>
        ) : null}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
          Date
          <input
            className="min-h-11 rounded-xl border border-slate-200 px-3 text-sm font-medium normal-case tracking-normal text-slate-900"
            onChange={(event) => {
              setStartDate(event.target.value);
              if (!endDate) setEndDate(event.target.value);
            }}
            type="date"
            value={startDate}
          />
        </label>
        <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
          Start time
          <input
            className="min-h-11 rounded-xl border border-slate-200 px-3 text-sm font-medium normal-case tracking-normal text-slate-900"
            onChange={(event) => setStartClockTime(event.target.value)}
            type="time"
            value={startClockTime}
          />
        </label>
        <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
          End date
          <input
            className="min-h-11 rounded-xl border border-slate-200 px-3 text-sm font-medium normal-case tracking-normal text-slate-900"
            onChange={(event) => setEndDate(event.target.value)}
            type="date"
            value={endDate}
          />
        </label>
        <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
          End time
          <input
            className="min-h-11 rounded-xl border border-slate-200 px-3 text-sm font-medium normal-case tracking-normal text-slate-900"
            onChange={(event) => setEndClockTime(event.target.value)}
            type="time"
            value={endClockTime}
          />
        </label>
      </div>
      {includeCoordinates ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            className="min-h-11 rounded-xl border border-slate-200 px-3 text-sm"
            inputMode="decimal"
            onChange={(event) => setLat(event.target.value)}
            placeholder="Latitude"
            value={lat}
          />
          <input
            className="min-h-11 rounded-xl border border-slate-200 px-3 text-sm"
            inputMode="decimal"
            onChange={(event) => setLng(event.target.value)}
            placeholder="Longitude"
            value={lng}
          />
        </div>
      ) : null}
      <textarea
        className="min-h-20 rounded-xl border border-slate-200 px-3 py-2 text-sm"
        onChange={(event) => setNotes(event.target.value)}
        placeholder="Notes"
        value={notes}
      />
      <button
        className="min-h-11 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white disabled:opacity-60"
        disabled={isPending || !hydrated}
        type="submit"
      >
        {!hydrated ? "Preparing..." : isPending ? "Saving..." : buttonLabel}
      </button>
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
