"use client";

import {
  DirectionsRenderer,
  GoogleMap,
  Marker,
  useJsApiLoader
} from "@react-google-maps/api";
import { useEffect, useMemo, useRef, useState } from "react";
import { googleMapsLibraries } from "@/lib/google-maps";

export type TripMapItem = {
  id: string;
  title: string;
  lat: number;
  lng: number;
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
  height?: number;
};

const fallbackCenter = { lat: 25.7617, lng: -80.1918 };

export default function TripMap({
  items,
  selectedId,
  onSelect,
  travelMode = "WALKING",
  height = 420
}: TripMapProps) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [routeInfo, setRouteInfo] = useState({
    distance: "",
    duration: ""
  });
  const [legsInfo, setLegsInfo] = useState<LegInfo[]>([]);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
    libraries: googleMapsLibraries
  });

  const center = useMemo(
    () => (items[0] ? { lat: items[0].lat, lng: items[0].lng } : fallbackCenter),
    [items]
  );
  const containerStyle = useMemo(
    () => ({ width: "100%", height: `${height}px` }),
    [height]
  );

  useEffect(() => {
    if (!isLoaded || !mapRef.current || !items.length || !window.google) {
      return;
    }

    const bounds = new window.google.maps.LatLngBounds();
    items.forEach((item) => {
      bounds.extend({ lat: item.lat, lng: item.lng });
    });
    mapRef.current.fitBounds(bounds);
  }, [isLoaded, items]);

  useEffect(() => {
    if (!isLoaded || !window.google || items.length < 2) {
      setDirections(null);
      setRouteInfo({ distance: "", duration: "" });
      setLegsInfo([]);
      return;
    }

    const directionsService = new window.google.maps.DirectionsService();
    const request = {
      origin: { lat: items[0].lat, lng: items[0].lng },
      destination: {
        lat: items[items.length - 1].lat,
        lng: items[items.length - 1].lng
      },
      waypoints: items.slice(1, -1).map((item) => ({
        location: { lat: item.lat, lng: item.lng },
        stopover: true
      })),
      travelMode: window.google.maps.TravelMode[travelMode],
      optimizeWaypoints: false
    };

    directionsService.route(
      request,
      (result, status) => {
        if (status === window.google.maps.DirectionsStatus.OK && result) {
          setDirections(result);
          setRouteInfo(getRouteInfo(result));
          setLegsInfo(getLegsInfo(result, items));
          return;
        }

        if (travelMode !== "DRIVING") {
          console.warn("Fallback to DRIVING");
          directionsService.route(
            {
              ...request,
              travelMode: window.google.maps.TravelMode.DRIVING
            },
            (fallbackResult, fallbackStatus) => {
              if (
                fallbackStatus === window.google.maps.DirectionsStatus.OK &&
                fallbackResult
              ) {
                setDirections(fallbackResult);
                setRouteInfo(getRouteInfo(fallbackResult));
                setLegsInfo(getLegsInfo(fallbackResult, items));
                return;
              }

              setDirections(null);
              setRouteInfo({ distance: "", duration: "" });
              setLegsInfo([]);
            }
          );
          return;
        }

        setDirections(null);
        setRouteInfo({ distance: "", duration: "" });
        setLegsInfo([]);
      }
    );
  }, [isLoaded, items, travelMode]);

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

  if (!isLoaded) {
    return (
      <div
        className="grid place-items-center bg-slate-100 text-sm font-bold text-slate-600"
        style={{ height }}
      >
        Loading map...
      </div>
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
        options={{ streetViewControl: false, mapTypeControl: false }}
        zoom={12}
      >
        {items.map((item) => (
          <Marker
            key={item.id}
            icon={
              selectedId === item.id
                ? { url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png" }
                : undefined
            }
            position={{ lat: item.lat, lng: item.lng }}
            title={item.title}
            onClick={() => onSelect?.(item.id)}
          />
        ))}

        {directions ? (
          <DirectionsRenderer
            directions={directions}
            options={{
              suppressMarkers: true,
              polylineOptions: {
                strokeColor: "#111827",
                strokeWeight: 4
              }
            }}
          />
        ) : null}
      </GoogleMap>

      {routeInfo.distance || routeInfo.duration ? (
        <div className="mb-3 mt-3 rounded-lg border border-line bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-gray-500">Total Distance</div>
              <div className="text-lg font-semibold">{routeInfo.distance}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Travel Time</div>
              <div className="text-lg font-semibold">{routeInfo.duration}</div>
            </div>
          </div>
          <div className="mt-1 text-xs text-gray-400">
            Mode: {travelMode.toLowerCase()}
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

function getRouteInfo(result: google.maps.DirectionsResult) {
  const legs = result.routes[0]?.legs || [];
  const meters = legs.reduce((total, leg) => total + (leg.distance?.value || 0), 0);
  const seconds = legs.reduce((total, leg) => total + (leg.duration?.value || 0), 0);

  return {
    distance: meters ? formatDistance(meters) : "",
    duration: seconds ? formatDuration(seconds) : ""
  };
}

function getLegsInfo(result: google.maps.DirectionsResult, items: TripMapItem[]) {
  const legs = result.routes[0]?.legs || [];

  return legs.map((leg, index) => ({
    id: `${items[index]?.id || "origin"}-${items[index + 1]?.id || "destination"}`,
    from: leg.start_address || items[index]?.title || `Stop ${index + 1}`,
    to: leg.end_address || items[index + 1]?.title || `Stop ${index + 2}`,
    distance: leg.distance?.text || "",
    duration: leg.duration?.text || ""
  }));
}

function formatDistance(meters: number) {
  const miles = meters / 1609.344;

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: miles >= 10 ? 0 : 1
  }).format(miles) + " mi";
}

function formatDuration(seconds: number) {
  const minutes = Math.round(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours === 0) {
    return `${minutes} min`;
  }

  return remainingMinutes ? `${hours} hr ${remainingMinutes} min` : `${hours} hr`;
}
