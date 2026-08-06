"use client";
import { useCallback, useEffect, useState } from "react";
import type { UserPreferences, UserPreferencesResponse } from "@/lib/user-preferences";
export function useUserPreferences() {
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [error, setError] = useState(false); const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => { setLoading(true); setError(false); try { const response = await fetch("/api/user-preferences", { cache: "no-store" }); if (!response.ok) throw new Error("load failed"); const result = await response.json() as UserPreferencesResponse; setPreferences(result.preferences); } catch { setError(true); } finally { setLoading(false); } }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  return { error, loading, preferences, refresh };
}
