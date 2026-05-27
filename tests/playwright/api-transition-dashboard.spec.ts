import { expect, test } from "@playwright/test";

test("shows canonical API transition verification status", async ({ page }) => {
  test.setTimeout(60_000);
  await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });

  await page.goto("http://127.0.0.1:3000/dashboard/api-transition", {
    waitUntil: "domcontentloaded"
  });

  await expect(page.getByTestId("api-transition-dashboard")).toBeVisible();
  await expect(page.getByRole("heading", { name: /legacy-to-canonical parity/i })).toBeVisible();
  await expect(page.getByText(/legacy exceptions remaining/i)).toBeVisible();
  await expect(page.getByText("0").first()).toBeVisible();
  await expect(page.getByText("/api/itinerary").first()).toBeVisible();
  await expect(page.getByText("{ data: { item }, error: null }").first()).toBeVisible();
  await expect(page.getByText(/X-Api-Envelope/i)).toBeVisible();
});
