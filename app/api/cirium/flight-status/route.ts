import { NextResponse } from "next/server";
import { fetchCiriumFlightStatus } from "@/lib/cirium";
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
  const itemId = searchParams.get("itemId")?.trim();
  const carrier = searchParams.get("carrier")?.trim();
  const flightNumber = searchParams.get("flightNumber")?.trim();
  const year = searchParams.get("year")?.trim();
  const month = searchParams.get("month")?.trim();
  const day = searchParams.get("day")?.trim();

  if (!tripId || !itemId) {
    return NextResponse.json(
      { error: "tripId and itemId are required." },
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

    const lookup = resolveFlightLookup(
      itineraryItem as ItineraryFlightRecord,
      {
        carrier,
        flightNumber,
        year,
        month,
        day
      }
    );

    if ("error" in lookup) {
      return NextResponse.json({ error: lookup.error }, { status: lookup.status });
    }

    const status = await fetchCiriumFlightStatus({
      carrier: lookup.carrier,
      flightNumber: lookup.flightNumber,
      year: lookup.year,
      month: lookup.month,
      day: lookup.day
    });

    return NextResponse.json(status);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not fetch flight status." },
      { status: 502 }
    );
  }
}

function resolveFlightLookup(
  item: ItineraryFlightRecord,
  request: {
    carrier?: string;
    flightNumber?: string;
    year?: string;
    month?: string;
    day?: string;
  }
) {
  const storedFlightText = item.flight_number || item.confirmation_code || "";
  const storedCarrier =
    parseCarrier(storedFlightText) || parseCarrierCode(item.airline) || null;
  const storedFlightNumber = parseFlightNumber(storedFlightText);
  const storedDate = parseFlightDate(
    item.scheduled_departure || item.estimated_departure || item.start_time
  );
  const requestedDate = parseRequestedDate(request.year, request.month, request.day);
  const requestedCarrier = parseCarrierCode(request.carrier);
  const carrier = requestedCarrier || storedCarrier;
  const flightNumber = parseFlightNumber(request.flightNumber) || storedFlightNumber;
  const date = requestedDate || storedDate;

  if (item.kind && item.kind !== "flight" && item.kind !== "air" && !storedFlightNumber) {
    return {
      error: "Itinerary item is not a flight segment.",
      status: 400
    } as const;
  }

  if (request.carrier && !requestedCarrier) {
    return {
      error: "carrier must be a two- or three-character airline code.",
      status: 400
    } as const;
  }

  if (storedCarrier && requestedCarrier && requestedCarrier !== storedCarrier) {
    return {
      error: "Requested carrier does not match the itinerary flight segment.",
      status: 400
    } as const;
  }

  if (
    storedFlightNumber &&
    request.flightNumber &&
    parseFlightNumber(request.flightNumber) !== storedFlightNumber
  ) {
    return {
      error: "Requested flight number does not match the itinerary flight segment.",
      status: 400
    } as const;
  }

  if (storedDate && requestedDate && formatDateKey(storedDate) !== formatDateKey(requestedDate)) {
    return {
      error: "Requested departure date does not match the itinerary flight segment.",
      status: 400
    } as const;
  }

  if (!carrier || !flightNumber || !date) {
    return {
      error:
        "carrier, flightNumber, and departure date are required on the itinerary flight segment or request.",
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

function parseRequestedDate(
  year: string | null | undefined,
  month: string | null | undefined,
  day: string | null | undefined
) {
  if (!year || !month || !day) {
    return null;
  }

  const numericYear = Number(year);
  const numericMonth = Number(month);
  const numericDay = Number(day);

  if (
    !Number.isInteger(numericYear) ||
    !Number.isInteger(numericMonth) ||
    !Number.isInteger(numericDay) ||
    numericMonth < 1 ||
    numericMonth > 12 ||
    numericDay < 1 ||
    numericDay > 31
  ) {
    return null;
  }

  const date = new Date(numericYear, numericMonth - 1, numericDay);
  return Number.isNaN(date.getTime()) ||
    date.getFullYear() !== numericYear ||
    date.getMonth() !== numericMonth - 1 ||
    date.getDate() !== numericDay
    ? null
    : date;
}

function parseFlightDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}
