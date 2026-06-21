import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { dashboardActionRoutes } from "../../lib/dashboard/action-routes";

const baseUrl = "http://127.0.0.1:3000";
const dashboardHeaders = {
  "sec-fetch-site": "same-origin",
  "x-cypress-dashboard": "true"
};

test.describe("dashboard action wiring", () => {
  test.beforeEach(async ({ page }) => {
    await page.setExtraHTTPHeaders({ "x-cypress-dashboard": "true" });
  });

  test("visible dashboard navigation actions route to their wired domains", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 900 });

    await openDashboardRoute(page, "/dashboard");
    const dashboardContent = page.getByTestId("app-shell-content");
    const startPlanning = dashboardContent.getByRole("link", { exact: true, name: "Start planning" }).first();
    await expect(startPlanning).toHaveAttribute("href", dashboardActionRoutes.plan.addIdea);
    await startPlanning.click();
    await expect(page).toHaveURL(`${baseUrl}${dashboardActionRoutes.plan.addIdea}`);
    await expect(page.getByTestId("imports-route")).toBeVisible();

    await openDashboardRoute(page, "/dashboard/trips");
    const tripsStartPlanning = page.getByRole("link", { exact: true, name: "Start planning" }).first();
    await expect(tripsStartPlanning).toHaveAttribute("href", dashboardActionRoutes.plan.addIdea);
    await tripsStartPlanning.click();
    await expect(page).toHaveURL(`${baseUrl}${dashboardActionRoutes.plan.addIdea}`);
    await expect(page.getByTestId("imports-route")).toBeVisible();

    await openDashboardRoute(page, "/dashboard");
    await expect(dashboardContent.getByTestId("home-primary-cta")).toHaveAttribute(
      "href",
      /\/dashboard\/trips\/[^/]+|\/dashboard\/trips#new-trip/
    );
  });

  test("mobile wallet buttons toggle, route, or show explicit unavailable state", async ({ context, page }) => {
    await page.addInitScript(() => {
      window.google = {
        maps: {
          importLibrary: async () => ({})
        }
      };
    });
    await context.grantPermissions(["geolocation"], { origin: baseUrl });
    await context.setGeolocation({ latitude: 25.7617, longitude: -80.1918 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 390, height: 900 });

    await openDashboardRoute(page, "/dashboard");
    const sheet = page.getByTestId("mobile-home-wallet-content");
    await expect(sheet).toHaveAttribute("data-sheet-state", "collapsed");

    await page.getByRole("link", { name: "Search" }).click();
    await expect(page).toHaveURL(`${baseUrl}/dashboard/search`);

    await openDashboardRoute(page, "/dashboard");
    await expect(sheet).toHaveAttribute("data-sheet-state", "collapsed");

    await page.getByRole("button", { name: "Expand trips sheet" }).click();
    await expect(sheet).toHaveAttribute("data-sheet-state", "expanded");

    await page.getByRole("button", { name: "Open settings" }).click();
    await expect(sheet).toHaveAttribute("data-sheet-state", "settings");
    await page.getByRole("button", { name: "Redeem 15 Days Free" }).click();
    await expect(page.getByRole("dialog")).toContainText("Trial activation coming soon");
    await page.getByRole("button", { name: "Close trial availability" }).click();
    await page.getByRole("button", { name: "Close settings" }).click();
    await expect(sheet).toHaveAttribute("data-sheet-state", "collapsed");

    await page.getByRole("button", { name: "Use current location" }).click();
    await expect(page.getByTestId("mobile-home-globe-controls")).toBeVisible();
  });

  test("plan action buttons are clickable and surface validation feedback", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    await openDashboardRoute(page, "/dashboard/plan");

    await page.getByTestId("plan-capture-link").click();
    await expect(page.locator('input[name="sourceUrl"]')).toBeVisible();

    await page.getByTestId("plan-capture-note").click();
    await expect(page.locator('textarea[name="rawText"]')).toBeVisible();

    const reviewIdea = page.getByRole("button", { name: "Review idea" });
    await reviewIdea.click();
    await expect(page.getByText("Choose a link, note, or screenshot first.")).toBeVisible();
    await expect(reviewIdea).toBeEnabled();
  });

  test("visible enabled dashboard button controls have an affordance or explicit contract", async ({ page }) => {
    const routes = ["/dashboard", "/dashboard?view=trips", "/dashboard/plan", "/dashboard/trips", "/dashboard/account"];
    const allowedLabels = new Set([
      "Accept 15 Days Free",
      "Collapse sidebar",
      "Close settings",
      "Close trial availability",
      "Collapse trips sheet",
      "Dismiss email automation card",
      "Dismiss pro card",
      "Expand trips sheet",
      "Open navigation",
      "Open settings",
      "Paste link",
      "Paste note",
      "Review idea",
      "Switch to dark mode",
      "Switch to light mode",
      "Use current location"
    ]);
    const failures: string[] = [];

    await page.setViewportSize({ width: 390, height: 900 });
    for (const route of routes) {
      await openDashboardRoute(page, route);
      failures.push(...await findUnsupportedVisibleButtons(page, route, allowedLabels));
    }

    expect(failures).toEqual([]);
  });
});

test.describe("dashboard API/server action boundaries", () => {
  test("trip APIs reject unauthorized and non-owned IDs while allowing a valid owned lifecycle", async ({ request }) => {
    const runId = Date.now().toString(36);
    const createPayload = {
      budget: 0,
      destination: "Miami, FL",
      destination_lat: 25.7617,
      destination_lng: -80.1918,
      destination_status: "resolved",
      end_date: "2026-07-05",
      name: `Action Test ${runId}`,
      start_date: "2026-07-01",
      status: "Planning",
      travel_style: "balanced"
    };
    let tripId: string | null = null;

    const unauthorizedList = await request.get(`${baseUrl}/api/trips`);
    expect(unauthorizedList.status()).toBe(401);

    const unauthorizedCreate = await request.post(`${baseUrl}/api/trips`, {
      data: createPayload,
      headers: { "sec-fetch-site": "same-origin" }
    });
    expect(unauthorizedCreate.status()).toBe(401);

    const crossSiteCreate = await request.post(`${baseUrl}/api/trips`, {
      data: createPayload,
      headers: {
        origin: "https://evil.example"
      }
    });
    expect(crossSiteCreate.status()).toBe(403);

    const nonOwnedId = "00000000-0000-4000-8000-000000000001";
    const nonOwnedGet = await request.get(`${baseUrl}/api/trips/${nonOwnedId}`, {
      headers: dashboardHeaders
    });
    expect(nonOwnedGet.status()).toBe(404);

    const nonOwnedPatch = await request.patch(`${baseUrl}/api/trips/${nonOwnedId}`, {
      data: { ...createPayload, name: `Wrong Owner ${runId}` },
      headers: dashboardHeaders
    });
    expect(nonOwnedPatch.status()).toBe(404);

    try {
      const created = await request.post(`${baseUrl}/api/trips`, {
        data: createPayload,
        headers: dashboardHeaders
      });
      expect(created.status()).toBe(201);
      const createdBody = await created.json();
      tripId = readTripId(createdBody);
      expect(tripId).toBeTruthy();

      const fetched = await request.get(`${baseUrl}/api/trips/${tripId}`, {
        headers: dashboardHeaders
      });
      expect(fetched.status()).toBe(200);

      const patched = await request.patch(`${baseUrl}/api/trips/${tripId}`, {
        data: { ...createPayload, name: `Action Test Updated ${runId}` },
        headers: dashboardHeaders
      });
      expect(patched.status()).toBe(200);
      await expectTripName(patched, `Action Test Updated ${runId}`);

      const deleted = await request.delete(`${baseUrl}/api/trips/${tripId}`, {
        headers: dashboardHeaders
      });
      expect(deleted.status()).toBe(200);
      tripId = null;
    } finally {
      if (tripId) {
        await request.delete(`${baseUrl}/api/trips/${tripId}`, {
          headers: dashboardHeaders
        });
      }
    }
  });
});

async function openDashboardRoute(page: Page, path: string) {
  await page.goto(`${baseUrl}${path}`, { waitUntil: "commit" });
  await expect(page.getByTestId("app-shell-root")).toBeVisible({ timeout: 30_000 });
  await suppressNextDevToolsPointerLayer(page);
}

async function suppressNextDevToolsPointerLayer(page: Page) {
  await page
    .addStyleTag({
      content: "nextjs-portal { pointer-events: none !important; }"
    })
    .catch(() => undefined);
}

async function findUnsupportedVisibleButtons(page: Page, route: string, allowedLabels: Set<string>) {
  return page.locator('button[type="button"]:visible').evaluateAll((buttons, args) => {
    const allowed = new Set(args.allowedLabels);
    return buttons.flatMap((button) => {
      const typedButton = button as HTMLButtonElement;
      if (typedButton.disabled || button.getAttribute("aria-disabled") === "true") {
        return [];
      }

      const label =
        button.getAttribute("aria-label") ||
        button.getAttribute("title") ||
        button.textContent?.replace(/\s+/g, " ").trim() ||
        "";
      const hasStateContract =
        button.hasAttribute("aria-controls") ||
        button.hasAttribute("aria-expanded") ||
        button.hasAttribute("data-testid") ||
        Boolean(button.closest("form"));

      if (!label) {
        return [`${args.route}: visible enabled button is missing an accessible label`];
      }

      if (!hasStateContract && !allowed.has(label)) {
        return [`${args.route}: visible enabled button "${label}" is not covered by an action affordance`];
      }

      return [];
    });
  }, { allowedLabels: [...allowedLabels], route });
}

function readTripId(body: unknown) {
  if (!body || typeof body !== "object" || !("trip" in body)) {
    return null;
  }
  const trip = (body as { trip?: { id?: unknown } }).trip;
  return typeof trip?.id === "string" ? trip.id : null;
}

async function expectTripName(response: Awaited<ReturnType<APIRequestContext["patch"]>>, name: string) {
  const body = await response.json();
  expect(body?.trip?.name).toBe(name);
}
