import { ApiError, apiCanonicalSuccess, handleApiError } from "@/lib/api/errors";
import { AlmidyCalendarSyncManager } from "@/lib/calendar/sync-manager";
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

    const manager = new AlmidyCalendarSyncManager(admin, {});
    const result = await manager.runNextBatch();

    return apiCanonicalSuccess({
      message:
        result.status === "idle"
          ? "No queued calendar sync jobs."
          : `Calendar sync job processed with status: ${result.status}.`,
      worker: result
    });
  } catch (error) {
    return handleApiError(error, "calendar/worker");
  }
}

function authorizeWorker(request: Request) {
  const configuredSecret =
    process.env.CALENDAR_SYNC_WORKER_SECRET || process.env.FLIGHT_REFRESH_CRON_SECRET;

  if (!configuredSecret) {
    throw new ApiError(
      "not_implemented",
      "CALENDAR_SYNC_WORKER_SECRET is not configured.",
      501
    );
  }

  const providedSecret = request.headers.get("x-calendar-sync-secret");
  if (providedSecret !== configuredSecret) {
    throw new ApiError("unauthorized", "Unauthorized", 401);
  }
}
