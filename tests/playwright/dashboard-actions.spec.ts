import { expect, test, type Page } from "@playwright/test";
import { dashboardActionRoutes } from "../../lib/dashboard/action-routes";

const baseUrl = "http://127.0.0.1:3000";

test.describe("dashboard navigation and client-state actions", () => {
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
      /\/dashboard\/trips\/[^/]+|\/dashboard\/trips\?view=list#new-trip/
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

    await page.getByRole("button", { name: "Accept 15 Days Free" }).click();
    await expect(page.getByRole("dialog")).toContainText("Trial activation coming soon");
    await page.getByRole("button", { name: "Close trial availability" }).click();

    await page.getByRole("button", { name: "Dismiss pro card" }).click();
    await expect(page.getByRole("button", { name: "Dismiss pro card" })).toHaveCount(0);
    await page.getByRole("button", { name: "Dismiss email automation card" }).click();
    await expect(page.getByTestId("mobile-home-email-card")).toHaveCount(0);

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

  test("mobile globe map control routes without writing data", async ({ page }) => {
    await page.addInitScript(() => {
      window.google = {
        maps: {
          importLibrary: async () => ({})
        }
      };
    });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 390, height: 900 });

    await openDashboardRoute(page, "/dashboard");
    await page.getByRole("link", { name: "Open map" }).click();
    await expect(page).toHaveURL(/\/dashboard\/(map|trips\/[^/]+\/map)(?:$|\?)/);
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
    const routes = ["/dashboard", "/dashboard/plan", "/dashboard/trips", "/dashboard/account"];
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
