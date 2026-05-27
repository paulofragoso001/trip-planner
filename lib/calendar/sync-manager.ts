import "server-only";

import type {
  CalendarEventInput,
  CalendarProviderAdapter,
  CalendarProviderEvent,
  ExternalEventRef
} from "@/lib/calendar/types";
import { GoogleCalendarProvider } from "@/lib/calendar/providers/google-calendar";
import { OutlookCalendarProvider } from "@/lib/calendar/providers/outlook-calendar";
import { decryptCalendarToken } from "@/lib/server/calendar-token-encryption";
import { refreshCalendarConnectionToken } from "@/lib/server/calendar-token-refresh";
import type { CalendarProvider } from "@/lib/validators/calendar-sync";

export type SyncOperation =
  | { kind: "create"; segmentId: string }
  | { externalEventId: string; kind: "update"; segmentId: string }
  | { externalEventId: string; kind: "delete"; segmentId: string }
  | { kind: "noop"; segmentId: string };

export type SyncConflictReason =
  | "missing_provider_metadata"
  | "provider_changed_after_sync"
  | "provider_event_deleted";

export type SyncResolution =
  | { operation: SyncOperation; status: "ready" }
  | {
      conflictReason: SyncConflictReason;
      operation?: SyncOperation;
      status: "stale";
    };

export type CalendarSyncItemState = {
  providerEventEtag?: string | null;
  providerEventId?: string | null;
  syncStatus: "pending" | "synced" | "stale" | "deleted" | "error";
  waylineSyncVersion?: string | null;
};

export type EnqueueTripSyncInput = {
  connectionId: string;
  jobType?: "initial_sync" | "incremental_sync" | "reconcile" | "delete";
  payload?: Record<string, unknown>;
  tripId: string;
};

export type SyncManager = {
  enqueueTripSync(input: EnqueueTripSyncInput): Promise<void>;
  resolveByExternalMetadata(
    provider: CalendarProvider,
    calendarId: string,
    tripId: string,
    segmentId: string
  ): Promise<string | null>;
  runNextBatch(): Promise<{
    jobId: string | null;
    status: "blocked" | "failed" | "idle" | "retry_wait" | "succeeded";
  }>;
  syncSegment(segmentId: string): Promise<void>;
};

type CalendarJobRunStatus = "blocked" | "failed" | "idle" | "retry_wait" | "succeeded";

type CalendarSyncManagerClient = {
  from: (
    table:
      | "calendar_connection_tokens"
      | "calendar_connections"
      | "calendar_sync_jobs"
      | "calendar_sync_items"
      | "notifications"
  ) => any;
  rpc?: (fn: "claim_calendar_sync_job", args: Record<string, unknown>) => any;
};

type CalendarSyncJobRow = {
  attempt_count: number;
  connection_id: string;
  id: string;
  job_type: "delete" | "incremental_sync" | "initial_sync" | "reconcile";
  max_attempts: number;
  payload: {
    calendarId?: string;
    segmentIds?: string[];
  } | null;
  trip_id: string | null;
};

type CalendarConnectionRow = {
  default_calendar_id: string | null;
  id: string;
  provider: CalendarProvider;
  provider_account_email: string | null;
  status: "active" | "error" | "needs_reauth" | "revoked";
  user_id: string;
};

type CalendarTokenRow = {
  access_token_ciphertext: string;
  access_token_expires_at: string | null;
};

type CalendarSyncItemRow = {
  event_payload: CalendarEventInput;
  id: string;
  provider_calendar_id: string | null;
  provider_event_etag: string | null;
  provider_event_id: string | null;
  source_id: string;
  sync_status: "pending" | "synced" | "stale" | "deleted" | "error";
  wayline_sync_version: string | null;
};

export class WaylineCalendarSyncManager implements SyncManager {
  constructor(
    private readonly client: CalendarSyncManagerClient,
    private readonly adapters: Partial<Record<CalendarProvider, CalendarProviderAdapter>>
  ) {}

  async enqueueTripSync({
    connectionId,
    jobType = "reconcile",
    payload = {},
    tripId
  }: EnqueueTripSyncInput) {
    const idempotencyKey = buildJobIdempotencyKey(connectionId, tripId, jobType, payload);
    const { error } = await this.client.from("calendar_sync_jobs").upsert({
      connection_id: connectionId,
      idempotency_key: idempotencyKey,
      job_type: jobType,
      payload,
      status: "queued",
      trip_id: tripId
    }, {
      onConflict: "idempotency_key"
    });

    if (error) {
      throw new Error(`Could not enqueue calendar sync job: ${error.message}`);
    }
  }

  async runNextBatch() {
    if (!this.client.rpc) {
      throw new Error("Calendar sync client does not support RPC job claiming.");
    }

    const { data, error } = await this.client.rpc("claim_calendar_sync_job", {
      p_lock_seconds: 300,
      p_locked_by: `wayline-worker-${process.pid}`
    });

    if (error) {
      throw new Error(`Could not load calendar sync job: ${error.message}`);
    }

    const job = Array.isArray(data) ? data[0] : null;
    if (!job) {
      return { jobId: null, status: "idle" as const };
    }

    try {
      const result = await this.executeJob(job as CalendarSyncJobRow);
      const status: CalendarJobRunStatus =
        result.errors.length > 0 ? "failed" : "succeeded";
      await this.finishJob(job.id as string, status, result);

      return { jobId: job.id as string, status };
    } catch (error) {
      const status = await this.failJob(job as CalendarSyncJobRow, error);
      return { jobId: job.id as string, status };
    }
  }

  async syncSegment(segmentId: string) {
    const { error } = await this.client
      .from("calendar_sync_items")
      .update({
        conflict_reason: null,
        last_error:
          "Segment sync is queued for the backend calendar worker.",
        sync_status: "pending"
      })
      .eq("source_id", segmentId);

    if (error) {
      throw new Error(`Could not queue calendar segment sync: ${error.message}`);
    }
  }

  async resolveByExternalMetadata(
    provider: CalendarProvider,
    calendarId: string,
    tripId: string,
    segmentId: string
  ) {
    const adapter = this.adapters[provider];
    if (!adapter?.findEventByMetadata) {
      return null;
    }

    const event = await adapter.findEventByMetadata(calendarId, {
      segmentId,
      tripId
    });

    return event?.externalEventId ?? null;
  }

  private async executeJob(job: CalendarSyncJobRow) {
    const connection = await this.loadConnection(job.connection_id);
    const accessToken = await this.loadUsableAccessToken(connection);
    const adapter = this.adapters[connection.provider] ?? buildAdapter(connection.provider, accessToken);
    const items = await this.loadSyncItems(job);
    const result = {
      conflicts: [] as string[],
      created: [] as string[],
      deleted: [] as string[],
      errors: [] as Array<{ error: string; itemId: string }>,
      noop: [] as string[],
      updated: [] as string[]
    };

    for (const item of items) {
      try {
        const input = normalizeCalendarEventInput(
          item.event_payload,
          item.provider_calendar_id ||
            job.payload?.calendarId ||
            connection.default_calendar_id ||
            item.event_payload.calendarId ||
            "primary"
        );
        const event = await this.resolveProviderEvent(adapter, input, item);
        const resolution = resolveSyncOperation({
          deleteRequested: job.job_type === "delete",
          event,
          input,
          item: {
            providerEventEtag: item.provider_event_etag,
            providerEventId: item.provider_event_id,
            syncStatus: item.sync_status,
            waylineSyncVersion: item.wayline_sync_version
          }
        });

        if (resolution.status === "stale") {
          await this.markItemConflict(item.id, resolution.conflictReason);
          result.conflicts.push(item.source_id);
          continue;
        }

        const operation = resolution.operation;
        if (operation.kind === "noop") {
          result.noop.push(item.source_id);
          continue;
        }

        if (operation.kind === "create") {
          const created = await adapter.createEvent(input);
          await this.markItemSynced(item.id, created, input);
          result.created.push(item.source_id);
          continue;
        }

        if (operation.kind === "update") {
          const updated = await adapter.updateEvent(
            input.calendarId,
            operation.externalEventId,
            input
          );
          await this.markItemSynced(item.id, updated, input);
          result.updated.push(item.source_id);
          continue;
        }

        await adapter.deleteEvent(input.calendarId, operation.externalEventId);
        await this.markItemDeleted(item.id);
        result.deleted.push(item.source_id);
      } catch (error) {
        const message = serializeError(error);
        await this.markItemError(item.id, message);
        result.errors.push({ error: message, itemId: item.id });
      }
    }

    await this.markConnectionSynced(connection.id, result.errors[0]?.error ?? null);

    if (result.errors.length > 0) {
      await this.notifyCalendarSyncFailure(
        connection,
        "One or more calendar events could not be synced."
      );
    }

    return result;
  }

  private async loadConnection(connectionId: string): Promise<CalendarConnectionRow> {
    const { data, error } = await this.client
      .from("calendar_connections")
      .select("id,user_id,provider,status,default_calendar_id,provider_account_email")
      .eq("id", connectionId)
      .single();

    if (error || !data) {
      throw new Error(`Could not load calendar connection: ${error?.message ?? "missing row"}`);
    }

    const connection = data as CalendarConnectionRow;
    if (connection.status !== "active") {
      throw new NonRetryableCalendarSyncError(
        `Calendar connection is ${connection.status}. Reauthorization is required.`
      );
    }

    return connection;
  }

  private async loadUsableAccessToken(connection: CalendarConnectionRow) {
    let token = await this.loadCurrentToken(connection.id);

    if (tokenNeedsRefresh(token.access_token_expires_at)) {
      await refreshCalendarConnectionToken(this.client, connection.id);
      token = await this.loadCurrentToken(connection.id);
    }

    return decryptCalendarToken(token.access_token_ciphertext);
  }

  private async loadCurrentToken(connectionId: string): Promise<CalendarTokenRow> {
    const { data, error } = await this.client
      .from("calendar_connection_tokens")
      .select("access_token_ciphertext,access_token_expires_at")
      .eq("connection_id", connectionId)
      .eq("is_current", true)
      .single();

    if (error || !data) {
      throw new NonRetryableCalendarSyncError("Calendar connection requires reauthorization.");
    }

    return data as CalendarTokenRow;
  }

  private async loadSyncItems(job: CalendarSyncJobRow): Promise<CalendarSyncItemRow[]> {
    let query = this.client
      .from("calendar_sync_items")
      .select(
        "id,source_id,provider_calendar_id,provider_event_id,provider_event_etag,wayline_sync_version,sync_status,event_payload"
      )
      .eq("connection_id", job.connection_id)
      .order("event_start", { ascending: true });

    if (job.trip_id) {
      query = query.eq("trip_id", job.trip_id);
    }

    if (job.payload?.segmentIds?.length) {
      query = query.in("source_id", job.payload.segmentIds);
    }

    if (job.job_type !== "delete") {
      query = query.in("sync_status", ["pending", "stale", "error", "synced"]);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Could not load calendar sync items: ${error.message}`);
    }

    return (data || []) as CalendarSyncItemRow[];
  }

  private async resolveProviderEvent(
    adapter: CalendarProviderAdapter,
    input: CalendarEventInput,
    item: CalendarSyncItemRow
  ) {
    if (item.provider_event_id && adapter.getEvent) {
      return adapter.getEvent(input.calendarId, item.provider_event_id);
    }

    if (adapter.findEventByMetadata) {
      return adapter.findEventByMetadata(input.calendarId, {
        segmentId: input.sourceId,
        tripId: input.wayline.tripId
      });
    }

    return null;
  }

  private async markItemSynced(
    itemId: string,
    ref: ExternalEventRef,
    input: CalendarEventInput
  ) {
    const { error } = await this.client
      .from("calendar_sync_items")
      .update({
        conflict_reason: null,
        last_error: null,
        last_synced_at: new Date().toISOString(),
        provider_calendar_id: ref.calendarId,
        provider_event_etag: ref.syncVersion ?? null,
        provider_event_id: ref.externalEventId,
        sync_status: "synced",
        wayline_sync_version: input.wayline.syncVersion,
        wayline_updated_at: input.wayline.updatedAt
      })
      .eq("id", itemId);

    if (error) {
      throw new Error(`Could not mark calendar item synced: ${error.message}`);
    }
  }

  private async markItemDeleted(itemId: string) {
    const { error } = await this.client
      .from("calendar_sync_items")
      .update({
        conflict_reason: null,
        last_error: null,
        last_synced_at: new Date().toISOString(),
        sync_status: "deleted"
      })
      .eq("id", itemId);

    if (error) {
      throw new Error(`Could not mark calendar item deleted: ${error.message}`);
    }
  }

  private async markItemConflict(itemId: string, reason: SyncConflictReason) {
    const { error } = await this.client
      .from("calendar_sync_items")
      .update({
        conflict_reason: reason,
        last_error: null,
        sync_status: "stale"
      })
      .eq("id", itemId);

    if (error) {
      throw new Error(`Could not mark calendar item stale: ${error.message}`);
    }
  }

  private async markItemError(itemId: string, message: string) {
    const { error } = await this.client
      .from("calendar_sync_items")
      .update({
        last_error: message,
        sync_status: "error"
      })
      .eq("id", itemId);

    if (error) {
      throw new Error(`Could not mark calendar item error: ${error.message}`);
    }
  }

  private async markConnectionSynced(connectionId: string, errorMessage: string | null) {
    const updates = errorMessage
      ? {
          last_error: errorMessage,
          status: "error"
        }
      : {
          last_error: null,
          last_synced_at: new Date().toISOString(),
          status: "active"
        };
    const { error } = await this.client
      .from("calendar_connections")
      .update(updates)
      .eq("id", connectionId);

    if (error) {
      throw new Error(`Could not update calendar connection sync state: ${error.message}`);
    }
  }

  private async finishJob(
    jobId: string,
    status: "failed" | "succeeded",
    result: Record<string, unknown>
  ) {
    const { error } = await this.client
      .from("calendar_sync_jobs")
      .update({
        last_error:
          status === "failed" ? "One or more calendar sync items failed." : null,
        lock_expires_at: null,
        locked_at: null,
        locked_by: null,
        result,
        status
      })
      .eq("id", jobId);

    if (error) {
      throw new Error(`Could not finish calendar sync job: ${error.message}`);
    }
  }

  private async failJob(
    job: CalendarSyncJobRow,
    error: unknown
  ): Promise<Exclude<CalendarJobRunStatus, "idle" | "succeeded">> {
    const retryable = !(error instanceof NonRetryableCalendarSyncError);
    const attemptsRemaining = job.attempt_count < job.max_attempts;
    const status: Exclude<CalendarJobRunStatus, "idle" | "succeeded"> =
      retryable && attemptsRemaining ? "retry_wait" : retryable ? "failed" : "blocked";
    const backoffSeconds = nextBackoffSeconds(job.attempt_count);
    const updates = {
      last_error: serializeError(error),
      lock_expires_at: null,
      locked_at: null,
      locked_by: null,
      status
    } as Record<string, unknown>;

    if (status === "retry_wait") {
      updates.available_at = new Date(Date.now() + backoffSeconds * 1000).toISOString();
    }

    const { error: updateError } = await this.client
      .from("calendar_sync_jobs")
      .update(updates)
      .eq("id", job.id);

    if (updateError) {
      throw new Error(`Could not fail calendar sync job: ${updateError.message}`);
    }

    await this.notifyCalendarSyncFailureByConnection(job.connection_id, serializeError(error));

    return status;
  }

  private async notifyCalendarSyncFailureByConnection(
    connectionId: string,
    message: string
  ) {
    try {
      const connection = await this.loadConnectionForNotification(connectionId);
      if (connection) {
        await this.notifyCalendarSyncFailure(connection, message);
      }
    } catch {
      // Notifications must not block the worker failure path.
    }
  }

  private async loadConnectionForNotification(connectionId: string) {
    const { data } = await this.client
      .from("calendar_connections")
      .select("id,user_id,provider,status,default_calendar_id,provider_account_email")
      .eq("id", connectionId)
      .maybeSingle();

    return (data || null) as CalendarConnectionRow | null;
  }

  private async notifyCalendarSyncFailure(
    connection: CalendarConnectionRow,
    message: string
  ) {
    const providerLabel =
      connection.provider === "google" ? "Google Calendar" : "Outlook Calendar";

    try {
      await this.client.from("notifications").insert({
        content: `${providerLabel} sync needs attention: ${message}`,
        type: "calendar_sync_failure",
        user_id: connection.user_id
      });
    } catch {
      // Notification writes are best effort.
    }
  }
}

export function resolveSyncOperation({
  deleteRequested = false,
  event,
  input,
  item
}: {
  deleteRequested?: boolean;
  event: CalendarProviderEvent | null;
  input: CalendarEventInput;
  item: CalendarSyncItemState;
}): SyncResolution {
  const segmentId = input.sourceId;

  if (deleteRequested) {
    if (!item.providerEventId) {
      return { operation: { kind: "noop", segmentId }, status: "ready" };
    }

    return {
      operation: {
        externalEventId: item.providerEventId,
        kind: "delete",
        segmentId
      },
      status: "ready"
    };
  }

  if (!item.providerEventId) {
    if (event?.externalEventId) {
      return {
        operation: {
          externalEventId: event.externalEventId,
          kind: "update",
          segmentId
        },
        status: "ready"
      };
    }

    return { operation: { kind: "create", segmentId }, status: "ready" };
  }

  if (!event) {
    return {
      conflictReason: "provider_event_deleted",
      operation: { kind: "create", segmentId },
      status: "stale"
    };
  }

  const eventSegmentId = event.metadata?.segmentId ?? event.metadata?.sourceId;
  if (eventSegmentId !== segmentId) {
    return {
      conflictReason: "missing_provider_metadata",
      status: "stale"
    };
  }

  if (item.waylineSyncVersion !== input.wayline.syncVersion) {
    return {
      operation: {
        externalEventId: item.providerEventId,
        kind: "update",
        segmentId
      },
      status: "ready"
    };
  }

  if (
    item.providerEventEtag &&
    event.syncVersion &&
    item.providerEventEtag !== event.syncVersion
  ) {
    return {
      conflictReason: "provider_changed_after_sync",
      status: "stale"
    };
  }

  return {
    operation: {
      externalEventId: item.providerEventId,
      kind: "update",
      segmentId
    },
    status: "ready"
  };
}

function buildJobIdempotencyKey(
  connectionId: string,
  tripId: string,
  jobType: string,
  payload: Record<string, unknown>
) {
  return [
    "calendar",
    connectionId,
    tripId,
    jobType,
    JSON.stringify(payload, Object.keys(payload).sort())
  ].join(":");
}

class NonRetryableCalendarSyncError extends Error {}

function buildAdapter(provider: CalendarProvider, accessToken: string) {
  return provider === "google"
    ? new GoogleCalendarProvider(accessToken)
    : new OutlookCalendarProvider(accessToken);
}

function normalizeCalendarEventInput(input: CalendarEventInput, calendarId: string) {
  return {
    ...input,
    calendarId
  };
}

function tokenNeedsRefresh(expiresAt: string | null) {
  if (!expiresAt) {
    return false;
  }

  return new Date(expiresAt).getTime() - Date.now() < 5 * 60 * 1000;
}

function nextBackoffSeconds(attempt: number, base = 30, cap = 3600) {
  return Math.min(cap, base * 2 ** Math.max(0, attempt - 1));
}

function serializeError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
