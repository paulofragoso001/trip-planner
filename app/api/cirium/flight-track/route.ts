import { NextResponse } from "next/server";
import { fetchCiriumFlightTrack } from "@/lib/cirium";
import { createClient } from "@/lib/supabase/server";

type ItineraryFlightRecord = {
  id: string;
  title: string | null;
  kind: string | null;
  flight_number: string | null;
  airline: string | null;
  confirmation_code: string | null;
  scheduled_departure: string | null;
  estimated_departure: string | null;
  start_time: string | null;
};

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const tripId = searchParams.get("tripId")?.trim();
  const itemId =
    searchParams.get("itemId")?.trim() ||
    searchParams.get("flightId")?.trim();

  if (!tripId || !itemId) {
    return NextResponse.json(
      { error: "tripId and flightId are required." },
      { status: 400 }
    );
  }

  try {
    const { data: itineraryItem, error: itemError } = await supabase
      .from("trip_segments")
      .select(
        "id,title,kind,flight_number,airline,confirmation_code,scheduled_departure,estimated_departure,start_time"
      )
      .eq("id", itemId)
      .eq("trip_id", tripId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (itemError) {
      return NextResponse.json({ error: itemError.message }, { status: 500 });
    }

    if (!itineraryItem) {
      return NextResponse.json({ error: "Flight segment not found." }, { status: 404 });
    }

    const lookup = resolveFlightLookup(itineraryItem as ItineraryFlightRecord);

    if ("error" in lookup) {
      return NextResponse.json({ error: lookup.error }, { status: lookup.status });
    }

    const track = await fetchCiriumFlightTrack(lookup);

    return NextResponse.json({
      track,
      position: track.position
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not fetch flight track." },
      { status: 502 }
    );
  }
}

function resolveFlightLookup(item: ItineraryFlightRecord) {
  const storedFlightText = item.flight_number || item.confirmation_code || "";
  const carrier =
    parseCarrier(storedFlightText) || parseCarrierCode(item.airline) || null;
  const flightNumber = parseFlightNumber(storedFlightText);
  const date = parseFlightDate(
    item.scheduled_departure || item.estimated_departure || item.start_time
  );

  if (item.kind && item.kind !== "flight" && item.kind !== "air" && !flightNumber) {
    return {
      error: "Itinerary item is not a flight segment.",
      status: 400
    } as const;
  }

  if (!carrier || !flightNumber || !date) {
    return {
      error:
        "carrier, flight number, and departure date are required on the itinerary flight segment.",
      status: 400
    } as const;
  }

  return {
    carrier,
    flightNumber,
    year: String(date.getFullYear()),
    month: String(date.getMonth() + 1),
    day: String(date.getDate())
  };
}

function normalizeCarrier(value: string | null | undefined) {
  return value?.trim().toUpperCase() || null;
}

function parseCarrier(value: string | null | undefined) {
  const cleanValue = normalizeCarrier(value) || "";
  return cleanValue.match(/^[A-Z0-9]{2,3}/)?.[0] ?? null;
}

function parseCarrierCode(value: string | null | undefined) {
  const cleanValue = normalizeCarrier(value) || "";
  return cleanValue.match(/^[A-Z0-9]{2,3}$/)?.[0] ?? null;
}

function parseFlightNumber(value: string | null | undefined) {
  const cleanValue = value?.trim().toUpperCase() || "";
  return cleanValue.match(/\d{1,5}/)?.[0] ?? null;
}

function parseFlightDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
