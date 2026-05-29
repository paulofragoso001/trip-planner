"use client";

import { GoogleMap, Marker, Polyline } from "@react-google-maps/api";
import { useMemo, useState } from "react";
import type { DashboardTimelineItem } from "@/components/DraggableList";
import { TripButton, TripEyebrow, cn, tripUi } from "@/components/trip-ui";
import { useCiriumFlightMapSync } from "@/hooks/useCiriumFlightMapSync";

type FlightTruthPanelProps = {
  flights: DashboardTimelineItem[];
  tripId: string;
  onRefreshFlightStatuses?: () => Promise<void>;
};

type FlightTruthAlert = {
  id: string;
  itemId: string;
  tone: "warning" | "danger" | "info";
  title: string;
  message: string;
  timestamp: string | null;
};

type LatLngLiteral = {
  lat: number;
  lng: number;
};

const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
const mapsConfigured = Boolean(mapsApiKey && !mapsApiKey.startsWith("YOUR_"));
const flightMapContainerStyle = { width: "100%", height: "220px" };

export function FlightTruthPanel({
  flights,
  tripId,
  onRefreshFlightStatuses
}: FlightTruthPanelProps) {
  const [selectedId, setSelectedId] = useState(flights[0]?.id ?? null);
  const [refreshing, setRefreshing] = useState(false);
  const selectedFlight =
    flights.find((flight) => flight.id === selectedId) ?? flights[0] ?? null;
  const alerts = useMemo(() => deriveFlightAlerts(flights), [flights]);

  async function refresh() {
    if (!onRefreshFlightStatuses) {
      return;
    }

    setRefreshing(true);
    try {
      await onRefreshFlightStatuses();
    } finally {
      setRefreshing(false);
    }
  }

  if (!flights.length) {
    return null;
  }

  return (
    <section
      className="grid gap-4 rounded-2xl border border-black/10 bg-[#f7f6f2] p-4"
      data-testid="flight-truth-panel"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <TripEyebrow>Flight truth layer</TripEyebrow>
          <h3 className="mt-1 text-xl font-black">Flight Updates</h3>
          <p className={`mt-1 text-sm ${tripUi.text.bodyMuted}`}>
            Status, schedule, gate, and terminal changes stay tied to the same
            itinerary flight items shown in the timeline.
          </p>
        </div>
        <TripButton
          data-testid="refresh-flight-statuses"
          disabled={!onRefreshFlightStatuses || refreshing}
          onClick={refresh}
          variant="secondary"
        >
          {refreshing ? "Refreshing..." : "Refresh flight updates"}
        </TripButton>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid gap-3">
          {flights.map((flight) => {
            const selected = flight.id === selectedFlight?.id;

            return (
              <button
                aria-current={selected ? "true" : undefined}
                className={cn(
                  "rounded-2xl border bg-white p-4 text-left transition hover:bg-slate-50",
                  selected ? "border-brand ring-2 ring-brand/20" : "border-black/10"
                )}
                data-testid={`flight-truth-row-${flight.id}`}
                key={flight.id}
                onClick={() => setSelectedId(flight.id)}
                type="button"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <FlightStatusPill status={flight.flight_status} />
                      <span className="text-xs font-bold text-[#6f675c]">
                        {flight.flight_number || flight.confirmation_code || "Flight number pending"}
                      </span>
                    </div>
                    <h4 className="mt-2 font-black">{flight.title}</h4>
                    <p className={`mt-1 text-sm ${tripUi.text.bodyMuted}`}>
                      {routeLabel(flight)}
                    </p>
                  </div>
                  <div className="text-right text-xs font-bold text-[#6f675c]">
                    <p>{flight.estimated_departure ? `Est. ${formatTime(flight.estimated_departure)}` : "Estimate pending"}</p>
                    <p>{gateTerminalLabel(flight)}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <aside
          className="rounded-2xl border border-black/10 bg-white p-4"
          data-testid="flight-truth-detail"
        >
          {selectedFlight ? (
            <>
              <TripEyebrow>Selected flight</TripEyebrow>
              <h4 className="mt-2 text-lg font-black">{selectedFlight.title}</h4>
              <dl className="mt-4 grid gap-3 text-sm">
                <FlightDetail label="Status" value={formatFlightStatus(selectedFlight.flight_status)} />
                <FlightDetail label="Route" value={routeLabel(selectedFlight)} />
                <FlightDetail label="Scheduled" value={selectedFlight.scheduled_departure ? formatDateTime(selectedFlight.scheduled_departure) : "Pending"} />
                <FlightDetail label="Estimated" value={selectedFlight.estimated_departure ? formatDateTime(selectedFlight.estimated_departure) : "Pending"} />
                <FlightDetail label="Airport" value={gateTerminalLabel(selectedFlight)} />
                <FlightDetail label="Current position" value={flightPositionLabel(selectedFlight)} />
                <FlightDetail label="Track updated" value={selectedFlight.flight_position_updated_at ? formatDateTime(selectedFlight.flight_position_updated_at) : "Not available"} />
                <FlightDetail label="Last checked" value={selectedFlight.last_status_checked_at ? formatDateTime(selectedFlight.last_status_checked_at) : "Not checked yet"} />
              </dl>
              <FlightPositionMap flight={selectedFlight} tripId={tripId} />
            </>
          ) : null}
        </aside>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-2xl border border-black/10 bg-white p-4">
          <h4 className="font-black">Live alert events</h4>
          <div className="mt-3 grid gap-2">
            {alerts.length ? (
              alerts.map((alert) => (
                <article
                  className="rounded-xl border border-black/10 bg-[#f7f6f2] p-3 text-sm"
                  data-testid={`flight-alert-${alert.itemId}`}
                  key={alert.id}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full px-2 py-1 text-[11px] font-black uppercase tracking-[0.08em]",
                        alert.tone === "danger"
                          ? "bg-red-100 text-red-700"
                          : alert.tone === "warning"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-blue-100 text-brand"
                      )}
                    >
                      {alert.title}
                    </span>
                    <span className="text-xs font-bold text-[#6f675c]">
                      {alert.timestamp ? formatDateTime(alert.timestamp) : "Pending"}
                    </span>
                  </div>
                  <p className={`mt-2 ${tripUi.text.bodyMuted}`}>{alert.message}</p>
                </article>
              ))
            ) : (
              <p className={`text-sm ${tripUi.text.bodyMuted}`}>
                No disruptions yet. Flight changes will appear here after refresh.
              </p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-black/10 bg-white p-4">
          <h4 className="font-black">Timeline sync preview</h4>
          <div className="mt-3 grid gap-2 text-sm">
            {flights.map((flight) => (
              <p
                className={`rounded-xl bg-[#f7f6f2] p-3 ${tripUi.text.bodyMuted}`}
                data-testid={`flight-sync-preview-${flight.id}`}
                key={flight.id}
              >
                {syncMessage(flight)}
              </p>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function FlightStatusPill({ status }: { status?: string | null }) {
  const normalized = status || "scheduled";

  return (
    <span
      className={cn(
        "rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.08em]",
        normalized === "cancelled"
          ? "bg-red-100 text-red-700"
          : normalized === "delayed"
            ? "bg-amber-100 text-amber-800"
            : normalized === "boarding"
              ? "bg-blue-100 text-brand"
              : "bg-emerald-100 text-evergreen"
      )}
    >
      {formatFlightStatus(normalized)}
    </span>
  );
}

function FlightDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#f7f6f2] p-3">
      <dt className="text-xs font-black uppercase tracking-[0.08em] text-[#8a8175]">{label}</dt>
      <dd className="mt-1 font-bold text-[#221d17]">{value}</dd>
    </div>
  );
}

function FlightPositionMap({
  flight,
  tripId
}: {
  flight: DashboardTimelineItem;
  tripId: string;
}) {
  const storedPosition = readFlightPoint(flight.flight_lat, flight.flight_lng);
  const {
    position: syncedPosition,
    bearing,
    trackPoint,
    loading: trackLoading,
    error: trackError,
    setMarkerInstance
  } = useCiriumFlightMapSync({
    flightId: flight.id,
    tripId,
    enabled: mapsConfigured && Boolean(flight.id && tripId),
    pollMs: 15_000,
    animationMs: 1_200
  });
  const currentPosition = syncedPosition ?? storedPosition;
  const departurePosition = readFlightPoint(
    flight.departure_airport_lat,
    flight.departure_airport_lng
  );
  const arrivalPosition = readFlightPoint(
    flight.arrival_airport_lat,
    flight.arrival_airport_lng
  );
  const routePath = [departurePosition, currentPosition, arrivalPosition].filter(
    Boolean
  ) as LatLngLiteral[];

  if (!currentPosition) {
    return (
      <MapPlaceholder message="Live aircraft position will appear here after Cirium returns latitude and longitude." />
    );
  }

  if (!mapsConfigured) {
    return (
      <MapPlaceholder message="The live flight map is temporarily unavailable." />
    );
  }

  if (typeof window === "undefined" || !window.google) {
    return (
      <MapPlaceholder message="Preparing the live flight map. Position details will appear shortly." />
    );
  }

  return (
    <div
      className="mt-4 overflow-hidden rounded-2xl border border-black/10"
      data-testid="flight-position-map"
    >
      <GoogleMap
        center={currentPosition}
        mapContainerStyle={flightMapContainerStyle}
        options={{
          fullscreenControl: false,
          mapTypeControl: false,
          streetViewControl: false
        }}
        zoom={6}
      >
        {departurePosition ? (
          <Marker
            label="DEP"
            position={departurePosition}
            title={flight.departure_airport || "Departure airport"}
          />
        ) : null}
        {arrivalPosition ? (
          <Marker
            label="ARR"
            position={arrivalPosition}
            title={flight.arrival_airport || "Arrival airport"}
          />
        ) : null}
        <Marker
          icon={{
            path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
            rotation: bearing ?? flight.flight_bearing ?? 0,
            scale: 5,
            strokeColor: "#0b73c9",
            strokeWeight: 3
          }}
          onLoad={(marker) => {
            setMarkerInstance(marker);
          }}
          onUnmount={() => {
            setMarkerInstance(null);
          }}
          position={currentPosition}
          title={flight.flight_number || flight.title || "Current flight position"}
        />
        {routePath.length >= 2 ? (
          <Polyline
            path={routePath}
            options={{
              strokeColor: "#0b73c9",
              strokeOpacity: 0.75,
              strokeWeight: 3
            }}
          />
        ) : null}
      </GoogleMap>
      <div className="border-t border-black/10 bg-white px-3 py-2 text-xs font-bold text-[#6f675c]">
        {trackLoading
          ? "Syncing live flight track..."
          : trackError
            ? "Live track sync is temporarily unavailable."
            : trackPoint
              ? `Live track synced${trackPoint.timestamp ? ` ${formatDateTime(trackPoint.timestamp)}` : ""}.`
              : "Using last stored aircraft position."}
      </div>
    </div>
  );
}

function MapPlaceholder({ message }: { message: string }) {
  return (
    <div
      className={`mt-4 grid min-h-[180px] place-items-center rounded-2xl border border-dashed border-black/10 bg-[#f7f6f2] p-4 text-center text-sm ${tripUi.text.bodyMuted}`}
      data-testid="flight-position-map-empty"
    >
      <p>{message}</p>
    </div>
  );
}

function readFlightPoint(
  lat: number | null | undefined,
  lng: number | null | undefined
): LatLngLiteral | null {
  return typeof lat === "number" &&
    Number.isFinite(lat) &&
    typeof lng === "number" &&
    Number.isFinite(lng)
    ? { lat, lng }
    : null;
}

function deriveFlightAlerts(flights: DashboardTimelineItem[]): FlightTruthAlert[] {
  return flights.flatMap((flight) => {
    const alerts: FlightTruthAlert[] = [];
    const status = flight.flight_status;

    if (status === "cancelled") {
      alerts.push({
        id: `${flight.id}-cancelled`,
        itemId: flight.id,
        tone: "danger",
        title: "Cancelled",
        message: `${flight.title} was cancelled. Keep this item visible until the traveler resolves it.`,
        timestamp: flight.last_status_checked_at ?? null
      });
    } else if (status === "delayed") {
      alerts.push({
        id: `${flight.id}-delayed`,
        itemId: flight.id,
        tone: "warning",
        title: "Delay",
        message: `${flight.title} moved to ${flight.estimated_departure ? formatDateTime(flight.estimated_departure) : "a later time"}.`,
        timestamp: flight.last_status_checked_at ?? null
      });
    } else if (status === "boarding") {
      alerts.push({
        id: `${flight.id}-boarding`,
        itemId: flight.id,
        tone: "info",
        title: "Boarding",
        message: `${flight.title} is boarding${flight.gate ? ` at gate ${flight.gate}` : ""}.`,
        timestamp: flight.last_status_checked_at ?? null
      });
    }

    if (flight.gate || flight.terminal) {
      alerts.push({
        id: `${flight.id}-airport`,
        itemId: flight.id,
        tone: "info",
        title: "Airport update",
        message: `${flight.title} now shows ${gateTerminalLabel(flight)}.`,
        timestamp: flight.last_status_checked_at ?? null
      });
    }

    return alerts;
  });
}

function routeLabel(flight: DashboardTimelineItem) {
  if (flight.departure_airport && flight.arrival_airport) {
    return `${flight.departure_airport} to ${flight.arrival_airport}`;
  }

  return flight.location || "Route pending";
}

function gateTerminalLabel(flight: DashboardTimelineItem) {
  return [flight.terminal ? `Terminal ${flight.terminal}` : null, flight.gate ? `Gate ${flight.gate}` : null]
    .filter(Boolean)
    .join(" · ") || "Gate pending";
}

function syncMessage(flight: DashboardTimelineItem) {
  if (flight.flight_status === "cancelled") {
    return `${flight.title} remains in the timeline as cancelled so downstream plans can be reviewed.`;
  }

  if (flight.estimated_departure) {
    return `${flight.title} timeline time syncs to ${formatDateTime(flight.estimated_departure)}.`;
  }

  return `${flight.title} will sync once a provider returns a schedule update.`;
}

function flightPositionLabel(flight: DashboardTimelineItem) {
  const currentPosition = readFlightPoint(flight.flight_lat, flight.flight_lng);

  if (!currentPosition) {
    return "Position pending";
  }

  return `${currentPosition.lat.toFixed(3)}, ${currentPosition.lng.toFixed(3)}`;
}

function formatFlightStatus(value?: string | null) {
  return value ? value.replace(/_/g, " ") : "scheduled";
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}
