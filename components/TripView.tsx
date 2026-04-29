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
};

type TripViewProps = {
  trip: TripViewTrip;
  items: TripViewItem[];
};

export default function TripView({ trip, items }: TripViewProps) {
  const firstMappedItem = items.find(hasCoordinates);
  const mapsUrl = firstMappedItem
    ? `https://www.google.com/maps/dir/?api=1&destination=${firstMappedItem.lat},${firstMappedItem.lng}`
    : null;

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-black tracking-tight text-ink">
            {trip.title || trip.name}
          </h1>
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

      <TripMap
        height={520}
        items={items
          .filter(hasCoordinates)
          .map((item) => ({
            id: item.id,
            title: item.title,
            lat: item.lat,
            lng: item.lng
          }))}
      />

      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="rounded-lg border border-line bg-white p-4 shadow-sm">
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
            <div className="font-semibold text-ink">{item.title}</div>
            <div className="mt-1 text-sm text-gray-500">{item.location || "No location"}</div>
            {item.notes ? (
              <div className="mt-2 text-sm text-gray-500">Note: {item.notes}</div>
            ) : null}
            <Comments itemId={item.id} />
          </div>
        ))}
      </div>
    </div>
  );
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
