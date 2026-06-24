"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { ImportParseAnomaly } from "@/lib/server/import-parse-report";
import { useAlmidyAction } from "@/hooks/use-wayline-action";

type FilterKind = "all" | "parser" | "segment" | "severity";

type ActiveFilter = {
  kind: FilterKind;
  value: string;
};

export function ImportParseAnomalyList({
  anomalies
}: {
  anomalies: ImportParseAnomaly[];
}) {
  const router = useRouter();
  const { isPending, run, state } = useAlmidyAction();
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>({
    kind: "all",
    value: "all"
  });
  const parserVersions = useMemo(
    () =>
      Array.from(
        new Set(
          anomalies.flatMap((anomaly) =>
            anomaly.relatedEvents.map((event) => `${event.parserName} ${event.parserVersion}`)
          )
        )
      ).sort(),
    [anomalies]
  );
  const segmentTypes = useMemo(
    () =>
      Array.from(
        new Set(
          anomalies.flatMap((anomaly) =>
            anomaly.relatedEvents.map(
              (event) => event.finalSegmentType || event.predictedSegmentType || "unknown"
            )
          )
        )
      ).sort(),
    [anomalies]
  );
  const visibleAnomalies = anomalies.filter((anomaly) => {
    if (activeFilter.kind === "all") {
      return true;
    }

    if (activeFilter.kind === "severity") {
      return anomaly.severity === activeFilter.value;
    }

    if (activeFilter.kind === "parser") {
      return anomaly.relatedEvents.some(
        (event) => `${event.parserName} ${event.parserVersion}` === activeFilter.value
      );
    }

    return anomaly.relatedEvents.some(
      (event) =>
        (event.finalSegmentType || event.predictedSegmentType || "unknown") === activeFilter.value
    );
  });
  async function onReview(
    anomaly: ImportParseAnomaly,
    status: "confirmed" | "false_positive" | "pending" | "resolved"
  ) {
    const result = await run({
      body: {
        anomalyFingerprint: anomaly.fingerprint,
        anomalyLabel: anomaly.label,
        detectedAt: anomaly.detectedAt,
        status
      },
      method: "POST",
      url: "/api/admin/import-parse-anomaly-reviews"
    });

    if (result.status === "success") {
      router.refresh();
    }
  }

  return (
    <div className="mt-5">
      <h3 className="text-sm font-black">Import anomalies</h3>
      <div className="mt-3 flex flex-wrap gap-2">
        <FilterChip
          active={activeFilter.kind === "all"}
          label="All"
          onClick={() => setActiveFilter({ kind: "all", value: "all" })}
        />
        {["warning", "info"].map((severity) => (
          <FilterChip
            active={activeFilter.kind === "severity" && activeFilter.value === severity}
            key={severity}
            label={severity}
            onClick={() => setActiveFilter({ kind: "severity", value: severity })}
          />
        ))}
        {parserVersions.map((parserVersion) => (
          <FilterChip
            active={activeFilter.kind === "parser" && activeFilter.value === parserVersion}
            key={parserVersion}
            label={parserVersion}
            onClick={() => setActiveFilter({ kind: "parser", value: parserVersion })}
          />
        ))}
        {segmentTypes.map((segmentType) => (
          <FilterChip
            active={activeFilter.kind === "segment" && activeFilter.value === segmentType}
            key={segmentType}
            label={segmentType}
            onClick={() => setActiveFilter({ kind: "segment", value: segmentType })}
          />
        ))}
      </div>

      {state.message ? (
        <p
          className={[
            "mt-3 rounded-2xl px-4 py-3 text-sm font-semibold",
            state.status === "success"
              ? "bg-emerald-50 text-emerald-700"
              : state.status === "error" || state.status === "timeout"
                ? "bg-red-50 text-red-700"
                : "bg-slate-50 text-slate-600"
          ].join(" ")}
        >
          {state.message}
        </p>
      ) : null}

      <div className="mt-3 grid gap-2">
        {visibleAnomalies.length ? (
          visibleAnomalies.map((anomaly, index) => (
            <article
              className={[
                "rounded-2xl border px-4 py-3 text-sm",
                anomaly.severity === "warning"
                  ? "border-amber-200 bg-amber-50"
                  : "border-blue-100 bg-blue-50"
              ].join(" ")}
              key={`${anomaly.label}-${index}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-black text-slate-950">{anomaly.label}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-700">
                    Impact {anomaly.impactScore}
                  </span>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-700">
                    {reviewStatusLabel(anomaly.reviewStatus)}
                  </span>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-700">
                    {anomaly.affectedEvents} events
                  </span>
                  <span
                    className={[
                      "rounded-full px-3 py-1 text-xs font-bold",
                      anomaly.severity === "warning"
                        ? "bg-white text-amber-800"
                        : "bg-white text-blue-700"
                    ].join(" ")}
                  >
                    {anomaly.value}
                  </span>
                </div>
              </div>
              <p className="mt-2 text-slate-700">{anomaly.detail}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {[
                  ["confirmed", "Confirm"],
                  ["false_positive", "False positive"],
                  ["resolved", "Resolve"],
                  ["pending", "Reset pending"]
                ].map(([status, label]) => (
                  <button
                    className={[
                      "rounded-full px-3 py-1 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-50",
                      anomaly.reviewStatus === status
                        ? "bg-slate-950 text-white"
                        : "bg-white text-slate-700 hover:bg-slate-100"
                    ].join(" ")}
                    disabled={isPending}
                    key={status}
                    onClick={() =>
                      onReview(
                        anomaly,
                        status as "confirmed" | "false_positive" | "pending" | "resolved"
                      )
                    }
                    type="button"
                  >
                    {label}
                  </button>
                ))}
                {anomaly.reviewedAt ? (
                  <span className="text-xs font-semibold text-slate-500">
                    Reviewed {formatDateTime(anomaly.reviewedAt)}
                  </span>
                ) : null}
                {anomaly.resolvedAt ? (
                  <span className="text-xs font-semibold text-slate-500">
                    Resolved {formatDateTime(anomaly.resolvedAt)}
                  </span>
                ) : null}
              </div>
              {anomaly.reviewNote ? (
                <p className="mt-2 rounded-xl bg-white/80 px-3 py-2 text-xs font-semibold text-slate-600">
                  {anomaly.reviewNote}
                </p>
              ) : null}
              {anomaly.relatedEvents.length ? (
                <div className="mt-3 grid gap-2">
                  {anomaly.relatedEvents.map((event) => (
                    <div className="rounded-xl bg-white/80 px-3 py-2" key={event.id}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold capitalize text-slate-800">
                          {event.eventType}
                        </p>
                        <span className="text-xs font-bold text-slate-500">
                          {formatDateTime(event.createdAt)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-600">
                        {event.sourceLabel || event.sourceType} ·{" "}
                        {event.predictedSegmentType || "unknown"} to{" "}
                        {event.finalSegmentType || "unknown"}
                        {event.confidence == null
                          ? ""
                          : ` · ${Math.round(event.confidence * 100)}% confidence`}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[11px] font-semibold text-slate-400">
                          {event.parserName} {event.parserVersion} · {event.id}
                        </p>
                        <Link
                          className="rounded-full bg-slate-950 px-3 py-1 text-xs font-bold text-white transition hover:bg-slate-700"
                          href={`/dashboard/admin/import-events/${event.id}`}
                        >
                          Open event
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </article>
          ))
        ) : (
          <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
            No parser anomalies match the selected filters.
          </p>
        )}
      </div>
    </div>
  );
}

function FilterChip({
  active,
  label,
  onClick
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={[
        "rounded-full px-3 py-1 text-xs font-bold capitalize transition",
        active
          ? "bg-slate-950 text-white"
          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
      ].join(" ")}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function reviewStatusLabel(status: ImportParseAnomaly["reviewStatus"]) {
  switch (status) {
    case "confirmed":
      return "Confirmed";
    case "false_positive":
      return "False positive";
    case "pending":
      return "Pending";
    case "resolved":
      return "Resolved";
    default:
      return "Unreviewed";
  }
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}
