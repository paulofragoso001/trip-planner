export type GrafanaAlertDraft = {
  uid?: string;
  title: string;
  folderUid: string;
  ruleGroup: string;
  expr: string;
  for: string;
  noDataState: "NoData" | "OK" | "Alerting";
  execErrState: "Error" | "Alerting" | "OK";
  labels: Record<string, string>;
  annotations: Record<string, string>;
  enabled: boolean;
};

export type GrafanaRuleAuditRecord = {
  id: string;
  action: "create" | "update" | "delete" | "dry-run";
  uid?: string;
  title: string;
  user: string;
  timestamp: string;
};

export type GrafanaProvisionedRule = {
  uid?: string;
  title?: string;
  folderUID?: string;
  folderUid?: string;
  ruleGroup?: string;
  for?: string;
  noDataState?: GrafanaAlertDraft["noDataState"];
  execErrState?: GrafanaAlertDraft["execErrState"];
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  isPaused?: boolean;
  data?: Array<{
    refId?: string;
    datasourceUid?: string;
    model?: {
      expr?: string;
      [key: string]: unknown;
    };
  }>;
};

export type GrafanaAlertRulePayload = {
  uid?: string;
  title: string;
  folderUID: string;
  ruleGroup: string;
  condition: "C";
  data: Array<Record<string, unknown>>;
  for: string;
  noDataState: GrafanaAlertDraft["noDataState"];
  execErrState: GrafanaAlertDraft["execErrState"];
  labels: Record<string, string>;
  annotations: Record<string, string>;
  isPaused: boolean;
};

export const defaultGrafanaAlertDrafts: GrafanaAlertDraft[] = [
  {
    annotations: {
      description: "Flight refresh workers are stalled above 5 for 5 minutes.",
      summary: "Stalled flight refresh jobs"
    },
    enabled: true,
    execErrState: "Error",
    expr: "flight_refresh_worker_stalled_jobs_total{queue=\"flight-refresh\"} >= 5",
    folderUid: "flight-ops",
    for: "5m",
    labels: {
      queue: "flight-refresh",
      severity: "critical",
      team: "flight-ops"
    },
    noDataState: "NoData",
    ruleGroup: "flight-refresh",
    title: "Stalled jobs critical"
  },
  {
    annotations: {
      description: "Flight refresh failures are above 10 for 10 minutes.",
      summary: "Failed flight refresh jobs"
    },
    enabled: true,
    execErrState: "Error",
    expr: "flight_refresh_worker_failed_jobs{queue=\"flight-refresh\"} >= 10",
    folderUid: "flight-ops",
    for: "10m",
    labels: {
      queue: "flight-refresh",
      severity: "warning",
      team: "flight-ops"
    },
    noDataState: "NoData",
    ruleGroup: "flight-refresh",
    title: "Failed jobs warning"
  },
  {
    annotations: {
      description: "Live flight position has not updated within 180 seconds.",
      summary: "Live flight data stale"
    },
    enabled: true,
    execErrState: "Error",
    expr: "flight_refresh_live_data_staleness_seconds{queue=\"flight-refresh\"} >= 180",
    folderUid: "flight-ops",
    for: "3m",
    labels: {
      queue: "flight-refresh",
      severity: "critical",
      team: "flight-ops"
    },
    noDataState: "NoData",
    ruleGroup: "flight-refresh",
    title: "Live flight data stale critical"
  }
];

export function normalizeGrafanaAlertDraft(input: Partial<GrafanaAlertDraft>): GrafanaAlertDraft {
  return {
    annotations: sanitizeStringRecord(input.annotations ?? {}),
    enabled: input.enabled !== false,
    execErrState: normalizeExecErrState(input.execErrState),
    expr: String(input.expr ?? "").trim(),
    folderUid: String(input.folderUid ?? "").trim(),
    for: String(input.for ?? "").trim(),
    labels: sanitizeStringRecord(input.labels ?? {}),
    noDataState: normalizeNoDataState(input.noDataState),
    ruleGroup: String(input.ruleGroup ?? "").trim(),
    title: String(input.title ?? "").trim(),
    uid: input.uid ? String(input.uid).trim() : undefined
  };
}

export function validateGrafanaAlertDraft(rule: GrafanaAlertDraft) {
  const errors: string[] = [];

  if (!rule.title) errors.push("Rule title is required.");
  if (!rule.folderUid) errors.push("Folder UID is required.");
  if (!rule.ruleGroup) errors.push("Rule group is required.");
  if (!rule.expr) errors.push("Query expression is required.");
  if (!rule.for || !/^\d+[smhdw]$/.test(rule.for)) errors.push("Evaluation window must look like 5m, 30s, 1h, or 1d.");
  if (!rule.annotations.summary?.trim()) errors.push("Annotation summary is required.");
  if (!rule.annotations.description?.trim()) errors.push("Annotation description is required.");
  if (!rule.labels.team?.trim()) errors.push("Label team is required.");
  if (!rule.labels.queue?.trim()) errors.push("Label queue is required.");
  if (rule.labels.severity && !["info", "warning", "critical"].includes(rule.labels.severity)) {
    errors.push("Label severity must be info, warning, or critical.");
  }

  return errors;
}

export function grafanaRuleToDraft(rule: GrafanaProvisionedRule): GrafanaAlertDraft {
  return {
    annotations: rule.annotations ?? {},
    enabled: rule.isPaused !== true,
    execErrState: normalizeExecErrState(rule.execErrState),
    expr: findPromExpression(rule),
    folderUid: String(rule.folderUID ?? rule.folderUid ?? ""),
    for: String(rule.for ?? "5m"),
    labels: rule.labels ?? {},
    noDataState: normalizeNoDataState(rule.noDataState),
    ruleGroup: String(rule.ruleGroup ?? "flight-refresh"),
    title: String(rule.title ?? "Untitled Grafana alert"),
    uid: rule.uid
  };
}

export function draftToGrafanaPayload(
  rule: GrafanaAlertDraft,
  datasourceUid: string
): GrafanaAlertRulePayload {
  return {
    annotations: rule.annotations,
    condition: "C",
    data: [
      {
        datasourceUid,
        model: {
          datasource: {
            type: "prometheus",
            uid: datasourceUid
          },
          expr: rule.expr,
          instant: false,
          intervalMs: 1000,
          maxDataPoints: 43200,
          refId: "A"
        },
        refId: "A",
        relativeTimeRange: {
          from: 600,
          to: 0
        }
      },
      {
        datasourceUid: "__expr__",
        model: {
          conditions: [
            {
              evaluator: {
                params: [0],
                type: "gt"
              },
              operator: {
                type: "and"
              },
              query: {
                params: ["A"]
              },
              reducer: {
                params: [],
                type: "last"
              },
              type: "query"
            }
          ],
          datasource: {
            type: "__expr__",
            uid: "__expr__"
          },
          expression: "A",
          reducer: "last",
          refId: "B",
          type: "reduce"
        },
        refId: "B",
        relativeTimeRange: {
          from: 0,
          to: 0
        }
      },
      {
        datasourceUid: "__expr__",
        model: {
          conditions: [
            {
              evaluator: {
                params: [0],
                type: "gt"
              },
              operator: {
                type: "and"
              },
              query: {
                params: ["B"]
              },
              reducer: {
                params: [],
                type: "last"
              },
              type: "query"
            }
          ],
          datasource: {
            type: "__expr__",
            uid: "__expr__"
          },
          expression: "B",
          refId: "C",
          type: "threshold"
        },
        refId: "C",
        relativeTimeRange: {
          from: 0,
          to: 0
        }
      }
    ],
    execErrState: rule.execErrState,
    folderUID: rule.folderUid,
    for: rule.for,
    isPaused: !rule.enabled,
    labels: rule.labels,
    noDataState: rule.noDataState,
    ruleGroup: rule.ruleGroup,
    title: rule.title,
    uid: rule.uid
  };
}

function findPromExpression(rule: GrafanaProvisionedRule) {
  const query = rule.data?.find((item) => item.refId === "A" && item.model?.expr);
  return String(query?.model?.expr ?? "");
}

function sanitizeStringRecord(record: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [
      key.replace(/[^a-zA-Z0-9_]/g, "_"),
      String(value ?? "").trim()
    ])
  );
}

function normalizeNoDataState(value: unknown): GrafanaAlertDraft["noDataState"] {
  return value === "OK" || value === "Alerting" ? value : "NoData";
}

function normalizeExecErrState(value: unknown): GrafanaAlertDraft["execErrState"] {
  return value === "Alerting" || value === "OK" ? value : "Error";
}
