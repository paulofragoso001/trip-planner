import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const dashboardHeaders = { "x-cypress-dashboard": "true" };
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || readLocalEnv("NEXT_PUBLIC_SUPABASE_URL");
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || readLocalEnv("SUPABASE_SERVICE_ROLE_KEY");

test("map and suggestions degrade safely for unresolved and activity stops", async ({ page, request }) => {
  test.setTimeout(120_000);
  test.skip(
    !supabaseUrl || !serviceRoleKey,
    "map reliability requires Supabase URL and SUPABASE_SERVICE_ROLE_KEY"
  );

  const preflight = await request.get(`${baseUrl}/api/social-imports`, {
    headers: dashboardHeaders
  });
  test.skip(preflight.status() !== 200, "dashboard test auth must be enabled");

  const admin = createClient(supabaseUrl!, serviceRoleKey!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  const runId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  let tripId = "";
  let physicalSegmentId = "";
  let activitySegmentId = "";
  let manualSegmentId = "";

  try {
    const tripResponse = await request.post(`${baseUrl}/api/trips`, {
      data: {
        destination: "Miami",
        name: `e2e-map-reliability-${runId}`,
        status: "Planning"
      },
      headers: dashboardHeaders
    });
    expect(tripResponse.status()).toBe(201);
    const tripPayload = await tripResponse.json();
    tripId = tripPayload?.trip?.id;
    const userId = tripPayload?.trip?.user_id;
    expect(typeof tripId).toBe("string");
    expect(typeof userId).toBe("string");

    const { data: physicalSegment, error: physicalError } = await admin
      .from("trip_segments")
      .insert({
        kind: "activity",
        location_status: "needs_location_confirmation",
        title: "Wynwood Walls",
        trip_id: tripId,
        user_id: userId
      })
      .select("id")
      .single();
    expect(physicalError).toBeNull();
    physicalSegmentId = physicalSegment?.id || "";

    const { data: activitySegment, error: activityError } = await admin
      .from("trip_segments")
      .insert({
        kind: "activity",
        location: "Miami",
        location_status: "needs_location_confirmation",
        provider_metadata: { activityCandidate: true },
        title: "Biscayne Bay boat tour",
        trip_id: tripId,
        user_id: userId
      })
      .select("id")
      .single();
    expect(activityError).toBeNull();
    activitySegmentId = activitySegment?.id || "";

    const suggestionsResponse = await request.post(
      `${baseUrl}/api/trips/${tripId}/generate-suggestions`,
      { headers: dashboardHeaders }
    );
    expect(suggestionsResponse.status()).toBe(200);
    const suggestionsPayload = await suggestionsResponse.json();
    expect(suggestionsPayload?.data?.skippedReason).toBe("no_mapped_segments");

    await page.setViewportSize({ height: 900, width: 390 });
    await page.setExtraHTTPHeaders(dashboardHeaders);
    await page.goto(`${baseUrl}/dashboard/trips/${tripId}/map`, { waitUntil: "commit" });
    const emptyState = page.getByTestId("compact-route-empty-state");
    await expect(emptyState).toBeVisible({ timeout: 30_000 });
    await expect(emptyState.getByRole("heading", { name: "No route places yet" })).toBeVisible();
    await expect(emptyState.getByText(/need confirmed locations|unscheduled activities/i).first()).toBeVisible();
    await expect(emptyState.getByRole("link", { name: "Open Ideas" })).toHaveAttribute(
      "href",
      `/dashboard/trips/${tripId}/ideas`
    );
    await expect(emptyState.getByRole("link", { name: "Add trip item" })).toBeVisible();
    await expect(page.getByText("Your route places appear here.")).toHaveCount(0);
    await expect(page.getByText("Nearby Ideas", { exact: true })).toHaveCount(0);
    const emptyStateBox = await emptyState.boundingBox();
    expect(emptyStateBox?.height || 0).toBeLessThan(260);

    const activityRetry = await request.post(
      `${baseUrl}/api/trip-segments/${activitySegmentId}/retry-location`,
      { headers: dashboardHeaders }
    );
    expect(activityRetry.status()).toBe(200);
    const activityRetryPayload = await activityRetry.json();
    expect(activityRetryPayload?.data?.status).toBe("needs_activity_provider");

    const physicalRetry = await request.post(
      `${baseUrl}/api/trip-segments/${physicalSegmentId}/retry-location`,
      { headers: dashboardHeaders }
    );
    expect(physicalRetry.status()).toBe(200);
    const physicalRetryPayload = await physicalRetry.json();
    expect([
      "resolved",
      "needs_location_confirmation",
      "wrong_city_rejected",
      "provider_failed"
    ]).toContain(physicalRetryPayload?.data?.status);

    const manualResponse = await request.post(`${baseUrl}/api/trip-segments`, {
      data: {
        kind: "activity",
        lat: 25.801,
        lng: -80.199,
        location: "Wynwood Walls, Miami, FL",
        title: "Manual Wynwood stop",
        tripId
      },
      headers: dashboardHeaders
    });
    expect(manualResponse.status()).toBe(201);
    const manualPayload = await manualResponse.json();
    manualSegmentId = manualPayload?.data?.segment?.id || manualPayload?.segment?.id || "";
    expect(manualPayload?.data?.segment || manualPayload?.segment).toMatchObject({
      location_status: "resolved"
    });
  } finally {
    const ids = [physicalSegmentId, activitySegmentId, manualSegmentId].filter(Boolean);
    if (ids.length) await admin.from("trip_segments").delete().in("id", ids);
    if (tripId) await admin.from("trips").delete().eq("id", tripId);
  }
});

function readLocalEnv(name: string) {
  const envPath = join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return "";
  const line = readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .find((candidate) => candidate.startsWith(`${name}=`));
  return line ? line.slice(name.length + 1).replace(/^["']|["']$/g, "").trim() : "";
}
