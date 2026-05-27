import { NextResponse } from "next/server";
import { redactPanelErrorReport } from "@/lib/panel-error-reporting";

type PanelErrorPayload = {
  componentStack?: unknown;
  digest?: unknown;
  metadata?: unknown;
  message?: unknown;
  name?: unknown;
  payload?: unknown;
  panelName?: unknown;
  source?: unknown;
  stack?: unknown;
  timestamp?: unknown;
  url?: unknown;
};

export async function POST(request: Request) {
  let payload: PanelErrorPayload;

  try {
    payload = (await request.json()) as PanelErrorPayload;
  } catch {
    return NextResponse.json({ error: "Invalid panel error payload." }, { status: 400 });
  }

  const report = redactPanelErrorReport({
    componentStack: readString(payload.componentStack),
    digest: readString(payload.digest),
    metadata: payload.metadata,
    message: readString(payload.message) || "Unknown panel error",
    name: readString(payload.name),
    payload: payload.payload,
    panelName: readString(payload.panelName) || "unknown-panel",
    source: readSource(payload.source),
    stack: readString(payload.stack),
    timestamp: readString(payload.timestamp) || new Date().toISOString(),
    url: readString(payload.url)
  });

  console.error("Dashboard panel error report", report);

  return NextResponse.json({ ok: true });
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readSource(value: unknown) {
  const source = readString(value);

  return source === "boundary" ||
    source === "global-error" ||
    source === "unhandled-rejection"
    ? source
    : undefined;
}
