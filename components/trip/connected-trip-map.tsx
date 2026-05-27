"use client";

import { useState } from "react";
import GoogleMapsProvider from "@/components/GoogleMapsProvider";
import TripMap, { type TripMapItem } from "@/components/TripMap";

type ConnectedTripMapProps = {
  destination: string | null;
  items: TripMapItem[];
  searchUrl: string | null;
};

export function ConnectedTripMap({ destination, items, searchUrl }: ConnectedTripMapProps) {
  const [selectedId, setSelectedId] = useState<string | null>(items[0]?.id ?? null);
  const selectedItem = items.find((item) => item.id === selectedId) ?? items[0];

  return (
    <div className="grid gap-4" data-testid="connected-trip-map">
      {items.length ? (
        <GoogleMapsProvider>
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-100">
            <TripMap
              height={460}
              items={items}
              selectedId={selectedId}
              onSelect={setSelectedId}
              travelMode="TRANSIT"
            />
          </div>
        </GoogleMapsProvider>
      ) : (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-sm text-slate-600">
          <p className="font-bold text-slate-950">No mapped stops yet.</p>
          <p className="mt-1">
            Add itinerary items with latitude and longitude to draw the route.
          </p>
          {searchUrl ? (
            <a
              className="mt-4 inline-flex rounded-2xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-700"
              href={searchUrl}
              rel="noreferrer"
              target="_blank"
            >
              Open {destination || "destination"} in Google Maps
            </a>
          ) : null}
        </div>
      )}

      {items.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
        {items.map((item, index) => {
          const active = item.id === selectedItem?.id;

          return (
            <button
              aria-current={active ? "true" : undefined}
              className={[
                "rounded-2xl border px-4 py-3 text-left text-sm transition",
                active
                  ? "border-blue-300 bg-blue-50 text-blue-950"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              ].join(" ")}
              key={item.id}
              onClick={() => setSelectedId(item.id)}
              type="button"
            >
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                Stop {index + 1}
              </span>
              <span className="mt-1 block font-semibold">{item.title}</span>
            </button>
          );
        })}
        </div>
      ) : null}
    </div>
  );
}
