"use client";

import Comments from "@/components/Comments";
import TripMap from "@/components/TripMap";

type TripViewTrip = {
  title?: string | null;
  name?: string | null;
  start_date?: string | null;
  end_date?: string | null;
};

type TripViewItem = {
  id: string;
  title: string;
  location: string | null;
  lat: number | null;
  lng: number | null;
  notes?: string | null;
  image_url?: string | null;
  image_urls?: string[] | null;
  segment_type?: string | null;
  provider?: string | null;
  confirmation_code?: string | null;
  booking_url?: string | null;
  date_time?: string | null;
};

type TripViewProps = {
  trip: TripViewTrip;
  items: TripViewItem[];
};

export default function TripView({ trip, items }: TripViewProps) {
  const mappedItems = items.filter(hasCoordinates);
  const firstMappedItem = mappedItems[0];
  const tripTitle = trip.title || trip.name || "Trip itinerary";
  const mapsUrl = firstMappedItem
    ? `https://www.google.com/maps/dir/?api=1&destination=${firstMappedItem.lat},${firstMappedItem.lng}`
    : null;

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h2 className="text-2xl font-black tracking-tight text-ink">{tripTitle}</h2>
          <p className="text-sm font-medium text-gray-500">
            {trip.start_date || "Start date"} to {trip.end_date || "End date"}
          </p>
        </div>
        {mapsUrl ? (
          <a
            className="rounded-lg bg-black px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-800"
            href={mapsUrl}
            rel="noreferrer"
            target="_blank"
          >
            Open in Google Maps
          </a>
        ) : null}
      </div>

      {mappedItems.length > 0 ? (
        <TripMap
          height={520}
          items={mappedItems.map((item) => ({
            id: item.id,
            title: item.title,
            lat: item.lat,
            lng: item.lng
          }))}
        />
      ) : (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-sm font-semibold text-slate-600">
          No mapped stops yet. Add locations with coordinates to show this trip on a map.
        </div>
      )}

      <div className="space-y-3">
        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-white p-6 text-sm font-semibold text-slate-600">
            No itinerary items have been shared yet.
          </div>
        ) : (
          items.map((item) => (
            <div
              data-trip-item-card="true"
              key={item.id}
              className="rounded-lg border border-line bg-white p-4 shadow-sm"
            >
              {getItemImages(item).length > 0 ? (
                <div className="mb-3 grid gap-2 sm:grid-cols-2">
                  {getItemImages(item).map((url, index) => (
                    <img
                      key={`${url}-${index}`}
                      alt={item.title}
                      className="h-40 w-full rounded-lg object-cover"
                      loading="lazy"
                      src={url}
                    />
                  ))}
                </div>
              ) : null}
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-ink">{item.title}</div>
                  <div className="mt-1 text-sm text-gray-500">
                    {item.location || "No location"}
                  </div>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase tracking-[0.08em] text-slate-600">
                  {formatSegmentType(item.segment_type)}
                </span>
              </div>
              <div className="mt-3 grid gap-2 text-sm sm:grid-cols-4">
                <TripFact label="Time" value={item.date_time ? formatTime(item.date_time) : "Pending"} />
                <TripFact label="Provider" value={item.provider || "Pending"} />
                <TripFact
                  label="Confirmation"
                  value={item.confirmation_code || "Not added"}
                />
                <div className="rounded-lg bg-slate-50 p-3">
                  <div className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                    Booking
                  </div>
                  {item.booking_url ? (
                    <a
                      className="mt-1 block truncate text-sm font-bold text-brand hover:underline"
                      href={item.booking_url}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Open
                    </a>
                  ) : (
                    <div className="mt-1 text-sm font-bold text-ink">Not added</div>
                  )}
                </div>
              </div>
              {item.notes ? (
                <div className="mt-2 text-sm text-gray-500">Note: {item.notes}</div>
              ) : null}
              <Comments itemId={item.id} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function TripFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <div className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-sm font-bold text-ink">{value}</div>
    </div>
  );
}

function formatSegmentType(value?: string | null) {
  return value ? value.replace(/_/g, " ") : "activity";
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function hasCoordinates(
  item: TripViewItem
): item is TripViewItem & { lat: number; lng: number } {
  return typeof item.lat === "number" && typeof item.lng === "number";
}

function getItemImages(item: TripViewItem) {
  return [item.image_url, ...(item.image_urls || [])].filter(
    (url): url is string => Boolean(url)
  );
}
