"use client";
import { useState } from "react";
import { AlmidyButton } from "@/components/ui/almidy-button";
import { AlmidyCard } from "@/components/ui/almidy-card";

export function PasswordResetButton() {
  const [pending, setPending] = useState(false); const [message, setMessage] = useState("");
  async function requestReset() {
    setPending(true); setMessage("");
    try { const response = await fetch("/api/account/password-reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }); const result = await response.json(); if (!response.ok) throw new Error(result.error || "Could not request reset email."); setMessage(result.message); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not request reset email."); }
    finally { setPending(false); }
  }
  return <AlmidyCard><p className="text-xs font-black uppercase tracking-[0.18em] text-orange-500">Security</p><h2 className="mt-1 text-2xl font-black text-slate-950">Change password</h2><p className="mt-2 text-sm text-slate-600">Request a secure reset link for your verified account email. Password completion happens on Almidy’s web flow.</p><AlmidyButton className="mt-4" disabled={pending} onClick={requestReset} size="compact" type="button" variant="neutral">{pending ? "Requesting…" : "Email reset instructions"}</AlmidyButton><p aria-live="polite" className="mt-3 text-xs text-slate-600">{message}</p></AlmidyCard>;
}
