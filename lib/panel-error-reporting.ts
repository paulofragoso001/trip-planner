export type PanelErrorReport = {
  componentStack?: string;
  digest?: string;
  message: string;
  metadata?: unknown;
  name?: string;
  payload?: unknown;
  panelName: string;
  source?: "boundary" | "global-error" | "unhandled-rejection";
  stack?: string;
  url?: string;
};

export function reportPanelError(report: PanelErrorReport) {
  const payload = redactPanelErrorReport({
    ...report,
    timestamp: new Date().toISOString(),
    url: report.url || (typeof window !== "undefined" ? window.location.href : undefined)
  });

  console.error("Dashboard panel error", payload);

  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
    navigator.sendBeacon("/api/panel-errors", blob);
    return;
  }

  if (typeof fetch !== "undefined") {
    void fetch("/api/panel-errors", {
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      method: "POST"
    }).catch(() => {
      // Reporting is best-effort; panel boundaries still contain the user-facing failure.
    });
  }
}

export function redactPanelErrorReport<TReport extends PanelErrorReport & { timestamp?: string }>(
  report: TReport
) {
  return {
    componentStack: redactText(report.componentStack),
    digest: redactText(report.digest),
    metadata: redactValue(report.metadata),
    message: redactText(report.message) || "Redacted panel error",
    name: redactText(report.name),
    payload: redactValue(report.payload),
    panelName: redactPanelName(report.panelName),
    source: report.source,
    stack: redactText(report.stack),
    timestamp: redactText(report.timestamp),
    url: redactUrl(report.url)
  };
}

function redactPanelName(value: string) {
  return redactText(value)?.slice(0, 120) || "unknown-panel";
}

function redactText(value: string | undefined) {
  if (!value) return undefined;

  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .replace(/\b(?:sk|pk|rk|AIza|ya29|ghp|github_pat)_[A-Za-z0-9_-]{12,}\b/g, "[redacted-token]")
    .replace(/\bAIza[A-Za-z0-9_-]{20,}\b/g, "[redacted-google-key]")
    .replace(/\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\b/g, "[redacted-jwt]")
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi, "[redacted-id]")
    .replace(/\b(?:trip|user|flight|item|profile|session)[_-]?[A-Za-z0-9]{8,}\b/gi, "[redacted-id]")
    .replace(/\b(token|secret|password|api[_-]?key|authorization)=([^&\s]+)/gi, "$1=[redacted]")
    .slice(0, 4000);
}

function redactValue(value: unknown, depth = 0): unknown {
  if (value == null || depth > 4) return undefined;
  if (typeof value === "string") return redactText(value);
  if (typeof value === "number" || typeof value === "boolean") return value;

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => redactValue(item, depth + 1));
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, 50)
        .map(([key, item]) => [
          redactText(key) || "redacted",
          isSensitiveKey(key) ? "[redacted]" : redactValue(item, depth + 1)
        ])
    );
  }

  return undefined;
}

function isSensitiveKey(key: string) {
  return /(?:token|secret|password|api[_-]?key|authorization|email|user|trip|flight|session|profile|document|note)/i.test(key);
}

function redactUrl(value: string | undefined) {
  if (!value) return undefined;

  try {
    const url = new URL(value);
    url.search = "";
    url.hash = "";
    return redactText(url.toString());
  } catch {
    return redactText(value.split("?")[0]);
  }
}
