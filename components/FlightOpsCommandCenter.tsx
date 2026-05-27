"use client";

import type { ReactNode } from "react";
import MapPanel from "@/components/FlightOpsMapPanel";
import { GrafanaAlertControlPanel } from "@/components/GrafanaAlertControlPanel";

export type QueueHealth = {
  queue: string;
  waiting: number;
  active: number;
  delayed: number;
  failed: number;
  completed: number;
  stalled: number;
  oldestActiveAgeMs: number | null;
  oldestWaitingAgeMs: number | null;
  healthy: boolean;
  lastCheckedAt: string;
};

export type MetricsResponse = {
  status: "healthy" | "degraded" | "unhealthy";
  service: string;
  queue: QueueHealth;
  timestamp: string;
};

export type TrackPoint = {
  lat: number;
  lng: number;
  bearing?: number;
  speed?: number;
  altitude?: number;
  timestamp?: string;
};

export type LatLng = { lat: number; lng: number };

export type QueueSample = {
  time: string;
  waiting: number;
  active: number;
  failed: number;
  stalled: number;
};

export type FlightOpsIncident = {
  id: string;
  tone: "red" | "amber" | "blue";
  title: string;
  message: string;
  escalation: "monitor" | "review" | "page";
  region: string;
  lastUpdated: string;
};

export type FlightOpsLayout = {
  tier1: {
    title: "Critical Alerts";
    height: "compact";
    regions: [
      "active_incidents",
      "stalled_workers",
      "delayed_refreshes",
      "route_exceptions"
    ];
  };
  tier2: {
    title: "Live Tracking";
    height: "large";
    regions: [
      "live_aircraft_map",
      "queue_health_rail",
      "position_details",
      "stream_connection"
    ];
  };
  tier3: {
    title: "Historical Performance";
    height: "medium";
    regions: [
      "queue_trend_chart",
      "failure_rate_chart",
      "latency_histogram",
      "recovery_timeline"
    ];
  };
};

export const flightOpsLayout: FlightOpsLayout = {
  tier1: {
    title: "Critical Alerts",
    height: "compact",
    regions: [
      "active_incidents",
      "stalled_workers",
      "delayed_refreshes",
      "route_exceptions"
    ]
  },
  tier2: {
    title: "Live Tracking",
    height: "large",
    regions: [
      "live_aircraft_map",
      "queue_health_rail",
      "position_details",
      "stream_connection"
    ]
  },
  tier3: {
    title: "Historical Performance",
    height: "medium",
    regions: [
      "queue_trend_chart",
      "failure_rate_chart",
      "latency_histogram",
      "recovery_timeline"
    ]
  }
};

type FlightOpsCommandCenterProps = {
  connected: boolean;
  flightLookup: {
    tripId: string;
    flightId: string;
  };
  incidents: FlightOpsIncident[];
  loading: boolean;
  mapBearing: number | null;
  markerPosition: LatLng | null;
  metrics: MetricsResponse | null;
  metricsError: string | null;
  queueHistory: QueueSample[];
  queueMix: Array<{ name: string; value: number }>;
  track: TrackPoint[];
};

const colors = ["#60a5fa", "#34d399", "#f59e0b", "#f43f5e", "#8b5cf6"];

export function FlightOpsCommandCenter({
  connected,
  flightLookup,
  incidents,
  loading,
  mapBearing,
  markerPosition,
  metrics,
  metricsError,
  queueHistory,
  queueMix,
  track
}: FlightOpsCommandCenterProps) {
  const uptimePercent = metrics ? (metrics.queue.healthy ? 100 : 72) : 0;
  const lastPos = track.at(-1);

  return (
    <main className="min-h-screen bg-slate-950 px-3 py-3 text-slate-100">
      <div className="mx-auto grid max-w-[1800px] gap-3">
        <CriticalAlertsTier
          connected={connected}
          incidents={incidents}
          loading={loading}
          metrics={metrics}
          metricsError={metricsError}
        />

        <LiveTrackingTier
          connected={connected}
          flightLookup={flightLookup}
          lastPos={lastPos}
          loading={loading}
          mapBearing={mapBearing}
          markerPosition={markerPosition}
          metrics={metrics}
          uptimePercent={uptimePercent}
        />

        <HistoricalPerformanceTier
          incidents={incidents}
          queue={metrics?.queue ?? null}
          queueHistory={queueHistory}
          queueMix={queueMix}
        />

        <section className="grid gap-3 xl:grid-cols-12">
          <IncidentLogTable
            connected={connected}
            history={queueHistory}
            incidents={incidents}
            queue={metrics?.queue ?? null}
          />
        </section>
      </div>
    </main>
  );
}

function CriticalAlertsTier({
  connected,
  incidents,
  loading,
  metrics,
  metricsError
}: {
  connected: boolean;
  incidents: FlightOpsIncident[];
  loading: boolean;
  metrics: MetricsResponse | null;
  metricsError: string | null;
}) {
  return (
    <section className="sticky top-0 z-20 grid gap-3 rounded-2xl border border-slate-800 bg-slate-900/95 p-3 shadow-xl backdrop-blur">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
            Flight operations command center
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            {flightOpsLayout.tier1.title}
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-400">
            Severity-first incident strip for active failures, stalled workers, delayed refreshes, and route exceptions.
          </p>
        </div>
        <StatusRibbon
          connected={connected}
          loading={loading}
          metrics={metrics}
          metricsError={metricsError}
        />
      </div>

      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {incidents.slice(0, 4).map((incident) => (
          <CriticalAlertCard incident={incident} key={incident.id} />
        ))}
      </div>
    </section>
  );
}

function LiveTrackingTier({
  connected,
  flightLookup,
  lastPos,
  loading,
  mapBearing,
  markerPosition,
  metrics,
  uptimePercent
}: {
  connected: boolean;
  flightLookup: { tripId: string; flightId: string };
  lastPos: TrackPoint | undefined;
  loading: boolean;
  mapBearing: number | null;
  markerPosition: LatLng | null;
  metrics: MetricsResponse | null;
  uptimePercent: number;
}) {
  return (
    <section className="grid gap-3 xl:grid-cols-12">
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 xl:col-span-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
              Tier 2
            </p>
            <h2 className="text-xl font-semibold">{flightOpsLayout.tier2.title}</h2>
            <p className="text-sm text-slate-400">
              Aircraft position, map-visible exceptions, and current Cirium truth state.
            </p>
          </div>
          <div className="text-right text-xs text-slate-400">
            <div>{loading ? "Updating..." : "Live"}</div>
            <div>{lastPos ? `${lastPos.lat.toFixed(4)}, ${lastPos.lng.toFixed(4)}` : "No position yet"}</div>
          </div>
        </div>
        {!flightLookup.tripId || !flightLookup.flightId ? (
          <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-400">
            Add <code>tripId</code> and <code>flightId</code> query params to enable live aircraft tracking.
          </div>
        ) : null}
        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-800">
          <MapPanel className="h-[560px]" position={markerPosition} bearing={mapBearing} />
        </div>
      </div>

      <div className="grid gap-3 xl:col-span-5">
        <section className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
              Queue health rail
            </p>
            <h2 className="text-xl font-semibold">Current operations</h2>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <StatCard
              title="Queue health"
              value={metrics ? `${uptimePercent}%` : "--"}
              subtitle="Truth score"
              tone={metrics?.queue.healthy ? "green" : "amber"}
            />
            <StatCard title="Waiting" value={metrics?.queue.waiting ?? "--"} subtitle="Jobs awaiting workers" />
            <StatCard title="Active" value={metrics?.queue.active ?? "--"} subtitle="Currently processing" />
            <StatCard title="Stalled" value={metrics?.queue.stalled ?? "--"} subtitle="Heartbeat pressure" tone={metrics && metrics.queue.stalled > 0 ? "amber" : "slate"} />
            <StatCard
              title="Failed"
              value={metrics?.queue.failed ?? "--"}
              subtitle="Errors in queue"
              tone={metrics && metrics.queue.failed > 0 ? "red" : "slate"}
            />
            <StatCard title="Stream" value={connected ? "Live" : "Fallback"} subtitle="SSE status" tone={connected ? "blue" : "amber"} />
          </div>
        </section>

        <PositionDetailsPanel lastPos={lastPos} />
      </div>
    </section>
  );
}

function HistoricalPerformanceTier({
  incidents,
  queue,
  queueHistory,
  queueMix
}: {
  incidents: FlightOpsIncident[];
  queue: QueueHealth | null;
  queueHistory: QueueSample[];
  queueMix: Array<{ name: string; value: number }>;
}) {
  return (
    <section className="grid gap-3 xl:grid-cols-12">
      <div className="grid gap-3 xl:col-span-4">
        <Panel title="Queue trends" subtitle="Historical performance: waiting and active refresh jobs.">
          <LineChart data={queueHistory} keys={["waiting", "active"]} height={250} />
        </Panel>

        <Panel title="Queue mix" subtitle="Current distribution for trend context.">
          <QueueMixChart data={queueMix} />
        </Panel>
      </div>

      <div className="grid gap-3 xl:col-span-8">
        <Panel title="Failure rate and stalls" subtitle="Historical degradation context for retries, stalls, and recovery pressure.">
          <BarChart data={queueHistory} keys={["failed", "stalled"]} height={300} />
        </Panel>

        <div className="grid gap-3 xl:grid-cols-2">
          <ExceptionPanel incidents={incidents} />
          <StalledJobsPanel queue={queue} />
        </div>

        <GrafanaAlertControlPanel />
      </div>
    </section>
  );
}

function PositionDetailsPanel({ lastPos }: { lastPos: TrackPoint | undefined }) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <h2 className="text-lg font-semibold">Position details</h2>
      <p className="text-sm text-slate-400">Latest aircraft movement values from the live track cycle.</p>
      <div className="mt-3 grid gap-2 text-sm">
        <WatchRow label="Latitude" value={lastPos ? lastPos.lat.toFixed(5) : "Pending"} />
        <WatchRow label="Longitude" value={lastPos ? lastPos.lng.toFixed(5) : "Pending"} />
        <WatchRow label="Bearing" value={lastPos?.bearing != null ? `${Math.round(lastPos.bearing)} degrees` : "Pending"} />
        <WatchRow label="Speed" value={lastPos?.speed != null ? `${Math.round(lastPos.speed)} kt` : "Pending"} />
        <WatchRow label="Altitude" value={lastPos?.altitude != null ? `${Math.round(lastPos.altitude).toLocaleString()} ft` : "Pending"} />
        <WatchRow label="Last position" value={lastPos?.timestamp ? formatShortTime(lastPos.timestamp) : "Pending"} />
      </div>
    </section>
  );
}

function CriticalAlertCard({ incident }: { incident: FlightOpsIncident }) {
  const tones = {
    red: "border-rose-500/40 bg-rose-500/15 text-rose-100",
    amber: "border-amber-500/40 bg-amber-500/15 text-amber-100",
    blue: "border-blue-500/40 bg-blue-500/15 text-blue-100"
  };

  const markers = {
    red: "bg-rose-400",
    amber: "bg-amber-300",
    blue: "bg-blue-300"
  };

  return (
    <article className={`grid gap-2 rounded-xl border px-3 py-2 text-sm ${tones[incident.tone]}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2 font-black">
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${markers[incident.tone]}`} />
          <span className="truncate">{incident.title}</span>
        </span>
        <span className="rounded-full border border-current/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em]">
          {incident.escalation}
        </span>
      </div>
      <p className="text-xs opacity-85">{incident.message}</p>
      <div className="flex items-center justify-between gap-2 text-[11px] opacity-75">
        <span>{incident.region}</span>
        <span>{incident.lastUpdated}</span>
      </div>
    </article>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  tone = "slate"
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  tone?: "slate" | "green" | "amber" | "red" | "blue";
}) {
  const tones = {
    slate: "border-slate-800 bg-slate-950 text-slate-100",
    green: "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
    amber: "border-amber-500/30 bg-amber-500/10 text-amber-100",
    red: "border-rose-500/30 bg-rose-500/10 text-rose-100",
    blue: "border-blue-500/30 bg-blue-500/10 text-blue-100"
  };

  return (
    <div className={`rounded-xl border p-3 shadow-sm ${tones[tone]}`}>
      <div className="text-[11px] font-medium uppercase tracking-wide opacity-70">{title}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      {subtitle ? <div className="mt-1 text-xs opacity-70">{subtitle}</div> : null}
    </div>
  );
}

function StatusRibbon({
  connected,
  loading,
  metrics,
  metricsError
}: {
  connected: boolean;
  loading: boolean;
  metrics: MetricsResponse | null;
  metricsError: string | null;
}) {
  return (
    <div className="grid gap-2 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-300 sm:grid-cols-4 xl:min-w-[560px]">
      <RibbonItem label="Stream" tone={connected ? "green" : "amber"} value={connected ? "SSE live" : "Polling"} />
      <RibbonItem label="Health" tone={metrics?.queue.healthy ? "green" : "amber"} value={metrics?.queue.healthy ? "Healthy" : "Degraded"} />
      <RibbonItem label="Last update" value={metrics?.queue.lastCheckedAt ? formatShortTime(metrics.queue.lastCheckedAt) : "Pending"} />
      <RibbonItem label="Surface" tone={metricsError ? "red" : loading ? "amber" : "green"} value={metricsError ? "Exception" : loading ? "Updating" : "Stable"} />
    </div>
  );
}

function RibbonItem({
  label,
  value,
  tone = "slate"
}: {
  label: string;
  value: string;
  tone?: "slate" | "green" | "amber" | "red";
}) {
  const tones = {
    slate: "text-slate-300",
    green: "text-emerald-400",
    amber: "text-amber-400",
    red: "text-rose-300"
  };

  return (
    <div>
      <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</div>
      <div className={`mt-0.5 font-bold ${tones[tone]}`}>{value}</div>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  children
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-sm text-slate-400">{subtitle}</p>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function ExceptionPanel({ incidents }: { incidents: FlightOpsIncident[] }) {
  return (
    <Panel title="Exceptions" subtitle="Operator-facing alerts from stream and queue state.">
      <div className="grid gap-2">
        {incidents.length ? (
          incidents.slice(0, 4).map((incident) => (
            <IncidentRow incident={incident} key={incident.id} />
          ))
        ) : (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
            No active exceptions.
          </div>
        )}
      </div>
    </Panel>
  );
}

function StalledJobsPanel({ queue }: { queue: QueueHealth | null }) {
  return (
    <Panel title="Stalled jobs" subtitle="Heartbeat and backlog watch list.">
      <div className="grid gap-2 text-sm">
        <WatchRow label="Stalled" value={queue?.stalled ?? 0} warning={(queue?.stalled ?? 0) > 0} />
        <WatchRow label="Oldest active" value={formatAge(queue?.oldestActiveAgeMs ?? null)} warning={(queue?.oldestActiveAgeMs ?? 0) > 600_000} />
        <WatchRow label="Oldest waiting" value={formatAge(queue?.oldestWaitingAgeMs ?? null)} warning={(queue?.oldestWaitingAgeMs ?? 0) > 900_000} />
      </div>
    </Panel>
  );
}

function WatchRow({
  label,
  value,
  warning
}: {
  label: string;
  value: string | number;
  warning?: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 px-3 py-2">
      <span className="text-slate-400">{label}</span>
      <span className={warning ? "font-bold text-amber-300" : "font-bold text-slate-100"}>{value}</span>
    </div>
  );
}

function IncidentLogTable({
  connected,
  history,
  incidents,
  queue
}: {
  connected: boolean;
  history: QueueSample[];
  incidents: FlightOpsIncident[];
  queue: QueueHealth | null;
}) {
  const recent = history.slice(-6).reverse();

  return (
    <div className="xl:col-span-12 rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Incident and snapshot log</h2>
          <p className="text-sm text-slate-400">Recent queue samples and current operational notes.</p>
        </div>
        <span className={connected ? "text-sm font-bold text-emerald-400" : "text-sm font-bold text-amber-400"}>
          {connected ? "Live stream" : "Fallback mode"}
        </span>
      </div>
      <div className="mt-3 overflow-hidden rounded-xl border border-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-950 text-xs uppercase tracking-[0.12em] text-slate-500">
            <tr>
              <th className="px-3 py-2">Time</th>
              <th className="px-3 py-2">Waiting</th>
              <th className="px-3 py-2">Active</th>
              <th className="px-3 py-2">Failed</th>
              <th className="px-3 py-2">Stalled</th>
              <th className="px-3 py-2">Note</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {recent.length ? (
              recent.map((sample) => (
                <tr key={`${sample.time}-${sample.waiting}-${sample.active}`}>
                  <td className="px-3 py-2 font-bold text-slate-200">{sample.time}</td>
                  <td className="px-3 py-2">{sample.waiting}</td>
                  <td className="px-3 py-2">{sample.active}</td>
                  <td className={sample.failed ? "px-3 py-2 text-rose-300" : "px-3 py-2"}>{sample.failed}</td>
                  <td className={sample.stalled ? "px-3 py-2 text-amber-300" : "px-3 py-2"}>{sample.stalled}</td>
                  <td className="px-3 py-2 text-slate-400">{queue?.healthy ? "Nominal" : "Review queue"}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-3 py-4 text-slate-400" colSpan={6}>
                  Waiting for the first metrics snapshot.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {incidents.length ? (
        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {incidents.map((incident) => (
            <IncidentRow incident={incident} key={incident.id} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function LineChart({
  data,
  keys,
  height
}: {
  data: QueueSample[];
  keys: Array<keyof QueueSample>;
  height: number;
}) {
  return (
    <div>
      <svg
        className="w-full"
        height={height}
        preserveAspectRatio="none"
        role="img"
        viewBox={`0 0 1000 ${height}`}
        aria-label="Queue trend chart"
      >
        <ChartGrid height={height} />
        {keys.map((key, index) => (
          <polyline
            key={String(key)}
            fill="none"
            points={seriesPoints(data, key, height)}
            stroke={colors[index % colors.length]}
            strokeWidth="6"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      <ChartLegend keys={keys.map(String)} />
    </div>
  );
}

function BarChart({
  data,
  keys,
  height
}: {
  data: QueueSample[];
  keys: Array<keyof QueueSample>;
  height: number;
}) {
  const chartHeight = height - 42;
  const max = Math.max(1, ...data.flatMap((datum) => keys.map((key) => Number(datum[key]) || 0)));
  const groupWidth = data.length ? 1000 / data.length : 1000;

  return (
    <div>
      <svg
        className="w-full"
        height={height}
        preserveAspectRatio="none"
        role="img"
        viewBox={`0 0 1000 ${height}`}
        aria-label="Failure and stalled jobs chart"
      >
        <ChartGrid height={height} />
        {data.map((datum, datumIndex) =>
          keys.map((key, keyIndex) => {
            const value = Number(datum[key]) || 0;
            const width = Math.max(8, groupWidth / (keys.length + 1));
            const x = datumIndex * groupWidth + keyIndex * width + width * 0.5;
            const barHeight = (value / max) * (chartHeight - 16);

            return (
              <rect
                fill={colors[(keyIndex + 3) % colors.length]}
                height={barHeight}
                key={`${datum.time}-${String(key)}`}
                rx="8"
                width={width}
                x={x}
                y={chartHeight - barHeight}
              />
            );
          })
        )}
      </svg>
      <ChartLegend keys={keys.map(String)} offset={3} />
    </div>
  );
}

function QueueMixChart({ data }: { data: Array<{ name: string; value: number }> }) {
  const total = data.reduce((sum, datum) => sum + datum.value, 0);

  if (!total) {
    return (
      <div className="grid h-[280px] place-items-center rounded-2xl border border-slate-800 bg-slate-950 text-sm text-slate-400">
        No queue activity yet.
      </div>
    );
  }

  return (
    <div className="grid min-h-[280px] place-items-center gap-4 md:grid-cols-[180px_1fr]">
      <div className="relative grid h-40 w-40 place-items-center rounded-full bg-slate-950">
        <div className="absolute inset-0 rounded-full" style={{ background: pieGradient(data) }} />
        <div className="relative grid h-24 w-24 place-items-center rounded-full bg-slate-900 text-center text-sm font-bold">
          {total} jobs
        </div>
      </div>
      <div className="grid gap-2">
        {data.map((datum, index) => (
          <div className="flex items-center justify-between text-sm" key={datum.name}>
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} />
              {datum.name}
            </span>
            <span className="font-bold">{datum.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function IncidentRow({ incident }: { incident: FlightOpsIncident }) {
  const tones = {
    red: "border-rose-500/30 bg-rose-500/10 text-rose-200",
    amber: "border-amber-500/30 bg-amber-500/10 text-amber-100",
    blue: "border-blue-500/30 bg-blue-500/10 text-blue-100"
  };

  return (
    <div className={`rounded-xl border px-3 py-2 text-sm ${tones[incident.tone]}`}>
      <div className="font-bold">{incident.title}</div>
      <div className="mt-1 text-xs opacity-80">{incident.message}</div>
    </div>
  );
}

function ChartGrid({ height }: { height: number }) {
  return (
    <>
      {[0, 1, 2, 3].map((index) => (
        <line
          key={index}
          stroke="#1f2937"
          strokeDasharray="3 3"
          x1="0"
          x2="1000"
          y1={(height - 42) * (index / 3)}
          y2={(height - 42) * (index / 3)}
        />
      ))}
    </>
  );
}

function ChartLegend({ keys, offset = 0 }: { keys: string[]; offset?: number }) {
  return (
    <div className="mt-2 flex gap-4 text-xs font-bold text-slate-400">
      {keys.map((key, index) => (
        <span className="flex items-center gap-2" key={key}>
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colors[(index + offset) % colors.length] }} />
          {key}
        </span>
      ))}
    </div>
  );
}

function seriesPoints(data: QueueSample[], key: keyof QueueSample, height: number) {
  if (!data.length) {
    return "";
  }

  const chartHeight = height - 42;
  const max = Math.max(1, ...data.map((datum) => Number(datum[key]) || 0));

  return data
    .map((datum, index) => {
      const x = data.length === 1 ? 0 : (index / (data.length - 1)) * 1000;
      const y = chartHeight - ((Number(datum[key]) || 0) / max) * (chartHeight - 16);
      return `${x},${y}`;
    })
    .join(" ");
}

function pieGradient(data: Array<{ name: string; value: number }>) {
  const total = data.reduce((sum, datum) => sum + datum.value, 0);
  let current = 0;

  return `conic-gradient(${data
    .map((datum, index) => {
      const start = (current / total) * 100;
      current += datum.value;
      const end = (current / total) * 100;
      return `${colors[index % colors.length]} ${start}% ${end}%`;
    })
    .join(", ")})`;
}

export function buildFlightOpsIncidents(
  queue: QueueHealth | null,
  metricsError: string | null,
  connected: boolean,
  thresholdStates: Array<{
    active: boolean;
    currentValue: number;
    message: string;
    status: "inactive" | "info" | "warning" | "critical";
    threshold: {
      id: string;
      name: string;
      severity: "info" | "warning" | "critical";
    };
  }> = []
): FlightOpsIncident[] {
  const incidents: FlightOpsIncident[] = [];
  const lastUpdated = queue?.lastCheckedAt ? formatShortTime(queue.lastCheckedAt) : "Pending";

  if (metricsError) {
    incidents.push({
      id: "stream-error",
      tone: "red",
      title: "Metrics stream",
      message: metricsError,
      escalation: "page",
      region: "stream_connection",
      lastUpdated
    });
  }

  if (!connected) {
    incidents.push({
      id: "stream-fallback",
      tone: "amber",
      title: "SSE fallback",
      message: "Dashboard is relying on polling until the stream reconnects.",
      escalation: "monitor",
      region: "stream_connection",
      lastUpdated
    });
  }

  if (queue?.failed) {
    incidents.push({
      id: "failed-jobs",
      tone: "red",
      title: "Failed jobs",
      message: `${queue.failed} refresh jobs need review.`,
      escalation: queue.failed > 10 ? "page" : "review",
      region: "active_incidents",
      lastUpdated
    });
  }

  if (queue?.stalled) {
    incidents.push({
      id: "stalled-jobs",
      tone: "amber",
      title: "Stalled jobs",
      message: `${queue.stalled} jobs have stalled heartbeat state.`,
      escalation: queue.stalled > 3 ? "page" : "review",
      region: "stalled_workers",
      lastUpdated
    });
  }

  if (queue?.oldestWaitingAgeMs && queue.oldestWaitingAgeMs > 900_000) {
    incidents.push({
      id: "old-waiting",
      tone: "amber",
      title: "Waiting backlog",
      message: `Oldest waiting job is ${formatAge(queue.oldestWaitingAgeMs)} old.`,
      escalation: "review",
      region: "delayed_refreshes",
      lastUpdated
    });
  }

  thresholdStates
    .filter((state) => state.active && (state.threshold.severity === "warning" || state.threshold.severity === "critical"))
    .forEach((state) => {
      incidents.push({
        id: `threshold-${state.threshold.id}`,
        tone: state.threshold.severity === "critical" ? "red" : "amber",
        title: state.threshold.name,
        message: state.message,
        escalation: state.threshold.severity === "critical" ? "page" : "review",
        region: state.threshold.severity === "critical" ? "active_incidents" : "delayed_refreshes",
        lastUpdated
      });
    });

  if (!incidents.length && queue) {
    incidents.push({
      id: "nominal",
      tone: "blue",
      title: "Nominal operations",
      message: "Queue state is inside current thresholds.",
      escalation: "monitor",
      region: "route_exceptions",
      lastUpdated
    });
  }

  return incidents;
}

function formatAge(value: number | null) {
  if (value === null) {
    return "None";
  }

  const seconds = Math.max(0, Math.round(value / 1000));
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m`;
  }

  return `${Math.round(minutes / 60)}h`;
}

function formatShortTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit"
  }).format(new Date(value));
}
