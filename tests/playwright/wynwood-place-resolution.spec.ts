import { expect, test } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const dashboardHeaders = { "x-cypress-dashboard": "true" };
const googlePlaceResolutionKey =
  process.env.GOOGLE_PLACES_API_KEY ||
  process.env.GOOGLE_MAPS_API_KEY ||
  readLocalEnv("GOOGLE_PLACES_API_KEY") ||
  readLocalEnv("GOOGLE_MAPS_API_KEY");

test("Wynwood Walls resolves as a mapped Miami place", async ({ request }) => {
  test.skip(
    !googlePlaceResolutionKey,
    "Wynwood regression requires GOOGLE_PLACES_API_KEY or GOOGLE_MAPS_API_KEY"
  );

  const preflight = await request.get(`${baseUrl}/api/social-imports`, {
    headers: dashboardHeaders
  });

  test.skip(
    preflight.status() !== 200,
    "Wynwood regression requires dashboard test auth to be enabled"
  );

  const response = await request.post(`${baseUrl}/api/travel-data/resolve-place`, {
    data: {
      city: "Miami",
      country: "United States",
      locationHint: "Miami, FL",
      name: "Wynwood Walls"
    },
    headers: dashboardHeaders
  });

  expect(response.status()).toBe(200);
  const payload = await response.json();
  const resolved = payload?.data?.resolved;
  const addressAndTitle = [
    resolved?.address,
    resolved?.inventoryItem?.title
  ].join(" ").toLowerCase();

  expect(resolved?.provider).toBe("google_places");
  expect(typeof resolved?.latitude).toBe("number");
  expect(typeof resolved?.longitude).toBe("number");
  expect(resolved?.placeId).toBeTruthy();
  expect(addressAndTitle).toMatch(/wynwood|miami|florida|fl\b/);
  expect(addressAndTitle).not.toContain("fort lauderdale");
});

function readLocalEnv(name: string) {
  const envPath = join(process.cwd(), ".env.local");

  if (!existsSync(envPath)) {
    return "";
  }

  const line = readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .find((candidate) => candidate.startsWith(`${name}=`));

  if (!line) {
    return "";
  }

  return line.slice(name.length + 1).replace(/^["']|["']$/g, "").trim();
}
