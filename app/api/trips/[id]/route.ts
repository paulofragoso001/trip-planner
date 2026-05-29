import { NextResponse } from "next/server";
import { authorizeDashboardApi } from "@/lib/server/dashboard-test-auth";
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
  const auth = await authorizeDashboardApi();

  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await auth.supabase
    .from("trips")
    .select("*")
    .eq("id", id)
    .eq("user_id", auth.userId)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  return NextResponse.json({ trip: mapTripRecord(data as Record<string, unknown>) });
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const auth = await authorizeDashboardApi();

  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const trip = normalizeTripInput(body);

  if (!trip.name || !trip.destination) {
    return NextResponse.json(
      { error: "Trip name and destination are required." },
      { status: 400 }
    );
  }

  let { data, error } = await auth.supabase
    .from("trips")
    .update(toTripWritePayload(trip))
    .eq("id", id)
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
      .eq("id", id)
      .eq("user_id", auth.userId)
      .select("*")
      .single();

    data = retry.data;
    error = retry.error;
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ trip: mapTripRecord(data as Record<string, unknown>) });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const auth = await authorizeDashboardApi();

  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await auth.supabase
    .from("trips")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

function isMissingTravelStyleColumn(message: string) {
  return /travel_style/i.test(message) && /column|schema cache|could not find/i.test(message);
}
