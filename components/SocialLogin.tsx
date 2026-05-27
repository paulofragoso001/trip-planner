"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Provider = "google" | "github" | "facebook";

const providers: {
  alt: string;
  icon: string;
  label: string;
  provider: Provider;
  requiresSetup?: boolean;
}[] = [
  {
    alt: "Google logo",
    icon: "https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg",
    label: "Continue with Google",
    provider: "google"
  },
  {
    alt: "GitHub logo",
    icon: "https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png",
    label: "Continue with GitHub",
    provider: "github"
  },
  {
    alt: "Facebook logo",
    icon: "https://www.svgrepo.com/show/475647/facebook-color.svg",
    label: "Continue with Facebook",
    provider: "facebook",
    requiresSetup: true
  }
];

export function SocialLogin() {
  const [loadingProvider, setLoadingProvider] = useState<Provider | null>(null);
  const [message, setMessage] = useState("");

  const signIn = async (provider: Provider) => {
    if (provider === "facebook" && process.env.NEXT_PUBLIC_FACEBOOK_LOGIN_ENABLED !== "true") {
      setMessage(
        "Facebook login needs a valid Facebook App ID and App Secret enabled in Supabase first."
      );
      return;
    }

    setLoadingProvider(provider);
    setMessage("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    });

    if (error) {
      setMessage(error.message);
      setLoadingProvider(null);
    }
  };

  return (
    <div className="mt-6 space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        {providers.map((item) => (
          <button
            className="flex min-h-12 w-full items-center justify-center gap-3 rounded-lg border border-line bg-white px-4 py-3 text-sm font-bold text-ink transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-11 md:justify-start"
            disabled={loadingProvider !== null}
            key={item.provider}
            onClick={() => signIn(item.provider)}
            type="button"
            title={
              item.requiresSetup
                ? "Enable Facebook in Supabase and set NEXT_PUBLIC_FACEBOOK_LOGIN_ENABLED=true"
                : undefined
            }
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line bg-white">
              <img
                alt={item.alt}
                className="h-4 w-4 object-contain"
                loading="lazy"
                src={item.icon}
              />
            </span>
            <span className="min-w-0 truncate">
              {loadingProvider === item.provider ? "Connecting..." : item.label}
            </span>
          </button>
        ))}
      </div>

      {message ? (
        <p className="break-words rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
          {message}
        </p>
      ) : null}
    </div>
  );
}
