"use client";

import { useEffect, useMemo, useState } from "react";
import TripMap, { type TripMapItem } from "@/components/TripMap";
import type { DashboardTimelineItem } from "@/components/DraggableList";
import { TripButton, TripCard, TripEyebrow, tripUi } from "@/components/trip-ui";

type MapPin = {
  id: string;
  title: string;
  location: string;
  lat: number;
  lng: number;
  segmentType: string | null;
  provider: string | null;
  confirmationCode: string | null;
  dateTime: string | null;
};

type TripMapTabProps = {
  items: DashboardTimelineItem[];
  selectedId?: string | null;
  ariaLabelledBy?: string;
  onSelect?: (id: string) => void;
  onOpenDetails?: (id: string) => void;
  onOpenTransport?: (id: string, originId?: string | null) => void;
  className?: string;
};

export function TripMapTab({
  items,
  selectedId = null,
  ariaLabelledBy,
  onSelect,
  onOpenDetails,
  onOpenTransport,
  className = ""
}: TripMapTabProps) {
  const [pins, setPins] = useState<MapPin[]>([]);
  const [loading, setLoading] = useState(false);
  const geocodableItems = useMemo(
    () => items.filter((item) => Boolean(item.location?.trim())),
    [items]
  );
  const selectedPin = pins.find((pin) => pin.id === selectedId) ?? pins[0] ?? null;

  useEffect(() => {
    let active = true;

    async function resolvePins() {
      setLoading(true);

      try {
        const nextPins = await Promise.all(
          geocodableItems.map(async (item) => {
            const location = item.location?.trim();

            if (!location) return null;

            const coords = await geocodeLocation(location, item);

            if (!coords) return null;

            return {
              id: item.id,
              title: item.title,
              location,
              lat: coords.lat,
              lng: coords.lng,
              segmentType: item.segment_type ?? null,
              provider: item.provider ?? null,
              confirmationCode: item.confirmation_code ?? null,
              dateTime: item.date_time ?? null
            } satisfies MapPin;
          })
        );

        if (!active) return;
        setPins(nextPins.filter((pin): pin is MapPin => Boolean(pin)));
      } finally {
        if (active) setLoading(false);
      }
    }

    resolvePins();

    return () => {
      active = false;
    };
  }, [geocodableItems]);

  useEffect(() => {
    if (!selectedId && selectedPin) {
      onSelect?.(selectedPin.id);
    }
  }, [onSelect, selectedId, selectedPin]);

  return (
    <section
      aria-labelledby={ariaLabelledBy}
      className={`grid gap-4 ${className}`}
      data-testid="trip-map-panel"
      id="trip-tabpanel-map"
      role="tabpanel"
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-black">Map</h3>
          <p className={`text-sm ${tripUi.text.bodyMuted}`}>
            {pins.length} pin{pins.length === 1 ? "" : "s"} on the trip map
          </p>
        </div>
        <TripButton
          disabled={!selectedPin}
          onClick={() => {
            if (selectedPin) onOpenTransport?.(selectedPin.id, null);
          }}
          variant="secondary"
        >
          Transport options
        </TripButton>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <TripMapView
          loading={loading}
          pins={pins}
          selectedId={selectedPin?.id ?? null}
          onSelect={(id) => onSelect?.(id)}
        />

        <PlanCarousel
          pins={pins}
          selectedId={selectedPin?.id ?? null}
          onOpenDetails={onOpenDetails}
          onOpenTransport={onOpenTransport}
          onSelect={(id) => onSelect?.(id)}
        />
      </div>

      {geocodableItems.length > pins.length && !loading ? (
        <div className={`rounded-2xl bg-[#f7f6f2] p-4 text-sm ${tripUi.text.bodyMuted}`}>
          {geocodableItems.length - pins.length} addressed plan
          {geocodableItems.length - pins.length === 1 ? "" : "s"} could not be
          resolved into map pins.
        </div>
      ) : null}
    </section>
  );
}

function TripMapView({
  pins,
  selectedId,
  loading,
  onSelect
}: {
  pins: MapPin[];
  selectedId: string | null;
  loading: boolean;
  onSelect: (id: string) => void;
}) {
  const mapItems = useMemo(
    () =>
      pins.map<TripMapItem>((pin) => ({
        id: pin.id,
        title: pin.title,
        lat: pin.lat,
        lng: pin.lng
      })),
    [pins]
  );

  if (loading) {
    return <MapPlaceholder text="Loading map pins..." />;
  }

  if (pins.length === 0) {
    return (
      <MapPlaceholder text="No pins yet. Add an itinerary item with a valid address to see it on the map." />
    );
  }

  return (
    <div
      className="relative min-h-[420px] overflow-hidden rounded-2xl border border-black/10 bg-slate-100"
      data-testid="trip-map-view"
    >
      <TripMap
        height={460}
        items={mapItems}
        selectedId={selectedId}
        onSelect={onSelect}
      />
      <div className="pointer-events-none absolute inset-0">
        {pins.map((pin, index) => {
          const active = pin.id === selectedId;
          const left = 14 + ((index * 19) % 68);
          const top = 18 + ((index * 23) % 58);

          return (
            <button
              key={pin.id}
              type="button"
              aria-label={`${pin.title}, ${pin.location}`}
              className={`pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 rounded-full px-3 py-2 text-xs font-black shadow-lg transition ${
                active ? "scale-110 bg-brand text-white" : "bg-white text-ink"
              }`}
              data-testid={`map-pin-${pin.id}`}
              style={{ left: `${left}%`, top: `${top}%` }}
              onClick={() => onSelect(pin.id)}
            >
              {index + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PlanCarousel({
  pins,
  selectedId,
  onSelect,
  onOpenDetails,
  onOpenTransport
}: {
  pins: MapPin[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onOpenDetails?: (id: string) => void;
  onOpenTransport?: (id: string, originId?: string | null) => void;
}) {
  if (pins.length === 0) {
    return (
      <div className={`rounded-2xl border border-dashed border-black/10 p-4 text-sm ${tripUi.text.bodyMuted}`}>
        Add a valid address to an itinerary item to make it appear in map view.
      </div>
    );
  }

  return (
    <div
      className="flex gap-3 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible"
      data-testid="map-carousel"
    >
      {pins.map((pin) => {
        const active = pin.id === selectedId;

        return (
          <TripCard
            as="article"
            aria-current={active ? "true" : undefined}
            className={`min-w-[260px] p-4 transition ${
              active ? "border-brand bg-blue-50" : ""
            }`}
            data-testid={`map-card-${pin.id}`}
            key={pin.id}
            variant="surfaceSoft"
            onClick={() => onSelect(pin.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelect(pin.id);
              }
            }}
            tabIndex={0}
          >
            <TripEyebrow>{pin.segmentType || "plan"}</TripEyebrow>
            <h4 className="mt-1 font-black">{pin.title}</h4>
            <p className={`mt-1 text-sm ${tripUi.text.bodyMuted}`}>{pin.location}</p>
            {pin.provider || pin.confirmationCode || pin.dateTime ? (
              <p className={`mt-2 text-xs font-bold ${tripUi.text.bodyMuted}`}>
                {[pin.provider, pin.confirmationCode, formatPinDate(pin.dateTime)]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <TripButton onClick={() => onSelect(pin.id)} variant="secondary">
                View on map
              </TripButton>
              <TripButton onClick={() => onOpenDetails?.(pin.id)} variant="secondary">
                See details
              </TripButton>
              <TripButton
                onClick={() => onOpenTransport?.(pin.id, null)}
                variant="primaryCompact"
              >
                See Transport Options
              </TripButton>
            </div>
          </TripCard>
        );
      })}
    </div>
  );
}

function MapPlaceholder({ text }: { text: string }) {
  return (
    <div
      className={`grid min-h-[420px] place-items-center rounded-2xl border border-dashed border-black/10 bg-white p-6 text-center text-sm ${tripUi.text.bodyMuted}`}
      data-testid="trip-map-view"
    >
      <p className="max-w-sm">{text}</p>
    </div>
  );
}

async function geocodeLocation(
  location: string,
  item: DashboardTimelineItem
): Promise<{ lat: number; lng: number } | null> {
  if (isCoordinatePair(item.lat, item.lng)) {
    return { lat: item.lat as number, lng: item.lng as number };
  }

  return fakeGeocode(location);
}

async function fakeGeocode(location: string) {
  const hash = Array.from(location).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);

  return {
    lat: 25 + (hash % 30) + (hash % 100) / 1000,
    lng: -125 + (hash % 40) + (hash % 100) / 1000
  };
}

function isCoordinatePair(lat: unknown, lng: unknown): lat is number {
  return (
    typeof lat === "number" &&
    Number.isFinite(lat) &&
    typeof lng === "number" &&
    Number.isFinite(lng)
  );
}

function formatPinDate(value?: string | null) {
  if (!value) return null;

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}
