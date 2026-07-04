import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const rawToken =
    process.env.APPLE_MAPKIT_TOKEN ||
    process.env.NEXT_PUBLIC_APPLE_MAPKIT_TOKEN ||
    process.env.MAPKIT_TOKEN ||
    "";
  const token = sanitizeMapKitToken(rawToken);

  if (!token) {
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

function sanitizeMapKitToken(value: string) {
  return value
    .replace(/\\n/g, "")
    .replace(/[\r\n\t ]+/g, "")
    .replace(/^["']+|["']+$/g, "")
    .trim();
}
