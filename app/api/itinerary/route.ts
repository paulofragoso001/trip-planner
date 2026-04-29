import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type CreateItineraryItemInput = {
  tripId?: string;
  title?: string;
  location?: string | null;
  lat?: number | null;
  lng?: number | null;
  date_time?: string | null;
  notes?: string | null;
  image_url?: string | null;
  image_urls?: string[];
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tripId = searchParams.get("tripId");

  if (!tripId) {
    return NextResponse.json({ error: "tripId is required." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("itinerary_items")
    .select("id,title,location,lat,lng,position,date_time,notes,image_url,image_urls")
    .eq("trip_id", tripId)
    .eq("user_id", user.id)
    .order("date_time", { ascending: true, nullsFirst: false })
    .order("position", { ascending: true, nullsFirst: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as CreateItineraryItemInput;
  const tripId = body.tripId || searchParams.get("tripId") || undefined;
  const title = body.title?.trim();

  if (!tripId || !title) {
    return NextResponse.json(
      { error: "tripId and title are required." },
      { status: 400 }
    );
  }

  const { data: latestItem } = await supabase
    .from("itinerary_items")
    .select("position")
    .eq("trip_id", tripId)
    .eq("user_id", user.id)
    .order("position", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  const nextPosition =
    typeof latestItem?.position === "number" ? latestItem.position + 1 : 0;
  const { data, error } = await supabase
    .from("itinerary_items")
    .insert({
      trip_id: tripId,
      user_id: user.id,
      title,
      location: body.location?.trim() || null,
      lat: body.lat ?? null,
      lng: body.lng ?? null,
      date_time: body.date_time || null,
      notes: body.notes?.trim() || null,
      image_url: body.image_url || null,
      image_urls: Array.isArray(body.image_urls) ? body.image_urls : [],
      position: nextPosition
    })
    .select("id,title,location,lat,lng,position,date_time,notes,image_url,image_urls")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
