"use client";

import { useState } from "react";
import { getAuthCallbackUrl } from "@/lib/auth/auth-redirect-url";
import { createClient } from "@/lib/supabase/client";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function login() {
    if (!email.trim()) {
      setMessage("Enter your email first.");
      return;
    }

    setLoading(true);
    setMessage("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: getAuthCallbackUrl(window.location.origin)
      }
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    setMessage("Check your email for login link.");
    setLoading(false);
  }

  return (
    <div className="mx-auto mt-6 w-full max-w-sm space-y-3">
      <input
        type="email"
        placeholder="Your email"
        className="w-full rounded-lg border border-line p-3"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />

      <button
        type="button"
        onClick={login}
        disabled={loading}
        className="min-h-11 w-full rounded-lg bg-black px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Sending..." : "Sign in"}
      </button>

      {message ? <p className="text-center text-sm text-slate-600">{message}</p> : null}
    </div>
  );
}
