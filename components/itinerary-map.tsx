"use client";

import { useMemo, useState } from "react";
import TripMap, { type TripMapItem } from "@/components/TripMap";

type ItineraryMapProps = {
  items?: unknown[] | null;
};

type MapPoint = {
  id: string;
  title: string;
  latitude: number;
  longitude: number;
  date?: string;
  time?: string;
  type?: string;
};

const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
const fallbackCenter = { lat: 25.7617, lng: -80.1918 };
const containerStyle = { width: "100%", height: "400px" };

export function ItineraryMap({ items }: ItineraryMapProps) {
  const [selectedPoint, setSelectedPoint] = useState<MapPoint | null>(null);
  const points = useMemo(() => extractMapPoints(items), [items]);
  const isConfigured = Boolean(mapsApiKey && !mapsApiKey.startsWith("YOUR_"));
  const mapItems = useMemo(
    () =>
      points.map<TripMapItem>((point) => ({
        id: point.id,
        title: point.title,
        lat: point.latitude,
        lng: point.longitude
      })),
    [points]
  );

  if (!isConfigured) {
    return (
      <MapShell>
        <p className="text-sm leading-6 text-slate-600">
          Add <code className="rounded bg-slate-100 px-1 py-0.5">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code>{" "}
          to <code className="rounded bg-slate-100 px-1 py-0.5">.env.local</code> to enable
          Google Maps markers.
        </p>
      </MapShell>
    );
  }

  if (points.length === 0) {
    return (
      <MapShell>
        <p className="text-sm leading-6 text-slate-600">
          No latitude and longitude values found in this itinerary yet. Items with
          coordinates will be plotted here.
        </p>
      </MapShell>
    );
  }

  return (
    <MapShell>
      <div className="relative overflow-hidden rounded-lg border border-line">
        <TripMap
          items={mapItems}
          selectedId={selectedPoint?.id}
          onSelect={(id) =>
            setSelectedPoint(points.find((point) => point.id === id) || null)
          }
        />
      </div>
      {selectedPoint ? (
        <div className="mt-3 rounded-lg border border-line bg-slate-50 p-3 text-sm">
          <p className="font-black text-ink">{selectedPoint.title}</p>
          <p className="mt-1 text-slate-600">
            {[selectedPoint.type, selectedPoint.date, selectedPoint.time]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      ) : null}
    </MapShell>
  );
}

function MapShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 rounded-lg bg-white p-4 ring-1 ring-line">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
            Google Maps
          </p>
          <h4 className="mt-1 text-sm font-black text-ink">Itinerary route map</h4>
        </div>
      </div>
      {children}
    </div>
  );
}

function extractMapPoints(items?: unknown[] | null) {
  return (Array.isArray(items) ? items : [])
    .map((item, index) => normalizePoint(item, index))
    .filter((point): point is MapPoint => Boolean(point));
}

function normalizePoint(item: unknown, index: number): MapPoint | null {
  if (!item || typeof item !== "object") {
    return null;
  }

  const record = item as Record<string, unknown>;
  const location = readRecord(record.location);
  const coordinates = readRecord(record.coordinates);
  const latitude = firstNumber(
    record.latitude,
    record.lat,
    location?.latitude,
    location?.lat,
    coordinates?.latitude,
    coordinates?.lat
  );
  const longitude = firstNumber(
    record.longitude,
    record.lng,
    record.lon,
    location?.longitude,
    location?.lng,
    location?.lon,
    coordinates?.longitude,
    coordinates?.lng,
    coordinates?.lon
  );

  if (!isCoordinate(latitude, -90, 90) || !isCoordinate(longitude, -180, 180)) {
    return null;
  }

  const dateTime =
    readString(record.date_time) ||
    readString(record.datetime) ||
    readString(record.starttime) ||
    readString(record.start_time);

  return {
    id: readString(record.id) || `point-${index}`,
    title:
      readString(record.title) ||
      readString(record.name) ||
      readString(record.summary) ||
      `Stop ${index + 1}`,
    latitude,
    longitude,
    date:
      readString(record.date) ||
      readString(record.start_date) ||
      readString(record.day) ||
      readDate(dateTime),
    time: readString(record.time) || readTime(dateTime),
    type:
      readString(record.type) ||
      readString(record.segment_type) ||
      readString(record.kind) ||
      readString(record.category)
  };
}

function readRecord(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function readNumber(value: unknown) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function firstNumber(...values: unknown[]) {
  for (const value of values) {
    const parsed = readNumber(value);

    if (typeof parsed === "number") {
      return parsed;
    }
  }

  return undefined;
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readDate(value?: string) {
  return value?.slice(0, 10);
}

function readTime(value?: string) {
  if (!value) return undefined;
  return value.includes("T") ? value.slice(11, 16) : value.slice(0, 5);
}

function isCoordinate(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}
