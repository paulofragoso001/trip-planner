import { RouterRefreshButton } from "@/components/dashboard/router-refresh-button";
import { ImportParseAnomalyList } from "@/components/admin/import-parse-anomaly-list";
import { ImportParseLiveMetricsPanel } from "@/components/admin/import-parse-live-metrics";
import type { ImportParseReport } from "@/lib/server/import-parse-report";

export function ImportParseObservabilityPanel({
  report
}: {
  report: ImportParseReport;
}) {
  const totals = report.kpis.reduce(
    (acc, row) => {
      acc.corrections += Number(row.corrections || 0);
      acc.dismissals += Number(row.dismissals || 0);
      acc.predictions += Number(row.predictions || 0);
      acc.promotions += Number(row.promotions || 0);
      return acc;
    },
    { corrections: 0, dismissals: 0, predictions: 0, promotions: 0 }
  );
  const reviewed = totals.corrections + totals.dismissals + totals.promotions;
  const correctionRate = reviewed ? (totals.corrections / reviewed) * 100 : 0;
  const dismissalRate = reviewed ? (totals.dismissals / reviewed) * 100 : 0;
  const promotionRate = reviewed ? (totals.promotions / reviewed) * 100 : 0;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-black">Import parse observability</h2>
          <p className="mt-2 text-sm text-slate-600">
            Parser version health, review outcomes, and recent correction signals.
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            Loaded {formatDateTime(report.loadedAt)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
            Supabase views
          </span>
          <RouterRefreshButton>Refresh</RouterRefreshButton>
        </div>
      </div>

      {report.error ? (
        <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          {report.error}
        </p>
      ) : null}

      <div className="mt-4 grid gap-3 md:grid-cols-5">
        {[
          ["Weekly reviewed", report.weeklyScorecard.reviewedEvents],
          ["Anomalies", report.weeklyScorecard.anomalyCount],
          ["Accuracy drops", report.weeklyScorecard.accuracyDropAnomalies],
          ["Correction spikes", report.weeklyScorecard.correctionSpikeAnomalies],
          ["Impact score", report.weeklyScorecard.totalImpactScore]
        ].map(([label, value]) => (
          <article className="rounded-2xl border border-slate-200 px-4 py-3" key={label}>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
              {label}
            </p>
            <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
          </article>
        ))}
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <article className="rounded-2xl bg-slate-50 px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
            False-positive rate
          </p>
          <p className="mt-2 text-2xl font-black text-slate-950">
            {report.weeklyScorecard.falsePositiveRatePct == null
              ? "Pending"
              : formatPct(report.weeklyScorecard.falsePositiveRatePct)}
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            {report.weeklyScorecard.reviewedAnomalies} reviewed,{" "}
            {report.weeklyScorecard.pendingAnomalies} pending
          </p>
        </article>
        <article className="rounded-2xl bg-slate-50 px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
            Mean time to resolution
          </p>
          <p className="mt-2 text-2xl font-black text-slate-950">
            {report.weeklyScorecard.meanTimeToResolutionHours == null
              ? "Pending"
              : formatHours(report.weeklyScorecard.meanTimeToResolutionHours)}
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            {report.weeklyScorecard.resolvedAnomalies} resolved anomalies
          </p>
        </article>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        {[
          ["24h predictions", totals.predictions],
          ["Corrections", totals.corrections],
          ["Promotions", totals.promotions],
          ["Dismissals", totals.dismissals]
        ].map(([label, value]) => (
          <article className="rounded-2xl bg-slate-50 p-4" key={label}>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
              {label}
            </p>
            <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
          </article>
        ))}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {[
          ["Correction rate", correctionRate],
          ["Promotion rate", promotionRate],
          ["Dismissal rate", dismissalRate]
        ].map(([label, value]) => (
          <article className="rounded-2xl border border-slate-200 px-4 py-3" key={label}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-bold text-slate-700">{label}</p>
              <p className="text-sm font-black text-slate-950">
                {formatPct(Number(value).toFixed(2))}
              </p>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-blue-600"
                style={{ width: `${Math.min(100, Math.max(0, Number(value)))}%` }}
              />
            </div>
          </article>
        ))}
      </div>

      <ImportParseAnomalyList anomalies={report.anomalies} />

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1fr]">
        <div>
          <h3 className="text-sm font-black">Parser KPIs</h3>
          <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-[0.16em] text-slate-500">
                <tr>
                  <th className="px-3 py-3">Parser</th>
                  <th className="px-3 py-3">Source</th>
                  <th className="px-3 py-3">Correction</th>
                  <th className="px-3 py-3">Dismissal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {report.kpis.length ? (
                  report.kpis.map((row) => (
                    <tr key={`${row.parser_name}-${row.parser_version}-${row.source_type}`}>
                      <td className="px-3 py-3 font-semibold">
                        {row.parser_name} {row.parser_version}
                      </td>
                      <td className="px-3 py-3 capitalize">{row.source_type}</td>
                      <td className="px-3 py-3">{formatPct(row.correction_rate_pct)}</td>
                      <td className="px-3 py-3">{formatPct(row.dismissal_rate_pct)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-3 py-4 text-slate-500" colSpan={4}>
                      No import parse events recorded in the last 24 hours.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-black">7d segment accuracy</h3>
          <div className="mt-3 grid gap-2">
            {report.accuracy.length ? (
              report.accuracy.map((row) => (
                <div
                  className="grid gap-2 rounded-2xl bg-slate-50 px-4 py-3 text-sm sm:grid-cols-[1fr_auto]"
                  key={`${row.parser_name}-${row.parser_version}-${row.source_type}`}
                >
                  <div>
                    <p className="font-semibold">
                      {row.parser_name} {row.parser_version}
                    </p>
                    <p className="text-xs capitalize text-slate-500">
                      {row.source_type} source
                    </p>
                  </div>
                  <p className="font-bold text-slate-700">
                    {formatPct(row.segment_type_accuracy_pct)} on {row.reviewed_events} reviews
                  </p>
                  <div className="sm:col-span-2">
                    <div className="h-2 overflow-hidden rounded-full bg-white">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.max(0, Number(row.segment_type_accuracy_pct || 0))
                          )}%`
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
                No reviewed parse events in the last 7 days.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1fr]">
        <div>
          <h3 className="text-sm font-black">Accuracy trend by parser</h3>
          <div className="mt-3 grid gap-2">
            {report.accuracyTrend.length ? (
              report.accuracyTrend.slice(-10).map((row) => (
                <div
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                  key={`${row.bucket}-${row.parserName}-${row.parserVersion}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold">
                        {row.parserName} {row.parserVersion}
                      </p>
                      <p className="text-xs text-slate-500">{formatShortDate(row.bucket)}</p>
                    </div>
                    <p className="font-bold text-slate-700">
                      {formatPct(row.segmentTypeAccuracyPct)} on {row.reviewedEvents} reviews
                    </p>
                  </div>
                  <ProgressBar value={row.segmentTypeAccuracyPct || 0} tone="emerald" />
                </div>
              ))
            ) : (
              <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
                No parser-version trend data yet.
              </p>
            )}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-black">Correction rate by segment type</h3>
          <div className="mt-3 grid gap-2">
            {report.correctionBySegmentType.length ? (
              report.correctionBySegmentType.map((row) => (
                <div
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                  key={row.segmentType}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold capitalize">{row.segmentType}</p>
                      <p className="text-xs text-slate-500">
                        {row.corrections} corrections from {row.reviewedEvents} reviews
                      </p>
                    </div>
                    <p className="font-bold text-slate-700">
                      {formatPct(row.correctionRatePct)}
                    </p>
                  </div>
                  <ProgressBar value={row.correctionRatePct || 0} tone="blue" />
                </div>
              ))
            ) : (
              <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
                No segment correction data yet.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-5">
        <h3 className="text-sm font-black">Recent parse events</h3>
        <div className="mt-3 grid gap-2">
          {report.recentEvents.length ? (
            report.recentEvents.map((event) => (
              <article
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                key={`${event.created_at}-${event.event_type}-${event.source_type}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold capitalize">
                    {event.event_type.replaceAll("_", " ")}
                  </p>
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                    {event.parser_version}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {formatDateTime(event.created_at)}
                </p>
                <p className="mt-2 text-slate-700">
                  {event.predicted_segment_type || "unknown"} to{" "}
                  {event.final_segment_type || "unknown"} from {event.source_type}
                  {event.confidence == null ? "" : ` at ${Math.round(event.confidence * 100)}%`}
                </p>
              </article>
            ))
          ) : (
            <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
              No recent parse events.
            </p>
          )}
        </div>
      </div>

      <ImportParseLiveMetricsPanel />
    </section>
  );
}

function ProgressBar({ tone, value }: { tone: "blue" | "emerald"; value: number }) {
  const width = `${Math.min(100, Math.max(0, value))}%`;

  return (
    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
      <div
        className={[
          "h-full rounded-full",
          tone === "emerald" ? "bg-emerald-500" : "bg-blue-600"
        ].join(" ")}
        style={{ width }}
      />
    </div>
  );
}

function formatPct(value: number | string | null) {
  return value == null ? "0%" : `${value}%`;
}

function formatHours(value: number) {
  if (value < 1) {
    return `${Math.round(value * 60)}m`;
  }

  return `${value.toFixed(1).replace(/\.0$/, "")}h`;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric"
  }).format(new Date(`${value}T00:00:00.000Z`));
}
