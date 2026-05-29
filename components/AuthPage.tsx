"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type AuthPageProps = {
  message?: string;
};

export default function AuthPage({ message }: AuthPageProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState(message || "");
  const [loading, setLoading] = useState<"google" | "facebook" | "email" | null>(
    null
  );

  const redirectTo =
    typeof window !== "undefined"
      ? `${window.location.origin}/auth/callback`
      : undefined;

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        router.replace("/dashboard");
      }
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        router.replace("/dashboard");
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router, supabase]);

  const signInWithGoogle = async () => {
    setLoading("google");
    setStatus("");

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo }
    });

    if (error) {
      setStatus(error.message);
      setLoading(null);
    }
  };

  const signInWithFacebook = async () => {
    if (process.env.NEXT_PUBLIC_FACEBOOK_LOGIN_ENABLED !== "true") {
      setStatus(
        "Facebook login is not available yet. Use Google or email to continue."
      );
      return;
    }

    setLoading("facebook");
    setStatus("");

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "facebook",
      options: { redirectTo }
    });

    if (error) {
      setStatus(error.message);
      setLoading(null);
    }
  };

  const signInWithEmail = async () => {
    if (!email.trim()) {
      setStatus("Enter your email first.");
      return;
    }

    setLoading("email");
    setStatus("");

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: redirectTo
      }
    });

    if (error) {
      setStatus(error.message);
      setLoading(null);
      return;
    }

    setStatus("Check your email for the login link.");
    setLoading(null);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 to-gray-200 px-4 py-8 sm:px-6">
      <section className="animate-fade-in w-full max-w-md rounded-2xl border border-gray-200 bg-white/80 p-6 shadow-xl backdrop-blur-xl sm:p-8">
        <div className="mb-6 text-center">
          <div className="text-2xl font-semibold tracking-tight text-ink">
            Wayline
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Turn saved travel ideas into real trip plans.
          </p>
        </div>

        <div className="space-y-3">
          <button
            className="flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-gray-300 bg-white py-3 text-sm font-medium shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={loading !== null}
            onClick={signInWithGoogle}
            type="button"
          >
            <img
              alt="Google logo"
              className="h-5 w-5"
              loading="lazy"
              src="https://www.svgrepo.com/show/475656/google-color.svg"
            />
            {loading === "google" ? "Connecting..." : "Continue with Google"}
          </button>

          {process.env.NEXT_PUBLIC_FACEBOOK_LOGIN_ENABLED === "true" && (
            <button
              className="flex min-h-12 w-full items-center justify-center gap-3 rounded-xl bg-[#1877F2] py-3 text-sm font-medium text-white transition hover:bg-[#166fe5] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={loading !== null}
              onClick={signInWithFacebook}
              type="button"
            >
              <img
                alt="Facebook logo"
                className="h-5 w-5 rounded-full bg-white"
                loading="lazy"
                src="https://www.svgrepo.com/show/475647/facebook-color.svg"
              />
              {loading === "facebook" ? "Connecting..." : "Continue with Facebook"}
            </button>
          )}
        </div>

        <div className="my-6 flex items-center">
          <div className="h-px flex-1 bg-gray-300" />
          <span className="px-3 text-xs text-gray-500">or</span>
          <div className="h-px flex-1 bg-gray-300" />
        </div>

        <div className="space-y-3">
          <label htmlFor="email">
            Email
            <input
              autoComplete="email"
              id="email"
              name="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              type="email"
              value={email}
            />
          </label>

          <button
            className="min-h-12 w-full rounded-xl bg-black py-3 text-sm font-medium text-white transition hover:bg-gray-900 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={loading !== null}
            onClick={signInWithEmail}
            type="button"
          >
            {loading === "email" ? "Sending..." : "Continue with Email"}
          </button>
        </div>

        {status ? (
          <p className="mt-4 break-words rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-center text-sm font-semibold text-slate-700">
            {status}
          </p>
        ) : null}

        <p className="mt-6 text-center text-xs text-gray-400">
          By continuing, you agree to our Terms and Privacy Policy.
        </p>

        <p className="mt-4 text-center text-sm text-slate-600">
          New to Wayline?{" "}
          <Link className="font-bold text-brand hover:underline" href="/signup">
            Create an account
          </Link>
        </p>
      </section>
    </main>
  );
}
