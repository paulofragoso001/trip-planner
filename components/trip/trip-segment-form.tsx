"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";
import { useWaylineAction } from "@/hooks/use-wayline-action";

type TripSegmentFormProps = {
  buttonLabel?: string;
  defaultEndTime?: string | null;
  defaultKind?: string;
  defaultLat?: number | null;
  defaultLng?: number | null;
  defaultLocation?: string | null;
  defaultNotes?: string | null;
  defaultStartTime?: string | null;
  defaultTitle?: string;
  includeCoordinates?: boolean;
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
  defaultStartTime = null,
  defaultTitle = "",
  includeCoordinates = false,
  segmentId,
  tripId
}: TripSegmentFormProps) {
  const router = useRouter();
  const [endTime, setEndTime] = useState(toDateTimeLocal(defaultEndTime));
  const [kind, setKind] = useState(defaultKind);
  const [lat, setLat] = useState(defaultLat == null ? "" : String(defaultLat));
  const [lng, setLng] = useState(defaultLng == null ? "" : String(defaultLng));
  const [location, setLocation] = useState(defaultLocation || "");
  const [notes, setNotes] = useState(defaultNotes || "");
  const [startTime, setStartTime] = useState(toDateTimeLocal(defaultStartTime));
  const [title, setTitle] = useState(defaultTitle);
  const { isPending, run, state } = useWaylineAction();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const result = await run({
      body: {
        endTime: fromDateTimeLocal(endTime),
        kind,
        lat: lat.trim() ? Number(lat) : null,
        lng: lng.trim() ? Number(lng) : null,
        location,
        notes,
        startTime: fromDateTimeLocal(startTime),
        title,
        tripId
      },
      method: segmentId ? "PATCH" : "POST",
      timeoutMs: 7000,
      url: segmentId
        ? `/api/trip-segments/${encodeURIComponent(segmentId)}`
        : "/api/trip-segments"
    });

    if (result.status === "success") {
      if (!segmentId) {
        setEndTime("");
        setLat("");
        setLng("");
        setLocation("");
        setNotes("");
        setStartTime("");
        setTitle("");
      }
      router.refresh();
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
      <input
        className="min-h-11 rounded-xl border border-slate-200 px-3 text-sm"
        onChange={(event) => setLocation(event.target.value)}
        placeholder="Location"
        value={location}
      />
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          className="min-h-11 rounded-xl border border-slate-200 px-3 text-sm"
          onChange={(event) => setStartTime(event.target.value)}
          type="datetime-local"
          value={startTime}
        />
        <input
          className="min-h-11 rounded-xl border border-slate-200 px-3 text-sm"
          onChange={(event) => setEndTime(event.target.value)}
          type="datetime-local"
          value={endTime}
        />
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
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Saving..." : buttonLabel}
      </button>
      {state.status !== "idle" && message ? (
        <p className={`rounded-xl px-3 py-2 text-xs font-semibold ${tone}`}>{message}</p>
      ) : null}
    </form>
  );
}

function toDateTimeLocal(value: string | null) {
  if (!value) return "";
  return value.slice(0, 16);
}

function fromDateTimeLocal(value: string) {
  return value ? new Date(value).toISOString() : null;
}
