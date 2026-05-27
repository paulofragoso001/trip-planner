import { expect, test } from "@playwright/test";

const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:3000";

test("imports page can connect a source and add an item to the review queue", async ({
  page,
  request
}) => {
  test.setTimeout(60_000);
  const dashboardHeaders = { "x-cypress-dashboard": "true" };
  const runId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const reviewQueueTitle = `e2e-${runId} United confirmation email`;
  const createdUnfiledItemIds: string[] = [];
  const createdSegmentIds: string[] = [];

  test.skip(
    !process.env.SUPABASE_SERVICE_ROLE_KEY,
    "imports write coverage requires SUPABASE_SERVICE_ROLE_KEY in a protected test environment"
  );

  const preflight = await request.get(`${baseUrl}/api/import-sources`, {
    headers: dashboardHeaders
  });

  test.skip(
    preflight.status() !== 200,
    "imports write coverage requires an authenticated session or SUPABASE_SERVICE_ROLE_KEY for the dashboard test header"
  );

  try {
    await request.patch(`${baseUrl}/api/import-sources`, {
      data: {
        connected: false,
        lastError: null,
        sourceLabel: "Outlook inbox sync",
        sourceType: "outlook"
      },
      headers: dashboardHeaders
    });

    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });

    await page.goto(`${baseUrl}/dashboard/imports?e2eRunId=${runId}`, { waitUntil: "commit" });
    const importsRoute = page.getByTestId("imports-route");
    await expect(importsRoute).toBeVisible();

    const connectSource = await request.patch(`${baseUrl}/api/import-sources`, {
      data: {
        connected: true,
        lastError: null,
        sourceLabel: "Outlook inbox sync",
        sourceType: "outlook"
      },
      headers: dashboardHeaders
    });
    expect(connectSource.status()).toBe(200);

    const createResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/unfiled-items") &&
        response.request().method() === "POST"
    );
    await importsRoute.getByRole("button", { name: "Add to review queue" }).first().click();
    const createResponse = await createResponsePromise;
    const createPayload = await createResponse.json();
    const createdId = createPayload?.data?.item?.id;

    if (typeof createdId === "string") {
      createdUnfiledItemIds.push(createdId);
    }

    await expect(
      importsRoute.getByText(`${reviewQueueTitle} added to review queue.`)
    ).toBeVisible();

    const trips = await request.get(`${baseUrl}/api/trips`, {
      headers: dashboardHeaders
    });
    expect(trips.status()).toBe(200);
    const tripsPayload = await trips.json();
    const targetTripId = tripsPayload?.trips?.[0]?.id;
    expect(typeof targetTripId).toBe("string");

    const promoteResponse = await request.post(
      `${baseUrl}/api/unfiled-items/${createdId}/promote`,
      {
        data: {
          tripId: targetTripId
        },
        headers: dashboardHeaders
      }
    );
    expect(promoteResponse.status()).toBe(201);
    const promotePayload = await promoteResponse.json();
    const promotedSegmentId = promotePayload?.data?.segment?.id;
    const promotedTripId = promotePayload?.data?.segment?.trip_id;

    expect(promotePayload).toMatchObject({
      data: {
        item: {
          id: createdId,
          parse_status: "promoted",
          promoted_trip_segment_id: expect.any(String)
        },
        segment: {
          id: expect.any(String),
          title: reviewQueueTitle
        }
      },
      error: null
    });

    if (typeof promotedSegmentId === "string") {
      createdSegmentIds.push(promotedSegmentId);
    }

    const sources = await request.get(`${baseUrl}/api/import-sources`, {
      headers: dashboardHeaders
    });
    expect(sources.status()).toBe(200);
    expect(await sources.json()).toMatchObject({
      data: {
        sources: expect.arrayContaining([
          expect.objectContaining({
            connected: true,
            source_type: "outlook"
          })
        ])
      },
      error: null
    });

    const unfiledItems = await request.get(`${baseUrl}/api/unfiled-items`, {
      headers: dashboardHeaders
    });
    expect(unfiledItems.status()).toBe(200);
    expect(await unfiledItems.json()).toMatchObject({
      data: {
        items: expect.arrayContaining([
          expect.objectContaining({
            parse_status: "promoted",
            promoted_trip_segment_id: promotedSegmentId,
            source_type: "email",
            title: reviewQueueTitle,
            trip_id: promotedTripId
          })
        ])
      },
      error: null
    });

    const tripSegments = await request.get(
      `${baseUrl}/api/trip-segments?tripId=${promotedTripId}`,
      {
        headers: dashboardHeaders
      }
    );
    expect(tripSegments.status()).toBe(200);
    expect(await tripSegments.json()).toMatchObject({
      data: {
        segments: expect.arrayContaining([
          expect.objectContaining({
            id: promotedSegmentId,
            title: reviewQueueTitle
          })
        ])
      },
      error: null
    });
  } finally {
    await Promise.all(
      createdSegmentIds.map((id) =>
        request.delete(`${baseUrl}/api/trip-segments/${id}`, {
          headers: dashboardHeaders
        })
      )
    );

    await Promise.all(
      createdUnfiledItemIds.map((id) =>
        request.delete(`${baseUrl}/api/unfiled-items/${id}`, {
          headers: dashboardHeaders
        })
      )
    );

    await request.patch(`${baseUrl}/api/import-sources`, {
      data: {
        connected: false,
        lastError: null,
        sourceLabel: "Outlook inbox sync",
        sourceType: "outlook"
      },
      headers: dashboardHeaders
    });
  }
});
