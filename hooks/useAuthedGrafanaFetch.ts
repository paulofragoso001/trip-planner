"use client";

import { useCallback, useRef } from "react";

type RefreshState = Promise<void> | null;

export function useAuthedGrafanaFetch() {
  const refreshingRef = useRef<RefreshState>(null);

  const refreshSession = useCallback(async () => {
    if (!refreshingRef.current) {
      refreshingRef.current = fetch("/api/auth/refresh", {
        method: "POST"
      })
        .then(async (response) => {
          if (!response.ok) {
            const message = await response.text();
            throw new Error(message || "Session refresh failed.");
          }
        })
        .finally(() => {
          refreshingRef.current = null;
        });
    }

    return refreshingRef.current;
  }, []);

  return useCallback(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const firstResponse = await fetch(input, init);
      if (firstResponse.status !== 401) return firstResponse;

      await refreshSession();
      return fetch(input, init);
    },
    [refreshSession]
  );
}
