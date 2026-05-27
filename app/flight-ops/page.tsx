"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  FlightOpsCommandCenter,
  buildFlightOpsIncidents,
  type LatLng,
  type MetricsResponse,
  type QueueHealth,
  type QueueSample,
  type TrackPoint
} from "@/components/FlightOpsCommandCenter";
import {
  defaultThresholdPolicy,
  evaluateThresholdPolicy
} from "@/components/ThresholdManager";

type StreamMessage =
  | {
      type: "connected";
      ok: true;
      timestamp: string;
    }
  | {
      type: "metrics";
      timestamp: string;
      health: MetricsResponse;
    }
  | {
      type: "error";
      message: string;
    };

export default function FlightOpsDashboard() {
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [track, setTrack] = useState<TrackPoint[]>([]);
  const [markerPosition, setMarkerPosition] = useState<LatLng | null>(null);
  const [mapBearing, setMapBearing] = useState<number | null>(null);
  const [queueHistory, setQueueHistory] = useState<QueueSample[]>([]);
  const sourceRef = useRef<EventSource | null>(null);
  const fallbackTimerRef = useRef<number | null>(null);

  const flightLookup = useMemo(() => {
    if (typeof window === "undefined") {
      return { tripId: "", flightId: "" };
    }

    const params = new URLSearchParams(window.location.search);
    return {
      tripId: params.get("tripId") || "",
      flightId: params.get("flightId") || ""
    };
  }, []);

  async function fetchHealth() {
    const res = await fetch("/api/health", { cache: "no-store" });
    if (!res.ok) throw new Error(`Health request failed: ${res.status}`);
    const json = (await res.json()) as MetricsResponse;
    setMetrics(json);
    return json;
  }

  function appendSnapshot(queue: QueueHealth, timestamp: string) {
    setQueueHistory((prev) => [
      ...prev.slice(-59),
      {
        time: new Date(timestamp).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit"
        }),
        waiting: queue.waiting,
        active: queue.active,
        failed: queue.failed,
        stalled: queue.stalled
      }
    ]);
  }

  async function fetchTrack() {
    if (!flightLookup.tripId || !flightLookup.flightId) {
      return;
    }

    const params = new URLSearchParams({
      tripId: flightLookup.tripId,
      flightId: flightLookup.flightId
    });
    const res = await fetch(`/api/cirium/flight-track?${params.toString()}`, {
      cache: "no-store"
    });

    if (!res.ok) throw new Error(`Track request failed: ${res.status}`);

    const json = await res.json();
    const position =
      json?.track?.position ??
      json?.flightTrack?.position ??
      json?.position;

    if (!position) {
      return;
    }

    const nextPoint: TrackPoint = {
      lat: Number(position.lat ?? position.latitude),
      lng: Number(position.lng ?? position.lon ?? position.longitude),
      bearing: readOptionalNumber(position.bearing ?? position.heading),
      speed: readOptionalNumber(position.speed ?? position.groundSpeed),
      altitude: readOptionalNumber(position.altitude),
      timestamp: position.timestamp ?? json?.track?.lastUpdated ?? new Date().toISOString()
    };

    if (!Number.isFinite(nextPoint.lat) || !Number.isFinite(nextPoint.lng)) {
      return;
    }

    setMarkerPosition({ lat: nextPoint.lat, lng: nextPoint.lng });
    setMapBearing(nextPoint.bearing ?? null);
    setTrack((prev) => [...prev.slice(-49), nextPoint]);
  }

  async function refresh() {
    try {
      setLoading(true);
      setMetricsError(null);
      const health = await fetchHealth();
      await fetchTrack();
      appendSnapshot(health.queue, health.timestamp);
    } catch (err) {
      setMetricsError(err instanceof Error ? err.message : "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let mounted = true;

    void refresh();
    const eventSource = new EventSource("/api/stream/metrics");
    sourceRef.current = eventSource;

    eventSource.addEventListener("connected", () => {
      if (!mounted) return;
      setConnected(true);
      setMetricsError(null);
    });

    eventSource.addEventListener("metrics", (event) => {
      void (async () => {
        try {
          const message = JSON.parse((event as MessageEvent).data) as StreamMessage;
          if (message.type !== "metrics") {
            return;
          }

          if (!mounted) {
            return;
          }

          setMetrics(message.health);
          appendSnapshot(message.health.queue, message.timestamp);
          try {
            await fetchTrack();
          } catch {
            // Keep queue metrics live even if the optional aircraft lookup fails.
          }
          setLoading(false);
        } catch {
          if (mounted) {
            setMetricsError("Could not parse live metrics stream.");
          }
        }
      })();
    });

    eventSource.addEventListener("stream-error", (event) => {
      try {
        const message = JSON.parse((event as MessageEvent).data) as StreamMessage;
        if (message.type === "error") {
          setMetricsError(message.message);
        }
      } catch {
        setMetricsError("Metrics stream sent an unreadable error.");
      }
    });

    eventSource.onerror = () => {
      if (!mounted) return;
      setConnected(false);
      setMetricsError("Metrics stream disconnected. Falling back to polling.");
    };

    fallbackTimerRef.current = window.setInterval(async () => {
      try {
        const health = await fetchHealth();
        appendSnapshot(health.queue, health.timestamp);
        await fetchTrack();
      } catch {
        // Keep the SSE error visible if polling also fails.
      }
    }, 15_000);

    return () => {
      mounted = false;
      eventSource.close();
      if (fallbackTimerRef.current) {
        window.clearInterval(fallbackTimerRef.current);
      }
    };
  }, []);

  const queueMix = useMemo(() => {
    if (!metrics) return [];
    return [
      { name: "Waiting", value: metrics.queue.waiting },
      { name: "Active", value: metrics.queue.active },
      { name: "Delayed", value: metrics.queue.delayed },
      { name: "Failed", value: metrics.queue.failed },
      { name: "Completed", value: metrics.queue.completed }
    ].filter((datum) => datum.value > 0);
  }, [metrics]);
  const thresholdMetricSnapshot = useMemo(() => {
    const recent = queueHistory.slice(-10);
    const failedTotal = recent.reduce((sum, sample) => sum + sample.failed, 0);
    const activeTotal = recent.reduce((sum, sample) => sum + sample.active + sample.waiting, 0);
    const lastTrack = track.at(-1);
    const dataStaleness = lastTrack?.timestamp
      ? Math.max(0, Math.round((Date.now() - new Date(lastTrack.timestamp).getTime()) / 1000))
      : 0;

    return {
      active: metrics?.queue.active ?? 0,
      dataStaleness,
      failed: metrics?.queue.failed ?? 0,
      retryRate: activeTotal > 0 ? Math.round((failedTotal / activeTotal) * 100) : 0,
      stalled: metrics?.queue.stalled ?? 0,
      waiting: metrics?.queue.waiting ?? 0
    };
  }, [metrics, queueHistory, track]);
  const thresholdStates = useMemo(
    () => evaluateThresholdPolicy(defaultThresholdPolicy, thresholdMetricSnapshot),
    [thresholdMetricSnapshot]
  );
  const incidents = buildFlightOpsIncidents(metrics?.queue ?? null, metricsError, connected, thresholdStates);

  return (
    <FlightOpsCommandCenter
      connected={connected}
      flightLookup={flightLookup}
      incidents={incidents}
      loading={loading}
      mapBearing={mapBearing}
      markerPosition={markerPosition}
      metrics={metrics}
      metricsError={metricsError}
      queueHistory={queueHistory}
      queueMix={queueMix}
      track={track}
    />
  );
}

function readOptionalNumber(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}
