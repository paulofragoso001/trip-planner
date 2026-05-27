import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type ApiErrorEvent = {
  created_at: string;
  error_message: string;
  error_name: string | null;
  route: string;
  status: number;
};

export type CalendarQueueHealth = {
  blocked: number;
  failed: number;
  oldestQueuedAt: string | null;
  queued: number;
  retryWait: number;
  running: number;
};

export type CalendarWorkerFailure = {
  available_at: string | null;
  attempt_count: number;
  conflict_reason: string | null;
  created_at: string;
  id: string;
  job_type: string;
  last_error: string | null;
  status: string;
};

export type ImportFailure = {
  last_error: string | null;
  last_synced_at: string | null;
  source_label: string | null;
  source_type: string;
  updated_at: string;
};

export type OperationsObservabilityReport = {
  apiErrors: ApiErrorEvent[];
  calendarFailures: CalendarWorkerFailure[];
  calendarQueue: CalendarQueueHealth;
  error: string | null;
  importFailures: ImportFailure[];
  loadedAt: string;
};

const emptyQueue: CalendarQueueHealth = {
  blocked: 0,
  failed: 0,
  oldestQueuedAt: null,
  queued: 0,
  retryWait: 0,
  running: 0
};

export async function getOperationsObservabilityReport(): Promise<OperationsObservabilityReport> {
  const loadedAt = new Date().toISOString();
  const admin = createAdminClient();

  if (!admin) {
    return {
      apiErrors: [],
      calendarFailures: [],
      calendarQueue: emptyQueue,
      error: "SUPABASE_SERVICE_ROLE_KEY is not configured.",
      importFailures: [],
      loadedAt
    };
  }

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  try {
    const [apiErrors, importFailures, calendarFailures, queueRows] = await Promise.all([
      admin
        .from("api_error_events")
        .select("created_at,error_message,error_name,route,status")
        .gte("created_at", since24h)
        .order("created_at", { ascending: false })
        .limit(12),
      admin
        .from("import_sources")
        .select("last_error,last_synced_at,source_label,source_type,updated_at")
        .not("last_error", "is", null)
        .order("updated_at", { ascending: false })
        .limit(8),
      admin
        .from("calendar_sync_jobs")
        .select("available_at,attempt_count,conflict_reason,created_at,id,job_type,last_error,status")
        .in("status", ["failed", "blocked", "retry_wait"])
        .order("updated_at", { ascending: false })
        .limit(10),
      admin
        .from("calendar_sync_jobs")
        .select("created_at,status")
        .in("status", ["queued", "running", "retry_wait", "failed", "blocked"])
        .limit(500)
    ]);

    const error =
      apiErrors.error || importFailures.error || calendarFailures.error || queueRows.error;

    if (error) {
      return {
        apiErrors: [],
        calendarFailures: [],
        calendarQueue: emptyQueue,
        error: error.message,
        importFailures: [],
        loadedAt
      };
    }

    return {
      apiErrors: (apiErrors.data || []) as ApiErrorEvent[],
      calendarFailures: (calendarFailures.data || []) as CalendarWorkerFailure[],
      calendarQueue: buildQueueHealth((queueRows.data || []) as Array<{ created_at: string; status: string }>),
      error: null,
      importFailures: (importFailures.data || []) as ImportFailure[],
      loadedAt
    };
  } catch (error) {
    return {
      apiErrors: [],
      calendarFailures: [],
      calendarQueue: emptyQueue,
      error:
        error instanceof Error
          ? error.message
          : "Could not load operations observability report.",
      importFailures: [],
      loadedAt
    };
  }
}

function buildQueueHealth(rows: Array<{ created_at: string; status: string }>): CalendarQueueHealth {
  const oldestQueuedAt = rows
    .filter((row) => row.status === "queued")
    .map((row) => row.created_at)
    .sort()[0] ?? null;

  return {
    blocked: countStatus(rows, "blocked"),
    failed: countStatus(rows, "failed"),
    oldestQueuedAt,
    queued: countStatus(rows, "queued"),
    retryWait: countStatus(rows, "retry_wait"),
    running: countStatus(rows, "running")
  };
}

function countStatus(rows: Array<{ status: string }>, status: string) {
  return rows.filter((row) => row.status === status).length;
}
