import { NextResponse } from "next/server";
import { loadTripOverviewData } from "@/app/dashboard/trips/[tripId]/overview-loader";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadTripOverviewData(id);

  return NextResponse.json(data);
}
