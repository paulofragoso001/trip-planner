"use client";

import type { DashboardTimelineItem } from "@/components/DraggableList";
import { TripButton, TripEyebrow, cn, tripUi } from "@/components/trip-ui";

type FlightStatusPanelProps = {
  flights: DashboardTimelineItem[];
  onRefreshFlightStatuses?: () => Promise<void>;
  refreshing?: boolean;
};

type FlightStatusAlert = {
  id: string;
  itemId: string;
  message: string;
  timestamp: string | null;
  title: string;
  tone: "danger" | "info" | "warning";
};

export function FlightStatusPanel({
  flights,
  onRefreshFlightStatuses,
  refreshing = false
}: FlightStatusPanelProps) {
  const alerts = deriveFlightAlerts(flights);

  if (!flights.length) return null;

  return (
    <section
      className="mt-5 grid gap-4 rounded-2xl border border-black/10 bg-[#f7f6f2] p-4"
      data-testid="flight-status-panel"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <TripEyebrow>Flight truth layer</TripEyebrow>
          <h3 className="mt-1 text-xl font-black">Flight Updates</h3>
          <p className={`mt-1 text-sm ${tripUi.text.bodyMuted}`}>
            Status, schedule, gate, and terminal changes stay tied to itinerary flight items.
          </p>
        </div>
        <TripButton
          data-testid="refresh-flight-statuses"
          disabled={!onRefreshFlightStatuses || refreshing}
          onClick={onRefreshFlightStatuses}
          variant="secondary"
        >
          {refreshing ? "Refreshing..." : "Refresh flight updates"}
        </TripButton>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid gap-3">
          {flights.map((flight) => (
            <article
              className="rounded-2xl border border-black/10 bg-white p-4"
              data-testid={`flight-status-row-${flight.id}`}
              key={flight.id}
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
                  <p>
                    {flight.estimated_departure
                      ? `Est. ${formatTime(flight.estimated_departure)}`
                      : "Estimate pending"}
                  </p>
                  <p>{gateTerminalLabel(flight)}</p>
                </div>
              </div>
            </article>
          ))}
        </div>

        <aside className="rounded-2xl border border-black/10 bg-white p-4">
          <TripEyebrow>Live alert events</TripEyebrow>
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
        </aside>
      </div>

      <div className="rounded-2xl border border-black/10 bg-white p-4">
        <h4 className="font-black">Itinerary sync preview</h4>
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

function deriveFlightAlerts(flights: DashboardTimelineItem[]): FlightStatusAlert[] {
  const alerts: FlightStatusAlert[] = [];

  flights.forEach((flight) => {
    const status = flight.flight_status?.toLowerCase();
    const timestamp = flight.last_status_checked_at || flight.estimated_departure || null;

    if (status === "cancelled") {
      alerts.push({
        id: `${flight.id}-cancelled`,
        itemId: flight.id,
        message: `${flight.title} was cancelled. Review dependent hotel, car, and meeting plans.`,
        timestamp,
        title: "Cancelled",
        tone: "danger"
      });
      return;
    }

    if (status === "delayed") {
      alerts.push({
        id: `${flight.id}-delayed`,
        itemId: flight.id,
        message: `${flight.title} is delayed. Itinerary time will sync to the latest estimate.`,
        timestamp,
        title: "Delayed",
        tone: "warning"
      });
      return;
    }

    if (flight.gate || flight.terminal) {
      alerts.push({
        id: `${flight.id}-gate`,
        itemId: flight.id,
        message: `${flight.title} has terminal or gate information available: ${gateTerminalLabel(flight)}.`,
        timestamp,
        title: "Airport update",
        tone: "info"
      });
    }
  });

  return alerts;
}

function routeLabel(flight: DashboardTimelineItem) {
  if (flight.departure_airport && flight.arrival_airport) {
    return `${flight.departure_airport} to ${flight.arrival_airport}`;
  }

  return flight.location || "Route pending";
}

function gateTerminalLabel(flight: DashboardTimelineItem) {
  const parts = [
    flight.terminal ? `Terminal ${flight.terminal}` : null,
    flight.gate ? `Gate ${flight.gate}` : null
  ].filter(Boolean);

  return parts.length ? parts.join(", ") : "Gate pending";
}

function syncMessage(flight: DashboardTimelineItem) {
  if (flight.flight_status === "cancelled") {
    return `${flight.title} remains in the itinerary as cancelled so downstream plans can be reviewed.`;
  }

  if (flight.estimated_departure) {
    return `${flight.title} itinerary time syncs to ${formatDateTime(flight.estimated_departure)}.`;
  }

  return `${flight.title} is waiting for refreshed flight status data.`;
}

function formatFlightStatus(value?: string | null) {
  return (value || "scheduled").replace(/_/g, " ");
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}
