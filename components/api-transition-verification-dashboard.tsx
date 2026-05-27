import Link from "next/link";
import { TripButton, TripCard, TripEyebrow, cn, tripUi } from "@/components/trip-ui";

type EndpointAudit = {
  route: string;
  family: "itinerary" | "trip segments" | "imports" | "unfiled" | "flight status";
  method: "GET" | "PATCH" | "POST";
  canonicalShape: string;
  consumerStatus: "complete";
  legacyFields: "removed";
  envelopeHeader: "absent";
  regressionFocus: string;
};

type ChecklistItem = {
  label: string;
  status: "complete" | "watch";
};

const endpointAudits: EndpointAudit[] = [
  {
    canonicalShape: "{ data: { itinerary }, error: null }",
    consumerStatus: "complete",
    envelopeHeader: "absent",
    family: "itinerary",
    legacyFields: "removed",
    method: "GET",
    regressionFocus: "Timeline and map consumers must load itinerary reads from data.itinerary.",
    route: "/api/itinerary"
  },
  {
    canonicalShape: "{ data: { item }, error: null }",
    consumerStatus: "complete",
    envelopeHeader: "absent",
    family: "itinerary",
    legacyFields: "removed",
    method: "POST",
    regressionFocus: "Mutation consumers must read data.item after creating itinerary plans.",
    route: "/api/itinerary"
  },
  {
    canonicalShape: "{ data: { segments }, error: null }",
    consumerStatus: "complete",
    envelopeHeader: "absent",
    family: "trip segments",
    legacyFields: "removed",
    method: "GET",
    regressionFocus: "Trip preview fallback must read data.segments without bare-array support.",
    route: "/api/trip-segments"
  },
  {
    canonicalShape: "{ data: { sources }, error: null }",
    consumerStatus: "complete",
    envelopeHeader: "absent",
    family: "imports",
    legacyFields: "removed",
    method: "GET",
    regressionFocus: "Import queue reads must not depend on top-level sources.",
    route: "/api/import-sources"
  },
  {
    canonicalShape: "{ data: { source }, error: null }",
    consumerStatus: "complete",
    envelopeHeader: "absent",
    family: "imports",
    legacyFields: "removed",
    method: "PATCH",
    regressionFocus: "Import source updates must read data.source and canonical validation errors.",
    route: "/api/import-sources"
  },
  {
    canonicalShape: "{ data: { items }, error: null }",
    consumerStatus: "complete",
    envelopeHeader: "absent",
    family: "unfiled",
    legacyFields: "removed",
    method: "GET",
    regressionFocus: "Unfiled queue reads must not depend on top-level items.",
    route: "/api/unfiled-items"
  },
  {
    canonicalShape: "{ data: { item }, error: null }",
    consumerStatus: "complete",
    envelopeHeader: "absent",
    family: "unfiled",
    legacyFields: "removed",
    method: "POST",
    regressionFocus: "Create flow must read data.item and preserve canonical failure envelope.",
    route: "/api/unfiled-items"
  },
  {
    canonicalShape: "{ data: { item }, error: null }",
    consumerStatus: "complete",
    envelopeHeader: "absent",
    family: "unfiled",
    legacyFields: "removed",
    method: "PATCH",
    regressionFocus: "Promotion flow must read data.item after marking an unfiled item promoted.",
    route: "/api/unfiled-items/[id]"
  },
  {
    canonicalShape: "{ data: { ok, item, alert, provider }, error: null }",
    consumerStatus: "complete",
    envelopeHeader: "absent",
    family: "flight status",
    legacyFields: "removed",
    method: "POST",
    regressionFocus: "Cirium refresh must map upstream failures into canonical error codes.",
    route: "/api/itinerary/flight-status"
  }
];

const regressionChecklist: ChecklistItem[] = [
  {
    label: "All trip-data endpoint successes return top-level data and error only.",
    status: "complete"
  },
  {
    label: "No migrated endpoint emits X-Api-Envelope.",
    status: "complete"
  },
  {
    label: "Dashboard consumers prefer data.<field> through lib/api/client.ts.",
    status: "complete"
  },
  {
    label: "Validation, unauthorized, and integration failures return canonical error envelopes.",
    status: "watch"
  },
  {
    label: "Dashboard smoke remains a required PR gate for contract drift.",
    status: "watch"
  }
];

const methodStyles = {
  GET: "bg-sky-50 text-sky-700 ring-sky-100",
  PATCH: "bg-violet-50 text-violet-700 ring-violet-100",
  POST: "bg-emerald-50 text-emerald-700 ring-emerald-100"
} as const;

export function ApiTransitionVerificationDashboard() {
  const totalRoutes = endpointAudits.length;
  const canonicalRoutes = endpointAudits.filter(
    (route) => route.legacyFields === "removed" && route.envelopeHeader === "absent"
  ).length;
  const exceptionCount = totalRoutes - canonicalRoutes;

  return (
    <div className="mt-8 grid gap-5" data-testid="api-transition-dashboard">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <TripEyebrow>API contract verification</TripEyebrow>
          <h2 className="mt-2 text-3xl font-black tracking-tight">
            Legacy-to-canonical parity
          </h2>
          <p className={cn("mt-2 max-w-3xl text-sm leading-6", tripUi.text.bodyMuted)}>
            Trip-data endpoints now use a single envelope contract. This view tracks
            endpoint parity, header removal, consumer convergence, and the remaining
            regression checks needed to keep compatibility debt from returning.
          </p>
        </div>
        <Link href="/dashboard">
          <TripButton variant="secondary">Back to dashboard</TripButton>
        </Link>
      </div>

      <section className="grid gap-3 md:grid-cols-4" aria-label="API transition metrics">
        <Metric label="Audited routes" value={String(totalRoutes)} />
        <Metric label="Canonical routes" value={String(canonicalRoutes)} />
        <Metric label="Legacy exceptions" value={String(exceptionCount)} tone="good" />
        <Metric label="Envelope headers" value="0" tone="good" />
      </section>

      <TripCard as="section" className="overflow-hidden">
        <div className="border-b border-black/10 p-4">
          <TripEyebrow>Endpoint parity</TripEyebrow>
          <h3 className="mt-2 text-xl font-black">Trip-data API audit</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#f7f6f2] text-xs uppercase tracking-[0.12em] text-[#6f675c]">
              <tr>
                <th className="px-4 py-3">Route</th>
                <th className="px-4 py-3">Shape</th>
                <th className="px-4 py-3">Legacy fields</th>
                <th className="px-4 py-3">Header</th>
                <th className="px-4 py-3">Regression focus</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/10">
              {endpointAudits.map((route) => (
                <tr key={`${route.method}-${route.route}`} className="align-top">
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-1 text-xs font-black ring-1",
                          methodStyles[route.method]
                        )}
                      >
                        {route.method}
                      </span>
                      <code className="font-mono text-xs text-[#221d17]">{route.route}</code>
                    </div>
                    <p className={cn("mt-2 text-xs capitalize", tripUi.text.bodyMuted)}>
                      {route.family}
                    </p>
                  </td>
                  <td className="px-4 py-4">
                    <code className="font-mono text-xs">{route.canonicalShape}</code>
                  </td>
                  <td className="px-4 py-4">
                    <StatusBadge label={route.legacyFields} />
                  </td>
                  <td className="px-4 py-4">
                    <StatusBadge label={route.envelopeHeader} />
                  </td>
                  <td className={cn("max-w-xs px-4 py-4 leading-6", tripUi.text.bodyMuted)}>
                    {route.regressionFocus}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </TripCard>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <TripCard as="section" className="p-5">
          <TripEyebrow>Regression checklist</TripEyebrow>
          <h3 className="mt-2 text-xl font-black">Required final-state checks</h3>
          <div className="mt-4 grid gap-3">
            {regressionChecklist.map((item) => (
              <div
                className="flex items-start justify-between gap-4 rounded-2xl border border-black/10 bg-[#faf8f5] p-3"
                key={item.label}
              >
                <p className="text-sm font-semibold leading-6">{item.label}</p>
                <StatusBadge label={item.status === "complete" ? "complete" : "watch"} />
              </div>
            ))}
          </div>
        </TripCard>

        <TripCard as="section" className="p-5">
          <TripEyebrow>Release gate</TripEyebrow>
          <h3 className="mt-2 text-xl font-black">Sign-off criteria</h3>
          <p className={cn("mt-3 text-sm leading-6", tripUi.text.bodyMuted)}>
            The compatibility layer stays decommissioned when typecheck, dashboard
            smoke, and post-deploy smoke all pass against canonical-only trip-data
            responses.
          </p>
          <div className="mt-4 rounded-2xl bg-[#f7f6f2] p-4">
            <p className="text-sm font-black">Current migration KPI</p>
            <p className="mt-2 text-4xl font-black text-emerald-700">0</p>
            <p className={cn("mt-1 text-xs font-bold uppercase tracking-[0.12em]", tripUi.text.bodyMuted)}>
              legacy exceptions remaining
            </p>
          </div>
        </TripCard>
      </section>
    </div>
  );
}

function Metric({
  label,
  tone = "neutral",
  value
}: {
  label: string;
  tone?: "good" | "neutral";
  value: string;
}) {
  return (
    <TripCard className="p-4" variant="surfaceSoft">
      <p className={tripUi.text.eyebrow}>{label}</p>
      <p className={cn("mt-2 text-3xl font-black", tone === "good" && "text-emerald-700")}>
        {value}
      </p>
    </TripCard>
  );
}

function StatusBadge({ label }: { label: string }) {
  const good = ["absent", "complete", "removed"].includes(label);

  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-xs font-black ring-1",
        good
          ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
          : "bg-amber-50 text-amber-700 ring-amber-100"
      )}
    >
      {label}
    </span>
  );
}
