import { NextResponse } from "next/server";
import { validateEnv } from "@/lib/server/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFlightRefreshHealth } from "@/workers/monitor.worker";

export const dynamic = "force-dynamic";

export async function GET() {
  const timestamp = new Date().toISOString();
  const [envCheck, supabaseCheck, queueCheck] = await Promise.all([
    checkEnv(),
    checkSupabase(),
    checkFlightRefreshQueue()
  ]);
  const coreHealthy = envCheck.ok && supabaseCheck.ok;
  const status = coreHealthy ? 200 : 503;

  return NextResponse.json(
    {
      checks: {
        env: envCheck,
        flightRefreshQueue: queueCheck,
        supabase: supabaseCheck
      },
      service: "wayline",
      status: coreHealthy ? "healthy" : "unhealthy",
      timestamp
    },
    { status }
  );
}

async function checkEnv() {
  try {
    validateEnv();
    return { ok: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unknown env validation error.",
      ok: false
    };
  }
}

async function checkSupabase() {
  const admin = createAdminClient();

  if (!admin) {
    return {
      error: "SUPABASE_SERVICE_ROLE_KEY is not configured.",
      ok: false
    };
  }

  const { error } = await admin
    .from("trips")
    .select("id", { count: "exact", head: true });

  if (error) {
    return {
      error: error.message,
      ok: false
    };
  }

  return { ok: true };
}

async function checkFlightRefreshQueue() {
  try {
    const health = await getFlightRefreshHealth();
    return {
      ok: Boolean(health.healthy),
      queue: health
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unknown queue health error.",
      ok: false,
      optional: true
    };
  }
}
