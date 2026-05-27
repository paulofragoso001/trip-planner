import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type OrderUpdate = {
  id: string;
  position: number;
};

type ReorderRequest = {
  tripId?: unknown;
  orderedItemIds?: unknown;
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

  const body = (await request.json()) as ReorderRequest | OrderUpdate[];
  const tripId =
    !Array.isArray(body) && typeof body.tripId === "string" ? body.tripId : "";
  const orderedItemIds =
    !Array.isArray(body) && Array.isArray(body.orderedItemIds)
      ? body.orderedItemIds.map(String).filter(Boolean)
      : [];
  const updates =
    tripId && orderedItemIds.length > 0
      ? orderedItemIds.map((id, position) => ({ id, position }))
      : (Array.isArray(body) ? body : []).filter(isValidUpdate);

  if (updates.length === 0) {
    return NextResponse.json({ error: "Missing tripId or orderedItemIds" }, { status: 400 });
  }

  const results = await Promise.all(
    updates.map((update) => {
      let query = supabase
        .from(tripId ? "trip_segments" : "itinerary_items")
        .update({ position: update.position })
        .eq("id", update.id)
        .eq("user_id", user.id);

      if (tripId) {
        query = query.eq("trip_id", tripId);
      }

      return query.select("id,position").single();
    })
  );
  const error = results.find((result) => result.error)?.error;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (tripId) {
    return NextResponse.json({
      ok: true,
      tripId,
      orderedItemIds,
      updated: true
    });
  }

  return NextResponse.json({
    success: true,
    updated: results.map((result) => result.data).filter(Boolean)
  });
}

function isValidUpdate(update: OrderUpdate) {
  return (
    update &&
    typeof update.id === "string" &&
    Number.isInteger(update.position) &&
    update.position >= 0
  );
}
