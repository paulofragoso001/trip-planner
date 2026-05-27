import { NextResponse } from "next/server";
import { register } from "@/lib/prometheus";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const body = await register.metrics();
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": register.contentType,
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "failed to render metrics"
      },
      { status: 500 }
    );
  }
}
