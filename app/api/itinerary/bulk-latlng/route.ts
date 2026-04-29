import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type LatLngUpdate = {
  id: string;
  lat: number;
  lng: number;
};

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const updates = ((await request.json()) as LatLngUpdate[]).filter(isValidUpdate);

  if (updates.length === 0) {
    return NextResponse.json({ ok: true, updated: [] });
  }

  const results = await Promise.all(
    updates.map((update) =>
      supabase
        .from("itinerary_items")
        .update({ lat: update.lat, lng: update.lng })
        .eq("id", update.id)
        .eq("user_id", user.id)
        .select("id,lat,lng")
        .single()
    )
  );
  const error = results.find((result) => result.error)?.error;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    updated: results.map((result) => result.data).filter(Boolean)
  });
}

function isValidUpdate(update: LatLngUpdate) {
  return (
    update &&
    typeof update.id === "string" &&
    isCoordinate(update.lat, -90, 90) &&
    isCoordinate(update.lng, -180, 180)
  );
}

function isCoordinate(value: unknown, min: number, max: number) {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}
