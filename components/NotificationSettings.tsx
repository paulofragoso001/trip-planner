"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  notificationPreferenceFields,
  type NotificationPreferenceField,
  type NotificationPreferences,
  type NotificationPreferencesResponse
} from "@/lib/account/contracts";

export default function NotificationSettings() {
  const [settings, setSettings] = useState<NotificationPreferences | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "saving" | "saved" | "error">("loading");
  const [message, setMessage] = useState("");
  const intentVersion = useRef(0);
  const latestSettings = useRef<NotificationPreferences | null>(null);

  const hydrate = useCallback(async () => {
    const hydrationVersion = ++intentVersion.current;
    setStatus("loading");
    setMessage("");
    try {
      const response = await fetch("/api/preferences", { cache: "no-store" });
      if (!response.ok) throw new Error("load failed");
      const result = (await response.json()) as NotificationPreferencesResponse;
      if (intentVersion.current !== hydrationVersion) return;
      latestSettings.current = result.preferences;
      setSettings(result.preferences);
      setStatus("idle");
    } catch {
      if (intentVersion.current !== hydrationVersion) return;
      setStatus("error");
      setMessage("Could not load notification settings.");
    }
  }, []);

  useEffect(() => { void hydrate(); }, [hydrate]);

  async function update(field: NotificationPreferenceField, value: boolean) {
    const previous = latestSettings.current;
    if (!previous) return;
    const version = ++intentVersion.current;
    const next = { ...previous, [field]: value };
    latestSettings.current = next;
    setSettings(next);
    setStatus("saving");
    setMessage("Saving…");

    try {
      const response = await fetch("/api/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value })
      });
      if (!response.ok) throw new Error("save failed");
      const result = (await response.json()) as NotificationPreferencesResponse;
      if (intentVersion.current !== version) return;
      latestSettings.current = result.preferences;
      setSettings(result.preferences);
      setStatus("saved");
      setMessage("Saved");
    } catch {
      if (intentVersion.current !== version) return;
      latestSettings.current = previous;
      setSettings(previous);
      setStatus("error");
      setMessage("Could not save. Your change was rolled back.");
    }
  }

  if (status === "loading") {
    return <NotificationShell><p aria-live="polite" className="text-sm text-slate-500">Loading saved notification settings…</p></NotificationShell>;
  }

  if (!settings) {
    return (
      <NotificationShell>
        <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-red-700">
          <span>{message}</span>
          <button className="font-bold underline" onClick={() => void hydrate()} type="button">Try again</button>
        </div>
      </NotificationShell>
    );
  }

  return (
    <NotificationShell>
      <p aria-live="polite" className={`min-h-5 text-xs font-semibold ${status === "error" ? "text-red-700" : "text-slate-500"}`}>{message}</p>
      <NotificationGroup title="Email">
        <PreferenceToggle ariaLabel="Email Comments notifications" checked={settings.email_comments} description="Email me when someone comments on my trip." label="Comments" onChange={(value) => update("email_comments", value)} />
        <PreferenceToggle ariaLabel="Email Mentions notifications" checked={settings.email_mentions} description="Email me when someone mentions me." label="Mentions" onChange={(value) => update("email_mentions", value)} />
      </NotificationGroup>
      <NotificationGroup title="In-app">
        <PreferenceToggle ariaLabel="In-app Comments notifications" checked={settings.inapp_comments} description="Show an in-app notification for comments." label="Comments" onChange={(value) => update("inapp_comments", value)} />
        <PreferenceToggle ariaLabel="In-app Mentions notifications" checked={settings.inapp_mentions} description="Show an in-app notification for mentions." label="Mentions" onChange={(value) => update("inapp_mentions", value)} />
      </NotificationGroup>
    </NotificationShell>
  );
}

function NotificationShell({ children }: { children: ReactNode }) {
  return <section aria-labelledby="notification-settings-title" className="rounded-[1.75rem] border border-almidy-border-subtle bg-white p-5 shadow-panel" id="notifications"><p className="text-xs font-black uppercase tracking-[0.18em] text-orange-500">Preferences</p><h2 className="mt-1 text-2xl font-black text-slate-950" id="notification-settings-title">Notifications</h2><p className="mb-4 mt-2 text-sm text-slate-600">Choose how Almidy contacts you about trip comments and mentions.</p>{children}</section>;
}

function NotificationGroup({ children, title }: { children: ReactNode; title: string }) {
  return <fieldset className="mt-4 space-y-3 border-t border-almidy-border-subtle pt-4"><legend className="text-sm font-bold text-almidy-text-primary">{title}</legend>{children}</fieldset>;
}

function PreferenceToggle({ ariaLabel, checked, description, label, onChange }: { ariaLabel: string; checked: boolean; description: string; label: string; onChange: (value: boolean) => void }) {
  return <label className="flex min-h-12 cursor-pointer items-center justify-between gap-4 text-sm text-almidy-text-primary"><span><span className="block font-medium">{label}</span><span className="mt-0.5 block text-xs leading-5 text-slate-500">{description}</span></span><input aria-label={ariaLabel} checked={checked} className="peer sr-only" onChange={(event) => onChange(event.target.checked)} type="checkbox"/><span aria-hidden="true" className="relative h-6 w-11 shrink-0 rounded-full bg-slate-200 transition peer-checked:bg-black peer-focus-visible:ring-4 peer-focus-visible:ring-orange-300/40"><span className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow-sm transition peer-checked:translate-x-5" /></span></label>;
}

export { notificationPreferenceFields };
