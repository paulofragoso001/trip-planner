"use client";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function ResetPasswordForm() {
  const [password, setPassword] = useState(""); const [confirmation, setConfirmation] = useState(""); const [message, setMessage] = useState(""); const [pending, setPending] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password.length < 10) { setMessage("Use at least 10 characters."); return; }
    if (password !== confirmation) { setMessage("Passwords do not match."); return; }
    setPending(true); setMessage("");
    const { error } = await createClient().auth.updateUser({ password });
    setMessage(error ? "The reset link is invalid or expired. Request a new email from Account Settings." : "Password updated. You can return to Almidy and sign in.");
    setPending(false);
  }
  return <form className="mt-6 grid gap-4" onSubmit={submit}><label className="grid gap-2 text-sm font-bold">New password<input autoComplete="new-password" className="min-h-11 rounded-xl border border-almidy-border-subtle px-3" minLength={10} onChange={(event) => setPassword(event.target.value)} required type="password" value={password}/></label><label className="grid gap-2 text-sm font-bold">Confirm password<input autoComplete="new-password" className="min-h-11 rounded-xl border border-almidy-border-subtle px-3" minLength={10} onChange={(event) => setConfirmation(event.target.value)} required type="password" value={confirmation}/></label><button className="rounded-xl bg-slate-950 px-4 py-3 font-bold text-white disabled:opacity-50" disabled={pending} type="submit">{pending ? "Updating…" : "Update password"}</button><p aria-live="polite" className="text-sm text-slate-600">{message}</p></form>;
}
