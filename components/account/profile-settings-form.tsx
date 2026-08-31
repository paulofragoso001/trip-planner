"use client";

import { FormEvent, useState } from "react";
import type { AccountProfileResponse } from "@/lib/account/contracts";
import { AlmidyButton } from "@/components/ui/almidy-button";
import { almidyCardClassName } from "@/components/ui/almidy-card";
import { AlmidyInput } from "@/components/ui/almidy-form-control";

export function ProfileSettingsForm({ initialDisplayName }: { initialDisplayName: string }) {
  const [name, setName] = useState(initialDisplayName);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setStatus("");
    try {
      const response = await fetch("/api/account/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ displayName: name }) });
      const result = await response.json() as AccountProfileResponse & { error?: string };
      if (!response.ok && response.status !== 202) throw new Error(result.error || "Could not save profile.");
      setName(result.profile.displayName);
      setStatus(result.synchronization === "synchronized" ? "Profile saved." : "Name saved. Account metadata will be reconciled on a later update.");
      window.dispatchEvent(new CustomEvent("almidy:profile-updated", { detail: result.profile }));
    } catch (error) { setStatus(error instanceof Error ? error.message : "Could not save profile."); }
    finally { setSaving(false); }
  }

  return <form className={almidyCardClassName} onSubmit={submit}><p className="text-xs font-black uppercase tracking-[0.18em] text-orange-500">Profile</p><h2 className="mt-1 text-2xl font-black text-slate-950">Display name</h2><p className="mt-2 text-sm text-slate-600">This name is used consistently in your account, menu, and trip collaboration.</p><label className="mt-4 grid gap-2"><span className="text-sm font-bold">Name</span><AlmidyInput autoComplete="name" maxLength={80} minLength={2} onChange={(event) => setName(event.target.value)} required value={name}/></label><div className="mt-4 flex items-center gap-3"><AlmidyButton disabled={saving} size="compact" type="submit" variant="neutral">{saving ? "Saving…" : "Save name"}</AlmidyButton><p aria-live="polite" className="text-xs text-slate-600">{status}</p></div></form>;
}
