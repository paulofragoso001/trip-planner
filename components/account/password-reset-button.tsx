"use client";
import { useState } from "react";

export function PasswordResetButton() {
  const [pending, setPending] = useState(false); const [message, setMessage] = useState("");
  async function requestReset() {
    setPending(true); setMessage("");
    try { const response = await fetch("/api/account/password-reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }); const result = await response.json(); if (!response.ok) throw new Error(result.error || "Could not request reset email."); setMessage(result.message); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not request reset email."); }
    finally { setPending(false); }
  }
  return <section className="rounded-[1.75rem] border border-line bg-white p-5 shadow-panel"><p className="text-xs font-black uppercase tracking-[0.18em] text-orange-500">Security</p><h2 className="mt-1 text-2xl font-black text-slate-950">Change password</h2><p className="mt-2 text-sm text-slate-600">Request a secure reset link for your verified account email. Password completion happens on Almidy’s web flow.</p><button className="mt-4 rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-50" disabled={pending} onClick={requestReset} type="button">{pending ? "Requesting…" : "Email reset instructions"}</button><p aria-live="polite" className="mt-3 text-xs text-slate-600">{message}</p></section>;
}
