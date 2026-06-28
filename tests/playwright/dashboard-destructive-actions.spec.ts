import { expect, test } from "@playwright/test";

const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const sameOriginHeaders = { "sec-fetch-site": "same-origin" };

test.describe("dashboard destructive action boundaries", () => {
  test("cross-site destructive requests are blocked before auth", async ({ request }) => {
    const crossSiteHeaders = { origin: "https://evil.example" };

    const tripSegmentDelete = await request.delete(
      `${baseUrl}/api/trip-segments/00000000-0000-4000-8000-000000000001`,
      { headers: crossSiteHeaders }
    );
    expect(tripSegmentDelete.status()).toBe(403);

    const budgetDelete = await request.delete(
      `${baseUrl}/api/budget-records/00000000-0000-4000-8000-000000000001`,
      { headers: crossSiteHeaders }
    );
    expect(budgetDelete.status()).toBe(403);

    const calendarDisconnect = await request.delete(`${baseUrl}/api/calendar/connections`, {
      data: { confirmDisconnect: true, provider: "google" },
      headers: crossSiteHeaders
    });
    expect(calendarDisconnect.status()).toBe(403);

    const accountDeletion = await request.post(`${baseUrl}/api/account/deletion-request`, {
      data: { confirmDeletion: true },
      headers: crossSiteHeaders
    });
    expect(accountDeletion.status()).toBe(403);
  });

  test("destructive payloads require explicit confirmation and reject drift", async ({ request }) => {
    const importDisconnectWithoutConfirm = await request.patch(
      `${baseUrl}/api/import-sources`,
      {
        data: {
          connected: false,
          sourceLabel: "Outlook inbox sync",
          sourceType: "outlook"
        },
        headers: sameOriginHeaders
      }
    );
    expect(importDisconnectWithoutConfirm.status()).toBe(400);
    expect(await importDisconnectWithoutConfirm.json()).toMatchObject({
      error: expect.objectContaining({
        details: expect.objectContaining({
          confirmDisconnect: expect.stringContaining("requires confirmation")
        })
      })
    });

    const importDisconnectUnknownField = await request.patch(`${baseUrl}/api/import-sources`, {
      data: {
        connected: false,
        confirmDisconnect: true,
        sourceLabel: "Outlook inbox sync",
        sourceType: "outlook",
        userId: "client-controlled"
      },
      headers: sameOriginHeaders
    });
    expect(importDisconnectUnknownField.status()).toBe(400);

    const calendarWithoutConfirm = await request.delete(`${baseUrl}/api/calendar/connections`, {
      data: { provider: "google" },
      headers: sameOriginHeaders
    });
    expect(calendarWithoutConfirm.status()).toBe(400);
    expect(await calendarWithoutConfirm.json()).toMatchObject({
      error: expect.objectContaining({
        details: expect.objectContaining({
          confirmDisconnect: expect.stringContaining("requires confirmation")
        })
      })
    });

    const calendarUnknownField = await request.delete(`${baseUrl}/api/calendar/connections`, {
      data: {
        confirmDisconnect: true,
        provider: "google",
        userId: "client-controlled"
      },
      headers: sameOriginHeaders
    });
    expect(calendarUnknownField.status()).toBe(400);

    const accountWithoutConfirm = await request.post(`${baseUrl}/api/account/deletion-request`, {
      data: { reason: "Testing missing confirmation." },
      headers: sameOriginHeaders
    });
    expect(accountWithoutConfirm.status()).toBe(400);
    expect(await accountWithoutConfirm.json()).toMatchObject({
      error: expect.objectContaining({
        details: expect.objectContaining({
          confirmDeletion: expect.stringMatching(/require confirmation/i)
        })
      })
    });

    const accountWithoutPhrase = await request.post(`${baseUrl}/api/account/deletion-request`, {
      data: {
        confirmDeletion: true,
        reason: "Testing missing typed phrase."
      },
      headers: sameOriginHeaders
    });
    expect(accountWithoutPhrase.status()).toBe(400);
    expect(await accountWithoutPhrase.json()).toMatchObject({
      error: expect.objectContaining({
        details: expect.objectContaining({
          confirmationPhrase: expect.stringMatching(/DELETE MY ACCOUNT/)
        })
      })
    });

    const accountUnknownField = await request.post(`${baseUrl}/api/account/deletion-request`, {
      data: {
        confirmDeletion: true,
        confirmationPhrase: "DELETE MY ACCOUNT",
        reason: "Testing unknown field rejection.",
        userId: "client-controlled"
      },
      headers: sameOriginHeaders
    });
    expect(accountUnknownField.status()).toBe(400);
  });
});
