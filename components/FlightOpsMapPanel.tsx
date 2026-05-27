"use client";

import { useEffect, useRef } from "react";

type LatLng = { lat: number; lng: number };

export default function FlightOpsMapPanel({
  position,
  bearing,
  className = "h-[420px]"
}: {
  position: LatLng | null;
  bearing: number | null;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);

  useEffect(() => {
    if (!ref.current || mapRef.current || typeof window === "undefined" || !window.google) {
      return;
    }

    const center = position ?? { lat: 25.7617, lng: -80.1918 };
    mapRef.current = new window.google.maps.Map(ref.current, {
      center,
      zoom: position ? 6 : 4,
      fullscreenControl: false,
      mapTypeControl: false,
      streetViewControl: false,
      styles: [
        { elementType: "geometry", stylers: [{ color: "#0f172a" }] },
        { elementType: "labels.text.fill", stylers: [{ color: "#94a3b8" }] },
        { elementType: "labels.text.stroke", stylers: [{ color: "#0f172a" }] },
        { featureType: "road", elementType: "geometry", stylers: [{ color: "#1e293b" }] },
        { featureType: "water", elementType: "geometry", stylers: [{ color: "#0b1220" }] }
      ]
    });

    markerRef.current = new window.google.maps.Marker({
      map: mapRef.current,
      position: center,
      title: "Aircraft",
      icon: {
        fillColor: "#38bdf8",
        fillOpacity: 1,
        path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
        rotation: bearing ?? 0,
        scale: 5,
        strokeColor: "#f8fafc",
        strokeWeight: 2
      }
    });
  }, [position, bearing]);

  useEffect(() => {
    if (!mapRef.current || !position) {
      return;
    }

    mapRef.current.panTo(position);
    markerRef.current?.setPosition(position);
    const icon = markerRef.current?.getIcon();

    if (markerRef.current && icon && typeof icon === "object") {
      markerRef.current.setIcon({ ...icon, rotation: bearing ?? 0 });
    }
  }, [position, bearing]);

  if (typeof window !== "undefined" && !window.google) {
    return (
      <div className={`grid place-items-center bg-slate-950 text-sm text-slate-400 ${className}`}>
        Google Maps is still loading or could not be reached.
      </div>
    );
  }

  return <div ref={ref} className={`w-full ${className}`} />;
}
