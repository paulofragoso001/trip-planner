"use client";

import type { ReactNode } from "react";
import { useState } from "react";

type NotificationPreferences = {
  email_comments: boolean;
  inapp_comments: boolean;
  email_mentions?: boolean;
  inapp_mentions?: boolean;
};

type NotificationSettingsProps = {
  prefs: NotificationPreferences;
  user: {
    id: string;
  };
};

export default function NotificationSettings({
  prefs,
  user
}: NotificationSettingsProps) {
  const [settings, setSettings] = useState(prefs);

  const update = async (field: keyof NotificationPreferences, value: boolean) => {
    const previous = settings;
    const next = { ...settings, [field]: value };

    setSettings(next);

    const res = await fetch("/api/preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: user.id,
        [field]: value
      })
    });

    if (!res.ok) {
      setSettings(previous);
    }
  };

  return (
    <div className="mt-8 max-w-xl space-y-5 rounded-xl border border-line bg-white p-5 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold text-ink">Notifications</h2>
        <p className="mt-1 text-sm text-slate-500">
          Choose how you want to be notified when someone interacts with your trips.
        </p>
      </div>

      <NotificationGroup title="Email">
        <PreferenceToggle
          checked={settings.email_comments}
          description="Receive an email when someone comments on one of your trip items."
          label="Comments"
          onChange={(value) => update("email_comments", value)}
        />
      </NotificationGroup>

      <NotificationGroup title="In-app">
        <PreferenceToggle
          checked={settings.inapp_comments}
          description="Show live dashboard notifications for new comments."
          label="Comments"
          onChange={(value) => update("inapp_comments", value)}
        />
      </NotificationGroup>
    </div>
  );
}

function NotificationGroup({
  children,
  title
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <section className="space-y-3 border-t border-line pt-4">
      <h3 className="text-sm font-bold text-ink">{title}</h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function PreferenceToggle({
  checked,
  description,
  label,
  onChange
}: {
  checked: boolean;
  description: string;
  label: string;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-4 text-sm text-ink">
      <span>
        <span className="block font-medium">{label}</span>
        <span className="mt-0.5 block text-xs leading-5 text-slate-500">
          {description}
        </span>
      </span>
      <input
        checked={checked}
        className="peer sr-only"
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
      <span className="relative h-6 w-11 shrink-0 rounded-full bg-slate-200 transition peer-checked:bg-black">
        <span className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow-sm transition peer-checked:translate-x-5" />
      </span>
    </label>
  );
}
