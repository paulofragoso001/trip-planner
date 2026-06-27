import { NextResponse } from "next/server";
import { z } from "zod";
import { slugify } from "@/lib/slug";
import { authorizeDashboardApi } from "@/lib/server/dashboard-test-auth";
import { validateSessionMutationRequest } from "@/lib/server/request-protection";
import { parseMutationPayload } from "@/lib/server/mutation-schemas";
import {
  isMissingTripDestinationMetadataColumn,
  mapTripRecord,
  normalizeTripInput,
  stripTripDestinationMetadata,
  toTripWritePayload,
  TRIP_TRAVEL_STYLES
} from "@/lib/trips";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const dateOnlySchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD format.")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Use a valid calendar date.");

const nullableDateSchema = z.preprocess((value) => {
  if (value === undefined || value === null) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  return value;
}, dateOnlySchema.nullable());

const nullableBudgetSchema = z.preprocess((value) => {
  if (value === undefined || value === null) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  return value;
}, z.coerce.number().finite().nonnegative().nullable());

const nullableCoordinateSchema = z.preprocess((value) => {
  if (value === undefined || value === null) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  return value;
}, z.coerce.number().finite().nullable());

const nullableTrimmedStringSchema = z.preprocess((value) => {
  if (value === undefined || value === null) return null;
  return value;
}, z.string().trim().transform((value) => value || null).nullable());

const countryCodeSchema = z
  .string()
  .trim()
  .length(2, "Country code must be an ISO 3166-1 alpha-2 code.")
  .transform((value) => value.toUpperCase());

const nullableCountryCodeSchema = z.preprocess((value) => {
  if (value === undefined || value === null) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  return value;
}, countryCodeSchema.nullable());

const createTripV1PayloadSchema = z
  .object({
    countryCode: nullableCountryCodeSchema.optional().default(null),
    country_code: nullableCountryCodeSchema.optional().default(null),
    destination: z.string().trim().min(1, "Destination is required."),
    destination_formatted_address: nullableTrimmedStringSchema.optional().default(null),
    destination_lat: nullableCoordinateSchema.optional().default(null),
    destination_lng: nullableCoordinateSchema.optional().default(null),
    destination_place_id: nullableTrimmedStringSchema.optional().default(null),
    end_date: nullableDateSchema.optional().default(null),
    expense_budget: nullableBudgetSchema.optional().default(null),
    start_date: nullableDateSchema.optional().default(null),
    travel_style: z.enum(TRIP_TRAVEL_STYLES).optional().default("balanced"),
    trip_name: z.string().trim().min(1, "Trip name is required.")
  })
  .strict()
  .transform((value) => ({
    ...value,
    country_code: value.country_code ?? value.countryCode ?? null
  }));

export async function GET(request: Request) {
  const auth = await authorizeDashboardApi();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized", success: false }, { status: 401 });
  }

  const year = new URL(request.url).searchParams.get("year");
  let query = auth.supabase
    .from("trips")
    .select("*")
    .eq("user_id", auth.userId)
    .order("start_date", { ascending: true, nullsFirst: false });

  if (year) {
    const parsedYear = Number(year);
    if (!Number.isInteger(parsedYear) || parsedYear < 1900 || parsedYear > 3000) {
      return NextResponse.json(
        { error: "Year must be a valid four-digit year.", success: false },
        { status: 400 }
      );
    }

    query = query
      .gte("start_date", `${parsedYear}-01-01`)
      .lte("start_date", `${parsedYear}-12-31`);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: error.message, success: false },
      { status: 500 }
    );
  }

  const trips = (data || []).map((record) =>
    toV1TripResponse(mapTripRecord(record as Record<string, unknown>))
  );

  return NextResponse.json({ success: true, trips });
}

export async function POST(request: Request) {
  const csrfError = validateSessionMutationRequest(request);
  if (csrfError) {
    return csrfError;
  }

  const auth = await authorizeDashboardApi();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await readJsonObject(request);
  if (!body.ok) {
    return NextResponse.json({ error: body.error }, { status: 400 });
  }

  const payload = parseMutationPayload(createTripV1PayloadSchema, body.value);
  if (!payload.ok) {
    return NextResponse.json({ error: payload.error }, { status: 400 });
  }

  const trip = normalizeTripInput({
    budget: payload.value.expense_budget ?? 0,
    destination: payload.value.destination,
    destination_formatted_address: payload.value.destination_formatted_address,
    destination_lat: payload.value.destination_lat,
    destination_lng: payload.value.destination_lng,
    destination_place_id: payload.value.destination_place_id,
    destination_provider_metadata: payload.value.country_code
      ? { countryCode: payload.value.country_code }
      : {},
    destination_status:
      payload.value.destination_lat !== null && payload.value.destination_lng !== null
        ? "resolved"
        : "manual",
    end_date: payload.value.end_date,
    name: payload.value.trip_name,
    start_date: payload.value.start_date,
    travel_style: payload.value.travel_style
  });
  const writePayload = {
    ...toTripWritePayload(trip),
    slug: `${slugify(payload.value.trip_name)}-${Date.now()}`,
    user_id: auth.userId
  };
  let { data, error } = await auth.supabase
    .from("trips")
    .insert(writePayload)
    .select("*")
    .single();

  if (
    error &&
    (isMissingTravelStyleColumn(error.message) ||
      isMissingTripDestinationMetadataColumn(error.message))
  ) {
    const { travel_style: _travelStyle, ...withoutTravelStyle } = writePayload;
    const legacyPayload = stripTripDestinationMetadata(withoutTravelStyle);
    const retry = await auth.supabase
      .from("trips")
      .insert(legacyPayload)
      .select("*")
      .single();

    data = retry.data;
    error = retry.error;
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    {
      success: true,
      trip: toV1TripResponse(mapTripRecord(data as Record<string, unknown>))
    },
    { status: 201 }
  );
}

function isMissingTravelStyleColumn(message: string) {
  return /travel_style/i.test(message) && /column|schema cache|could not find/i.test(message);
}

function toV1TripResponse(trip: ReturnType<typeof mapTripRecord>) {
  const countryCode = readCountryCode(trip.destination_provider_metadata);
  return {
    countryCode,
    country_code: countryCode,
    date_range: formatDateRange(trip.start_date, trip.end_date),
    destination_name: trip.destination,
    end_date: trip.end_date,
    expense_budget: trip.budget,
    id: trip.id,
    lat: trip.destination_lat,
    lng: trip.destination_lng,
    start_date: trip.start_date,
    travel_style: trip.travel_style,
    trip_name: trip.name
  };
}

function readCountryCode(metadata: Record<string, unknown>) {
  const value = metadata.countryCode ?? metadata.country_code;
  return typeof value === "string" && /^[a-z]{2}$/i.test(value)
    ? value.toUpperCase()
    : null;
}

function formatDateRange(startDate: string | null, endDate: string | null) {
  return `${startDate || "TBD"} → ${endDate || "TBD"}`;
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
