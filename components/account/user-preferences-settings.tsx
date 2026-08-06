"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { currencyLabels, distanceLabels, supportedCurrencyCodes, supportedDistanceUnits, type UserPreferences, type UserPreferencesResponse } from "@/lib/user-preferences";

type PreferenceField = keyof UserPreferences;
export function UserPreferencesSettings({ compact = false }: { compact?: boolean }) {
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"loading" | "idle" | "saving" | "saved" | "error">("loading");
  const latest = useRef<UserPreferences | null>(null);
  const versions = useRef<Record<PreferenceField, number>>({ default_currency: 0, distance_unit: 0 });
  const hydrate = useCallback(async () => {
    setStatus("loading"); setMessage("");
    try {
      const response = await fetch("/api/user-preferences", { cache: "no-store" });
      if (!response.ok) throw new Error("load failed");
      const result = await response.json() as UserPreferencesResponse;
      latest.current = result.preferences; setPreferences(result.preferences); setStatus("idle");
    } catch { setStatus("error"); setMessage("Could not load currency and distance preferences."); }
  }, []);
  useEffect(() => { void hydrate(); }, [hydrate]);

  async function update<K extends PreferenceField>(field: K, value: UserPreferences[K]) {
    const previous = latest.current; if (!previous) return;
    const version = ++versions.current[field];
    latest.current = { ...previous, [field]: value }; setPreferences(latest.current); setStatus("saving"); setMessage("Saving…");
    try {
      const response = await fetch("/api/user-preferences", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [field]: value }) });
      if (!response.ok) throw new Error("save failed");
      const result = await response.json() as UserPreferencesResponse;
      if (versions.current[field] !== version) return;
      latest.current = { ...latest.current!, [field]: result.preferences[field] }; setPreferences(latest.current); setStatus("saved"); setMessage("Saved");
    } catch {
      if (versions.current[field] !== version) return;
      latest.current = { ...latest.current!, [field]: previous[field] }; setPreferences(latest.current); setStatus("error"); setMessage("Could not save. Your change was rolled back.");
    }
  }

  const shell = compact ? "bg-white px-5 py-4" : "rounded-[1.75rem] border border-line bg-white p-5 shadow-panel";
  if (status === "loading") return <section className={shell} aria-label="Travel preferences"><p aria-live="polite" className="text-sm text-slate-500">Loading saved travel preferences…</p></section>;
  if (!preferences) return <section className={shell} aria-label="Travel preferences"><p role="alert" className="text-sm text-red-700">{message} <button className="font-bold underline" onClick={() => void hydrate()} type="button">Try again</button></p></section>;
  return <section className={shell} aria-labelledby={compact ? undefined : "travel-preferences-title"} aria-label={compact ? "Travel preferences" : undefined}>
    {compact ? null : <><p className="text-xs font-black uppercase tracking-[0.18em] text-orange-500">Preferences</p><h2 className="mt-1 text-2xl font-black text-slate-950" id="travel-preferences-title">Currency and distance</h2><p className="mt-2 text-sm text-slate-600">Defaults apply to new records and displayed distances. Existing money is never converted.</p></>}
    <div className={compact ? "grid gap-4" : "mt-4 grid gap-4 sm:grid-cols-2"}>
      <label className="grid gap-2 text-sm font-bold text-slate-950">Default currency<select aria-label="Default currency" className="min-h-11 rounded-xl border border-line bg-white px-3" onChange={(event) => void update("default_currency", event.target.value as UserPreferences["default_currency"])} value={preferences.default_currency}>{supportedCurrencyCodes.map((code) => <option key={code} value={code}>{currencyLabels[code]}</option>)}</select></label>
      <label className="grid gap-2 text-sm font-bold text-slate-950">Distance unit<select aria-label="Distance unit" className="min-h-11 rounded-xl border border-line bg-white px-3" onChange={(event) => void update("distance_unit", event.target.value as UserPreferences["distance_unit"])} value={preferences.distance_unit}>{supportedDistanceUnits.map((unit) => <option key={unit} value={unit}>{distanceLabels[unit]}</option>)}</select></label>
    </div>
    <p aria-live="polite" className={`mt-3 min-h-5 text-xs font-semibold ${status === "error" ? "text-red-700" : "text-slate-500"}`}>{message}</p>
  </section>;
}
