import { NextResponse } from "next/server";
import { slugify } from "@/lib/slug";
import { authorizeDashboardApi } from "@/lib/server/dashboard-test-auth";
import { mapTripRecord, normalizeTripInput, toTripWritePayload } from "@/lib/trips";

export async function GET() {
  const auth = await authorizeDashboardApi();

  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await auth.supabase
    .from("trips")
    .select("*")
    .eq("user_id", auth.userId)
    .order("start_date", { ascending: true, nullsFirst: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const trips = (data || [])
    .map((record) => mapTripRecord(record as Record<string, unknown>))
    .sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json({ trips });
}

export async function POST(request: Request) {
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

  const { data, error } = await auth.supabase
    .from("trips")
    .insert({
      ...toTripWritePayload(trip),
      slug: `${slugify(trip.name)}-${Date.now()}`,
      user_id: auth.userId
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    { trip: mapTripRecord(data as Record<string, unknown>) },
    { status: 201 }
  );
}
