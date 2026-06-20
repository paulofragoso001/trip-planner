import { apiCanonicalSuccess, apiFailure, handleApiError, validationFailure } from "@/lib/api/errors";
import { adminJobsPayloadSchema, parseMutationPayload } from "@/lib/server/mutation-schemas";
import { requireAdmin } from "@/lib/server/admin-auth";

export const dynamic = "force-dynamic";

const routeName = "admin/jobs";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.isAdmin) {
    return adminAuthFailure(auth.reason);
  }

  return apiCanonicalSuccess({
    actions: ["status", "run"],
    message: "Admin job controls are available, but protected job execution requires cron/admin authorization.",
    protectedEndpoint: "/api/jobs/refresh-flight-statuses",
    status: "ready"
  });
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

    const parsedPayload = parseMutationPayload(adminJobsPayloadSchema, payload.value);
    if (!parsedPayload.ok) {
      return validationFailure(parsedPayload.error);
    }

    const { action } = parsedPayload.value;

    if (action === "status") {
      return GET();
    }

    if (action === "run") {
      return apiFailure(
        "unauthorized",
        "Admin job execution is protected. Use /api/jobs/refresh-flight-statuses with cron authorization until admin role checks are wired.",
        401,
        { protectedEndpoint: "/api/jobs/refresh-flight-statuses" }
      );
    }

    return validationFailure("Unsupported admin job action.", { action });
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
