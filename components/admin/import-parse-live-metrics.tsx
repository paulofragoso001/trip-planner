"use client";

import { useEffect, useState } from "react";

type ImportParseLiveMetrics = {
  failureRate: {
    failedEvents24h: number;
    failureRatePct: number;
  };
  generatedAt: string;
  latency: {
    label: string;
    p50Seconds: number | null;
    p95Seconds: number | null;
    samples: number;
  };
  outcomes24h: {
    corrections: number;
    dismissals: number;
    dismissalRatePct: number;
    predictions: number;
    promotions: number;
    reviewEvents: number;
  };
  sourceBreakdown: Array<{
    corrections: number;
    dismissalRatePct: number;
    dismissals: number;
    events: number;
    predictions: number;
    promotions: number;
    sourceType: string;
  }>;
  throughput: {
    eventsLast24Hours: number;
    eventsLast5Minutes: number;
    eventsLastHour: number;
    eventsPerMinute: number;
  };
};

type ApiResponse =
  | { data: ImportParseLiveMetrics; error: null }
  | { data: null; error: { message: string } };

export function ImportParseLiveMetricsPanel() {
  const [metrics, setMetrics] = useState<ImportParseLiveMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadMetrics() {
      try {
        const response = await fetch("/api/admin/import-parse-metrics", {
          headers: { Accept: "application/json" }
        });
        const payload = (await response.json().catch(() => null)) as ApiResponse | null;

        if (!active) {
          return;
        }

        if (!response.ok || !payload || payload.error) {
          setError(payload?.error?.message || `Metrics request failed (${response.status})`);
          setMetrics(null);
          return;
        }

        setError(null);
        setMetrics(payload.data);
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Could not load metrics.");
          setMetrics(null);
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    loadMetrics();
    const timer = window.setInterval(loadMetrics, 15_000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <div className="mt-5 rounded-2xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-black">Live import metrics</h3>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            Auto-refreshes every 15 seconds from Supabase events.
          </p>
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
          {metrics ? `Updated ${formatTime(metrics.generatedAt)}` : isLoading ? "Loading" : "Paused"}
        </span>
      </div>

      {error ? (
        <p className="mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          {error}
        </p>
      ) : null}

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <MetricCard
          label="Events / min"
          value={metrics ? metrics.throughput.eventsPerMinute : "—"}
        />
        <MetricCard
          label="Last 5 min"
          value={metrics ? metrics.throughput.eventsLast5Minutes : "—"}
        />
        <MetricCard
          label="P95 review latency"
          value={formatSeconds(metrics?.latency.p95Seconds ?? null)}
        />
        <MetricCard
          label="Failure rate"
          value={metrics ? `${metrics.failureRate.failureRatePct}%` : "—"}
        />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-2xl bg-slate-50 px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
            Throughput
          </p>
          <div className="mt-3 grid gap-2 text-sm text-slate-700">
            <Row label="Last hour" value={metrics?.throughput.eventsLastHour ?? "—"} />
            <Row label="Last 24h" value={metrics?.throughput.eventsLast24Hours ?? "—"} />
            <Row label="Review events" value={metrics?.outcomes24h.reviewEvents ?? "—"} />
          </div>
        </div>

        <div className="rounded-2xl bg-slate-50 px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
            Latency and outcomes
          </p>
          <div className="mt-3 grid gap-2 text-sm text-slate-700">
            <Row label="P50 review latency" value={formatSeconds(metrics?.latency.p50Seconds ?? null)} />
            <Row label="Latency samples" value={metrics?.latency.samples ?? "—"} />
            <Row label="Dismissals" value={metrics?.outcomes24h.dismissals ?? "—"} />
          </div>
        </div>
      </div>

      <div className="mt-4">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
          Source breakdown
        </p>
        <div className="mt-3 grid gap-2">
          {metrics?.sourceBreakdown.length ? (
            metrics.sourceBreakdown.slice(0, 4).map((source) => (
              <div
                className="grid gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm sm:grid-cols-[1fr_auto]"
                key={source.sourceType}
              >
                <div>
                  <p className="font-semibold capitalize">{source.sourceType}</p>
                  <p className="text-xs text-slate-500">
                    {source.predictions} predictions, {source.events} total events
                  </p>
                </div>
                <p className="font-bold text-slate-700">
                  {source.dismissalRatePct}% dismissal
                </p>
              </div>
            ))
          ) : (
            <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
              No source metrics yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number | string }) {
  return (
    <article className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
    </article>
  );
}

function Row({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatSeconds(value: number | null) {
  if (value == null) {
    return "—";
  }

  if (value < 60) {
    return `${value}s`;
  }

  return `${Math.round(value / 60)}m`;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}
