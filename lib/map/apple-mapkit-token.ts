type AppleMapKitTokenResponse = {
  token?: unknown;
};

let appleMapKitTokenPromise: Promise<string | null> | null = null;

export function loadAppleMapKitToken() {
  if (appleMapKitTokenPromise) {
    return appleMapKitTokenPromise;
  }

  appleMapKitTokenPromise = fetch("/api/mapkit-token", {
    cache: "no-store",
    headers: { Accept: "application/json" }
  })
    .then(async (response) => {
      if (!response.ok) {
        return null;
      }

      const payload = (await response.json().catch(() => null)) as AppleMapKitTokenResponse | null;
      const token = typeof payload?.token === "string" ? payload.token.trim() : "";
      return token || null;
    })
    .catch(() => null);

  return appleMapKitTokenPromise;
}

export function resetAppleMapKitTokenCacheForTests() {
  appleMapKitTokenPromise = null;
}
