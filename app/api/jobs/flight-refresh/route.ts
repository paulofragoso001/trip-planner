import { NextRequest, NextResponse } from "next/server";
import { enqueueFlightRefresh } from "@/lib/flight-refresh-queue";
import type { FlightRefreshJobData } from "@/types/flight-refresh";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const authError = validateJobSecret(req);

  if (authError) {
    return authError;
  }

  const body = (await req.json()) as Partial<FlightRefreshJobData>;
  const required: Array<keyof FlightRefreshJobData> = [
    "tripId",
    "itemId",
    "carrier",
    "flightNumber",
    "year",
    "month",
    "day",
    "userId"
  ];

  for (const key of required) {
    if (!body[key]) {
      return NextResponse.json({ error: `${key} required` }, { status: 400 });
    }
  }

  const year = Number(body.year);
  const month = Number(body.month);
  const day = Number(body.day);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return NextResponse.json(
      { error: "year, month, and day must be valid integers." },
      { status: 400 }
    );
  }

  const job = await enqueueFlightRefresh({
    tripId: String(body.tripId),
    itemId: String(body.itemId),
    carrier: String(body.carrier),
    flightNumber: String(body.flightNumber),
    year,
    month,
    day,
    userId: String(body.userId)
  });

  return NextResponse.json(
    { jobId: job.id, status: "queued" },
    { status: 202 }
  );
}

function validateJobSecret(request: NextRequest) {
  const configuredSecret = process.env.FLIGHT_REFRESH_CRON_SECRET || process.env.CRON_SECRET;

  if (!configuredSecret) {
    return NextResponse.json(
      { error: "Flight refresh cron secret is not configured." },
      { status: 503 }
    );
  }

  const authHeader = request.headers.get("authorization") || "";
  const bearerToken = authHeader.match(/^Bearer\s+(.+)$/i)?.[1];
  const headerToken = request.headers.get("x-cron-secret");

  if (bearerToken !== configuredSecret && headerToken !== configuredSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
