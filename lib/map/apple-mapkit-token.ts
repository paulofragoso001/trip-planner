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
        console.error("ALMIDY MAPKIT TOKEN FETCH FAILED", { status: response.status });
        return null;
      }

      const payload = (await response.json().catch(() => null)) as AppleMapKitTokenResponse | null;
      const rawToken = typeof payload?.token === "string" ? payload.token : "";
      const token = sanitizeAppleMapKitToken(rawToken);

      if (rawToken && rawToken !== token) {
        console.error("ALMIDY MAPKIT TOKEN SANITIZED: token contained wrapping quotes, spaces, or newline characters.");
      }

      if (!token && rawToken) {
        console.error("ALMIDY MAPKIT TOKEN INVALID: /api/mapkit-token returned an unusable token string.");
      }

      return token || null;
    })
    .catch((error) => {
      console.error("ALMIDY MAPKIT TOKEN REQUEST CRASH:", error);
      return null;
    });

  return appleMapKitTokenPromise;
}

export function clearAppleMapKitTokenCache() {
  appleMapKitTokenPromise = null;
}

export const resetAppleMapKitTokenCacheForTests = clearAppleMapKitTokenCache;

function sanitizeAppleMapKitToken(value: string) {
  return value
    .replace(/\\n/g, "")
    .replace(/[\r\n\t ]+/g, "")
    .replace(/^["']+|["']+$/g, "")
    .trim();
}
