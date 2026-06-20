import { NextResponse } from "next/server";
import { authorizeDashboardApi } from "@/lib/server/dashboard-test-auth";
import {
  parseMutationPayload,
  parseRouteId,
  tripMutationPayloadSchema
} from "@/lib/server/mutation-schemas";
import { validateSessionMutationRequest } from "@/lib/server/request-protection";
import {
  isMissingTripDestinationMetadataColumn,
  mapTripRecord,
  normalizeTripInput,
  stripTripDestinationMetadata,
  toTripWritePayload
} from "@/lib/trips";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const routeId = parseRouteId(id, "Trip id");
  if (!routeId.ok) {
    return NextResponse.json({ error: routeId.error }, { status: 400 });
  }

  const auth = await authorizeDashboardApi();

  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await auth.supabase
    .from("trips")
    .select("*")
    .eq("id", routeId.value)
    .eq("user_id", auth.userId)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  return NextResponse.json({ trip: mapTripRecord(data as Record<string, unknown>) });
}

export async function PATCH(request: Request, context: RouteContext) {
  const csrfError = validateSessionMutationRequest(request);
  if (csrfError) {
    return csrfError;
  }

  const { id } = await context.params;
  const routeId = parseRouteId(id, "Trip id");
  if (!routeId.ok) {
    return NextResponse.json({ error: routeId.error }, { status: 400 });
  }

  const auth = await authorizeDashboardApi();

  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await readJsonObject(request);
  if (!body.ok) {
    return NextResponse.json({ error: body.error }, { status: 400 });
  }

  const payload = parseMutationPayload(tripMutationPayloadSchema, body.value);
  if (!payload.ok) {
    return NextResponse.json({ error: payload.error }, { status: 400 });
  }

  const trip = normalizeTripInput(payload.value);

  if (!trip.name || !trip.destination) {
    return NextResponse.json(
      { error: "Trip name and destination are required." },
      { status: 400 }
    );
  }

  let { data, error } = await auth.supabase
    .from("trips")
    .update(toTripWritePayload(trip))
    .eq("id", routeId.value)
    .eq("user_id", auth.userId)
    .select("*")
    .single();

  if (
    error &&
    (isMissingTravelStyleColumn(error.message) ||
      isMissingTripDestinationMetadataColumn(error.message))
  ) {
    const { travel_style: _travelStyle, ...withoutTravelStyle } = toTripWritePayload(trip);
    const legacyPayload = stripTripDestinationMetadata(withoutTravelStyle);
    const retry = await auth.supabase
      .from("trips")
      .update(legacyPayload)
      .eq("id", routeId.value)
      .eq("user_id", auth.userId)
      .select("*")
      .single();

    data = retry.data;
    error = retry.error;
  }

  if (error) {
    const status = isMissingOrUnauthorizedTripError(error.message) ? 404 : 500;
    return NextResponse.json(
      { error: status === 404 ? "Trip not found." : error.message },
      { status },
    );
  }

  return NextResponse.json({ trip: mapTripRecord(data as Record<string, unknown>) });
}

export async function DELETE(request: Request, context: RouteContext) {
  const csrfError = validateSessionMutationRequest(request);
  if (csrfError) {
    return csrfError;
  }

  const { id } = await context.params;
  const routeId = parseRouteId(id, "Trip id");
  if (!routeId.ok) {
    return NextResponse.json({ error: routeId.error }, { status: 400 });
  }

  const auth = await authorizeDashboardApi();

  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await auth.supabase
    .from("trips")
    .delete()
    .eq("id", routeId.value)
    .eq("user_id", auth.userId)
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Trip not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

function isMissingTravelStyleColumn(message: string) {
  return /travel_style/i.test(message) && /column|schema cache|could not find/i.test(message);
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

function isMissingOrUnauthorizedTripError(message: string) {
  return /no rows|multiple rows|not found|406/i.test(message);
}
