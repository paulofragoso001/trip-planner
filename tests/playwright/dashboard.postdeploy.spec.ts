import { expect, test } from "@playwright/test";

const baseUrl = process.env.BASE_URL || "http://127.0.0.1:3000";

test("dashboard route is healthy after deployment", async ({ page }) => {
  const response = await page.goto(new URL("/dashboard", baseUrl).toString(), {
    waitUntil: "domcontentloaded"
  });

  expect(response?.ok() || response?.status() === 304).toBeTruthy();

  const dashboardShell = page.getByTestId("app-shell-root");
  const loginForm = page.getByRole("button", { name: /continue with email/i });

  await expect(dashboardShell.or(loginForm)).toBeVisible({ timeout: 15_000 });
});
