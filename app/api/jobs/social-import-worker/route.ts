import { ApiError, apiCanonicalSuccess, handleApiError } from "@/lib/api/errors";
import { runSocialImportWorker } from "@/lib/server/social-imports";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    authorizeWorker(request);

    const admin = createAdminClient();
    if (!admin) {
      throw new ApiError(
        "not_implemented",
        "SUPABASE_SERVICE_ROLE_KEY is not configured.",
        501
      );
    }

    const body = await readJson(request);
    const limit =
      isRecord(body) && typeof body.limit === "number" && Number.isFinite(body.limit)
        ? body.limit
        : 5;
    const worker = await runSocialImportWorker(admin, { limit });

    return apiCanonicalSuccess({
      message:
        worker.status === "idle"
          ? "No queued social imports."
          : `Social import worker processed ${worker.processed.length} import(s).`,
      worker
    });
  } catch (error) {
    return handleApiError(error, "jobs/social-import-worker");
  }
}

function authorizeWorker(request: Request) {
  const configuredSecret =
    process.env.SOCIAL_IMPORT_WORKER_SECRET ||
    process.env.CALENDAR_SYNC_WORKER_SECRET ||
    process.env.FLIGHT_REFRESH_CRON_SECRET;

  if (!configuredSecret) {
    throw new ApiError(
      "not_implemented",
      "SOCIAL_IMPORT_WORKER_SECRET is not configured.",
      501
    );
  }

  const providedSecret = request.headers.get("x-social-import-worker-secret");
  if (providedSecret !== configuredSecret) {
    throw new ApiError("unauthorized", "Unauthorized", 401);
  }
}

async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
