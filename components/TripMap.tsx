"use client";

import {
  GoogleMap,
  OverlayView,
  Polyline
} from "@react-google-maps/api";
import { useEffect, useMemo, useRef } from "react";

export type TripMapItem = {
  address?: string | null;
  category?: string | null;
  dayLabel?: string | null;
  id: string;
  imageAlt?: string | null;
  imageAttribution?: string | null;
  imageUrl?: string | null;
  title: string;
  lat: number;
  lng: number;
  routeOrder?: number | null;
  status?: string | null;
  timeLabel?: string | null;
};

export type TripTravelMode = "DRIVING" | "WALKING" | "BICYCLING" | "TRANSIT";

type LegInfo = {
  id: string;
  from: string;
  to: string;
  distance: string;
  duration: string;
};

type TripMapProps = {
  items: TripMapItem[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  travelMode?: TripTravelMode;
  height?: number | string;
};

const fallbackCenter = { lat: 25.7617, lng: -80.1918 };
const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
const mapsConfigured = Boolean(mapsApiKey && !mapsApiKey.startsWith("YOUR_"));

export default function TripMap({
  items,
  selectedId,
  onSelect,
  height = 420
}: TripMapProps) {
  const mapRef = useRef<google.maps.Map | null>(null);

  const center = useMemo(
    () => (items[0] ? { lat: items[0].lat, lng: items[0].lng } : fallbackCenter),
    [items]
  );
  const routePath = useMemo(
    () => items.map((item) => ({ lat: item.lat, lng: item.lng })),
    [items]
  );
  const routeInfo = useMemo(() => getRouteInfo(items), [items]);
  const legsInfo = useMemo(() => getLegsInfo(items), [items]);
  const containerStyle = useMemo(
    () => ({
      height: typeof height === "number" ? `${height}px` : height,
      width: "100%"
    }),
    [height]
  );

  useEffect(() => {
    if (
      !mapRef.current ||
      !items.length ||
      typeof window === "undefined" ||
      typeof window.google?.maps?.LatLngBounds !== "function"
    ) {
      return;
    }

    const bounds = new window.google.maps.LatLngBounds();
    items.forEach((item) => {
      bounds.extend({ lat: item.lat, lng: item.lng });
    });
    mapRef.current.fitBounds(bounds);
  }, [items]);

  useEffect(() => {
    if (!mapRef.current || !selectedId) {
      return;
    }

    const item = items.find((currentItem) => currentItem.id === selectedId);

    if (item) {
      mapRef.current.panTo({ lat: item.lat, lng: item.lng });
      mapRef.current.setZoom(14);
    }
  }, [selectedId, items]);

  if (!mapsConfigured) {
    return (
      <MapUnavailable
        height={height}
        message="Maps are temporarily unavailable. You can still save places and try again later."
      />
    );
  }

  if (
    typeof window === "undefined" ||
    typeof window.google?.maps?.Map !== "function" ||
    typeof window.google?.maps?.LatLngBounds !== "function"
  ) {
    return (
      <MapUnavailable
        height={height}
        message="Preparing your map. Location details will appear shortly."
      />
    );
  }

  return (
    <div>
      <GoogleMap
        center={center}
        mapContainerStyle={containerStyle}
        onLoad={(map) => {
          mapRef.current = map;
        }}
        options={{
          clickableIcons: true,
          fullscreenControl: false,
          gestureHandling: "greedy",
          mapTypeControl: false,
          streetViewControl: false
        }}
        zoom={12}
      >
        {routePath.length > 1 ? (
          <Polyline
            path={routePath}
            options={{
              geodesic: true,
              strokeColor: "#2563eb",
              strokeOpacity: 0.82,
              strokeWeight: 5
            }}
          />
        ) : null}

        {items.map((item, index) => {
          const active = selectedId === item.id;
          const order = item.routeOrder || index + 1;

          return (
          <OverlayView
            key={item.id}
            position={{ lat: item.lat, lng: item.lng }}
            mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
          >
            <button
              aria-label={`Select place ${order}: ${item.title}`}
              className={[
                "grid place-items-center rounded-full border-2 border-white text-sm font-black text-white shadow-lg transition",
                active ? "h-11 w-11 ring-4 ring-green-200" : "h-9 w-9 hover:scale-105"
              ].join(" ")}
              onClick={() => onSelect?.(item.id)}
              style={{
                backgroundColor: active ? "#16a34a" : colorForMarker(item),
                transform: "translate(-50%, -50%)"
              }}
              title={`${order}. ${item.title}`}
              type="button"
            >
              {order}
            </button>
          </OverlayView>
          );
        })}
      </GoogleMap>

      {routeInfo.distance || routeInfo.duration ? (
        <div className="mb-3 mt-3 rounded-lg border border-line bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-gray-500">Route preview</div>
              <div className="text-lg font-semibold">{routeInfo.distance}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Places mapped</div>
              <div className="text-lg font-semibold">{items.length}</div>
            </div>
          </div>
          <div className="mt-1 text-xs text-gray-400">
            Approximate path between your ordered places.
          </div>
        </div>
      ) : null}

      {legsInfo.length > 0 ? (
        <div className="mt-4 space-y-2 rounded-lg border border-line bg-white p-3 shadow-sm">
          {legsInfo.map((leg, index) => (
            <div key={leg.id || index} className="text-sm text-gray-600">
              <strong>{leg.duration}</strong> - {leg.distance}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function colorForMarker(item: TripMapItem) {
  const text = `${item.category || ""} ${item.status || ""}`.toLowerCase();
  if (text.includes("restaurant") || text.includes("dinner") || text.includes("food")) return "#7c3aed";
  if (text.includes("park") || text.includes("garden")) return "#059669";
  if (text.includes("shopping")) return "#db2777";
  if (text.includes("tour") || text.includes("activity")) return "#2563eb";
  if (text.includes("unscheduled")) return "#64748b";
  return "#2563eb";
}

function MapUnavailable({ height, message }: { height: number | string; message: string }) {
  return (
    <div
      className="grid place-items-center bg-slate-100 p-6 text-center text-sm font-bold text-slate-600"
      style={{ height: typeof height === "number" ? `${height}px` : height }}
    >
      <p className="max-w-sm">{message}</p>
    </div>
  );
}

function getRouteInfo(items: TripMapItem[]) {
  const meters = getTotalDistanceMeters(items);

  return {
    distance: meters ? formatDistance(meters) : "",
    duration: meters ? "Polyline" : ""
  };
}

function getLegsInfo(items: TripMapItem[]) {
  return items.slice(0, -1).map((item, index) => ({
    id: `${items[index]?.id || "origin"}-${items[index + 1]?.id || "destination"}`,
    from: item.title || `Place ${index + 1}`,
    to: items[index + 1]?.title || `Place ${index + 2}`,
    distance: formatDistance(getDistanceMeters(item, items[index + 1])),
    duration: "Coordinate path"
  }));
}

function getTotalDistanceMeters(items: TripMapItem[]) {
  return items
    .slice(0, -1)
    .reduce((total, item, index) => total + getDistanceMeters(item, items[index + 1]), 0);
}

function getDistanceMeters(a: TripMapItem, b: TripMapItem) {
  const earthRadiusMeters = 6371000;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function formatDistance(meters: number) {
  const miles = meters / 1609.344;

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: miles >= 10 ? 0 : 1
  }).format(miles) + " mi";
}
