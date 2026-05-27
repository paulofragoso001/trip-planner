import {
  apiCanonicalSuccess,
  apiFailure,
  handleApiError,
  validationFailure
} from "@/lib/api/errors";
import { requireAdmin } from "@/lib/server/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const routeName = "admin/import-parse-anomaly-reviews";
const reviewStatuses = new Set(["confirmed", "false_positive", "pending", "resolved"]);

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.isAdmin) {
      return adminAuthFailure(auth.reason);
    }

    const admin = createAdminClient();
    if (!admin) {
      return apiFailure(
        "internal_error",
        "SUPABASE_SERVICE_ROLE_KEY is not configured.",
        503
      );
    }

    const payload = await request.json().catch(() => ({}));
    const anomalyFingerprint = readString(payload, "anomalyFingerprint");
    const anomalyLabel = readString(payload, "anomalyLabel");
    const detectedAt = readString(payload, "detectedAt");
    const status = readString(payload, "status");
    const note = readOptionalString(payload, "note");

    if (!anomalyFingerprint || !anomalyLabel || !detectedAt || !status) {
      return validationFailure("Missing required anomaly review fields.", {
        required: ["anomalyFingerprint", "anomalyLabel", "detectedAt", "status"]
      });
    }

    if (!reviewStatuses.has(status)) {
      return validationFailure("Unsupported anomaly review status.", { status });
    }

    const detectedAtDate = new Date(detectedAt);
    if (Number.isNaN(detectedAtDate.getTime())) {
      return validationFailure("detectedAt must be a valid timestamp.", { detectedAt });
    }

    const now = new Date().toISOString();
    const reviewedAt = status === "pending" ? null : now;
    const resolvedAt = status === "false_positive" || status === "resolved" ? now : null;

    const { data, error } = await admin
      .from("import_parse_anomaly_reviews")
      .upsert(
        {
          anomaly_fingerprint: anomalyFingerprint,
          anomaly_label: anomalyLabel,
          detected_at: detectedAtDate.toISOString(),
          note,
          resolved_at: resolvedAt,
          reviewed_at: reviewedAt,
          status,
          user_id: auth.userId
        },
        { onConflict: "user_id,anomaly_fingerprint" }
      )
      .select(
        "anomaly_fingerprint,anomaly_label,created_at,detected_at,id,note,resolved_at,reviewed_at,status,updated_at,user_id"
      )
      .single();

    if (error) {
      return apiFailure("internal_error", error.message, 500);
    }

    return apiCanonicalSuccess({
      message: "Anomaly review saved.",
      review: data
    });
  } catch (error) {
    return handleApiError(error, routeName);
  }
}

function adminAuthFailure(reason: "forbidden" | "unauthorized") {
  return reason === "unauthorized"
    ? apiFailure("unauthorized", "Unauthorized", 401)
    : apiFailure("forbidden", "Forbidden", 403);
}

function readString(payload: unknown, key: string) {
  if (!isRecord(payload) || typeof payload[key] !== "string" || !payload[key].trim()) {
    return null;
  }

  return payload[key].trim();
}

function readOptionalString(payload: unknown, key: string) {
  if (!isRecord(payload) || typeof payload[key] !== "string") {
    return null;
  }

  const value = payload[key].trim();
  return value ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
