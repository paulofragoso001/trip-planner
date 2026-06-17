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
  await expect(page.getByTestId("app-shell-root")).toHaveAttribute("data-wallet-shell", "true");
  await expect(page.getByTestId("app-shell-nav")).toHaveAttribute("data-wallet-sidebar-nav", "true");
  await expect(page.getByTestId("app-shell-topbar")).toHaveAttribute("data-wallet-topbar", "true");
  await expect(
    page.getByRole("heading", {
      name: "Your travel companion"
    })
  ).toBeVisible({ timeout: 20_000 });
  const dashboardContent = page.getByTestId("app-shell-content");
  await expect(dashboardContent.getByTestId("home-launch-page")).toBeVisible();
  await expect(dashboardContent.getByTestId("home-hero")).toBeVisible();
  await expect(
    dashboardContent.getByText("Pick up a trip, start planning, or review ideas waiting for you.")
  ).toBeVisible();
  await expect(dashboardContent.getByTestId("home-primary-cta")).toHaveCount(1);
  await expect(dashboardContent.getByTestId("home-primary-cta")).toHaveText(
    /Continue trip|Create your first trip/
  );
  await expect(dashboardContent.getByTestId("home-smart-start")).toBeVisible();
  await expect(dashboardContent.getByLabel("Where are you headed?")).toBeVisible();
  await expect(dashboardContent.getByTestId("home-smart-create-trip")).toBeVisible();
  await expect(
    dashboardContent.getByRole("link", { exact: true, name: "Start planning" }).first()
  ).toBeVisible();
  await expect(
    dashboardContent.getByRole("link", { exact: true, name: "Start planning" }).first()
  ).toHaveAttribute("href", "/dashboard/plan");
  await expect(dashboardContent.getByText("Start with an idea")).toBeVisible();
  await expect(page.getByTestId("app-shell-nav").getByRole("link", { name: "Saved Inspiration" })).toHaveCount(0);
  await expect(page.getByTestId("app-shell-nav").getByRole("link", { name: "Flight Status" })).toHaveCount(0);
  await expect(page.getByTestId("app-shell-nav").getByRole("link", { name: "Reports" })).toHaveCount(0);
  await expect(page.getByTestId("app-shell-nav").getByRole("link", { name: "Layout Simulator" })).toHaveCount(0);
  await expect(page.getByTestId("app-shell-nav").getByRole("link", { name: "Admin" })).toHaveCount(0);
  await expect(dashboardContent.getByText("Dashboard")).toHaveCount(0);
  await expect(dashboardContent.getByText("Imports")).toHaveCount(0);
  await expect(dashboardContent.getByText("Extracted places")).toHaveCount(0);
  await expect(dashboardContent.getByText("Segments")).toHaveCount(0);
  await expect(dashboardContent.getByText("Provider")).toHaveCount(0);
  await expect(dashboardContent.getByText("Database")).toHaveCount(0);
  await expect(page.getByText("Turn saved travel ideas into mapped trip plans.")).toHaveCount(0);
  await expect(page.getByText("First Plan Guide")).toHaveCount(0);
  await expect(page.getByText("Add, review, create.")).toHaveCount(0);
  await expect(dashboardContent.getByText(/0 waiting to review/i)).toHaveCount(0);
  await expect(dashboardContent.getByText("Recent passes")).toHaveCount(0);

  await openDashboardRoute("/dashboard/search");
  await expect(page.getByTestId("search-page")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("search-input")).toBeVisible();
  await expect(page.getByTestId("search-input")).toHaveAttribute(
    "placeholder",
    "Search saved activities and documents"
  );
  await expect(page.getByRole("button", { name: "Cancel" })).toBeVisible();
  await expect(page.getByTestId("search-group-trip-items")).toHaveCount(0);
  await expect(page.getByTestId("search-group-saved-ideas")).toHaveCount(0);
  await openDashboardRoute("/dashboard/search?q=zzzz-no-wayline-results");
  await expect(page.getByTestId("search-input")).toHaveValue("zzzz-no-wayline-results");
  await expect(page.getByRole("heading", { name: "No results found" })).toBeVisible();
  await expect(page.getByText("Try searching a place, activity, document, or trip.")).toBeVisible();

  await openDashboardRoute("/dashboard/trips");
  await expect(page.getByTestId("app-shell-topbar").getByRole("heading", { name: "Trips" })).toBeVisible();
  await expect(page.getByRole("heading", { exact: true, name: "Your trip passes" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("desktop-trips-wallet").or(page.getByTestId("desktop-first-trip-state"))).toBeVisible({ timeout: 20_000 });

  await openDashboardRoute("/dashboard/trips/demo");
  await expect(page.getByTestId("trip-pass-shell")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("trip-pass-shell")).toHaveAttribute("data-has-background-image", "false");
  await expect(page.getByTestId("trip-workspace-layout")).toBeVisible({ timeout: 30_000 });
  const overview = page.getByTestId("trip-overview-page");
  await expect(overview.getByTestId("mobile-primary-trip-cta")).toBeVisible();
  await expect(overview.getByText("More trip tools")).toBeVisible();
  await expect(overview.getByText("Trip organizer")).toHaveCount(0);
  await expect(overview.getByText("All your trip details in one place")).toHaveCount(0);
  await expect(overview.getByText("Trip Overview")).toHaveCount(0);
  await expect(overview.getByRole("link", { name: /New Activity/ })).toBeVisible();
  await expect(overview.getByRole("link", { name: "Open map" }).first()).toBeVisible();
  await expect(overview.getByRole("link", { name: "Open Activities" })).toBeVisible();
  await expect(overview.getByRole("link", { name: "Open documents" })).toHaveCount(0);
  await expect(overview.getByText("Trip guests")).toBeVisible();
  await expect(overview.getByRole("link", { name: "Manage guests" })).toHaveCount(0);
  await expect(overview.getByTestId("overview-more-tools").getByText("Documents")).toBeHidden();
  await overview.getByText("More trip tools").click();
  await expect(overview.getByTestId("overview-more-tools").getByText("Documents")).toBeVisible();
  await expect(page.getByTestId("trip-pass-hero")).toHaveCount(0);
  const compactHeader = page.getByTestId("trip-compact-header");
  await expect(compactHeader).toBeVisible();
  await expect(compactHeader.getByLabel("Back to trips")).toBeVisible();
  await expect(compactHeader.getByLabel("Search trip")).toBeVisible();
  await expect(compactHeader.getByLabel("Share trip")).toBeVisible();
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
  await expect(page.locator("details#desktop-new-plan > summary")).toBeVisible();
  const desktopDateStrip = page.locator('[data-testid="itinerary-date-strip"]:visible').last();
  await expect(desktopDateStrip).toBeVisible();
  await expect(desktopDateStrip.getByRole("link", { name: "Jump to THURSDAY, JUNE 11, 2026" })).toBeVisible();
  await desktopDateStrip.getByRole("link", { name: "Jump to THURSDAY, JUNE 11, 2026" }).click();
  expect(await page.evaluate(() => window.location.hash)).toBe("#day-2026-06-11");
  expect(await page.getByTestId("itinerary-category-icon").count()).toBeGreaterThan(0);
  await expect(page.getByRole("heading", { name: "THURSDAY, JUNE 11, 2026" }).last()).toBeVisible();
  const timelineTabs = page.getByRole("navigation", { name: "Trip tabs" });
  await expect(timelineTabs.getByRole("link", { exact: true, name: "Itinerary" })).toBeVisible();
  await expect(timelineTabs.getByRole("link", { exact: true, name: "Ideas" })).toBeVisible();
  await expect(page.getByRole("heading", { exact: true, name: "Calendar sync" })).toHaveCount(0);

  await openDashboardRoute("/dashboard/trips/demo/map");
  await expect(page.getByTestId("trip-pass-hero")).toHaveCount(0);
  await expect(page.getByTestId("trip-map-compact-header")).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Trip tabs" })).toHaveCount(0);
  await expect(page.getByTestId("connected-trip-map")).toBeVisible();
  await expect(page.locator('[data-map-bottom-sheet="true"]')).toBeVisible();
  await expect(page.getByText("Nearby Ideas", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Your route places appear here.")).toHaveCount(0);
  await expect(page.getByTestId("compact-route-empty-state")).toHaveCount(0);
  await expect(page.getByTestId("map-route-list")).toBeVisible();
  await expect(page.getByTestId("map-route-list").getByText("Team dinner in El Born")).toBeVisible();
  await expect(page.getByRole("link", { name: "Open Ideas" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Share view" })).toHaveCount(0);

  await openDashboardRoute("/dashboard/trips/demo/ideas");
  await expect(page.getByRole("heading", { exact: true, name: "All trip activities" })).toBeVisible();
  if ((await page.getByText("Nearby Ideas", { exact: true }).count()) > 0) {
    await expect(page.getByText("Nearby Ideas", { exact: true })).toBeVisible();
  }
  const activityFilters = page.getByTestId("activity-category-filters");
  if ((await activityFilters.count()) > 0) {
    await expect(activityFilters.getByText("Explore nearby")).toBeVisible();
    await expect(activityFilters.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "true");
    await activityFilters.getByRole("button", { name: "Food" }).click();
    await expect(activityFilters.getByRole("button", { name: "Food" })).toHaveAttribute("aria-pressed", "true");
  }
  const desktopIdeas = page.getByTestId("desktop-ideas-view");
  const routePlaces = desktopIdeas
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Saved ideas" }) });
  await expect(routePlaces.getByText("Team dinner in El Born")).toBeVisible();

  await openDashboardRoute("/dashboard/trips/demo/budget");
  await expect(
    page.getByTestId("app-shell-content").getByRole("heading", { exact: true, name: "My Spending" }).first()
  ).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Total in USD")).toBeVisible();
  await expect(page.getByText("Expense notes")).toBeVisible();

  await openDashboardRoute("/dashboard/trips/demo/documents");
  await expect(page.getByRole("heading", { exact: true, name: "Documents" })).toBeVisible();
  await expect(page.getByText("No documents yet")).toBeVisible();
  await expect(page.getByText("Add reservations, notes, links, and screenshots when document upload is available.")).toBeVisible();
  await expect(page.getByText("Emails")).toBeVisible();

  await openDashboardRoute("/dashboard/trips/demo/share");
  await expect(
    page
      .getByTestId("app-shell-content")
      .getByRole("heading", { exact: true, name: "Share this trip" })
  ).toBeVisible();
  await expect(page.getByRole("heading", { exact: true, name: "Invite guest" })).toBeVisible();

  await openDashboardRoute("/dashboard/trips/demo/sharing");
  await expect(
    page
      .getByTestId("app-shell-content")
      .getByRole("heading", { exact: true, name: "Share this trip" })
  ).toBeVisible();

  await openDashboardRoute("/dashboard/plan");
  const importsRoute = page.getByTestId("imports-route");
  await expect(importsRoute).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("heading", { exact: true, name: "Capture travel ideas" })).toBeVisible();
  await expect(importsRoute.getByRole("heading", { exact: true, name: "Add an idea" })).toBeVisible();
  const aiReviewCardCount = await importsRoute.locator('[data-testid^="ai-review-card-"]').count();
  await expect(importsRoute.getByRole("heading", { exact: true, name: "Review places" })).toHaveCount(
    aiReviewCardCount ? 1 : 0
  );
  await expect(importsRoute.getByRole("heading", { exact: true, name: "Create trip plan" })).toBeVisible();
  await expect(importsRoute.getByText("Optional trip context")).toBeVisible();
  await expect(importsRoute.getByText("Create a trip from saved ideas.")).toHaveCount(0);
  await expect(importsRoute.getByText("Advanced sources")).toBeVisible();

  await openDashboardRoute("/dashboard/imports");
  await expect(page.getByTestId("imports-route")).toBeVisible({ timeout: 30_000 });

  await expect(page.getByTestId("app-shell-nav").getByRole("link", { name: "Admin" })).toHaveCount(0);

  await openDashboardRoute("/dashboard/profile/stats");
  await expect(page.getByTestId("travel-stats-page")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Travel Stats" })).toBeVisible();
  await expect(page.getByTestId("travel-stats-countries")).toBeVisible();
  await expect(page.getByTestId("travel-stats-transport")).toBeVisible();

  await openDashboardRoute("/dashboard/profile/stats?view=countries&year=all");
  await expect(page.getByTestId("travel-stats-countries-detail")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("travel-stats-countries").getByRole("heading", { name: "Countries" })).toBeVisible();
  await expect(page.getByText("World total")).toBeVisible();
});
