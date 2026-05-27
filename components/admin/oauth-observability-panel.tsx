import type { CalendarOAuthReport } from "@/lib/server/calendar-oauth-report";

export function OAuthObservabilityPanel({ report }: { report: CalendarOAuthReport }) {
  const totals = report.kpis.reduce(
    (acc, row) => {
      acc.failures += Number(row.callback_failures || 0);
      acc.missingCookies += Number(row.missing_state_cookies || 0);
      acc.starts += Number(row.starts || 0);
      acc.successes += Number(row.callback_successes || 0);
      return acc;
    },
    { failures: 0, missingCookies: 0, starts: 0, successes: 0 }
  );
  const latestTrend = report.trend.slice(0, 6);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-black">OAuth observability</h2>
          <p className="mt-2 text-sm text-slate-600">
            Calendar connect starts, callback health, and redirect anomaly signals.
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
          Supabase views
        </span>
      </div>

      {report.error ? (
        <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          {report.error}
        </p>
      ) : null}

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        {[
          ["24h starts", totals.starts],
          ["24h successes", totals.successes],
          ["24h failures", totals.failures],
          ["Missing cookies", totals.missingCookies]
        ].map(([label, value]) => (
          <article key={label} className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
              {label}
            </p>
            <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
          </article>
        ))}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <h3 className="text-sm font-black">Provider KPIs</h3>
          <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-[0.16em] text-slate-500">
                <tr>
                  <th className="px-3 py-3">Provider</th>
                  <th className="px-3 py-3">Success</th>
                  <th className="px-3 py-3">Failure</th>
                  <th className="px-3 py-3">Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {report.kpis.length ? (
                  report.kpis.map((row) => (
                    <tr key={row.provider}>
                      <td className="px-3 py-3 font-semibold capitalize">{row.provider}</td>
                      <td className="px-3 py-3">{row.callback_successes}</td>
                      <td className="px-3 py-3">{row.callback_failures}</td>
                      <td className="px-3 py-3">
                        {row.callback_failure_rate_pct === null
                          ? "0%"
                          : `${row.callback_failure_rate_pct}%`}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-3 py-4 text-slate-500" colSpan={4}>
                      No OAuth events recorded in the last 24 hours.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-black">Latest failure trend</h3>
          <div className="mt-3 grid gap-2">
            {latestTrend.length ? (
              latestTrend.map((row) => (
                <div
                  className="grid gap-2 rounded-2xl bg-slate-50 px-4 py-3 text-sm sm:grid-cols-[1fr_auto]"
                  key={`${row.bucket}-${row.provider}`}
                >
                  <div>
                    <p className="font-semibold capitalize">{row.provider}</p>
                    <p className="text-xs text-slate-500">{formatDateTime(row.bucket)}</p>
                  </div>
                  <p className="font-bold text-slate-700">
                    {Number(row.callback_failures || 0) +
                      Number(row.state_mismatches || 0) +
                      Number(row.missing_state_cookies || 0) +
                      Number(row.unsafe_redirects || 0) +
                      Number(row.token_exchange_errors || 0)}{" "}
                    signals
                  </p>
                </div>
              ))
            ) : (
              <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
                No failure trend rows in the last 7 days.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-5">
        <h3 className="text-sm font-black">Redirect anomalies</h3>
        <div className="mt-3 grid gap-2">
          {report.anomalies.length ? (
            report.anomalies.map((row) => (
              <article
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                key={`${row.created_at}-${row.provider}-${row.event_type}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">
                    {row.event_type.replaceAll("_", " ")}
                  </p>
                  <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700">
                    {row.provider}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {formatDateTime(row.created_at)}
                </p>
                <p className="mt-2 break-words text-slate-700">
                  {row.redirect_to || row.request_path || row.error_code || "No detail"}
                </p>
              </article>
            ))
          ) : (
            <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
              No redirect anomalies in the last 7 days.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}
