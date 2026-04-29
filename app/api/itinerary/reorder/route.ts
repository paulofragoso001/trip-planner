import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type OrderUpdate = {
  id: string;
  position: number;
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

  const updates = ((await request.json()) as OrderUpdate[]).filter(isValidUpdate);

  if (updates.length === 0) {
    return NextResponse.json({ success: true, updated: [] });
  }

  const results = await Promise.all(
    updates.map((update) =>
      supabase
        .from("itinerary_items")
        .update({ position: update.position })
        .eq("id", update.id)
        .eq("user_id", user.id)
        .select("id,position")
        .single()
    )
  );
  const error = results.find((result) => result.error)?.error;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
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
