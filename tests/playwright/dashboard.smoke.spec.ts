import { expect, test } from "@playwright/test";

test("loads dashboard summary and route-split pages", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });

  const openDashboardRoute = (path: string) =>
    page.goto(`http://127.0.0.1:3000${path}`, { waitUntil: "commit" });

  await openDashboardRoute("/dashboard");
  await expect(page.getByTestId("app-shell-root")).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Turn saved travel ideas into a mapped trip plan."
    })
  ).toBeVisible();
  const dashboardContent = page.getByTestId("app-shell-content");
  await expect(
    dashboardContent.getByRole("link", { name: /Plan with AI/ }).first()
  ).toBeVisible();
  await expect(
    dashboardContent.getByRole("link", { name: /My Trips/ }).first()
  ).toBeVisible();
  await expect(page.getByText("Trips saved")).toBeVisible();
  await expect(page.getByText("Continue planning")).toBeVisible();
  await expect(page.getByText("Quick actions")).toBeVisible();

  await openDashboardRoute("/dashboard/trips");
  await expect(page.getByTestId("app-shell-topbar").getByRole("heading", { name: "My Trips" })).toBeVisible();
  await expect(page.getByText("Create a new trip")).toBeVisible();
  await expect(page.getByText("Confirmed plans")).toBeVisible();
  await page.getByRole("button", { name: "Refresh" }).click();

  await openDashboardRoute("/dashboard/trips/demo");
  await expect(page.getByTestId("trip-workspace-layout")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await expect(page.getByText("Budget snapshot")).toBeVisible();

  await openDashboardRoute("/dashboard/trips/demo/timeline");
  await expect(page.getByTestId("trip-workspace-layout")).toBeVisible();
  await expect(
    page.getByTestId("app-shell-content").getByRole("heading", { exact: true, name: "Timeline" })
  ).toBeVisible();
  await expect(page.getByText("Plan tools")).toBeVisible();
  await expect(page.getByRole("heading", { exact: true, name: "Calendar sync" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Connect Google" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Connect Outlook" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Refresh flights" })).toBeVisible();

  await openDashboardRoute("/dashboard/trips/demo/map");
  await expect(
    page
      .getByTestId("app-shell-content")
      .getByRole("heading", { exact: true, name: "Trip map" })
  ).toBeVisible();
  await expect(page.getByTestId("connected-trip-map")).toBeVisible();
  await expect(page.getByText("Your confirmed stops, needs-location ideas")).toBeVisible();
  await expect(page.getByRole("button", { name: "Share view" })).toBeVisible();

  await openDashboardRoute("/dashboard/trips/demo/budget");
  await expect(
    page
      .getByTestId("app-shell-content")
      .getByRole("heading", { exact: true, name: "Budget" })
  ).toBeVisible();
  await expect(page.getByText("Budget alerts")).toBeVisible();

  await openDashboardRoute("/dashboard/trips/demo/sharing");
  await expect(
    page
      .getByTestId("app-shell-content")
      .getByRole("heading", { exact: true, name: "Sharing" })
  ).toBeVisible();
  await expect(page.getByRole("heading", { exact: true, name: "Invite" })).toBeVisible();

  await openDashboardRoute("/dashboard/imports");
  const importsRoute = page.getByTestId("imports-route");
  await expect(importsRoute).toBeVisible();
  await expect(importsRoute.getByRole("heading", { exact: true, name: "Add travel ideas" })).toBeVisible();
  await expect(importsRoute.getByRole("heading", { exact: true, name: "Review places Wayline found" })).toBeVisible();
  await expect(importsRoute.getByRole("heading", { exact: true, name: "Create your trip plan" })).toBeVisible();
  await expect(importsRoute.getByText("Advanced sources")).toBeVisible();

  await openDashboardRoute("/dashboard/admin");
  const adminRoute = page.getByTestId("admin-route");
  await expect(adminRoute).toBeVisible();
  await expect(adminRoute.getByRole("heading", { exact: true, name: "Admin tools" })).toBeVisible();
  await expect(adminRoute.getByRole("heading", { exact: true, name: "Internal status" })).toBeVisible();
  await expect(adminRoute.getByRole("heading", { exact: true, name: "OAuth observability" })).toBeVisible();
  await expect(adminRoute.getByRole("heading", { exact: true, name: "Import parse observability" })).toBeVisible();
  await expect(adminRoute.getByText("Weekly reviewed")).toBeVisible();
  await expect(adminRoute.getByText("Impact score")).toBeVisible();
  await expect(adminRoute.getByText("24h predictions")).toBeVisible();
  await expect(adminRoute.getByRole("heading", { exact: true, name: "Import anomalies" })).toBeVisible();
  await expect(adminRoute.getByRole("button", { name: "All" })).toBeVisible();
  await expect(adminRoute.getByRole("heading", { exact: true, name: "Accuracy trend by parser" })).toBeVisible();
  await expect(adminRoute.getByRole("heading", { exact: true, name: "Correction rate by segment type" })).toBeVisible();
  await expect(adminRoute.getByRole("heading", { exact: true, name: "Live import metrics" })).toBeVisible();
});
