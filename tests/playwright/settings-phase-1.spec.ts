import { expect, test } from "@playwright/test";

const baseUrl = "http://127.0.0.1:3000";
const owned = { email_comments: true, email_mentions: false, inapp_comments: false, inapp_mentions: true };
const dashboardHeaders = { "sec-fetch-site": "same-origin", "x-cypress-dashboard": "true" };

test.describe("Settings Phase 1", () => {
  test("preferences GET rejects unauthenticated access and returns the authenticated user's complete contract", async ({ request }) => {
    expect((await request.get(`${baseUrl}/api/preferences`)).status()).toBe(401);
    const response = await request.get(`${baseUrl}/api/preferences`, { headers: dashboardHeaders });
    expect(response.status()).toBe(200);
    expect(await response.json()).toMatchObject({ preferences: { email_comments: expect.any(Boolean), email_mentions: expect.any(Boolean), inapp_comments: expect.any(Boolean), inapp_mentions: expect.any(Boolean) } });
  });

  test("preference mutations reject identity fields, unknown fields, empty bodies, and cross-site requests", async ({ request }) => {
    for (const data of [{ user_id: "another-user", email_comments: true }, { unknown: true }, {}]) {
      expect((await request.post(`${baseUrl}/api/preferences`, { data, headers: dashboardHeaders })).status()).toBe(400);
    }
    expect((await request.post(`${baseUrl}/api/preferences`, { data: { email_comments: true }, headers: { origin: "https://evil.example" } })).status()).toBe(403);
  });

  test("notification UI hydrates all mention/comment fields without flashing defaults and persists across remount", async ({ page }) => {
    let persisted = { ...owned };
    await page.route("**/api/preferences", async (route) => {
      if (route.request().method() === "GET") return route.fulfill({ json: { preferences: persisted, source: "persisted" } });
      persisted = { ...persisted, ...(await route.request().postDataJSON()) };
      return route.fulfill({ json: { preferences: persisted, source: "persisted" } });
    });
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });
    await page.goto("/dashboard/account");
    await expect(page.getByText("Loading saved notification settings…")).toBeVisible();
    await expect(page.getByLabel("Email Mentions notifications")).not.toBeChecked();
    await page.getByLabel("Email Mentions notifications").check();
    await expect(page.getByText("Saved", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Email Mentions notifications")).toBeChecked();
  });

  test("latest preference failure rolls back while a stale response cannot overwrite newer intent", async ({ page }) => {
    let calls = 0;
    await page.route("**/api/preferences", async (route) => {
      if (route.request().method() === "GET") return route.fulfill({ json: { preferences: owned, source: "persisted" } });
      calls += 1;
      if (calls === 1) { await new Promise((resolve) => setTimeout(resolve, 200)); return route.fulfill({ json: { preferences: { ...owned, email_comments: false }, source: "persisted" } }); }
      return route.fulfill({ status: 502, json: { error: "failed" } });
    });
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });
    await page.goto("/dashboard/account");
    const toggle = page.getByLabel("Email Comments notifications");
    await expect(toggle).toBeChecked();
    await toggle.uncheck(); await toggle.check();
    await expect(page.getByText("Could not save. Your change was rolled back.")).toBeVisible();
    await expect(toggle).not.toBeChecked();
    await page.waitForTimeout(250);
    await expect(toggle).not.toBeChecked();
  });

  test("account security endpoints require auth and reject arbitrary reset emails", async ({ request }) => {
    expect((await request.post(`${baseUrl}/api/account/profile`, { data: { displayName: "Ada Lovelace" }, headers: { "sec-fetch-site": "same-origin" } })).status()).toBe(401);
    expect((await request.post(`${baseUrl}/api/account/password-reset`, { data: { email: "victim@example.com" }, headers: dashboardHeaders })).status()).toBe(400);
    expect((await request.get(`${baseUrl}/api/account/deletion-request`)).status()).toBe(401);
  });

  test("display names normalize, validate, persist, and cannot carry a user id", async ({ request }) => {
    for (const displayName of ["", "A", "x".repeat(81), "<script>alert(1)</script>"]) {
      expect((await request.post(`${baseUrl}/api/account/profile`, { data: { displayName }, headers: dashboardHeaders })).status()).toBe(400);
    }
    expect((await request.post(`${baseUrl}/api/account/profile`, { data: { displayName: "Ada", userId: "another-user" }, headers: dashboardHeaders })).status()).toBe(400);
    const saved = await request.post(`${baseUrl}/api/account/profile`, { data: { displayName: "  Ada   Lovelace  " }, headers: dashboardHeaders });
    expect([200, 202]).toContain(saved.status());
    expect(await saved.json()).toMatchObject({ profile: { displayName: "Ada Lovelace" } });
    const restartedRead = await request.get(`${baseUrl}/api/account/profile`, { headers: dashboardHeaders });
    expect(restartedRead.status()).toBe(200);
    expect(await restartedRead.json()).toMatchObject({ profile: { displayName: "Ada Lovelace" } });
  });
});
