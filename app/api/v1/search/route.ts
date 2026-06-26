import { NextResponse } from "next/server";
import { loadUnifiedSearchResults } from "@/app/dashboard/search/loader";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") || "").slice(0, 120);
  const payload = await loadUnifiedSearchResults(query);

  return NextResponse.json(payload);
}
