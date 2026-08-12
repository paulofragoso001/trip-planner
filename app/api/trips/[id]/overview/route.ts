import { NextResponse } from "next/server";
import { loadCanonicalTripOverview } from "@/app/dashboard/trips/[tripId]/overview-loader";
import { tripOverviewV1Schema } from "@/lib/contracts/trip-overview-v1";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await loadCanonicalTripOverview(id);

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, version: 1 },
      { status: result.status }
    );
  }

  return NextResponse.json(tripOverviewV1Schema.parse(result.data));
}
