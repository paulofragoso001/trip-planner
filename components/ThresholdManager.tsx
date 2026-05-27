"use client";

export type AlertThreshold = {
  id: string;
  name: string;
  metric: "waiting" | "active" | "failed" | "stalled" | "retryRate" | "dataStaleness";
  operator: ">" | ">=" | "<" | "<=";
  value: number;
  windowMinutes: number;
  severity: "info" | "warning" | "critical";
  enabled: boolean;
  note?: string;
};

export type ThresholdPolicy = {
  queue: string;
  thresholds: AlertThreshold[];
  updatedAt: string;
};

export type ThresholdAuditRecord = {
  id: string;
  thresholdId: string;
  thresholdName: string;
  field: keyof AlertThreshold;
  oldValue: string;
  newValue: string;
  user: string;
  timestamp: string;
};

export type ThresholdMetricSnapshot = {
  waiting: number;
  active: number;
  failed: number;
  stalled: number;
  retryRate: number;
  dataStaleness: number;
};

export type ThresholdRuleState = {
  threshold: AlertThreshold;
  status: "inactive" | "info" | "warning" | "critical";
  active: boolean;
  currentValue: number;
  message: string;
};

type ThresholdManagerProps = {
  auditRecords?: ThresholdAuditRecord[];
  metricSnapshot: ThresholdMetricSnapshot;
  onChange: (policy: ThresholdPolicy, auditRecord: ThresholdAuditRecord) => void;
  onReset: () => void;
  policy: ThresholdPolicy;
  userLabel?: string;
};

const metricLabels: Record<AlertThreshold["metric"], string> = {
  active: "Active jobs",
  dataStaleness: "Flight data staleness",
  failed: "Failed jobs",
  retryRate: "Retry rate",
  stalled: "Stalled jobs",
  waiting: "Waiting jobs"
};

const severityClasses = {
  critical: "border-rose-500/40 bg-rose-500/15 text-rose-100",
  info: "border-blue-500/40 bg-blue-500/15 text-blue-100",
  inactive: "border-slate-800 bg-slate-950 text-slate-300",
  warning: "border-amber-500/40 bg-amber-500/15 text-amber-100"
};

export const defaultThresholdPolicy: ThresholdPolicy = {
  queue: "flight-refresh",
  thresholds: [
    {
      id: "stalled-warning",
      name: "Stalled jobs warning",
      metric: "stalled",
      operator: ">=",
      value: 2,
      windowMinutes: 5,
      severity: "warning",
      enabled: true,
      note: "Review worker heartbeat and Redis lock pressure."
    },
    {
      id: "stalled-critical",
      name: "Stalled jobs critical",
      metric: "stalled",
      operator: ">=",
      value: 5,
      windowMinutes: 5,
      severity: "critical",
      enabled: true,
      note: "Escalate when stalled jobs indicate stuck refresh processing."
    },
    {
      id: "failed-warning",
      name: "Failed jobs warning",
      metric: "failed",
      operator: ">=",
      value: 10,
      windowMinutes: 10,
      severity: "warning",
      enabled: true,
      note: "Triage provider or normalization failures."
    },
    {
      id: "failed-critical",
      name: "Failed jobs critical",
      metric: "failed",
      operator: ">=",
      value: 25,
      windowMinutes: 10,
      severity: "critical",
      enabled: true,
      note: "Page operations owner when failures may affect trip truth."
    },
    {
      id: "retry-warning",
      name: "Retry-rate warning",
      metric: "retryRate",
      operator: ">=",
      value: 15,
      windowMinutes: 10,
      severity: "warning",
      enabled: true,
      note: "Percent of recent refreshes requiring retry."
    },
    {
      id: "retry-critical",
      name: "Retry-rate critical",
      metric: "retryRate",
      operator: ">=",
      value: 30,
      windowMinutes: 10,
      severity: "critical",
      enabled: true,
      note: "Retry pressure likely indicates upstream instability."
    },
    {
      id: "staleness-warning",
      name: "Flight data stale warning",
      metric: "dataStaleness",
      operator: ">=",
      value: 60,
      windowMinutes: 1,
      severity: "warning",
      enabled: true,
      note: "Map or live flight position is aging."
    },
    {
      id: "staleness-critical",
      name: "Flight data stale critical",
      metric: "dataStaleness",
      operator: ">=",
      value: 180,
      windowMinutes: 3,
      severity: "critical",
      enabled: true,
      note: "Live flight position is too old to trust operationally."
    }
  ],
  updatedAt: new Date(0).toISOString()
};

export function ThresholdManager({
  auditRecords = [],
  metricSnapshot,
  onChange,
  onReset,
  policy,
  userLabel = "operator"
}: ThresholdManagerProps) {
  const ruleStates = evaluateThresholdPolicy(policy, metricSnapshot);

  function updateThreshold(
    threshold: AlertThreshold,
    field: keyof AlertThreshold,
    value: AlertThreshold[keyof AlertThreshold]
  ) {
    const oldValue = String(threshold[field] ?? "");
    const nextThreshold = { ...threshold, [field]: value };
    const nextPolicy = {
      ...policy,
      thresholds: policy.thresholds.map((item) =>
        item.id === threshold.id ? nextThreshold : item
      ),
      updatedAt: new Date().toISOString()
    };

    onChange(nextPolicy, {
      id: `${threshold.id}-${field}-${Date.now()}`,
      field,
      newValue: String(value ?? ""),
      oldValue,
      thresholdId: threshold.id,
      thresholdName: threshold.name,
      timestamp: nextPolicy.updatedAt,
      user: userLabel
    });
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Threshold policy</h2>
          <p className="text-sm text-slate-400">
            Editable alert rules for queue failures, retries, and live flight data freshness.
          </p>
        </div>
        <button
          className="rounded-full border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-slate-200 hover:border-blue-400"
          onClick={onReset}
          type="button"
        >
          Reset defaults
        </button>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-4">
        {ruleStates.slice(0, 4).map((state) => (
          <SeverityPreview key={state.threshold.id} state={state} />
        ))}
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-800">
        <table className="min-w-[980px] w-full text-left text-sm">
          <thead className="bg-slate-950 text-xs uppercase tracking-[0.12em] text-slate-500">
            <tr>
              <th className="px-3 py-2">Enabled</th>
              <th className="px-3 py-2">Rule</th>
              <th className="px-3 py-2">Metric</th>
              <th className="px-3 py-2">Operator</th>
              <th className="px-3 py-2">Value</th>
              <th className="px-3 py-2">Window</th>
              <th className="px-3 py-2">Severity</th>
              <th className="px-3 py-2">Preview</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {policy.thresholds.map((threshold) => {
              const validation = validateThreshold(threshold, metricSnapshot);
              const state = ruleStates.find((item) => item.threshold.id === threshold.id);

              return (
                <tr key={threshold.id}>
                  <td className="px-3 py-2 align-top">
                    <input
                      aria-label={`${threshold.name} enabled`}
                      checked={threshold.enabled}
                      className="h-4 w-4 accent-blue-500"
                      onChange={(event) => updateThreshold(threshold, "enabled", event.target.checked)}
                      type="checkbox"
                    />
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div className="font-bold text-slate-100">{threshold.name}</div>
                    <div className="mt-1 text-xs text-slate-500">{threshold.note}</div>
                    {validation.message ? (
                      <div className={validation.level === "error" ? "mt-1 text-xs text-rose-300" : "mt-1 text-xs text-amber-300"}>
                        {validation.message}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <select
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100"
                      onChange={(event) =>
                        updateThreshold(threshold, "metric", event.target.value as AlertThreshold["metric"])
                      }
                      value={threshold.metric}
                    >
                      {Object.entries(metricLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <select
                      className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100"
                      onChange={(event) =>
                        updateThreshold(threshold, "operator", event.target.value as AlertThreshold["operator"])
                      }
                      value={threshold.operator}
                    >
                      {([">=", ">", "<=", "<"] as const).map((operator) => (
                        <option key={operator} value={operator}>
                          {operator}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <input
                      className="w-24 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100"
                      min="0"
                      onChange={(event) => updateThreshold(threshold, "value", Number(event.target.value))}
                      type="number"
                      value={threshold.value}
                    />
                  </td>
                  <td className="px-3 py-2 align-top">
                    <input
                      className="w-20 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100"
                      min="1"
                      onChange={(event) => updateThreshold(threshold, "windowMinutes", Number(event.target.value))}
                      type="number"
                      value={threshold.windowMinutes}
                    />
                  </td>
                  <td className="px-3 py-2 align-top">
                    <select
                      className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100"
                      onChange={(event) =>
                        updateThreshold(threshold, "severity", event.target.value as AlertThreshold["severity"])
                      }
                      value={threshold.severity}
                    >
                      {(["info", "warning", "critical"] as const).map((severity) => (
                        <option key={severity} value={severity}>
                          {severity}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 align-top">
                    {state ? <SeverityPreview compact state={state} /> : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3 grid gap-2 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
          <div className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
            Prometheus rule sketch
          </div>
          <pre className="mt-2 overflow-x-auto text-xs leading-5 text-slate-300">
            {renderPrometheusRulePreview(policy)}
          </pre>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
          <div className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
            Audit trail
          </div>
          <div className="mt-2 grid max-h-40 gap-2 overflow-y-auto text-xs text-slate-300">
            {auditRecords.length ? (
              auditRecords.slice(0, 8).map((record) => (
                <div className="rounded-lg border border-slate-800 px-2 py-1" key={record.id}>
                  <span className="font-bold">{record.thresholdName}</span> {record.field}: {record.oldValue} to {record.newValue}
                  <span className="text-slate-500"> by {record.user} at {formatShortTime(record.timestamp)}</span>
                </div>
              ))
            ) : (
              <div className="text-slate-500">No threshold changes in this session.</div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function SeverityPreview({
  compact = false,
  state
}: {
  compact?: boolean;
  state: ThresholdRuleState;
}) {
  return (
    <div className={`rounded-xl border px-3 py-2 text-sm ${severityClasses[state.status]}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-bold">{compact ? state.status : state.threshold.name}</span>
        <span className="rounded-full border border-current/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em]">
          {state.active ? state.threshold.severity : "clear"}
        </span>
      </div>
      {compact ? null : <div className="mt-1 text-xs opacity-80">{state.message}</div>}
    </div>
  );
}

export function evaluateThresholdPolicy(
  policy: ThresholdPolicy,
  snapshot: ThresholdMetricSnapshot
): ThresholdRuleState[] {
  return policy.thresholds.map((threshold) => {
    const currentValue = snapshot[threshold.metric] ?? 0;
    const active = threshold.enabled && compare(currentValue, threshold.operator, threshold.value);
    const status = active ? threshold.severity : "inactive";

    return {
      active,
      currentValue,
      message: `${metricLabels[threshold.metric]} is ${formatMetricValue(threshold.metric, currentValue)} ${active ? "and crosses" : "against"} ${threshold.operator} ${formatMetricValue(threshold.metric, threshold.value)} over ${threshold.windowMinutes}m.`,
      status,
      threshold
    };
  });
}

export function criticalThresholdStates(states: ThresholdRuleState[]) {
  return states.filter((state) => state.active && state.threshold.severity === "critical");
}

export function warningThresholdStates(states: ThresholdRuleState[]) {
  return states.filter((state) => state.active && state.threshold.severity === "warning");
}

function compare(left: number, operator: AlertThreshold["operator"], right: number) {
  if (operator === ">") return left > right;
  if (operator === ">=") return left >= right;
  if (operator === "<") return left < right;
  return left <= right;
}

function validateThreshold(
  threshold: AlertThreshold,
  snapshot: ThresholdMetricSnapshot
): { level: "error" | "warning" | null; message: string | null } {
  if (!Number.isFinite(threshold.value) || threshold.value < 0) {
    return { level: "error", message: "Use a non-negative finite threshold." };
  }

  if (!Number.isFinite(threshold.windowMinutes) || threshold.windowMinutes < 1) {
    return { level: "error", message: "Window must be at least 1 minute." };
  }

  if (threshold.metric === "retryRate" && threshold.value > 100) {
    return { level: "error", message: "Retry rate is a percent and cannot exceed 100." };
  }

  const current = snapshot[threshold.metric] ?? 0;
  if (threshold.operator.includes(">") && threshold.value < current * 0.25 && current > 0) {
    return { level: "warning", message: "This may fire too often compared with current activity." };
  }

  if (threshold.operator.includes(">") && threshold.value > Math.max(100, current * 10)) {
    return { level: "warning", message: "This may be too high to catch real degradation." };
  }

  return { level: null, message: null };
}

function renderPrometheusRulePreview(policy: ThresholdPolicy) {
  return policy.thresholds
    .filter((threshold) => threshold.enabled)
    .slice(0, 4)
    .map(
      (threshold) =>
        `- alert: ${toRuleName(threshold.name)}\n  expr: flight_refresh_${threshold.metric} ${threshold.operator} ${threshold.value}\n  for: ${threshold.windowMinutes}m\n  labels: { severity: ${threshold.severity}, queue: ${policy.queue} }`
    )
    .join("\n");
}

function toRuleName(value: string) {
  return value.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function formatMetricValue(metric: AlertThreshold["metric"], value: number) {
  if (metric === "retryRate") {
    return `${value}%`;
  }

  if (metric === "dataStaleness") {
    return `${value}s`;
  }

  return String(value);
}

function formatShortTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit"
  }).format(new Date(value));
}
