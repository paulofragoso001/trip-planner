import {
  apiCanonicalSuccess,
  handleApiError,
  unauthorized,
  validationFailure
} from "@/lib/api/errors";
import { authorizeDashboardApi } from "@/lib/server/dashboard-test-auth";
import { validateSessionMutationRequest } from "@/lib/server/request-protection";
import {
  deleteTripSegment,
  updateTripSegment,
  type TripSegmentsClient
} from "@/lib/server/trip-segments";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateTripSegmentPatch } from "@/lib/validators/trip-segments";

const routeName = "trip-segments/:id";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id.trim()) {
      return validationFailure("Trip segment id is required.");
    }

    const validation = validateTripSegmentPatch(await readJson(request));

    if (!validation.ok) {
      return validationFailure("Invalid trip segment payload.", validation.details);
    }

    const auth = await authorizeDashboardApi<TripSegmentsClient>();

    if (!auth) {
      return unauthorized();
    }

    const segment = await updateTripSegment(
      auth.supabase,
      auth.userId,
      id,
      validation.value
    );

    return apiCanonicalSuccess({ segment });
  } catch (error) {
    return handleApiError(error, routeName);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const csrfError = validateSessionMutationRequest(request);
    if (csrfError) {
      return csrfError;
    }

    const { id } = await params;

    if (!id.trim()) {
      return validationFailure("Trip segment id is required.");
    }

    const auth = await authorizeDashboardApi<TripSegmentsClient>();

    if (!auth) {
      return unauthorized();
    }

    const calendarDeletePlan = await loadCalendarDeletePlan(auth.userId, id);
    await deleteTripSegment(auth.supabase, auth.userId, id);
    await queueCalendarDeletes(calendarDeletePlan);

    return apiCanonicalSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error, routeName);
  }
}

type CalendarDeletePlan = {
  connectionId: string;
  itemIds: string[];
  segmentId: string;
  tripId: string;
};

async function loadCalendarDeletePlan(
  userId: string,
  segmentId: string
): Promise<CalendarDeletePlan[]> {
  const admin = createAdminClient();

  if (!admin) {
    return [];
  }

  const { data: connections, error: connectionError } = await admin
    .from("calendar_connections")
    .select("id")
    .eq("user_id", userId)
    .in("status", ["active", "error"]);

  if (connectionError || !connections?.length) {
    return [];
  }

  const connectionIds = connections
    .map((connection: { id?: string }) => connection.id)
    .filter((id: string | undefined): id is string => Boolean(id));

  if (!connectionIds.length) {
    return [];
  }

  const { data: items, error: itemError } = await admin
    .from("calendar_sync_items")
    .select("id,connection_id,trip_id")
    .in("connection_id", connectionIds)
    .eq("source_type", "trip_segment")
    .eq("source_id", segmentId)
    .neq("sync_status", "deleted");

  if (itemError || !items?.length) {
    return [];
  }

  const plan = new Map<string, CalendarDeletePlan>();

  for (const item of items as Array<{
    connection_id: string;
    id: string;
    trip_id: string;
  }>) {
    const key = `${item.connection_id}:${item.trip_id}`;
    const existing = plan.get(key);

    if (existing) {
      existing.itemIds.push(item.id);
      continue;
    }

    plan.set(key, {
      connectionId: item.connection_id,
      itemIds: [item.id],
      segmentId,
      tripId: item.trip_id
    });
  }

  return Array.from(plan.values());
}

async function queueCalendarDeletes(plans: CalendarDeletePlan[]) {
  if (!plans.length) {
    return;
  }

  const admin = createAdminClient();

  if (!admin) {
    return;
  }

  for (const plan of plans) {
    const { error: itemError } = await admin
      .from("calendar_sync_items")
      .update({
        conflict_reason: null,
        last_error: null,
        sync_status: "pending"
      })
      .in("id", plan.itemIds);

    if (itemError) {
      throw itemError;
    }

    const payload = { segmentIds: [plan.segmentId] };
    const { error: jobError } = await admin.from("calendar_sync_jobs").upsert(
      {
        connection_id: plan.connectionId,
        idempotency_key: buildCalendarDeleteJobId(
          plan.connectionId,
          plan.tripId,
          payload
        ),
        job_type: "delete",
        payload,
        status: "queued",
        trip_id: plan.tripId
      },
      { onConflict: "idempotency_key" }
    );

    if (jobError) {
      throw jobError;
    }
  }
}

function buildCalendarDeleteJobId(
  connectionId: string,
  tripId: string,
  payload: Record<string, unknown>
) {
  return [
    "calendar",
    connectionId,
    tripId,
    "delete",
    JSON.stringify(payload, Object.keys(payload).sort())
  ].join(":");
}

async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
