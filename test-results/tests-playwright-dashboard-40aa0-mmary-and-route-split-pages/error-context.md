# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests/playwright/dashboard.smoke.spec.ts >> loads dashboard summary and route-split pages
- Location: tests/playwright/dashboard.smoke.spec.ts:3:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator:  getByTestId('trip-workspace-layout')
Expected: visible
Received: hidden
Timeout:  5000ms

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByTestId('trip-workspace-layout')
    - locator resolved to <section data-testid="trip-workspace-layout" class="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">…</section>
    - unexpected value "hidden"

```

```yaml
- link "Skip to main content":
  - /url: "#main-content"
- complementary "Primary navigation":
  - link "W Wayline Flight operations":
    - /url: /dashboard
  - navigation "Primary":
    - heading "Operations" [level=2]
    - list:
      - listitem:
        - link "Overview":
          - /url: /dashboard
      - listitem:
        - link "Trips":
          - /url: /dashboard/trips
      - listitem:
        - link "Itinerary":
          - /url: /dashboard/trips
      - listitem:
        - link "Budget":
          - /url: /dashboard/trips
      - listitem:
        - link "Imports":
          - /url: /dashboard/imports
      - listitem:
        - link "Flight Status":
          - /url: /dashboard?view=flight-status
      - listitem:
        - link "Map":
          - /url: /dashboard/trips
    - heading "Signals" [level=2]
    - list:
      - listitem:
        - link "Alerts":
          - /url: /dashboard?view=alerts
      - listitem:
        - link "Activity":
          - /url: /dashboard/trips
      - listitem:
        - link "Sharing":
          - /url: /dashboard/trips
      - listitem:
        - link "Reports":
          - /url: /dashboard/api-transition
      - listitem:
        - link "Layout Simulator":
          - /url: /dashboard/layout-simulator
    - heading "Admin" [level=2]
    - list:
      - listitem:
        - link "Admin":
          - /url: /dashboard/admin
  - link "A Flight Ops Workspace Switch workspace":
    - /url: /dashboard?view=workspace
  - button "Collapse sidebar": < Collapse sidebar
- banner:
  - navigation "Breadcrumbs":
    - link "Overview":
      - /url: /dashboard
    - text: Trips
  - heading "Trips" [level=1]
  - text: Global search
  - searchbox "Global search"
  - button "Switch to dark mode": D
  - button "CW cypress@wayline.test"
- main
```

# Test source

```ts
  1  | import { expect, test } from "@playwright/test";
  2  | 
  3  | test("loads dashboard summary and route-split pages", async ({ page }) => {
  4  |   test.setTimeout(90_000);
  5  |   await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });
  6  | 
  7  |   const openDashboardRoute = (path: string) =>
  8  |     page.goto(`http://127.0.0.1:3000${path}`, { waitUntil: "commit" });
  9  | 
  10 |   await openDashboardRoute("/dashboard");
  11 |   await expect(page.getByTestId("app-shell-root")).toBeVisible();
  12 |   await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  13 |   await expect(page.getByText("Trips saved")).toBeVisible();
  14 |   await expect(page.getByText("Recent trips")).toBeVisible();
  15 |   await expect(page.getByText("Quick actions")).toBeVisible();
  16 | 
  17 |   await openDashboardRoute("/dashboard/trips");
  18 |   await expect(page.getByTestId("app-shell-topbar").getByRole("heading", { name: "Trips" })).toBeVisible();
  19 |   await expect(page.getByText("Trips database")).toBeVisible();
  20 |   await expect(page.getByText("Trip list")).toBeVisible();
  21 |   await page.getByRole("button", { name: "Refresh" }).click();
  22 | 
  23 |   await openDashboardRoute("/dashboard/trips/demo");
> 24 |   await expect(page.getByTestId("trip-workspace-layout")).toBeVisible();
     |                                                           ^ Error: expect(locator).toBeVisible() failed
  25 |   await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  26 |   await expect(page.getByText("Budget snapshot")).toBeVisible();
  27 | 
  28 |   await openDashboardRoute("/dashboard/trips/demo/timeline");
  29 |   await expect(page.getByTestId("trip-workspace-layout")).toBeVisible();
  30 |   await expect(page.getByRole("heading", { exact: true, name: "Timeline" })).toBeVisible();
  31 |   await expect(page.getByText("Timeline tools")).toBeVisible();
  32 |   await expect(page.getByRole("heading", { exact: true, name: "Calendar sync" })).toBeVisible();
  33 |   await expect(page.getByRole("button", { name: "Connect Google" })).toBeVisible();
  34 |   await expect(page.getByRole("button", { name: "Connect Outlook" })).toBeVisible();
  35 |   await expect(page.getByRole("button", { name: "Refresh flights" })).toBeVisible();
  36 | 
  37 |   await openDashboardRoute("/dashboard/trips/demo/map");
  38 |   await expect(page.getByRole("heading", { exact: true, name: "Map" })).toBeVisible();
  39 |   await expect(page.getByTestId("connected-trip-map")).toBeVisible();
  40 |   await expect(page.getByText("Connected Google Maps route preview")).toBeVisible();
  41 |   await expect(page.getByRole("button", { name: "Share view" })).toBeVisible();
  42 | 
  43 |   await openDashboardRoute("/dashboard/trips/demo/budget");
  44 |   await expect(page.getByRole("heading", { exact: true, name: "Budget" })).toBeVisible();
  45 |   await expect(page.getByText("Budget alerts")).toBeVisible();
  46 | 
  47 |   await openDashboardRoute("/dashboard/trips/demo/sharing");
  48 |   await expect(page.getByRole("heading", { exact: true, name: "Sharing" })).toBeVisible();
  49 |   await expect(page.getByRole("heading", { exact: true, name: "Invite" })).toBeVisible();
  50 | 
  51 |   await openDashboardRoute("/dashboard/imports");
  52 |   const importsRoute = page.getByTestId("imports-route");
  53 |   await expect(importsRoute).toBeVisible();
  54 |   await expect(importsRoute.getByRole("heading", { exact: true, name: "Imports" })).toBeVisible();
  55 |   await expect(importsRoute.getByRole("heading", { exact: true, name: "Unfiled items" })).toBeVisible();
  56 |   await expect(importsRoute.getByRole("button", { name: "Connect" }).first()).toBeVisible();
  57 | 
  58 |   await openDashboardRoute("/dashboard/admin");
  59 |   const adminRoute = page.getByTestId("admin-route");
  60 |   await expect(adminRoute).toBeVisible();
  61 |   await expect(adminRoute.getByRole("heading", { exact: true, name: "Admin tools" })).toBeVisible();
  62 |   await expect(adminRoute.getByRole("heading", { exact: true, name: "Internal status" })).toBeVisible();
  63 |   await expect(adminRoute.getByRole("heading", { exact: true, name: "OAuth observability" })).toBeVisible();
  64 |   await expect(adminRoute.getByRole("heading", { exact: true, name: "Import parse observability" })).toBeVisible();
  65 |   await expect(adminRoute.getByText("Weekly reviewed")).toBeVisible();
  66 |   await expect(adminRoute.getByText("Impact score")).toBeVisible();
  67 |   await expect(adminRoute.getByText("24h predictions")).toBeVisible();
  68 |   await expect(adminRoute.getByRole("heading", { exact: true, name: "Import anomalies" })).toBeVisible();
  69 |   await expect(adminRoute.getByRole("button", { name: "All" })).toBeVisible();
  70 |   await expect(adminRoute.getByRole("heading", { exact: true, name: "Accuracy trend by parser" })).toBeVisible();
  71 |   await expect(adminRoute.getByRole("heading", { exact: true, name: "Correction rate by segment type" })).toBeVisible();
  72 |   await expect(adminRoute.getByRole("heading", { exact: true, name: "Live import metrics" })).toBeVisible();
  73 | });
  74 | 
```