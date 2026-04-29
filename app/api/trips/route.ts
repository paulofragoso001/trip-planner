import { NextResponse } from "next/server";
import { slugify } from "@/lib/slug";
import { createClient } from "@/lib/supabase/server";
import { normalizeTripInput } from "@/lib/trips";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("trips")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ trips: data });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
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

  const { data, error } = await supabase
    .from("trips")
    .insert({
      ...trip,
      slug: `${slugify(trip.name)}-${Date.now()}`,
      user_id: user.id
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ trip: data }, { status: 201 });
}
