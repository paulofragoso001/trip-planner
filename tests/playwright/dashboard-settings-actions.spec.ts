import { expect, test } from "@playwright/test";

const baseUrl = "http://127.0.0.1:3000";
const dashboardHeaders = {
  "sec-fetch-site": "same-origin",
  "x-cypress-dashboard": "true"
};

test.describe("dashboard settings preferences and sync actions", () => {
  test("preferences endpoint enforces CSRF, auth, and strict payloads", async ({ request }) => {
    const crossSite = await request.post(`${baseUrl}/api/preferences`, {
      data: {
        email_comments: true
      },
      headers: {
        origin: "https://evil.example"
      }
    });
    expect(crossSite.status()).toBe(403);

    const unknownField = await request.post(`${baseUrl}/api/preferences`, {
      data: {
        email_comments: true,
        user_role: "admin"
      },
      headers: { "sec-fetch-site": "same-origin" }
    });
    expect(unknownField.status()).toBe(400);

    const unauthenticated = await request.post(`${baseUrl}/api/preferences`, {
      data: {
        email_comments: true
      },
      headers: { "sec-fetch-site": "same-origin" }
    });
    expect(unauthenticated.status()).toBe(401);
  });

  test("notification read endpoints enforce session boundary and accept owned dashboard session", async ({ request }) => {
    const crossSiteRead = await request.post(`${baseUrl}/api/notifications/read`, {
      data: {},
      headers: {
        origin: "https://evil.example"
      }
    });
    expect(crossSiteRead.status()).toBe(403);

    const unknownReadField = await request.post(`${baseUrl}/api/notifications/read`, {
      data: {
        markEverythingForUser: "spoof"
      },
      headers: dashboardHeaders
    });
    expect(unknownReadField.status()).toBe(400);

    const readAll = await request.post(`${baseUrl}/api/notifications/read`, {
      data: {},
      headers: dashboardHeaders
    });
    expect(readAll.status()).toBe(200);
    expect(await readAll.json()).toMatchObject({ success: true });

    const unknownPatchField = await request.patch(`${baseUrl}/api/notifications`, {
      data: {
        ids: [],
        userId: "spoof"
      },
      headers: dashboardHeaders
    });
    expect(unknownPatchField.status()).toBe(400);

    const markSelected = await request.patch(`${baseUrl}/api/notifications`, {
      data: {
        ids: []
      },
      headers: dashboardHeaders
    });
    expect(markSelected.status()).toBe(200);
    expect(await markSelected.json()).toMatchObject({ success: true });
  });
});
