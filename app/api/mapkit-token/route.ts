import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const token =
    process.env.APPLE_MAPKIT_TOKEN ||
    process.env.NEXT_PUBLIC_APPLE_MAPKIT_TOKEN ||
    process.env.MAPKIT_TOKEN ||
    "";

  if (!token.trim()) {
    return NextResponse.json(
      { error: "Apple MapKit token is not configured." },
      {
        headers: { "Cache-Control": "no-store" },
        status: 503
      }
    );
  }

  return NextResponse.json(
    { token },
    {
      headers: { "Cache-Control": "no-store" }
    }
  );
}
