import Link from "next/link";
import { notFound } from "next/navigation";
import { getImportParseEventDetail } from "@/lib/server/import-parse-event-detail";

type PageProps = {
  params: Promise<{ eventId: string }>;
};

export default async function Page({ params }: PageProps) {
  const { eventId } = await params;
  const report = await getImportParseEventDetail(eventId);

  if (report.error === "Import parse event not found.") {
    notFound();
  }

  return (
    <div className="grid gap-6" data-testid="import-event-detail-route">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
            Import event
          </p>
          <h2 className="mt-1 text-xl font-black">Parse event detail</h2>
        </div>
        <Link
          className="rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-200"
          href="/dashboard/admin"
        >
          Back to admin
        </Link>
      </div>

      {report.error ? (
        <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          {report.error}
        </p>
      ) : null}

      {report.event ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-black capitalize">
                {report.event.event_type}
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                {formatDateTime(report.event.created_at)}
              </p>
            </div>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
              {report.event.parser_name} {report.event.parser_version}
            </span>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <InfoCard label="Predicted" value={report.event.predicted_segment_type || "unknown"} />
            <InfoCard label="Final" value={report.event.final_segment_type || "unknown"} />
            <InfoCard
              label="Confidence"
              value={
                report.event.confidence == null
                  ? "unknown"
                  : `${Math.round(report.event.confidence * 100)}%`
              }
            />
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1fr]">
            <div className="rounded-2xl bg-slate-50 p-4">
              <h4 className="text-sm font-black">Source context</h4>
              <div className="mt-3 grid gap-2 text-sm text-slate-700">
                <Row label="Source" value={report.event.source_label || report.event.source_type} />
                <Row label="Event ID" value={report.event.id} />
                <Row label="User ID" value={report.event.user_id} />
                <Row label="Unfiled item" value={report.event.unfiled_item_id || "none"} />
              </div>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <h4 className="text-sm font-black">Unfiled item</h4>
              {report.source ? (
                <div className="mt-3 grid gap-2 text-sm text-slate-700">
                  <Row label="Title" value={report.source.title || "untitled"} />
                  <Row label="Status" value={report.source.parse_status || "unknown"} />
                  <Row label="Segment" value={report.source.segment_type || "unknown"} />
                  <Row label="Trip" value={report.source.trip_id || "none"} />
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-500">
                  No source review item is linked to this parse event.
                </p>
              )}
            </div>
          </div>

          {report.event.input_excerpt ? (
            <div className="mt-5 rounded-2xl border border-slate-200 px-4 py-3">
              <h4 className="text-sm font-black">Input excerpt</h4>
              <p className="mt-2 text-sm text-slate-700">{report.event.input_excerpt}</p>
            </div>
          ) : null}

          <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1fr]">
            <JsonBlock label="Predicted payload" value={report.event.predicted_payload} />
            <JsonBlock label="Final payload" value={report.event.final_payload} />
            <JsonBlock label="Previous payload" value={report.event.previous_payload} />
            <JsonBlock label="Correction payload" value={report.event.correction_payload} />
          </div>
        </section>
      ) : null}
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-lg font-black text-slate-950">{value}</p>
    </article>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1">
      <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </span>
      <span className="break-all font-semibold">{value}</span>
    </div>
  );
}

function JsonBlock({ label, value }: { label: string; value: Record<string, unknown> }) {
  return (
    <div className="rounded-2xl border border-slate-200 px-4 py-3">
      <h4 className="text-sm font-black">{label}</h4>
      <pre className="mt-3 max-h-72 overflow-auto rounded-xl bg-slate-950 p-3 text-xs text-slate-50">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}
