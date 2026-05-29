import { expect, test } from "@playwright/test";

const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const dashboardHeaders = { "x-cypress-dashboard": "true" };

test("trip destination supports manual entry and resolved Google metadata", async ({
  page,
  request
}) => {
  const preflight = await request.get(`${baseUrl}/api/trips`, {
    headers: dashboardHeaders
  });

  test.skip(
    preflight.status() !== 200,
    "trip destination form requires dashboard test auth to be enabled"
  );

  const runId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const manualTripName = `e2e-manual-destination-${runId}`;
  const resolvedTripName = `e2e-resolved-destination-${runId}`;
  const createdTripIds: string[] = [];

  try {
    await page.setExtraHTTPHeaders(dashboardHeaders);
    await page.goto(`${baseUrl}/dashboard/trips#new-trip`);

    await expect(page.getByRole("heading", { name: "Trips database" })).toBeVisible();
    await page.getByPlaceholder("Trip name").fill(manualTripName);
    await page.getByLabel("Destination").fill("Miami");
    await page.getByRole("button", { name: "Save trip" }).click();
    await expect(page.getByText("Trip saved.")).toBeVisible();

    const manualTripsResponse = await request.get(`${baseUrl}/api/trips`, {
      headers: dashboardHeaders
    });
    expect(manualTripsResponse.status()).toBe(200);
    const manualTripsPayload = await manualTripsResponse.json();
    const manualTrip = manualTripsPayload.trips.find(
      (trip: any) => trip.name === manualTripName
    );
    expect(manualTrip).toMatchObject({
      destination: "Miami",
      destination_status: "manual"
    });
    createdTripIds.push(manualTrip.id);

    const resolvedResponse = await request.post(`${baseUrl}/api/trips`, {
      data: {
        destination: "Miami, FL, USA",
        destination_formatted_address: "Miami, FL, USA",
        destination_lat: 25.761681,
        destination_lng: -80.191788,
        destination_place_id: `e2e-google-place-${runId}`,
        destination_provider_metadata: {
          provider: "google_places",
          source: "playwright"
        },
        destination_status: "resolved",
        name: resolvedTripName,
        status: "Planning",
        travel_style: "balanced"
      },
      headers: dashboardHeaders
    });
    expect(resolvedResponse.status()).toBe(201);
    const resolvedPayload = await resolvedResponse.json();
    createdTripIds.push(resolvedPayload.trip.id);
    expect(resolvedPayload.trip).toMatchObject({
      destination: "Miami, FL, USA",
      destination_formatted_address: "Miami, FL, USA",
      destination_lat: 25.761681,
      destination_lng: -80.191788,
      destination_place_id: `e2e-google-place-${runId}`,
      destination_status: "resolved"
    });
  } finally {
    await Promise.all(
      createdTripIds.map((tripId) =>
        request.delete(`${baseUrl}/api/trips/${encodeURIComponent(tripId)}`, {
          headers: dashboardHeaders
        })
      )
    );
  }
});
