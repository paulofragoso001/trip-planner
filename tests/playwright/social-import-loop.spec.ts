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
const googlePlaceResolutionKey =
  process.env.GOOGLE_PLACES_API_KEY ||
  process.env.GOOGLE_MAPS_API_KEY ||
  readLocalEnv("GOOGLE_PLACES_API_KEY") ||
  readLocalEnv("GOOGLE_MAPS_API_KEY");

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
      id: expect.any(String)
    });
    expect(["needs_review", "needs_location_confirmation"]).toContain(place.status);

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

    const boatTour = places.find((place: any) =>
      normalizeNameForAssertion(String(place.name || "")).includes("biscayne bay boat tour")
    );
    expect(boatTour).toBeTruthy();
    expect(["activity", "tour"]).toContain(String(boatTour?.category || ""));
    expect(
      places
        .map((place: any) => `${place.name || ""} ${place.address || ""}`)
        .join(" ")
        .toLowerCase()
    ).not.toContain("fort lauderdale");
  } finally {
    if (importId) {
      await admin.from("extracted_places").delete().eq("imported_post_id", importId);
      await admin.from("imported_social_posts").delete().eq("id", importId);
    }
    await admin.from("imported_social_posts").delete().eq("source_title", sourceTitle);
  }
});

test("Google place resolution maps physical Miami stops with destination context", async ({
  request
}) => {
  test.setTimeout(60_000);
  test.skip(
    !googlePlaceResolutionKey,
    "Google place resolution requires GOOGLE_PLACES_API_KEY or GOOGLE_MAPS_API_KEY"
  );

  const preflight = await request.get(`${baseUrl}/api/social-imports`, {
    headers: dashboardHeaders
  });

  test.skip(
    preflight.status() !== 200,
    "place resolution regression requires dashboard test auth to be enabled"
  );

  for (const name of [
    "Wynwood Walls",
    "Komodo",
    "Brickell City Centre",
    "South Pointe Park"
  ]) {
    const response = await request.post(`${baseUrl}/api/travel-data/resolve-place`, {
      data: {
        city: "Miami",
        country: "United States",
        locationHint: "Miami, FL",
        name
      },
      headers: dashboardHeaders
    });
    expect(response.status()).toBe(200);
    const payload = await response.json();
    const resolved = payload?.data?.resolved;
    expect(resolved?.provider).toBe("google_places");
    expect(typeof resolved?.latitude).toBe("number");
    expect(typeof resolved?.longitude).toBe("number");
    const address = String(resolved?.address || "").toLowerCase();
    expect(address).not.toContain("fort lauderdale");
    if (name === "Wynwood Walls") {
      expect([address, String(resolved?.inventoryItem?.title || "").toLowerCase()].join(" ")).toMatch(
        /wynwood|miami|florida|fl\b/
      );
    }
  }
});

test("destination mismatch blocks accidental approval into the wrong trip", async ({
  request
}) => {
  test.setTimeout(90_000);
  test.skip(
    !supabaseUrl || !serviceRoleKey,
    "destination mismatch regression requires Supabase URL and SUPABASE_SERVICE_ROLE_KEY"
  );

  const preflight = await request.get(`${baseUrl}/api/social-imports`, {
    headers: dashboardHeaders
  });

  test.skip(
    preflight.status() !== 200,
    "destination mismatch regression requires dashboard test auth to be enabled"
  );

  const admin = createClient(supabaseUrl!, serviceRoleKey!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  const runId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const sourceTitle = `e2e-miami-mismatch-${runId}`;
  const barcelonaTripName = `e2e-barcelona-mismatch-${runId}`;
  let importId = "";
  let barcelonaTripId = "";

  try {
    const tripResponse = await request.post(`${baseUrl}/api/trips`, {
      data: {
        destination: "Barcelona, Spain",
        name: barcelonaTripName,
        status: "Planning"
      },
      headers: dashboardHeaders
    });
    expect(tripResponse.status()).toBe(201);
    const tripPayload = await tripResponse.json();
    barcelonaTripId = tripPayload?.trip?.id;
    expect(typeof barcelonaTripId).toBe("string");

    const response = await request.post(`${baseUrl}/api/social-imports`, {
      data: {
        processNow: true,
        rawText:
          "Planning a Miami weekend trip. I want to visit Wynwood Walls and maybe do a Biscayne Bay boat tour.",
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
    const miamiPlace = places.find((place: any) => String(place.city || place.address || "").toLowerCase().includes("miami")) || places[0];
    expect(miamiPlace?.id).toEqual(expect.any(String));

    const approvalResponse = await request.patch(
      `${baseUrl}/api/extracted-places/${miamiPlace.id}`,
      {
        data: {
          status: "accepted",
          tripId: barcelonaTripId
        },
        headers: dashboardHeaders
      }
    );
    expect(approvalResponse.status()).toBe(400);
    const approvalPayload = await approvalResponse.json();
    expect(approvalPayload?.error?.details?.reason).toBe("destination_mismatch");
  } finally {
    if (importId) {
      await admin.from("extracted_places").delete().eq("imported_post_id", importId);
      await admin.from("imported_social_posts").delete().eq("id", importId);
    }
    if (barcelonaTripId) {
      await admin.from("trips").delete().eq("id", barcelonaTripId);
    }
    await admin.from("imported_social_posts").delete().eq("source_title", sourceTitle);
    await admin.from("trips").delete().eq("name", barcelonaTripName);
  }
});

test("AI review requires a real trip destination before approval", async ({
  page,
  request
}) => {
  test.setTimeout(90_000);
  test.skip(
    !supabaseUrl || !serviceRoleKey,
    "destination control regression requires Supabase URL and SUPABASE_SERVICE_ROLE_KEY"
  );

  const preflight = await request.get(`${baseUrl}/api/social-imports`, {
    headers: dashboardHeaders
  });

  test.skip(
    preflight.status() !== 200,
    "destination control regression requires dashboard test auth to be enabled"
  );

  const admin = createClient(supabaseUrl!, serviceRoleKey!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  const runId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const seedTripName = `e2e-seed-trip-${runId}`;
  const placeholderTripName = `Barcelona work trip ${runId}`;
  const sourceTitle = `e2e-destination-controls-${runId}`;
  let seedTripId = "";
  let placeholderTripId = "";
  let miamiTripId = "";
  let activitySegmentId = "";
  let importId = "";
  let placeId = "";

  try {
    const seedTripResponse = await request.post(`${baseUrl}/api/trips`, {
      data: {
        destination: "Seed City",
        name: seedTripName,
        status: "Planning"
      },
      headers: dashboardHeaders
    });
    expect(seedTripResponse.status()).toBe(201);
    const seedTripPayload = await seedTripResponse.json();
    seedTripId = seedTripPayload?.trip?.id;
    const userId = seedTripPayload?.trip?.user_id;
    expect(typeof seedTripId).toBe("string");
    expect(typeof userId).toBe("string");

    const { data: placeholderTrip, error: tripError } = await admin
      .from("trips")
      .insert({
        budget: 0,
        destination: "Destination not set",
        name: placeholderTripName,
        slug: `e2e-placeholder-${runId}`,
        status: "Planning",
        title: placeholderTripName,
        travel_style: "balanced",
        user_id: userId
      })
      .select("id")
      .single();
    expect(tripError).toBeNull();
    placeholderTripId = placeholderTrip?.id;
    expect(typeof placeholderTripId).toBe("string");

    const { data: post, error: postError } = await admin
      .from("imported_social_posts")
      .insert({
        raw_text: "Planning a Miami weekend trip. Maybe do a Biscayne Bay boat tour.",
        source_platform: "manual",
        source_title: sourceTitle,
        status: "needs_review",
        user_id: userId
      })
      .select("id")
      .single();
    expect(postError).toBeNull();
    importId = post?.id;
    expect(typeof importId).toBe("string");

    const { data: place, error: placeError } = await admin
      .from("extracted_places")
      .insert({
        ai_payload: {
          locationHint: "Miami",
          reviewReason: "needs_location",
          summary: "Biscayne Bay boat tour activity idea"
        },
        category: "tour",
        city: "Miami",
        confidence: 0.91,
        evidence: ["maybe do a Biscayne Bay boat tour"],
        imported_post_id: importId,
        name: "Biscayne Bay boat tour",
        normalized_name: "biscayne-bay-boat-tour",
        status: "needs_location_confirmation",
        travel_note: "Activity idea that needs a provider or meeting point.",
        user_id: userId
      })
      .select("id")
      .single();
    expect(placeError).toBeNull();
    placeId = place?.id;
    expect(typeof placeId).toBe("string");

    const blockedApproval = await request.patch(
      `${baseUrl}/api/extracted-places/${placeId}`,
      {
        data: {
          confirmDestinationMismatch: true,
          status: "accepted",
          tripId: placeholderTripId
        },
        headers: dashboardHeaders
      }
    );
    expect(blockedApproval.status()).toBe(400);
    const blockedPayload = await blockedApproval.json();
    expect(blockedPayload?.error?.details?.reason).toBe("destination_required");

    await page.setExtraHTTPHeaders(dashboardHeaders);
    await page.goto(`${baseUrl}/dashboard/imports`);

    const card = page.getByTestId(`ai-review-card-${placeId}`);
    await expect(card.getByText("Wayline found this as an activity idea.")).toBeVisible();
    await page.locator(`#trip-${placeId}`).selectOption(placeholderTripId);
    await expect(
      card.getByText("This trip does not have a destination yet. Set a destination before approving AI candidates.")
    ).toBeVisible();
    await expect(card.getByRole("button", { name: "Approve to draft" })).toBeDisabled();
    await expect(card.getByRole("button", { name: /Set destination to Barcelona/ })).toBeVisible();

    const miamiTripResponse = await request.post(`${baseUrl}/api/trips`, {
      data: {
        destination: "Miami",
        name: `e2e-miami-activity-${runId}`,
        status: "Planning"
      },
      headers: dashboardHeaders
    });
    expect(miamiTripResponse.status()).toBe(201);
    const miamiTripPayload = await miamiTripResponse.json();
    miamiTripId = miamiTripPayload?.trip?.id;
    expect(typeof miamiTripId).toBe("string");

    const validApproval = await request.patch(
      `${baseUrl}/api/extracted-places/${placeId}`,
      {
        data: {
          status: "accepted",
          tripId: miamiTripId
        },
        headers: dashboardHeaders
      }
    );
    expect(validApproval.status()).toBe(200);

    const promoteResponse = await request.post(
      `${baseUrl}/api/extracted-places/${placeId}/promote`,
      {
        data: { tripId: miamiTripId },
        headers: dashboardHeaders
      }
    );
    expect(promoteResponse.status()).toBe(201);
    const promotePayload = await promoteResponse.json();
    const segment = promotePayload?.data?.segment;
    activitySegmentId = segment?.id || "";
    expect(segment).toMatchObject({
      kind: "activity",
      lat: null,
      lng: null,
      location: "Miami",
      title: "Biscayne Bay boat tour"
    });
    expect(["needs_activity_provider", "needs_location_confirmation"]).toContain(
      segment.location_status
    );
  } finally {
    if (activitySegmentId) {
      await admin.from("trip_segments").delete().eq("id", activitySegmentId);
    }
    if (importId) {
      await admin.from("extracted_places").delete().eq("imported_post_id", importId);
      await admin.from("imported_social_posts").delete().eq("id", importId);
    }
    if (placeholderTripId) {
      await admin.from("trips").delete().eq("id", placeholderTripId);
    }
    if (miamiTripId) {
      await admin.from("trips").delete().eq("id", miamiTripId);
    }
    if (seedTripId) {
      await admin.from("trips").delete().eq("id", seedTripId);
    }
    await admin.from("trips").delete().eq("name", placeholderTripName);
    await admin.from("trips").delete().eq("name", seedTripName);
    await admin.from("trips").delete().eq("name", `e2e-miami-activity-${runId}`);
  }
});

test("AI review can create and select a destination-matched trip draft", async ({
  page,
  request
}) => {
  test.setTimeout(90_000);
  test.skip(
    !supabaseUrl || !serviceRoleKey,
    "trip draft creation regression requires Supabase URL and SUPABASE_SERVICE_ROLE_KEY"
  );

  const preflight = await request.get(`${baseUrl}/api/social-imports`, {
    headers: dashboardHeaders
  });

  test.skip(
    preflight.status() !== 200,
    "trip draft creation regression requires dashboard test auth to be enabled"
  );

  const admin = createClient(supabaseUrl!, serviceRoleKey!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  const runId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const seedTripName = `e2e-seed-draft-${runId}`;
  const sourceTitle = `e2e-create-miami-draft-${runId}`;
  let seedTripId = "";
  let importId = "";
  let placeId = "";
  let createdTripId = "";

  try {
    const seedTripResponse = await request.post(`${baseUrl}/api/trips`, {
      data: {
        destination: "Seed City",
        name: seedTripName,
        status: "Planning"
      },
      headers: dashboardHeaders
    });
    expect(seedTripResponse.status()).toBe(201);
    const seedTripPayload = await seedTripResponse.json();
    seedTripId = seedTripPayload?.trip?.id;
    const userId = seedTripPayload?.trip?.user_id;
    expect(typeof seedTripId).toBe("string");
    expect(typeof userId).toBe("string");

    const { data: post, error: postError } = await admin
      .from("imported_social_posts")
      .insert({
        raw_text: "Planning a Miami weekend trip. Visit Wynwood Walls.",
        source_platform: "manual",
        source_title: sourceTitle,
        status: "needs_review",
        user_id: userId
      })
      .select("id")
      .single();
    expect(postError).toBeNull();
    importId = post?.id;

    const { data: place, error: placeError } = await admin
      .from("extracted_places")
      .insert({
        ai_payload: {
          locationHint: "Miami",
          summary: "Wynwood Walls from Miami saved inspiration."
        },
        category: "attraction",
        city: "Miami",
        confidence: 0.94,
        evidence: ["Visit Wynwood Walls"],
        imported_post_id: importId,
        name: "Wynwood Walls",
        normalized_name: "wynwood-walls",
        status: "needs_review",
        travel_note: "Street art attraction in Miami.",
        user_id: userId
      })
      .select("id")
      .single();
    expect(placeError).toBeNull();
    placeId = place?.id;
    expect(typeof placeId).toBe("string");

    await page.setExtraHTTPHeaders(dashboardHeaders);
    await page.goto(`${baseUrl}/dashboard/imports`);

    const card = page.getByTestId(`ai-review-card-${placeId}`);
    const createDraftButton = card.getByRole("button", { name: "Create new Miami trip draft" });
    let createdNewDraft = false;
    if (await createDraftButton.isVisible()) {
      await createDraftButton.click();
      createdNewDraft = true;
      await expect(card.getByText(/Miami trip is ready for approval/)).toBeVisible();
    }
    await expect(card.getByRole("button", { name: "Approve to draft" })).toBeEnabled();

    const { data: trips } = await admin
      .from("trips")
      .select("id,destination,name,travel_style")
      .eq("user_id", userId)
      .eq("destination", "Miami")
      .order("created_at", { ascending: false })
      .limit(1);
    createdTripId = trips?.[0]?.id || "";
    expect(createdTripId).toEqual(expect.any(String));
    if (createdNewDraft) {
      expect(trips?.[0]?.name).toBe("Miami trip");
    }
    expect(trips?.[0]?.travel_style || "balanced").toBe("balanced");
  } finally {
    if (importId) {
      await admin.from("extracted_places").delete().eq("imported_post_id", importId);
      await admin.from("imported_social_posts").delete().eq("id", importId);
    }
    if (createdTripId) {
      await admin.from("trips").delete().eq("id", createdTripId);
    }
    if (seedTripId) {
      await admin.from("trips").delete().eq("id", seedTripId);
    }
    await admin.from("trips").delete().eq("name", seedTripName);
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
