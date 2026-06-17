"use client";

import {
  Circle,
  GoogleMap,
  OverlayView,
  Polyline
} from "@react-google-maps/api";
import { Fragment, useEffect, useMemo, useRef } from "react";
import {
  hasResolvedRoute,
  routeEndpointLabel,
  type TripRouteEndpoint,
  type TripSegmentRouteMetadata
} from "@/lib/trip-segment-route";

export type TripMapItem = {
  address?: string | null;
  bookingUrl?: string | null;
  category?: string | null;
  confirmationCode?: string | null;
  dayLabel?: string | null;
  endTime?: string | null;
  hasEndTime?: boolean;
  hasStartTime?: boolean;
  id: string;
  imageAlt?: string | null;
  imageAttribution?: string | null;
  imageUrl?: string | null;
  kind?: string | null;
  title: string;
  lat: number;
  lng: number;
  notes?: string | null;
  provider?: string | null;
  providerMetadata?: Record<string, unknown> | null;
  providerPlaceId?: string | null;
  route?: TripSegmentRouteMetadata | null;
  routeOrder?: number | null;
  status?: string | null;
  startTime?: string | null;
  timeLabel?: string | null;
};

export type TripTravelMode = "DRIVING" | "WALKING" | "BICYCLING" | "TRANSIT";

export type TripMapDistanceRing = {
  center: {
    lat: number;
    lng: number;
  };
  id: string;
  label: string;
  radiusMeters: number;
};

type LegInfo = {
  id: string;
  from: string;
  to: string;
  distance: string;
  duration: string;
};

type TripMapProps = {
  distanceRings?: TripMapDistanceRing[];
  items: TripMapItem[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  travelMode?: TripTravelMode;
  height?: number | string;
  mapTheme?: "default" | "dark";
  showRouteDetails?: boolean;
};

const fallbackCenter = { lat: 25.7617, lng: -80.1918 };
const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
const mapsConfigured = Boolean(mapsApiKey && !mapsApiKey.startsWith("YOUR_"));

export default function TripMap({
  distanceRings = [],
  items,
  selectedId,
  onSelect,
  height = 420,
  mapTheme = "default",
  showRouteDetails = false
}: TripMapProps) {
  const mapRef = useRef<google.maps.Map | null>(null);

  const mapPoints = useMemo(() => getMapPoints(items), [items]);
  const placeItems = useMemo(
    () => items.filter((item) => !hasResolvedRoute(item.route)),
    [items]
  );
  const routeItems = useMemo(
    () => items.filter((item) => hasResolvedRoute(item.route)),
    [items]
  );
  const center = useMemo(
    () => mapPoints[0] || fallbackCenter,
    [mapPoints]
  );
  const routePath = useMemo(
    () => placeItems.map((item) => ({ lat: item.lat, lng: item.lng })),
    [placeItems]
  );
  const markerPositions = useMemo(() => getMarkerPositions(placeItems), [placeItems]);
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
    mapPoints.forEach((point) => {
      bounds.extend(point);
    });
    mapRef.current.fitBounds(bounds);
  }, [mapPoints]);

  useEffect(() => {
    if (!mapRef.current || !selectedId) {
      return;
    }

    const item = items.find((currentItem) => currentItem.id === selectedId);

    if (item) {
      mapRef.current.panTo(getItemCenter(item));
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

  const googleMaps = window.google.maps;

  return (
    <div data-map-theme={mapTheme} data-testid="trip-map-canvas">
      <GoogleMap
        center={center}
        mapContainerStyle={containerStyle}
        onLoad={(map) => {
          mapRef.current = map;
        }}
        options={{
          backgroundColor: mapTheme === "dark" ? "#07182b" : undefined,
          colorScheme: mapTheme === "dark" ? googleMaps.ColorScheme?.DARK : undefined,
          clickableIcons: true,
          fullscreenControl: false,
          gestureHandling: "greedy",
          mapTypeControl: false,
          streetViewControl: false,
          styles: mapTheme === "dark" ? darkMapStyles : undefined,
          zoomControl: mapTheme === "dark" ? false : undefined
        }}
        zoom={12}
      >
        {distanceRings.map((ring, index) => (
          <Fragment key={ring.id}>
            <Circle
              center={ring.center}
              radius={ring.radiusMeters}
              options={{
                clickable: false,
                fillOpacity: 0,
                strokeColor: "#f8fafc",
                strokeOpacity: Math.max(0.28, 0.58 - index * 0.12),
                strokeWeight: index === 0 ? 2.5 : 2,
                zIndex: 1
              }}
            />
            <OverlayView
              position={ringLabelPosition(ring.center, ring.radiusMeters)}
              mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
            >
              <span
                className="pointer-events-none rounded-full bg-black/55 px-2 py-0.5 text-xs font-black text-white shadow-[0_2px_10px_rgba(0,0,0,0.45)] ring-1 ring-white/20"
                data-testid="map-distance-ring-label"
                style={{ transform: "translate(-50%, -50%)" }}
              >
                {ring.label}
              </span>
            </OverlayView>
          </Fragment>
        ))}

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

        {routeItems.map((item) => {
          const route = item.route;
          const origin = route?.origin;
          const destination = route?.destination;
          const originPosition = endpointPosition(origin);
          const destinationPosition = endpointPosition(destination);
          const order = item.routeOrder || items.findIndex((current) => current.id === item.id) + 1;
          const active = selectedId === item.id;

          if (!originPosition || !destinationPosition) return null;

          return (
            <Fragment key={`${item.id}-route`}>
              <Polyline
                path={[originPosition, destinationPosition]}
                options={{
                  geodesic: true,
                  strokeColor: active ? "#059669" : "#0f172a",
                  strokeOpacity: active ? 0.88 : 0.62,
                  strokeWeight: active ? 5 : 4
                }}
              />
              <EndpointMarker
                active={active}
                item={item}
                label="From"
                onSelect={onSelect}
                order={`${order}A`}
                position={originPosition}
                title={routeEndpointLabel(origin) || "Origin"}
              />
              <EndpointMarker
                active={active}
                item={item}
                label="To"
                onSelect={onSelect}
                order={`${order}B`}
                position={destinationPosition}
                title={routeEndpointLabel(destination) || "Destination"}
              />
            </Fragment>
          );
        })}

        {placeItems.map((item, index) => {
          const active = selectedId === item.id;
          const order = item.routeOrder || items.findIndex((current) => current.id === item.id) + 1;

          return (
          <OverlayView
            key={item.id}
            position={markerPositions[index] || { lat: item.lat, lng: item.lng }}
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

      {showRouteDetails && (routeInfo.distance || routeInfo.duration) ? (
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

      {showRouteDetails && legsInfo.length > 0 ? (
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

function EndpointMarker({
  active,
  item,
  label,
  onSelect,
  order,
  position,
  title
}: {
  active: boolean;
  item: TripMapItem;
  label: string;
  onSelect?: (id: string) => void;
  order: string;
  position: google.maps.LatLngLiteral;
  title: string;
}) {
  return (
    <OverlayView
      position={position}
      mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
    >
      <button
        aria-label={`Select ${label.toLowerCase()} for route ${item.title}: ${title}`}
        className={[
          "grid place-items-center rounded-full border-2 border-white text-[11px] font-black text-white shadow-lg transition",
          active ? "h-11 min-w-11 px-2 ring-4 ring-emerald-200" : "h-9 min-w-9 px-2 hover:scale-105"
        ].join(" ")}
        onClick={() => onSelect?.(item.id)}
        style={{
          backgroundColor: active ? "#059669" : "#0f172a",
          transform: "translate(-50%, -50%)"
        }}
        title={`${label}: ${title}`}
        type="button"
      >
        {order}
      </button>
    </OverlayView>
  );
}

function colorForMarker(item: TripMapItem) {
  const text = `${item.category || ""} ${item.status || ""}`.toLowerCase();
  if (hasResolvedRoute(item.route)) return "#0f172a";
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
  const places = items.filter((item) => !hasResolvedRoute(item.route));
  return places.slice(0, -1).map((item, index) => ({
    id: `${places[index]?.id || "origin"}-${places[index + 1]?.id || "destination"}`,
    from: item.title || `Place ${index + 1}`,
    to: places[index + 1]?.title || `Place ${index + 2}`,
    distance: formatDistance(getDistanceMeters(item, places[index + 1])),
    duration: "Route leg"
  }));
}

function getTotalDistanceMeters(items: TripMapItem[]) {
  const places = items.filter((item) => !hasResolvedRoute(item.route));
  const placeDistance = places
    .slice(0, -1)
    .reduce((total, item, index) => total + getDistanceMeters(item, places[index + 1]), 0);
  const routeDistance = items.reduce((total, item) => {
    const origin = endpointPosition(item.route?.origin);
    const destination = endpointPosition(item.route?.destination);
    if (!origin || !destination) return total;
    return total + getDistanceMeters(origin, destination);
  }, 0);

  return placeDistance + routeDistance;
}

function getMarkerPositions(items: TripMapItem[]) {
  const seen = new Map<string, number>();
  return items.map((item) => {
    const key = `${item.lat.toFixed(5)}:${item.lng.toFixed(5)}`;
    const count = seen.get(key) || 0;
    seen.set(key, count + 1);
    if (!count) return { lat: item.lat, lng: item.lng };
    const angle = count * 1.7;
    const radius = 0.00008 * Math.min(count, 4);
    return {
      lat: item.lat + Math.sin(angle) * radius,
      lng: item.lng + Math.cos(angle) * radius
    };
  });
}

function getDistanceMeters(
  a: Pick<TripMapItem, "lat" | "lng">,
  b: Pick<TripMapItem, "lat" | "lng">
) {
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

function getMapPoints(items: TripMapItem[]) {
  return items.flatMap((item) => {
    const origin = endpointPosition(item.route?.origin);
    const destination = endpointPosition(item.route?.destination);
    if (origin && destination) return [origin, destination];
    return [{ lat: item.lat, lng: item.lng }];
  });
}

function getItemCenter(item: TripMapItem) {
  const origin = endpointPosition(item.route?.origin);
  const destination = endpointPosition(item.route?.destination);
  if (origin && destination) {
    return {
      lat: (origin.lat + destination.lat) / 2,
      lng: (origin.lng + destination.lng) / 2
    };
  }
  return { lat: item.lat, lng: item.lng };
}

function endpointPosition(endpoint: TripRouteEndpoint | null | undefined) {
  if (typeof endpoint?.lat !== "number" || typeof endpoint.lng !== "number") {
    return null;
  }
  return { lat: endpoint.lat, lng: endpoint.lng };
}

function ringLabelPosition(center: google.maps.LatLngLiteral, radiusMeters: number) {
  return {
    lat: center.lat + radiusMeters / 111320,
    lng: center.lng
  };
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

const darkMapStyles: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#172238" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#cbd5e1" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#07111f" }, { weight: 3 }] },
  {
    featureType: "administrative",
    elementType: "geometry.stroke",
    stylers: [{ color: "#334155" }]
  },
  {
    featureType: "landscape.natural",
    elementType: "geometry",
    stylers: [{ color: "#123138" }]
  },
  {
    featureType: "poi",
    elementType: "geometry",
    stylers: [{ color: "#16323a" }]
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#f59e0b" }]
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#0f3b35" }]
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#2b3a55" }]
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#0f172a" }]
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#94a3b8" }]
  },
  {
    featureType: "transit",
    elementType: "geometry",
    stylers: [{ color: "#1e293b" }]
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#071331" }]
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#60a5fa" }]
  }
];
