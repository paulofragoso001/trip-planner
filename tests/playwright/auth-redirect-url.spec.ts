import { expect, test } from "@playwright/test";

import {
  getAuthCallbackUrl,
  getCanonicalAppUrl
} from "../../lib/auth/auth-redirect-url";

test("auth callback uses the canonical Almidy app URL", () => {
  withAppUrl("https://almidy.app", () => {
    expect(getAuthCallbackUrl("https://trip-planner-swart-sigma.vercel.app")).toBe(
      "https://almidy.app/auth/callback"
    );
  });
});

test("auth callback normalizes a trailing slash in the canonical app URL", () => {
  withAppUrl("https://almidy.app/", () => {
    expect(getAuthCallbackUrl()).toBe("https://almidy.app/auth/callback");
  });
});

test("auth callback falls back to localhost when no canonical app URL is set", () => {
  withAppUrl(undefined, () => {
    expect(getAuthCallbackUrl("http://localhost:3000")).toBe(
      "http://localhost:3000/auth/callback"
    );
  });
});

test("auth callback rejects non-local runtime origins without canonical config", () => {
  withAppUrl(undefined, () => {
    expect(getAuthCallbackUrl("https://trip-planner-swart-sigma.vercel.app")).toBe(
      "/auth/callback"
    );
  });
});

test("canonical app URL redirects production callbacks back to Almidy", () => {
  withAppUrl("https://almidy.app", () => {
    expect(
      getCanonicalAppUrl(
        "/dashboard",
        "https://trip-planner-swart-sigma.vercel.app/auth/callback"
      ).href
    ).toBe("https://almidy.app/dashboard");
  });
});

function withAppUrl(value: string | undefined, callback: () => void) {
  const originalValue = process.env.NEXT_PUBLIC_APP_URL;

  if (value === undefined) {
    delete process.env.NEXT_PUBLIC_APP_URL;
  } else {
    process.env.NEXT_PUBLIC_APP_URL = value;
  }

  try {
    callback();
  } finally {
    if (originalValue === undefined) {
      delete process.env.NEXT_PUBLIC_APP_URL;
      return;
    }

    process.env.NEXT_PUBLIC_APP_URL = originalValue;
  }
}
