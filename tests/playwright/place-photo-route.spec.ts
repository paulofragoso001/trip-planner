import { expect, test } from "@playwright/test";

const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:3000";

test("place photo proxy rejects invalid references without exposing provider keys", async ({ request }) => {
  const response = await request.get(
    `${baseUrl}/api/travel-data/place-photo?photoName=https://example.com/not-google&maxWidth=9000`
  );

  expect(response.status()).toBe(400);
  const body = await response.text();
  expect(body).toContain("Invalid place photo reference");
  expect(body).not.toMatch(/GOOGLE_|AIza|key=/i);
});
