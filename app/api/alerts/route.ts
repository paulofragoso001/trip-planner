import { NextResponse } from "next/server";
import {
  recordAlertAck,
  recordAlertDashboardSnapshot,
  recordDashboardRequest
} from "@/lib/prometheus";

export const dynamic = "force-dynamic";

export type FlightOpsAlert = {
  id: string;
  source: "slack" | "teams" | "discord" | "email" | "pagerduty";
  severity: "info" | "warning" | "error" | "critical";
  status: "firing" | "resolved" | "acked";
  title: string;
  summary: string;
  incidentKey?: string;
  createdAt: string;
  updatedAt: string;
};

const defaultAlerts: FlightOpsAlert[] = [
  {
    createdAt: new Date().toISOString(),
    id: "pd-critical-canary",
    incidentKey: "flight-ops-canary",
    severity: "critical",
    source: "pagerduty",
    status: "firing",
    summary: "Canary error budget breached and rollback is pending.",
    title: "Flight Ops canary rollback risk",
    updatedAt: new Date().toISOString()
  },
  {
    createdAt: new Date().toISOString(),
    id: "slack-rollout",
    severity: "info",
    source: "slack",
    status: "resolved",
    summary: "Canary initialized and k6 smoke profile started.",
    title: "Canary lifecycle update",
    updatedAt: new Date().toISOString()
  },
  {
    createdAt: new Date().toISOString(),
    id: "email-summary",
    severity: "info",
    source: "email",
    status: "acked",
    summary: "Daily operator summary delivered.",
    title: "Flight Ops digest",
    updatedAt: new Date().toISOString()
  }
];

export async function GET() {
  recordDashboardRequest("/api/alerts", "GET");
  recordAlertDashboardSnapshot(defaultAlerts);
  return NextResponse.json({ alerts: defaultAlerts });
}

export async function POST(request: Request) {
  recordDashboardRequest("/api/alerts", "POST");
  const body = (await request.json().catch(() => ({}))) as Partial<FlightOpsAlert> & {
    action?: string;
  };

  if (body.action !== "ack") {
    return NextResponse.json({ error: "Unsupported alert action" }, { status: 400 });
  }

  recordAlertAck(body.source ?? "unknown", body.severity ?? "unknown");
  return NextResponse.json({
    alert: {
      ...body,
      status: "acked"
    },
    ok: true
  });
}
