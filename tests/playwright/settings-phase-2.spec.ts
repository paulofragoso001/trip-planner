import { expect, test } from "@playwright/test";

const baseUrl = "http://127.0.0.1:3000";
const dashboardHeaders = { "sec-fetch-site": "same-origin", "x-cypress-dashboard": "true" };

test.describe("Settings Phase 2", () => {
  test("preference API authenticates reads and strictly validates partial writes", async ({ request }) => {
    expect((await request.get(`${baseUrl}/api/user-preferences`)).status()).toBe(401);
    expect((await request.patch(`${baseUrl}/api/user-preferences`, { data: { distance_unit: "miles" }, headers: { "sec-fetch-site": "same-origin" } })).status()).toBe(401);
    for (const data of [
      { default_currency: "BTC" },
      { distance_unit: "yards" },
      { unknown: true },
      { user_id: "another-user", distance_unit: "miles" },
      {}
    ]) {
      expect((await request.patch(`${baseUrl}/api/user-preferences`, { data, headers: dashboardHeaders })).status()).toBe(400);
    }
    expect((await request.patch(`${baseUrl}/api/user-preferences`, { data: { distance_unit: "miles" }, headers: { origin: "https://evil.example" } })).status()).toBe(403);
  });

  test("web preferences hydrate, persist independently, and survive remount", async ({ page }) => {
    let persisted = { default_currency: "EUR", distance_unit: "kilometers" };
    await page.route("**/api/user-preferences", async (route) => {
      if (route.request().method() === "GET") return route.fulfill({ json: { preferences: persisted, source: "persisted" } });
      persisted = { ...persisted, ...(await route.request().postDataJSON()) };
      return route.fulfill({ json: { preferences: persisted, source: "persisted" } });
    });
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });
    await page.goto("/dashboard/account");
    await expect(page.getByText("Loading saved travel preferences…")).toBeVisible();
    await expect(page.getByLabel("Default currency")).toHaveValue("EUR");
    await expect(page.getByLabel("Distance unit")).toHaveValue("kilometers");
    await page.getByLabel("Default currency").selectOption("GBP");
    await expect(page.getByText("Saved", { exact: true })).toBeVisible();
    expect(persisted).toEqual({ default_currency: "GBP", distance_unit: "kilometers" });
    await page.reload();
    await expect(page.getByLabel("Default currency")).toHaveValue("GBP");
  });

  test("failed and stale preference responses cannot override the latest intent", async ({ page }) => {
    let calls = 0;
    await page.route("**/api/user-preferences", async (route) => {
      if (route.request().method() === "GET") return route.fulfill({ json: { preferences: { default_currency: "USD", distance_unit: "miles" }, source: "persisted" } });
      calls += 1;
      if (calls === 1) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return route.fulfill({ json: { preferences: { default_currency: "EUR", distance_unit: "miles" }, source: "persisted" } });
      }
      return route.fulfill({ status: 502, json: { error: "failed" } });
    });
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });
    await page.goto("/dashboard/account");
    const currency = page.getByLabel("Default currency");
    await expect(currency).toHaveValue("USD");
    await currency.selectOption("EUR");
    await currency.selectOption("GBP");
    await expect(page.getByText("Could not save. Your change was rolled back.")).toBeVisible();
    await expect(currency).toHaveValue("EUR");
    await page.waitForTimeout(250);
    await expect(currency).toHaveValue("EUR");
  });
});
