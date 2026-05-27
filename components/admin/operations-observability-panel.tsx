import { RouterRefreshButton } from "@/components/dashboard/router-refresh-button";
import type { OperationsObservabilityReport } from "@/lib/server/operations-observability-report";

export function OperationsObservabilityPanel({
  report
}: {
  report: OperationsObservabilityReport;
}) {
  const queue = report.calendarQueue;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-black">Operations observability</h2>
          <p className="mt-2 text-sm text-slate-600">
            Import failures, calendar worker failures, API errors, and sync queue health.
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            Loaded {formatDateTime(report.loadedAt)}
          </p>
        </div>
        <RouterRefreshButton>Refresh</RouterRefreshButton>
      </div>

      {report.error ? (
        <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          {report.error}
        </p>
      ) : null}

      <div className="mt-4 grid gap-3 md:grid-cols-5">
        {[
          ["Queued", queue.queued],
          ["Running", queue.running],
          ["Retry wait", queue.retryWait],
          ["Failed", queue.failed],
          ["Blocked", queue.blocked]
        ].map(([label, value]) => (
          <article className="rounded-2xl bg-slate-50 p-4" key={label}>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
              {label}
            </p>
            <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
          </article>
        ))}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <PanelList title="Import failures">
          {report.importFailures.length ? (
            report.importFailures.map((row) => (
              <article
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                key={`${row.source_type}-${row.source_label}-${row.updated_at}`}
              >
                <p className="font-semibold">{row.source_label || row.source_type}</p>
                <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                  {row.source_type}
                </p>
                <p className="mt-2 break-words text-slate-700">{row.last_error}</p>
              </article>
            ))
          ) : (
            <EmptyState>No import source failures.</EmptyState>
          )}
        </PanelList>

        <PanelList title="Calendar worker failures">
          {report.calendarFailures.length ? (
            report.calendarFailures.map((row) => (
              <article className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" key={row.id}>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">{row.job_type}</p>
                  <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700">
                    {row.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Attempt {row.attempt_count} - {formatDateTime(row.created_at)}
                </p>
                <p className="mt-2 break-words text-slate-700">
                  {row.last_error || row.conflict_reason || "No error detail"}
                </p>
              </article>
            ))
          ) : (
            <EmptyState>No calendar worker failures.</EmptyState>
          )}
        </PanelList>

        <PanelList title="API errors">
          {report.apiErrors.length ? (
            report.apiErrors.map((row) => (
              <article
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                key={`${row.route}-${row.created_at}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">{row.route}</p>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                    {row.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">{formatDateTime(row.created_at)}</p>
                <p className="mt-2 break-words text-slate-700">{row.error_message}</p>
              </article>
            ))
          ) : (
            <EmptyState>No API errors recorded in the last 24 hours.</EmptyState>
          )}
        </PanelList>
      </div>

      {queue.oldestQueuedAt ? (
        <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          Oldest queued calendar job: {formatDateTime(queue.oldestQueuedAt)}
        </p>
      ) : null}
    </section>
  );
}

function PanelList({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <div>
      <h3 className="text-sm font-black">{title}</h3>
      <div className="mt-3 grid gap-2">{children}</div>
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
      {children}
    </p>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}
