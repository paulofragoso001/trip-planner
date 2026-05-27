"use client";

import { useEffect, useMemo, useState } from "react";

type AlertSource = "all" | "slack" | "teams" | "discord" | "email" | "pagerduty";

type FlightOpsAlert = {
  id: string;
  source: Exclude<AlertSource, "all">;
  severity: "info" | "warning" | "error" | "critical";
  status: "firing" | "resolved" | "acked";
  title?: string;
  summary?: string;
  incidentKey?: string;
  createdAt?: string;
  updatedAt?: string;
};

const sources: AlertSource[] = ["all", "pagerduty", "slack", "teams", "discord", "email"];

const sourceLabels: Record<AlertSource, string> = {
  all: "All",
  discord: "Discord",
  email: "Email",
  pagerduty: "PagerDuty",
  slack: "Slack",
  teams: "Teams"
};

export default function FlightOpsAlertsPage() {
  const [alerts, setAlerts] = useState<FlightOpsAlert[]>([]);
  const [activeSource, setActiveSource] = useState<AlertSource>("all");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadAlerts() {
      try {
        const response = await fetch("/api/alerts", { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`Alert request failed: ${response.status}`);
        }
        const payload = (await response.json()) as { alerts?: FlightOpsAlert[] };
        if (!active) return;
        setAlerts(payload.alerts ?? []);
        setError(null);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Could not load alert events.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadAlerts();
    return () => {
      active = false;
    };
  }, []);

  const normalizedAlerts = useMemo(
    () =>
      alerts.map((alert) => ({
        ...alert,
        status: alert.status === "resolved" ? "acked" : alert.status
      })),
    [alerts]
  );

  const visibleAlerts = useMemo(
    () =>
      activeSource === "all"
        ? normalizedAlerts
        : normalizedAlerts.filter((alert) => alert.source === activeSource),
    [activeSource, normalizedAlerts]
  );

  const firingCount = normalizedAlerts.filter((alert) => alert.status === "firing").length;
  const pagerDutyCount = normalizedAlerts.filter((alert) => alert.source === "pagerduty").length;

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-5 text-slate-100">
      <div className="mx-auto grid max-w-6xl gap-4">
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                Multi-channel alerts
              </p>
              <h1 className="mt-1 text-2xl font-bold">Flight Ops incident inbox</h1>
              <p className="mt-1 max-w-2xl text-sm text-slate-400">
                PagerDuty is reserved for critical canary failures. Slack, Teams, Discord, and email provide broad rollout visibility.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm md:w-64">
              <Stat label="Firing" value={firingCount} />
              <Stat label="PagerDuty" value={pagerDutyCount} />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2" aria-label="Alert source filters">
            {sources.map((source) => (
              <button
                className={`rounded-full border px-3 py-2 text-xs font-black uppercase tracking-[0.12em] ${
                  activeSource === source
                    ? "border-blue-400 bg-blue-500 text-white"
                    : "border-slate-700 bg-slate-950 text-slate-300 hover:border-blue-400"
                }`}
                key={source}
                onClick={() => setActiveSource(source)}
                type="button"
              >
                {sourceLabels[source]}
              </button>
            ))}
          </div>
        </section>

        {error ? (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        <section className="grid gap-3">
          {loading ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-400">
              Loading alert events...
            </div>
          ) : visibleAlerts.length ? (
            visibleAlerts.map((alert) => (
              <AlertRow
                alert={alert}
                key={alert.id}
                onAck={() =>
                  void ackAlert(alert)
                }
              />
            ))
          ) : (
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-400">
              No alerts for this provider.
            </div>
          )}
        </section>
      </div>
    </main>
  );

  async function ackAlert(alert: FlightOpsAlert) {
    setAlerts((current) =>
      current.map((item) =>
        item.id === alert.id
          ? {
              ...item,
              status: "acked"
            }
          : item
      )
    );

    await fetch("/api/alerts", {
      body: JSON.stringify({
        action: "ack",
        id: alert.id,
        severity: alert.severity,
        source: alert.source
      }),
      headers: {
        "Content-Type": "application/json"
      },
      method: "POST"
    }).catch(() => {
      // Keep the UI responsive even if metrics recording is temporarily unavailable.
    });
  }
}

function AlertRow({
  alert,
  onAck
}: {
  alert: FlightOpsAlert;
  onAck: () => void;
}) {
  const severityClass =
    alert.severity === "critical" || alert.severity === "error"
      ? "border-rose-500/40 bg-rose-500/10"
      : alert.severity === "warning"
        ? "border-amber-500/40 bg-amber-500/10"
        : "border-slate-800 bg-slate-900";

  return (
    <article className={`rounded-2xl border p-4 ${severityClass}`}>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-slate-300">
              {sourceLabels[alert.source]}
            </span>
            <span className="rounded-full border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-slate-300">
              {alert.severity}
            </span>
            <span className="rounded-full border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-slate-300">
              {alert.status}
            </span>
          </div>
          <h2 className="mt-3 text-lg font-semibold">{alert.title ?? "Flight Ops alert"}</h2>
          <p className="mt-1 text-sm text-slate-300">{alert.summary ?? "No alert details provided."}</p>
          {alert.incidentKey ? (
            <p className="mt-2 font-mono text-xs text-slate-500">Incident key: {alert.incidentKey}</p>
          ) : null}
        </div>
        <div className="grid gap-2 text-sm text-slate-400 md:justify-items-end">
          <div>{alert.status === "acked" ? "Auto-acked after resolution" : "Operator action required"}</div>
          {alert.status === "firing" ? (
            <button
              className="rounded-full border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-slate-200 hover:border-blue-400"
              onClick={onAck}
              type="button"
            >
              Ack
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2">
      <div className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}
