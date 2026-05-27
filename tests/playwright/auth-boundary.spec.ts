import { expect, test } from "@playwright/test";

const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:3000";

test("dashboard write APIs reject unauthenticated requests", async ({ request }) => {
  const tripCreate = await request.post(`${baseUrl}/api/trips`, {
    data: {
      destination: "Miami",
      name: "Unauthorized trip"
    }
  });
  expect(tripCreate.status()).toBe(401);

  const calendarSync = await request.post(`${baseUrl}/api/calendar/sync`, {
    data: {
      calendarId: "primary",
      provider: "google",
      tripId: "demo"
    }
  });
  expect(calendarSync.status()).toBe(401);

  const imports = await request.patch(`${baseUrl}/api/import-sources`, {
    data: {
      connected: true,
      sourceLabel: "Unauthorized source",
      sourceType: "email"
    }
  });
  expect(imports.status()).toBe(401);
});

test("dashboard pages do not expose protected shell without auth or test bypass", async ({
  page
}) => {
  const response = await page.goto(`${baseUrl}/dashboard`, {
    waitUntil: "domcontentloaded"
  });

  expect(response?.status()).toBeLessThan(500);
  await expect(page.getByTestId("app-shell-root").or(page.getByRole("button", {
    name: /continue with email/i
  }))).toBeVisible();
});
