import { AsyncActionButton } from "@/components/dashboard/async-action-button";
import { ImportParseObservabilityPanel } from "@/components/admin/import-parse-observability-panel";
import { OAuthObservabilityPanel } from "@/components/admin/oauth-observability-panel";
import { OperationsObservabilityPanel } from "@/components/admin/operations-observability-panel";
import { getCalendarOAuthReport } from "@/lib/server/calendar-oauth-report";
import { getImportParseReport } from "@/lib/server/import-parse-report";
import { getOperationsObservabilityReport } from "@/lib/server/operations-observability-report";

export default async function AdminPage() {
  const [oauthReport, importParseReport, operationsReport] = await Promise.all([
    getCalendarOAuthReport(),
    getImportParseReport(),
    getOperationsObservabilityReport()
  ]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]" data-testid="admin-route">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-black">Admin tools</h2>
        <p className="mt-2 text-sm text-slate-600">
          Backend-only controls, sync jobs, and diagnostics belong here.
        </p>
        <div className="mt-4 grid gap-3">
          <AsyncActionButton
            body={{ action: "run" }}
            endpoint="/api/admin/jobs"
            successMessage="Flight refresh job started."
          >
            Refresh flight statuses
          </AsyncActionButton>
          <AsyncActionButton
            body={{ action: "health" }}
            endpoint="/api/admin/sync"
            successMessage="Sync health checked."
          >
            View sync health
          </AsyncActionButton>
          <AsyncActionButton
            body={{ action: "logs" }}
            endpoint="/api/admin/sync"
            successMessage="Parser/alert rules loaded."
          >
            Open parser logs
          </AsyncActionButton>
        </div>
      </section>

      <aside className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-base font-black">Internal status</h3>
        <div className="mt-4 grid gap-3 text-sm text-slate-700">
          <p className="rounded-2xl bg-slate-50 px-4 py-3">Queue healthy</p>
          <p className="rounded-2xl bg-slate-50 px-4 py-3">
            API latency normal
          </p>
          <p className="rounded-2xl bg-slate-50 px-4 py-3">
            No critical sync errors
          </p>
        </div>
      </aside>

      <OAuthObservabilityPanel report={oauthReport} />
      <OperationsObservabilityPanel report={operationsReport} />
      <ImportParseObservabilityPanel report={importParseReport} />
    </div>
  );
}
