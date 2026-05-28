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
const socialWorkerSecret =
  process.env.SOCIAL_IMPORT_WORKER_SECRET ||
  process.env.CALENDAR_SYNC_WORKER_SECRET ||
  process.env.FLIGHT_REFRESH_CRON_SECRET ||
  readLocalEnv("SOCIAL_IMPORT_WORKER_SECRET") ||
  readLocalEnv("CALENDAR_SYNC_WORKER_SECRET") ||
  readLocalEnv("FLIGHT_REFRESH_CRON_SECRET");

test("social inspiration import promotes to timeline/map and generates a plan", async ({
  page,
  request
}) => {
  test.setTimeout(120_000);
  test.skip(
    !supabaseUrl || !serviceRoleKey,
    "social import loop requires Supabase URL and SUPABASE_SERVICE_ROLE_KEY in a protected environment"
  );
  test.skip(
    !socialWorkerSecret,
    "social import loop requires SOCIAL_IMPORT_WORKER_SECRET or compatible worker secret"
  );
  const admin = createClient(supabaseUrl!, serviceRoleKey!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  const runId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const tripName = `e2e-social-loop-${runId}`;
  const sourceTitle = `e2e-social-source-${runId}`;
  const importedPlaceName = "Park Güell";
  let importId = "";
  let promotedSegmentId = "";
  let tripId = "";

  const preflight = await request.get(`${baseUrl}/api/social-imports`, {
    headers: dashboardHeaders
  });

  test.skip(
    preflight.status() !== 200,
    "social import loop requires dashboard test auth to be enabled for the protected lane"
  );

  try {
    const tripResponse = await request.post(`${baseUrl}/api/trips`, {
      data: {
        destination: "Barcelona, Spain",
        end_date: "2026-06-13",
        name: tripName,
        start_date: "2026-06-11",
        status: "Planning"
      },
      headers: dashboardHeaders
    });
    expect(tripResponse.status()).toBe(201);
    const tripPayload = await tripResponse.json();
    tripId = tripPayload?.trip?.id;
    expect(typeof tripId).toBe("string");
    const testUserId = tripPayload?.trip?.user_id;
    expect(typeof testUserId).toBe("string");

    const importResponse = await request.post(`${baseUrl}/api/social-imports`, {
      data: {
        processNow: false,
        rawText:
          "Barcelona save: Visit Park Güell for Gaudí mosaics and city views. Add this sightseeing stop to the trip map.",
        sourcePlatform: "manual",
        sourceTitle,
        tripId
      },
      headers: dashboardHeaders
    });
    expect(importResponse.status()).toBe(201);
    const importPayload = await importResponse.json();
    expect(importPayload.error).toBeNull();
    importId = importPayload?.data?.socialImport?.id;
    expect(typeof importId).toBe("string");

    await processUntilReady(request, importId);

    const detailResponse = await request.get(`${baseUrl}/api/social-imports/${importId}`, {
      headers: dashboardHeaders
    });
    expect(detailResponse.status()).toBe(200);
    const detailPayload = await detailResponse.json();
    const extractedPlaces = detailPayload?.data?.extractedPlaces || [];
    expect(extractedPlaces.length).toBeGreaterThan(0);

    let place =
      extractedPlaces.find((candidate: any) =>
        String(candidate.name || "").toLowerCase().includes("park")
      ) || extractedPlaces[0];

    expect(place).toMatchObject({
      id: expect.any(String),
      status: "needs_review"
    });

    if (typeof place.latitude !== "number" || typeof place.longitude !== "number") {
      const { data, error } = await admin
        .from("extracted_places")
        .update({
          address: "Park Güell, 08024 Barcelona, Spain",
          latitude: 41.4145,
          longitude: 2.1527,
          place_id: `e2e-${runId}-park-guell`
        })
        .eq("id", place.id)
        .select("*")
        .single();

      expect(error).toBeNull();
      place = data;
    }

    expect(typeof place.latitude).toBe("number");
    expect(typeof place.longitude).toBe("number");

    const { data: duplicate, error: duplicateError } = await admin
      .from("extracted_places")
      .insert({
        category: place.category || "sightseeing",
        confidence: 0.7,
        dedupe_key: `e2e-duplicate-${runId}`,
        description: "Duplicate evidence from a second saved post.",
        evidence: ["Duplicate Park Güell evidence"],
        imported_post_id: importId,
        latitude: place.latitude,
        longitude: place.longitude,
        name: "Park Guell duplicate",
        normalized_name: `park-guell-duplicate-${runId}`,
        status: "needs_review",
        travel_note: "Duplicate note to merge into the target.",
        trip_id: tripId,
        user_id: testUserId
      })
      .select("*")
      .single();

    expect(duplicateError).toBeNull();
    const mergeResponse = await request.post(
      `${baseUrl}/api/extracted-places/${duplicate.id}/merge`,
      {
        data: { targetPlaceId: place.id },
        headers: dashboardHeaders
      }
    );
    expect(mergeResponse.status()).toBe(200);
    const mergePayload = await mergeResponse.json();
    expect(mergePayload?.data?.source).toMatchObject({
      duplicate_of: place.id,
      status: "merged"
    });
    expect(mergePayload?.data?.target?.evidence).toContain("Duplicate Park Güell evidence");

    await page.setExtraHTTPHeaders(dashboardHeaders);
    await page.goto(`${baseUrl}/dashboard/imports`, { waitUntil: "commit" });
    await expect(page.getByTestId("imports-route")).toBeVisible();
    await expect(page.getByText(place.name, { exact: true })).toBeVisible();

    const promoteResponse = await request.post(
      `${baseUrl}/api/social-imports/${importId}/promote`,
      {
        data: {
          placeIds: [place.id],
          tripId
        },
        headers: dashboardHeaders
      }
    );
    expect(promoteResponse.status()).toBe(201);
    const promotePayload = await promoteResponse.json();
    promotedSegmentId = promotePayload?.data?.results?.[0]?.segment?.id;
    expect(typeof promotedSegmentId).toBe("string");

    await page.goto(`${baseUrl}/dashboard/trips/${tripId}/timeline`, {
      waitUntil: "commit"
    });
    await expect(page.getByText(place.name, { exact: true })).toBeVisible();

    await page.goto(`${baseUrl}/dashboard/trips/${tripId}/map`, {
      waitUntil: "commit"
    });
    await expect(page.getByText(place.name, { exact: true })).toBeVisible();

    const generateResponse = await request.post(
      `${baseUrl}/api/trips/${tripId}/itinerary/generate`,
      {
        headers: dashboardHeaders
      }
    );
    expect(generateResponse.status()).toBe(200);
    await expect(await generateResponse.json()).toMatchObject({
      data: {
        itinerary: {
          assigned: expect.any(Number),
          routeSummary: expect.arrayContaining([
            expect.objectContaining({
              itemCount: expect.any(Number),
              orderedItemIds: expect.arrayContaining([promotedSegmentId])
            })
          ])
        }
      },
      error: null
    });
  } finally {
    if (serviceRoleKey && supabaseUrl) {
      await cleanupFixtures(admin, { importId, promotedSegmentId, sourceTitle, tripId, tripName });
    }
  }
});

test("Miami social inspiration extraction returns only real travel candidates", async ({
  request
}) => {
  test.setTimeout(90_000);
  test.skip(
    !supabaseUrl || !serviceRoleKey,
    "social import extraction quality requires Supabase URL and SUPABASE_SERVICE_ROLE_KEY"
  );

  const preflight = await request.get(`${baseUrl}/api/social-imports`, {
    headers: dashboardHeaders
  });

  test.skip(
    preflight.status() !== 200,
    "social import extraction quality requires dashboard test auth to be enabled"
  );

  const admin = createClient(supabaseUrl!, serviceRoleKey!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  const runId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const sourceTitle = `e2e-miami-extraction-${runId}`;
  let importId = "";

  try {
    const response = await request.post(`${baseUrl}/api/social-imports`, {
      data: {
        processNow: true,
        rawText:
          "Planning a Miami weekend trip. I want to visit Wynwood Walls, have dinner at Komodo, walk around Brickell City Centre, go to South Pointe Park, and maybe do a Biscayne Bay boat tour.",
        sourcePlatform: "manual",
        sourceTitle
      },
      headers: dashboardHeaders
    });
    expect(response.status()).toBe(201);
    const payload = await response.json();
    importId = payload?.data?.socialImport?.id;
    expect(typeof importId).toBe("string");

    const names = (payload?.data?.extractedPlaces || []).map((place: any) =>
      String(place.name || "")
    );
    const places = payload?.data?.extractedPlaces || [];
    const normalizedNames = names.map(normalizeNameForAssertion);

    for (const expected of [
      "Wynwood Walls",
      "Komodo",
      "Brickell City Centre",
      "South Pointe Park",
      "Biscayne Bay boat tour"
    ]) {
      expect(
        normalizedNames.some((name) => name.includes(normalizeNameForAssertion(expected)))
      ).toBeTruthy();
    }

    for (const blocked of [
      "Destination: Miami",
      "Travel style: balanced",
      "OpenAI",
      "Wayline",
      "AI trip planner",
      "Review candidates before promoting them into the itinerary"
    ]) {
      expect(normalizedNames).not.toContain(normalizeNameForAssertion(blocked));
    }

    for (const place of places) {
      expect(Number(place.confidence || 0)).toBeGreaterThanOrEqual(0.85);
    }
  } finally {
    if (importId) {
      await admin.from("extracted_places").delete().eq("imported_post_id", importId);
      await admin.from("imported_social_posts").delete().eq("id", importId);
    }
    await admin.from("imported_social_posts").delete().eq("source_title", sourceTitle);
  }
});

test("Barcelona production-style inspiration extracts clean mapped candidates", async ({
  request
}) => {
  test.setTimeout(90_000);
  test.skip(
    !supabaseUrl || !serviceRoleKey,
    "Barcelona extraction quality requires Supabase URL and SUPABASE_SERVICE_ROLE_KEY"
  );

  const preflight = await request.get(`${baseUrl}/api/social-imports`, {
    headers: dashboardHeaders
  });

  test.skip(
    preflight.status() !== 200,
    "Barcelona extraction quality requires dashboard test auth to be enabled"
  );

  const admin = createClient(supabaseUrl!, serviceRoleKey!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  const runId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const sourceTitle = `e2e-barcelona-extraction-${runId}`;
  let importId = "";

  try {
    const response = await request.post(`${baseUrl}/api/social-imports`, {
      data: {
        processNow: true,
        rawText:
          "Test production inspiration: coffee at Nomad Coffee in Barcelona, visit Sagrada Familia, see sunset from Park Guell, tapas at El Xampanyet",
        sourcePlatform: "manual",
        sourceTitle
      },
      headers: dashboardHeaders
    });
    expect(response.status()).toBe(201);
    const payload = await response.json();
    importId = payload?.data?.socialImport?.id;
    expect(typeof importId).toBe("string");

    const places = payload?.data?.extractedPlaces || [];
    const names = places.map((place: any) => String(place.name || ""));
    const normalizedNames = names.map(normalizeNameForAssertion);
    const combinedText = places
      .map((place: any) => `${place.name || ""} ${place.address || ""}`)
      .join(" ");

    for (const expected of [
      "Nomad Coffee",
      "Sagrada Familia",
      "Park Guell",
      "El Xampanyet"
    ]) {
      expect(
        normalizedNames.some((name) => name.includes(normalizeNameForAssertion(expected)))
      ).toBeTruthy();
    }

    for (const blocked of [
      "Test production inspiration",
      "coffee at Nomad Coffee in Barcelona, visit Sagrada Familia, see sunset from Park Guell, tapas at El Xampanyet",
      "1 N Fort Lauderdale Beach Blvd",
      "Fort Lauderdale"
    ]) {
      expect(combinedText.toLowerCase()).not.toContain(blocked.toLowerCase());
    }
  } finally {
    if (importId) {
      await admin.from("extracted_places").delete().eq("imported_post_id", importId);
      await admin.from("imported_social_posts").delete().eq("id", importId);
    }
    await admin.from("imported_social_posts").delete().eq("source_title", sourceTitle);
  }
});

async function processUntilReady(request: any, importId: string) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const workerResponse = await request.post(`${baseUrl}/api/jobs/social-import-worker`, {
      data: { limit: 10 },
      headers: {
        "x-social-import-worker-secret": socialWorkerSecret!
      }
    });
    expect(workerResponse.status()).toBe(200);

    const detailResponse = await request.get(`${baseUrl}/api/social-imports/${importId}`, {
      headers: dashboardHeaders
    });
    expect(detailResponse.status()).toBe(200);
    const detailPayload = await detailResponse.json();
    const status = detailPayload?.data?.socialImport?.status;
    const extractedPlaces = detailPayload?.data?.extractedPlaces || [];

    if ((status === "needs_review" || status === "processed") && extractedPlaces.length) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error("Social import worker did not produce extracted places.");
}

async function cleanupFixtures(
  admin: ReturnType<typeof createClient>,
  {
    importId,
    promotedSegmentId,
    sourceTitle,
    tripId,
    tripName
  }: {
    importId: string;
    promotedSegmentId: string;
    sourceTitle: string;
    tripId: string;
    tripName: string;
  }
) {
  if (promotedSegmentId) {
    await admin.from("trip_segments").delete().eq("id", promotedSegmentId);
  }

  if (importId) {
    await admin.from("extracted_places").delete().eq("imported_post_id", importId);
    await admin.from("imported_social_posts").delete().eq("id", importId);
  }

  if (sourceTitle) {
    const { data } = await admin
      .from("imported_social_posts")
      .select("id")
      .eq("source_title", sourceTitle);
    const ids = (data || []).map((row: { id: string }) => row.id);

    if (ids.length) {
      await admin.from("extracted_places").delete().in("imported_post_id", ids);
      await admin.from("imported_social_posts").delete().in("id", ids);
    }
  }

  if (tripId) {
    await admin.from("trips").delete().eq("id", tripId);
  }

  if (tripName) {
    await admin.from("trips").delete().eq("name", tripName);
  }
}

function readLocalEnv(name: string) {
  const envPath = join(process.cwd(), ".env.local");

  if (!existsSync(envPath)) {
    return "";
  }

  const line = readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .find((candidate) => candidate.startsWith(`${name}=`));

  if (!line) {
    return "";
  }

  return line.slice(name.length + 1).replace(/^["']|["']$/g, "").trim();
}

function normalizeNameForAssertion(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
