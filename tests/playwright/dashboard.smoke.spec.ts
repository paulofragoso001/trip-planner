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
      name: "Where do you want to start?"
    })
  ).toBeVisible();
  const dashboardContent = page.getByTestId("app-shell-content");
  await expect(
    dashboardContent.getByRole("link", { name: /Plan/ }).first()
  ).toBeVisible();
  await expect(
    dashboardContent.getByRole("link", { name: /View trips/ }).first()
  ).toBeVisible();
  await expect(page.getByTestId("app-shell-nav").getByRole("link", { name: "Saved Inspiration" })).toHaveCount(0);
  await expect(page.getByTestId("app-shell-nav").getByRole("link", { name: "Flight Status" })).toHaveCount(0);
  await expect(page.getByTestId("app-shell-nav").getByRole("link", { name: "Reports" })).toHaveCount(0);
  await expect(page.getByTestId("app-shell-nav").getByRole("link", { name: "Layout Simulator" })).toHaveCount(0);
  await expect(page.getByTestId("app-shell-nav").getByRole("link", { name: "Admin" })).toHaveCount(0);
  await expect(page.getByText("Turn saved travel ideas into mapped trip plans.")).toHaveCount(0);
  await expect(page.getByText("First Plan Guide")).toHaveCount(0);
  await expect(page.getByText("Add, review, create.")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Plan a trip" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Open my trips" })).toBeVisible();

  await openDashboardRoute("/dashboard/trips");
  await expect(page.getByTestId("app-shell-topbar").getByRole("heading", { name: "Trips" })).toBeVisible();
  await expect(page.getByText("Create a new trip")).toBeVisible();
  await expect(page.getByRole("heading", { exact: true, name: "Trip passes" })).toBeVisible();
  await page.getByRole("button", { name: "Refresh" }).click();

  await openDashboardRoute("/dashboard/trips/demo");
  await expect(page.getByTestId("trip-workspace-layout")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Everything for this trip" })).toBeVisible();
  await expect(page.getByText("Trip organizer")).toBeVisible();
  const hero = page.getByTestId("trip-pass-hero");
  await expect(hero.getByRole("link", { exact: true, name: "Itinerary" })).toHaveCount(0);
  await expect(hero.getByRole("link", { exact: true, name: "Map" })).toHaveCount(0);
  await expect(hero.getByRole("link", { exact: true, name: "Ideas" })).toHaveCount(0);
  await expect(hero.getByRole("link", { exact: true, name: "Expenses" })).toHaveCount(0);
  await expect(hero.getByRole("link", { exact: true, name: "Docs" })).toHaveCount(0);
  await expect(hero.getByRole("link", { exact: true, name: "Documents" })).toHaveCount(0);
  const tripTabs = page.getByRole("navigation", { name: "Trip tabs" });
  await expect(tripTabs.getByRole("link", { exact: true, name: "Itinerary" })).toBeVisible();
  await expect(tripTabs.getByRole("link", { exact: true, name: "Map" })).toBeVisible();
  await expect(tripTabs.getByRole("link", { exact: true, name: "Ideas" })).toBeVisible();
  await expect(tripTabs.getByRole("link", { exact: true, name: "Overview" })).toBeVisible();
  await expect(tripTabs.getByRole("link", { exact: true, name: "Documents" })).toBeVisible();
  await expect(tripTabs.getByRole("link", { exact: true, name: "Expenses" })).toBeVisible();
  await expect(tripTabs.getByRole("link", { exact: true, name: "Share" })).toBeVisible();

  await openDashboardRoute("/dashboard/trips/demo/timeline");
  await expect(page.getByTestId("trip-workspace-layout")).toBeVisible();
  await expect(
    page.getByTestId("app-shell-content").getByText("Itinerary", { exact: true }).first()
  ).toBeVisible();
  await expect(page.getByText("Add to itinerary")).toBeVisible();
  await expect(page.getByText("THURSDAY, JUNE 11, 2026")).toBeVisible();
  const timelineTabs = page.getByRole("navigation", { name: "Trip tabs" });
  await expect(timelineTabs.getByRole("link", { exact: true, name: "Itinerary" })).toBeVisible();
  await expect(timelineTabs.getByRole("link", { exact: true, name: "Ideas" })).toBeVisible();
  await expect(page.getByRole("heading", { exact: true, name: "Calendar sync" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Connect Google" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Connect Outlook" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Refresh flights" })).toBeVisible();

  await openDashboardRoute("/dashboard/trips/demo/map");
  await expect(
    page
      .getByTestId("app-shell-content")
      .getByRole("heading", { exact: true, name: "Map" })
  ).toBeVisible();
  await expect(page.getByTestId("connected-trip-map")).toBeVisible();
  await expect(page.getByText("Nearby Ideas", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Share view" })).toBeVisible();

  await openDashboardRoute("/dashboard/trips/demo/budget");
  await expect(
    page
      .getByTestId("app-shell-content")
      .getByRole("heading", { exact: true, name: "Category breakdown" })
  ).toBeVisible();
  await expect(page.getByText("Expense notes")).toBeVisible();

  await openDashboardRoute("/dashboard/trips/demo/documents");
  await expect(page.getByRole("heading", { exact: true, name: "Documents" })).toBeVisible();
  await expect(page.getByText("No documents yet")).toBeVisible();

  await openDashboardRoute("/dashboard/trips/demo/sharing");
  await expect(
    page
      .getByTestId("app-shell-content")
      .getByRole("heading", { exact: true, name: "Share this trip" })
  ).toBeVisible();
  await expect(page.getByRole("heading", { exact: true, name: "Invite guest" })).toBeVisible();

  await openDashboardRoute("/dashboard/imports");
  const importsRoute = page.getByTestId("imports-route");
  await expect(importsRoute).toBeVisible();
  await expect(importsRoute.getByRole("heading", { exact: true, name: "Plan" })).toBeVisible();
  await expect(importsRoute.getByRole("heading", { exact: true, name: "Add an idea" })).toBeVisible();
  await expect(importsRoute.getByRole("heading", { exact: true, name: "Review places" })).toBeVisible();
  await expect(importsRoute.getByRole("heading", { exact: true, name: "Create trip plan" })).toBeVisible();
  await expect(importsRoute.getByText("Optional trip context")).toBeVisible();
  await expect(importsRoute.getByText("Create a trip from saved ideas.")).toHaveCount(0);
  await expect(importsRoute.getByText("Advanced sources")).toBeVisible();

  await expect(page.getByTestId("app-shell-nav").getByRole("link", { name: "Admin" })).toHaveCount(0);
});
