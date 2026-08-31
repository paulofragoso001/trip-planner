"use client";

import { useState } from "react";
import { AlmidyButton } from "@/components/ui/almidy-button";
import { AlmidyInput } from "@/components/ui/almidy-form-control";
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
      <AlmidyInput
        type="email"
        placeholder="Your email"
        className="w-full p-3 text-almidy-body-compact"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />

      <AlmidyButton
        type="button"
        onClick={login}
        disabled={loading}
        className="w-full"
      >
        {loading ? "Sending..." : "Sign in"}
      </AlmidyButton>

      {message ? <p className="text-center text-sm text-slate-600">{message}</p> : null}
    </div>
  );
}
