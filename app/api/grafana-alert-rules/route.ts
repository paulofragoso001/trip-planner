import { NextRequest, NextResponse } from "next/server";
import {
  defaultGrafanaAlertDrafts,
  draftToGrafanaPayload,
  grafanaRuleToDraft,
  normalizeGrafanaAlertDraft,
  validateGrafanaAlertDraft,
  type GrafanaAlertDraft,
  type GrafanaProvisionedRule,
  type GrafanaRuleAuditRecord
} from "@/lib/grafana-alert-rules";

export const dynamic = "force-dynamic";

let localAuditTrail: GrafanaRuleAuditRecord[] = [];
const WRITE_DEDUPE_MS = 5000;
const recentWrites = new Map<string, { fingerprint: string; timestamp: number }>();

export async function GET(request: NextRequest) {
  const config = getGrafanaConfig();
  const uid = request.nextUrl.searchParams.get("uid");

  if (!config.configured) {
    const fallbackRules = filterRules(defaultGrafanaAlertDrafts, uid);
    return NextResponse.json({
      auditTrail: localAuditTrail,
      configured: false,
      message: "Set GRAFANA_URL and GRAFANA_SERVICE_ACCOUNT_TOKEN to load Grafana-managed alert rules.",
      rule: uid ? fallbackRules[0] ?? null : undefined,
      rules: fallbackRules,
      source: "defaults"
    });
  }

  const response = await fetch(grafanaUrl(config.url, "/api/v1/provisioning/alert-rules"), {
    cache: "no-store",
    headers: grafanaHeaders(config.token)
  });

  if (!response.ok) {
    return NextResponse.json(
      { error: `Grafana rule load failed: ${response.status}` },
      { status: response.status }
    );
  }

  const payload = await response.json();
  const payloadWithItems = payload as { items?: GrafanaProvisionedRule[] };
  const rawRules: GrafanaProvisionedRule[] = Array.isArray(payload)
    ? payload
    : Array.isArray(payloadWithItems.items)
      ? payloadWithItems.items
      : [];
  const rules: GrafanaAlertDraft[] = rawRules.map(grafanaRuleToDraft);

  return NextResponse.json({
    auditTrail: localAuditTrail,
    configured: true,
    rule: uid ? rules.find((rule) => rule.uid === uid || rule.title === uid) ?? null : undefined,
    rules: filterRules(rules, uid),
    source: "grafana"
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = normalizeAction(body?.action);
    const config = getGrafanaConfig();
    const user = typeof body?.user === "string" && body.user.trim() ? body.user.trim() : "operator";
    const rule = normalizeGrafanaAlertDraft(body?.rule ?? {});
    const datasourceUid = process.env.GRAFANA_PROMETHEUS_DATASOURCE_UID || "prometheus";

    if (action !== "delete") {
      const errors = validateGrafanaAlertDraft(rule);
      if (errors.length) {
        return NextResponse.json({ errors }, { status: 400 });
      }
    }

    const grafanaPayload = action === "delete" ? null : draftToGrafanaPayload(rule, datasourceUid);

    if (action === "dry-run") {
      return NextResponse.json({
        action,
        configured: config.configured,
        grafanaPayload,
        ok: true,
        rule
      });
    }

    const duplicateWrite = findDuplicateWrite(action, rule, grafanaPayload);
    if (duplicateWrite) {
      return NextResponse.json(
        {
          error: "Duplicate Grafana rule write suppressed. Wait briefly before saving the same rule again.",
          retryAfterSeconds: duplicateWrite.retryAfterSeconds
        },
        {
          headers: {
            "Retry-After": String(duplicateWrite.retryAfterSeconds)
          },
          status: 429
        }
      );
    }

    if (!config.configured) {
      return NextResponse.json(
        { error: "Grafana is not configured. Set GRAFANA_URL and GRAFANA_SERVICE_ACCOUNT_TOKEN before saving rules." },
        { status: 503 }
      );
    }

    let grafanaResponse: Response;
    if (action === "delete") {
      if (!rule.uid) {
        return NextResponse.json({ error: "uid is required to delete a Grafana rule." }, { status: 400 });
      }

      grafanaResponse = await fetch(grafanaUrl(config.url, `/api/v1/provisioning/alert-rules/${encodeURIComponent(rule.uid)}`), {
        method: "DELETE",
        headers: grafanaHeaders(config.token)
      });
    } else {
      grafanaResponse = await fetch(
        grafanaUrl(
          config.url,
          rule.uid
            ? `/api/v1/provisioning/alert-rules/${encodeURIComponent(rule.uid)}`
            : "/api/v1/provisioning/alert-rules"
        ),
        {
          body: JSON.stringify(grafanaPayload),
          headers: {
            ...grafanaHeaders(config.token),
            "Content-Type": "application/json"
          },
          method: rule.uid ? "PUT" : "POST"
        }
      );
    }

    const responseText = await grafanaResponse.text();
    const responseBody = parseJson(responseText);
    if (!grafanaResponse.ok) {
      return NextResponse.json(
        {
          error: grafanaErrorMessage(action, grafanaResponse.status, responseText),
          grafana: responseBody ?? responseText
        },
        { status: grafanaResponse.status }
      );
    }

    const auditRecord: GrafanaRuleAuditRecord = {
      action: action === "delete" ? "delete" : rule.uid ? "update" : "create",
      id: `grafana-rule-${Date.now()}`,
      timestamp: new Date().toISOString(),
      title: rule.title,
      uid: rule.uid,
      user
    };
    localAuditTrail = [auditRecord, ...localAuditTrail].slice(0, 50);
    rememberWrite(action, rule, grafanaPayload);

    return NextResponse.json({
      action,
      auditRecord,
      grafana: responseBody ?? responseText,
      grafanaPayload,
      ok: true,
      rule
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Could not write Grafana alert rule."
      },
      { status: 500 }
    );
  }
}

function findDuplicateWrite(action: string, rule: { uid?: string; title: string }, payload: unknown) {
  const key = writeKey(action, rule);
  const fingerprint = JSON.stringify(payload ?? { action, uid: rule.uid, title: rule.title });
  const previous = recentWrites.get(key);
  const now = Date.now();

  if (!previous || previous.fingerprint !== fingerprint) return null;
  const ageMs = now - previous.timestamp;
  if (ageMs >= WRITE_DEDUPE_MS) return null;

  return {
    retryAfterSeconds: Math.max(1, Math.ceil((WRITE_DEDUPE_MS - ageMs) / 1000))
  };
}

function rememberWrite(action: string, rule: { uid?: string; title: string }, payload: unknown) {
  recentWrites.set(writeKey(action, rule), {
    fingerprint: JSON.stringify(payload ?? { action, uid: rule.uid, title: rule.title }),
    timestamp: Date.now()
  });
}

function writeKey(action: string, rule: { uid?: string; title: string }) {
  return `${action}:${rule.uid || rule.title}`;
}

function getGrafanaConfig() {
  const url = process.env.GRAFANA_URL || "";
  const token = process.env.GRAFANA_SERVICE_ACCOUNT_TOKEN || process.env.GRAFANA_TOKEN || "";

  return {
    configured: Boolean(url && token),
    token,
    url
  };
}

function filterRules<T extends { uid?: string; title: string }>(rules: T[], uid: string | null) {
  if (!uid) return rules;
  return rules.filter((rule) => rule.uid === uid || rule.title === uid);
}

function grafanaErrorMessage(action: string, status: number, responseText: string) {
  if (status === 401 || status === 403) {
    return "Grafana authentication failed. Check GRAFANA_SERVICE_ACCOUNT_TOKEN permissions.";
  }
  if (status === 409) {
    return "Grafana rule conflict. Refresh the rule and try again.";
  }
  if (status === 429) {
    return "Grafana rate limit reached. Wait before saving again.";
  }
  return `Grafana ${action} failed: ${status}${responseText ? ` - ${responseText}` : ""}`;
}

function grafanaUrl(baseUrl: string, path: string) {
  return new URL(path, baseUrl).toString();
}

function grafanaHeaders(token: string) {
  return {
    Accept: "application/json",
    Authorization: `Bearer ${token}`
  };
}

function normalizeAction(value: unknown) {
  if (value === "delete") return "delete";
  if (value === "dry-run") return "dry-run";
  return "save";
}

function parseJson(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
