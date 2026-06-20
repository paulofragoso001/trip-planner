import {
  apiCanonicalSuccess,
  apiFailure,
  handleApiError,
  validationFailure
} from "@/lib/api/errors";
import { requireAdmin } from "@/lib/server/admin-auth";
import { getFlightRefreshHealth } from "@/workers/monitor.worker";

export const dynamic = "force-dynamic";

const routeName = "admin/sync";

export async function GET() {
  const timestamp = new Date().toISOString();

  try {
    const auth = await requireAdmin();
    if (!auth.isAdmin) {
      return adminAuthFailure(auth.reason);
    }

    const queue = await getFlightRefreshHealth();
    return apiCanonicalSuccess({
      action: "health",
      queue,
      service: "flight-refresh-monitor",
      status: queue.healthy ? "healthy" : "degraded",
      timestamp
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not read sync health.";

    return apiCanonicalSuccess(
      {
        action: "health",
        message,
        queue: null,
        service: "flight-refresh-monitor",
        status: "degraded",
        timestamp
      },
      { status: 503 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.isAdmin) {
      return adminAuthFailure(auth.reason);
    }

    const payload = await readJsonObject(request);
    if (!payload.ok) {
      return validationFailure(payload.error);
    }

    const action =
      typeof payload.value.action === "string" ? payload.value.action : "health";

    if (action === "health") {
      return GET();
    }

    if (action === "logs") {
      return apiCanonicalSuccess({
        action,
        message: "Parser and alert diagnostics are exposed through /api/grafana-alert-rules.",
        relatedEndpoint: "/api/grafana-alert-rules",
        status: "available"
      });
    }

    return validationFailure("Unsupported admin sync action.", { action });
  } catch (error) {
    return handleApiError(error, routeName);
  }
}

function adminAuthFailure(reason: "forbidden" | "unauthorized") {
  return reason === "unauthorized"
    ? apiFailure("unauthorized", "Unauthorized", 401)
    : apiFailure("forbidden", "Forbidden", 403);
}

async function readJsonObject(request: Request) {
  try {
    const value = await request.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return { error: "Request body must be a JSON object.", ok: false as const };
    }

    return { ok: true as const, value: value as Record<string, unknown> };
  } catch {
    return { error: "Request body must be valid JSON.", ok: false as const };
  }
}
