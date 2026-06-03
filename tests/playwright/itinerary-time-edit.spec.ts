import { expect, test } from "@playwright/test";

const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const dashboardHeaders = { "x-cypress-dashboard": "true" };

test("itinerary edit saves wall-clock times and keeps untimed places out of midnight", async ({
  page,
  request
}) => {
  test.setTimeout(180_000);
  const runId = Date.now();
  const createdTripIds: string[] = [];

  const tripResponse = await request.post(`${baseUrl}/api/trips`, {
    data: {
      destination: "Miami, FL",
      name: `Itinerary time test ${runId}`,
      status: "Planning",
      travel_style: "balanced"
    },
    headers: dashboardHeaders
  });
  expect(tripResponse.status()).toBe(201);
  const tripPayload = await tripResponse.json();
  const tripId = tripPayload?.trip?.id;
  expect(typeof tripId).toBe("string");
  createdTripIds.push(tripId);

  try {
    const createSegment = async (data: Record<string, unknown>) => {
      const response = await request.post(`${baseUrl}/api/trip-segments`, {
        data: {
          kind: "activity",
          location: "Miami, FL",
          tripId,
          ...data
        },
        headers: dashboardHeaders
      });
      expect(response.status()).toBe(201);
      const payload = await response.json();
      return payload.segment || payload.data?.segment;
    };

    const editable = await createSegment({
      startDate: "2026-06-14",
      title: "Komodo time edit"
    });
    await createSegment({
      startClockTime: "09:00",
      startDate: "2026-06-14",
      title: "Morning museum"
    });
    await createSegment({
      startClockTime: "12:00",
      startDate: "2026-06-14",
      title: "Lunch stop"
    });
    await createSegment({
      startClockTime: "00:00",
      startDate: "2026-06-15",
      title: "Midnight arrival"
    });

    await page.setExtraHTTPHeaders(dashboardHeaders);
    await page.goto(`${baseUrl}/dashboard/trips/${tripId}/timeline`, {
      waitUntil: "commit"
    });
    await page.waitForLoadState("domcontentloaded");

    const content = page.getByTestId("app-shell-content");
    const editableCard = content.locator("article").filter({
      has: page.getByRole("heading", { name: "Komodo time edit" })
    });
    await expect(editableCard.getByText("Anytime").first()).toBeVisible();
    await expect(editableCard.getByText("12:00 AM")).toHaveCount(0);

    const updateResponse = await request.patch(
      `${baseUrl}/api/trip-segments/${editable.id}`,
      {
        data: {
          startClockTime: "14:30",
          startDate: "2026-06-14",
          title: "Komodo time edit"
        },
        headers: dashboardHeaders
      }
    );
    expect(updateResponse.status()).toBe(200);
    await page.reload({ waitUntil: "commit" });
    await expect(editableCard.getByText("2:30 PM").first()).toBeVisible({
      timeout: 20_000
    });

    const segmentResponse = await request.get(`${baseUrl}/api/trip-segments?tripId=${tripId}`, {
      headers: dashboardHeaders
    });
    expect(segmentResponse.status()).toBe(200);
    const segmentPayload = await segmentResponse.json();
    const segments = segmentPayload.segments || segmentPayload.data?.segments || [];
    const updated = segments.find((segment: any) => segment.id === editable.id);
    expect(new Date(updated.start_time).toISOString()).toBe("2026-06-14T14:30:00.000Z");
    expect(updated.provider_metadata?.schedule).toMatchObject({
      hasStartTime: true,
      startDate: "2026-06-14",
      startTime: "14:30"
    });

    const midnightCard = content.locator("article").filter({
      has: page.getByRole("heading", { name: "Midnight arrival" })
    });
    await expect(midnightCard.getByText("12:00 AM").first()).toBeVisible();

    const headingOrder = await content.locator("article h4").evaluateAll((headings) =>
      headings.map((heading) => heading.textContent?.trim())
    );
    expect(headingOrder.indexOf("Morning museum")).toBeLessThan(
      headingOrder.indexOf("Lunch stop")
    );
    expect(headingOrder.indexOf("Lunch stop")).toBeLessThan(
      headingOrder.indexOf("Komodo time edit")
    );

    const morningCard = content.locator("article").filter({
      has: page.getByRole("heading", { name: "Morning museum" })
    });
    await expect(morningCard.getByRole("button", { name: /Edit Morning museum/ })).toBeEnabled();
    await morningCard.getByRole("button", { name: /Edit Morning museum/ }).click();
    await expect(morningCard.getByLabel("Start time")).toBeVisible();
    await morningCard.getByLabel("Start time").fill("15:45");
    await morningCard.getByRole("button", { name: "Save changes" }).click();
    await expect(morningCard.getByText("3:45 PM").first()).toBeVisible({ timeout: 20_000 });
    await expect(morningCard.getByLabel("Start time")).toHaveCount(0);

    const noDateTripResponse = await request.post(`${baseUrl}/api/trips`, {
      data: {
        destination: "Miami, FL",
        name: `No date itinerary ${runId}`,
        status: "Planning",
        travel_style: "balanced"
      },
      headers: dashboardHeaders
    });
    expect(noDateTripResponse.status()).toBe(201);
    const noDateTripPayload = await noDateTripResponse.json();
    const noDateTripId = noDateTripPayload?.trip?.id;
    expect(typeof noDateTripId).toBe("string");
    createdTripIds.push(noDateTripId);

    const noDateSegmentResponse = await request.post(`${baseUrl}/api/trip-segments`, {
      data: {
        kind: "activity",
        location: "Miami, FL",
        title: "Unscheduled idea",
        tripId: noDateTripId
      },
      headers: dashboardHeaders
    });
    expect(noDateSegmentResponse.status()).toBe(201);

    await page.goto(`${baseUrl}/dashboard/trips/${noDateTripId}/timeline`, {
      waitUntil: "commit"
    });
    await expect(page.getByRole("heading", { name: "Unscheduled idea" })).toBeVisible();
    await expect(page.getByTestId("itinerary-date-strip")).toHaveCount(0);
  } finally {
    await Promise.all(
      createdTripIds.map((id) =>
        request.delete(`${baseUrl}/api/trips/${encodeURIComponent(id)}`, {
          headers: dashboardHeaders
        })
      )
    );
  }
});
