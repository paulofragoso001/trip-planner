"use client";

import { useEffect, useRef, useState } from "react";

export type LatLng = { lat: number; lng: number };

export type CiriumTrackPoint = {
  lat: number;
  lng: number;
  bearing?: number;
  speed?: number;
  altitude?: number;
  timestamp?: string;
};

type UseCiriumFlightMapSyncOptions = {
  flightId: string;
  tripId: string;
  enabled?: boolean;
  pollMs?: number;
  animationMs?: number;
  onPosition?: (point: CiriumTrackPoint) => void;
};

async function fetchCiriumTrack(
  { flightId, tripId }: { flightId: string; tripId: string },
  signal?: AbortSignal
): Promise<CiriumTrackPoint | null> {
  const url = new URL("/api/cirium/flight-track", window.location.origin);
  url.searchParams.set("flightId", flightId);
  url.searchParams.set("tripId", tripId);

  const res = await fetch(url, {
    method: "GET",
    cache: "no-store",
    signal
  });

  if (!res.ok) {
    throw new Error(`Failed to load flight track: ${res.status}`);
  }

  const json = await res.json();
  const point =
    json?.track?.position ??
    json?.flightTrack?.position ??
    json?.position;

  if (!point) {
    return null;
  }

  const lat = Number(point.lat ?? point.latitude);
  const lng = Number(point.lng ?? point.lon ?? point.longitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return {
    lat,
    lng,
    bearing: readOptionalNumber(point.bearing ?? point.heading),
    speed: readOptionalNumber(point.speed ?? point.groundSpeed),
    altitude: readOptionalNumber(point.altitude),
    timestamp: point.timestamp ?? point.updatedAt ?? json?.track?.lastUpdated
  };
}

export function useCiriumFlightMapSync({
  flightId,
  tripId,
  enabled = true,
  pollMs = 15_000,
  animationMs = 1_200,
  onPosition
}: UseCiriumFlightMapSyncOptions) {
  const [position, setPosition] = useState<LatLng | null>(null);
  const [trackPoint, setTrackPoint] = useState<CiriumTrackPoint | null>(null);
  const [bearing, setBearing] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const lastPositionRef = useRef<LatLng | null>(null);
  const rafRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const currentHeadingRef = useRef<number | null>(null);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  function animateTo(from: LatLng, to: LatLng, nextBearing?: number) {
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
    }

    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (reducedMotion || animationMs <= 0) {
      finishAnimation(to, nextBearing);
      return;
    }

    const start = performance.now();
    const step = (now: number) => {
      const rawT = Math.min(1, (now - start) / animationMs);
      const easedT = rawT * rawT * (3 - 2 * rawT);
      const next = {
        lat: lerp(from.lat, to.lat, easedT),
        lng: lerp(from.lng, to.lng, easedT)
      };

      setPosition(next);
      markerRef.current?.setPosition(next);

      if (nextBearing !== undefined) {
        const startHeading = currentHeadingRef.current ?? nextBearing;
        const endHeading = normalizeHeading(startHeading, nextBearing);
        const heading = lerp(startHeading, endHeading, easedT);
        setBearing(heading);
        currentHeadingRef.current = heading;
        rotateMarkerIcon(markerRef.current, heading);
      }

      if (rawT < 1 && mountedRef.current) {
        rafRef.current = window.requestAnimationFrame(step);
        return;
      }

      finishAnimation(to, nextBearing);
    };

    rafRef.current = window.requestAnimationFrame(step);
  }

  function finishAnimation(nextPosition: LatLng, nextBearing?: number) {
    lastPositionRef.current = nextPosition;
    setPosition(nextPosition);
    markerRef.current?.setPosition(nextPosition);

    if (nextBearing !== undefined) {
      setBearing(nextBearing);
      currentHeadingRef.current = nextBearing;
      rotateMarkerIcon(markerRef.current, nextBearing);
    }
  }

  useEffect(() => {
    if (!enabled || !flightId || !tripId) {
      return;
    }

    let activeController: AbortController | null = null;
    let timer: number | undefined;

    const sync = async () => {
      activeController?.abort();
      const controller = new AbortController();
      activeController = controller;

      try {
        setLoading(true);
        const point = await fetchCiriumTrack(
          { flightId, tripId },
          controller.signal
        );

        if (!mountedRef.current || !point) {
          return;
        }

        const nextPosition = { lat: point.lat, lng: point.lng };
        const previousPosition = lastPositionRef.current;
        setTrackPoint(point);
        setError(null);
        onPosition?.(point);

        if (!previousPosition) {
          finishAnimation(nextPosition, point.bearing);
          return;
        }

        animateTo(previousPosition, nextPosition, point.bearing);
      } catch (err) {
        if (!mountedRef.current || controller.signal.aborted) {
          return;
        }

        setError(err instanceof Error ? err.message : "Failed to sync flight position");
      } finally {
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    };

    void sync();
    timer = window.setInterval(sync, pollMs);

    return () => {
      activeController?.abort();
      if (timer) {
        window.clearInterval(timer);
      }
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
      }
    };
  }, [enabled, flightId, tripId, pollMs, animationMs, onPosition]);

  return {
    position,
    trackPoint,
    bearing,
    loading,
    error,
    markerRef,
    setMarkerInstance(marker: google.maps.Marker | null) {
      markerRef.current = marker;
      if (marker && position) {
        marker.setPosition(position);
      }
      if (marker && bearing !== null) {
        rotateMarkerIcon(marker, bearing);
      }
    }
  };
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function normalizeHeading(from: number, to: number) {
  const delta = (to - from + 540) % 360 - 180;
  return from + delta;
}

function rotateMarkerIcon(marker: google.maps.Marker | null, heading: number) {
  const icon = marker?.getIcon();

  if (!marker || !icon || typeof icon !== "object" || !("path" in icon)) {
    return;
  }

  marker.setIcon({
    ...icon,
    rotation: heading
  });
}

function readOptionalNumber(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}
