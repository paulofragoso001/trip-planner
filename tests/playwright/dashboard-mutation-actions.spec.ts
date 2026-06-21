import { expect, test, type APIRequestContext } from "@playwright/test";

const baseUrl = "http://127.0.0.1:3000";
const dashboardHeaders = {
  "sec-fetch-site": "same-origin",
  "x-cypress-dashboard": "true"
};

test.describe("dashboard authenticated mutation actions", () => {
  test("trip APIs reject unauthorized and non-owned IDs while allowing a valid owned lifecycle", async ({ request }) => {
    const runId = Date.now().toString(36);
    const createPayload = {
      budget: 0,
      destination: "Miami, FL",
      destination_lat: 25.7617,
      destination_lng: -80.1918,
      destination_status: "resolved",
      end_date: "2026-07-05",
      name: `Action Test ${runId}`,
      start_date: "2026-07-01",
      status: "Planning",
      travel_style: "balanced"
    };
    let tripId: string | null = null;

    const unauthorizedList = await request.get(`${baseUrl}/api/trips`);
    expect(unauthorizedList.status()).toBe(401);

    const unauthorizedCreate = await request.post(`${baseUrl}/api/trips`, {
      data: createPayload,
      headers: { "sec-fetch-site": "same-origin" }
    });
    expect(unauthorizedCreate.status()).toBe(401);

    const crossSiteCreate = await request.post(`${baseUrl}/api/trips`, {
      data: createPayload,
      headers: {
        origin: "https://evil.example"
      }
    });
    expect(crossSiteCreate.status()).toBe(403);

    const nonOwnedId = "00000000-0000-4000-8000-000000000001";
    const nonOwnedGet = await request.get(`${baseUrl}/api/trips/${nonOwnedId}`, {
      headers: dashboardHeaders
    });
    expect(nonOwnedGet.status()).toBe(404);

    const nonOwnedPatch = await request.patch(`${baseUrl}/api/trips/${nonOwnedId}`, {
      data: { ...createPayload, name: `Wrong Owner ${runId}` },
      headers: dashboardHeaders
    });
    expect(nonOwnedPatch.status()).toBe(404);

    try {
      const created = await request.post(`${baseUrl}/api/trips`, {
        data: createPayload,
        headers: dashboardHeaders
      });
      expect(created.status()).toBe(201);
      const createdBody = await created.json();
      tripId = readTripId(createdBody);
      expect(tripId).toBeTruthy();

      const fetched = await request.get(`${baseUrl}/api/trips/${tripId}`, {
        headers: dashboardHeaders
      });
      expect(fetched.status()).toBe(200);

      const patched = await request.patch(`${baseUrl}/api/trips/${tripId}`, {
        data: { ...createPayload, name: `Action Test Updated ${runId}` },
        headers: dashboardHeaders
      });
      expect(patched.status()).toBe(200);
      await expectTripName(patched, `Action Test Updated ${runId}`);

      const deleted = await request.delete(`${baseUrl}/api/trips/${tripId}`, {
        headers: dashboardHeaders
      });
      expect(deleted.status()).toBe(200);
      tripId = null;
    } finally {
      if (tripId) {
        await request.delete(`${baseUrl}/api/trips/${tripId}`, {
          headers: dashboardHeaders
        });
      }
    }
  });

  test("import source and review queue mutations enforce session boundary and schema", async ({ request }) => {
    const runId = Date.now().toString(36);
    const createdUnfiledItemIds: string[] = [];
    const createdSegmentIds: string[] = [];
    let tripId: string | null = null;

    const createPayload = {
      budget: 0,
      destination: "Miami, FL",
      destination_lat: 25.7617,
      destination_lng: -80.1918,
      destination_status: "resolved",
      end_date: "2026-08-05",
      name: `Mutation Import Test ${runId}`,
      start_date: "2026-08-01",
      status: "Planning",
      travel_style: "balanced"
    };

    const crossSiteSource = await request.patch(`${baseUrl}/api/import-sources`, {
      data: {
        connected: true,
        sourceType: "outlook"
      },
      headers: {
        origin: "https://evil.example"
      }
    });
    expect(crossSiteSource.status()).toBe(403);

    const unknownSourceField = await request.patch(`${baseUrl}/api/import-sources`, {
      data: {
        connected: true,
        sourceType: "outlook",
        unexpected: "drift"
      },
      headers: dashboardHeaders
    });
    expect(unknownSourceField.status()).toBe(400);
    expect(await unknownSourceField.json()).toMatchObject({
      error: expect.objectContaining({
        details: expect.objectContaining({
          body: expect.stringContaining("Unknown field")
        })
      })
    });

    const crossSiteUnfiled = await request.post(`${baseUrl}/api/unfiled-items`, {
      data: {
        rawText: "AA123 Miami to San Juan",
        sourceType: "email",
        title: `Blocked ${runId}`
      },
      headers: {
        origin: "https://evil.example"
      }
    });
    expect(crossSiteUnfiled.status()).toBe(403);

    const unknownUnfiledField = await request.post(`${baseUrl}/api/unfiled-items`, {
      data: {
        rawText: "AA123 Miami to San Juan",
        sourceType: "email",
        title: `Unknown field ${runId}`,
        userId: "attacker-controlled"
      },
      headers: dashboardHeaders
    });
    expect(unknownUnfiledField.status()).toBe(400);
    expect(await unknownUnfiledField.json()).toMatchObject({
      error: expect.objectContaining({
        details: expect.objectContaining({
          body: expect.stringContaining("Unknown field")
        })
      })
    });

    try {
      const createdTrip = await request.post(`${baseUrl}/api/trips`, {
        data: createPayload,
        headers: dashboardHeaders
      });
      expect(createdTrip.status()).toBe(201);
      tripId = readTripId(await createdTrip.json());
      expect(tripId).toBeTruthy();

      const sourceConnected = await request.patch(`${baseUrl}/api/import-sources`, {
        data: {
          connected: true,
          lastError: null,
          sourceLabel: "Outlook inbox sync",
          sourceType: "outlook"
        },
        headers: dashboardHeaders
      });
      expect(sourceConnected.status()).toBe(200);

      const createdUnfiled = await request.post(`${baseUrl}/api/unfiled-items`, {
        data: {
          rawText: "Dinner reservation at 7 PM in Miami.",
          sourceLabel: "Dashboard mutation test",
          sourceType: "manual",
          title: `Review queue item ${runId}`,
          tripId
        },
        headers: dashboardHeaders
      });
      expect(createdUnfiled.status()).toBe(201);
      const unfiledBody = await createdUnfiled.json();
      const unfiledId = unfiledBody?.data?.item?.id;
      expect(typeof unfiledId).toBe("string");
      createdUnfiledItemIds.push(unfiledId);

      const unknownPromoteField = await request.post(
        `${baseUrl}/api/unfiled-items/${encodeURIComponent(unfiledId)}/promote`,
        {
          data: {
            tripId,
            userId: "attacker-controlled"
          },
          headers: dashboardHeaders
        }
      );
      expect(unknownPromoteField.status()).toBe(400);

      const promoted = await request.post(
        `${baseUrl}/api/unfiled-items/${encodeURIComponent(unfiledId)}/promote`,
        {
          data: { tripId },
          headers: dashboardHeaders
        }
      );
      expect(promoted.status()).toBe(201);
      const promotedBody = await promoted.json();
      const promotedSegmentId = promotedBody?.data?.segment?.id;
      expect(typeof promotedSegmentId).toBe("string");
      createdSegmentIds.push(promotedSegmentId);
    } finally {
      await Promise.all(
        createdSegmentIds.map((id) =>
          request.delete(`${baseUrl}/api/trip-segments/${encodeURIComponent(id)}`, {
            headers: dashboardHeaders
          })
        )
      );

      await Promise.all(
        createdUnfiledItemIds.map((id) =>
          request.delete(`${baseUrl}/api/unfiled-items/${encodeURIComponent(id)}`, {
            headers: dashboardHeaders
          })
        )
      );

      await request.patch(`${baseUrl}/api/import-sources`, {
      data: {
        connected: false,
        confirmDisconnect: true,
        lastError: null,
        sourceLabel: "Outlook inbox sync",
          sourceType: "outlook"
        },
        headers: dashboardHeaders
      });

      if (tripId) {
        await request.delete(`${baseUrl}/api/trips/${encodeURIComponent(tripId)}`, {
          headers: dashboardHeaders
        });
      }
    }
  });
});

function readTripId(body: unknown) {
  if (!body || typeof body !== "object" || !("trip" in body)) {
    return null;
  }
  const trip = (body as { trip?: { id?: unknown } }).trip;
  return typeof trip?.id === "string" ? trip.id : null;
}

async function expectTripName(response: Awaited<ReturnType<APIRequestContext["patch"]>>, name: string) {
  const body = await response.json();
  expect(body?.trip?.name).toBe(name);
}
