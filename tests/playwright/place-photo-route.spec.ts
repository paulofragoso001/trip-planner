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

test("place photo proxy accepts Google-shaped photo names without exposing provider keys", async ({ request }) => {
  const response = await request.get(
    `${baseUrl}/api/travel-data/place-photo?photoName=places/ChIJN1t_tDeuEmsRUsoyG83frY4/photos/ATKogpeExamplePhotoName&maxWidth=9000`
  );

  expect([200, 502, 503]).toContain(response.status());
  const body = await response.text();
  expect(body).not.toMatch(/GOOGLE_|AIza|key=/i);
});

test("place photo proxy accepts legacy Google photo references without exposing provider keys", async ({ request }) => {
  const response = await request.get(
    `${baseUrl}/api/travel-data/place-photo?photoReference=AeJbb3d_example-photo_reference-1234567890&maxWidth=640`
  );

  expect([200, 502, 503]).toContain(response.status());
  const body = await response.text();
  expect(body).not.toMatch(/GOOGLE_|AIza|key=/i);
});
