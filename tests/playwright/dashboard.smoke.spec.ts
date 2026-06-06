import { expect, test } from "@playwright/test";

test("loads dashboard summary and route-split pages", async ({ page }) => {
  test.setTimeout(360_000);
  await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });

  const openDashboardRoute = (path: string) =>
    page.goto(`http://127.0.0.1:3000${path}`, { waitUntil: "commit" });

  await page.goto("http://127.0.0.1:3000/", { waitUntil: "commit" });
  await expect(
    page.getByRole("heading", {
      name: "All your trip details. Finally, in one place."
    })
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Start planning" })).toHaveAttribute("href", "/signup");
  await expect(page.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login");
  await expect(page.getByText(/real-time flight alerts/i)).toHaveCount(0);
  await expect(page.getByText(/700 providers/i)).toHaveCount(0);
  await expect(page.getByText(/calendar sync/i)).toHaveCount(0);
  await expect(page.getByText(/forward reservation emails/i)).toHaveCount(0);
  await expect(page.getByText(/instantly turn your reservation emails/i)).toHaveCount(0);

  await openDashboardRoute("/dashboard");
  await expect(page.getByTestId("app-shell-root")).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Your travel companion"
    })
  ).toBeVisible({ timeout: 20_000 });
  const dashboardContent = page.getByTestId("app-shell-content");
  await expect(
    dashboardContent.getByRole("link", { name: /Start planning/ }).first()
  ).toBeVisible();
  await expect(
    dashboardContent.getByRole("link", { name: /View trips|Continue trip|Create your first trip/ }).first()
  ).toBeVisible();
  await expect(page.getByTestId("app-shell-nav").getByRole("link", { name: "Saved Inspiration" })).toHaveCount(0);
  await expect(page.getByTestId("app-shell-nav").getByRole("link", { name: "Flight Status" })).toHaveCount(0);
  await expect(page.getByTestId("app-shell-nav").getByRole("link", { name: "Reports" })).toHaveCount(0);
  await expect(page.getByTestId("app-shell-nav").getByRole("link", { name: "Layout Simulator" })).toHaveCount(0);
  await expect(page.getByTestId("app-shell-nav").getByRole("link", { name: "Admin" })).toHaveCount(0);
  await expect(page.getByText("Turn saved travel ideas into mapped trip plans.")).toHaveCount(0);
  await expect(page.getByText("First Plan Guide")).toHaveCount(0);
  await expect(page.getByText("Add, review, create.")).toHaveCount(0);
  await expect(page.getByText("Create trip")).toBeVisible();
  await expect(
    dashboardContent.getByRole("link", { exact: true, name: "Start planning" }).first()
  ).toBeVisible();

  await openDashboardRoute("/dashboard/trips");
  await expect(page.getByTestId("app-shell-topbar").getByRole("heading", { name: "Trips" })).toBeVisible();
  await expect(page.getByText("Create trip pass")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("heading", { exact: true, name: "Trip passes" })).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Refresh" }).click();

  await openDashboardRoute("/dashboard/trips/demo");
  await expect(page.getByTestId("trip-pass-shell")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("trip-pass-shell")).toHaveAttribute("data-has-background-image", "false");
  await expect(page.getByTestId("trip-workspace-layout")).toBeVisible({ timeout: 30_000 });
  const overview = page.getByTestId("trip-overview-page");
  await expect(overview.getByRole("heading", { name: "Your trip at a glance" })).toBeVisible();
  await expect(overview.getByText("Trip organizer")).toBeVisible();
  await expect(overview.getByText("All your trip details in one place")).toHaveCount(0);
  await expect(overview.getByText("Trip Overview")).toHaveCount(0);
  await expect(overview.getByRole("link", { exact: true, name: "Add trip detail" })).toBeVisible();
  await expect(overview.getByRole("link", { name: "Open documents" })).toBeVisible();
  await expect(overview.getByRole("link", { name: "Manage guests" })).toBeVisible();
  const hero = page.getByTestId("trip-pass-hero");
  await expect(hero).toHaveAttribute("data-hero-image", "false");
  await expect(hero.getByTestId("trip-pass-hero-fallback")).toBeVisible();
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
  await expect(tripTabs.getByRole("link", { exact: true, name: "Ideas" })).toHaveAttribute(
    "href",
    "/dashboard/trips/demo/ideas"
  );

  await openDashboardRoute("/dashboard/trips/demo/timeline");
  await expect(page.getByTestId("trip-workspace-layout")).toBeVisible({ timeout: 30_000 });
  await expect(
    page.getByRole("navigation", { name: "Trip tabs" }).getByRole("link", { exact: true, name: "Itinerary" })
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Add trip item" }).first()).toBeVisible();
  await expect(page.getByTestId("itinerary-date-strip")).toBeVisible();
  await expect(page.getByTestId("itinerary-date-strip").getByRole("link", { name: "Jump to THURSDAY, JUNE 11, 2026" })).toBeVisible();
  await page.getByTestId("itinerary-date-strip").getByRole("link", { name: "Jump to THURSDAY, JUNE 11, 2026" }).click();
  expect(await page.evaluate(() => window.location.hash)).toBe("#day-2026-06-11");
  expect(await page.getByTestId("itinerary-category-icon").count()).toBeGreaterThan(0);
  await expect(page.getByText("THURSDAY, JUNE 11, 2026")).toBeVisible();
  const timelineTabs = page.getByRole("navigation", { name: "Trip tabs" });
  await expect(timelineTabs.getByRole("link", { exact: true, name: "Itinerary" })).toBeVisible();
  await expect(timelineTabs.getByRole("link", { exact: true, name: "Ideas" })).toBeVisible();
  await expect(page.getByRole("heading", { exact: true, name: "Calendar sync" })).toBeVisible();
  const calendarSync = page.locator("section").filter({ has: page.getByRole("heading", { exact: true, name: "Calendar sync" }) });
  expect(await calendarSync.getByRole("button").count()).toBeGreaterThanOrEqual(2);
  await expect(page.getByRole("button", { name: "Refresh flights" })).toBeVisible();

  await openDashboardRoute("/dashboard/trips/demo/map");
  await expect(page.getByTestId("connected-trip-map")).toBeVisible();
  await expect(page.getByText("Nearby Ideas", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Your route places appear here.")).toHaveCount(0);
  await expect(page.getByTestId("compact-route-empty-state")).toHaveCount(0);
  await expect(page.getByTestId("map-route-list")).toBeVisible();
  await expect(page.getByTestId("map-route-list").getByText("Team dinner in El Born")).toBeVisible();
  await expect(page.getByRole("button", { name: "Share view" })).toBeVisible();

  await openDashboardRoute("/dashboard/trips/demo/ideas");
  await expect(page.getByRole("heading", { exact: true, name: "All trip activities" })).toBeVisible();
  await expect(page.getByText("Nearby Ideas", { exact: true })).toBeVisible();
  const activityFilters = page.getByTestId("activity-category-filters");
  if ((await activityFilters.count()) > 0) {
    await expect(activityFilters.getByText("Explore nearby")).toBeVisible();
    await expect(activityFilters.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "true");
    await activityFilters.getByRole("button", { name: "Food" }).click();
    await expect(activityFilters.getByRole("button", { name: "Food" })).toHaveAttribute("aria-pressed", "true");
  }
  const routePlaces = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Route places" }) });
  await expect(routePlaces.getByText("Team dinner in El Born")).toBeVisible();

  await openDashboardRoute("/dashboard/trips/demo/budget");
  await expect(page.getByTestId("app-shell-content").getByText("Category breakdown")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Expense notes")).toBeVisible();

  await openDashboardRoute("/dashboard/trips/demo/documents");
  await expect(page.getByRole("heading", { exact: true, name: "Documents" })).toBeVisible();
  await expect(page.getByText("No documents yet")).toBeVisible();
  await expect(page.getByText("Keep reservations, confirmations, screenshots, notes, files, and useful links for this trip in one place.")).toBeVisible();
  await expect(page.getByText("Email import coming soon")).toBeVisible();

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
  await expect(page.getByRole("heading", { exact: true, name: "Capture travel ideas" })).toBeVisible();
  await expect(importsRoute.getByRole("heading", { exact: true, name: "Add an idea" })).toBeVisible();
  await expect(importsRoute.getByRole("heading", { exact: true, name: "Review places" })).toBeVisible();
  await expect(importsRoute.getByRole("heading", { exact: true, name: "Create trip plan" })).toBeVisible();
  await expect(importsRoute.getByText("Optional trip context")).toBeVisible();
  await expect(importsRoute.getByText("Create a trip from saved ideas.")).toHaveCount(0);
  await expect(importsRoute.getByText("Advanced sources")).toBeVisible();

  await expect(page.getByTestId("app-shell-nav").getByRole("link", { name: "Admin" })).toHaveCount(0);
});
