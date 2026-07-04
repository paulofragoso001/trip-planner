"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  isNativeCapacitorRuntime,
  NATIVE_AUTH_CALLBACK_URL
} from "@/lib/native/capacitor-runtime";
import { createClient } from "@/lib/supabase/client";

const NATIVE_SESSION_STORAGE_KEY = "almidy_auth_session";

type StoredNativeSession = {
  access_token?: string;
  refresh_token?: string;
};

function parseStoredNativeSession(value: string | null) {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as StoredNativeSession;
    if (
      typeof parsed.access_token === "string" &&
      parsed.access_token.length > 0 &&
      typeof parsed.refresh_token === "string" &&
      parsed.refresh_token.length > 0
    ) {
      return {
        access_token: parsed.access_token,
        refresh_token: parsed.refresh_token
      };
    }
  } catch {
    return null;
  }

  return null;
}

function isNativeAuthCallbackUrl(url: string) {
  return url.startsWith(NATIVE_AUTH_CALLBACK_URL);
}

export function CapacitorAuthSessionBridge() {
  const router = useRouter();

  useEffect(() => {
    if (!isNativeCapacitorRuntime()) return;

    let isMounted = true;
    const supabase = createClient();
    const listenerCleanups: Array<() => void> = [];

    async function handleNativeAuthCallback(url: string) {
      if (!isNativeAuthCallbackUrl(url)) return;

      const callbackUrl = new URL(url);
      const error = callbackUrl.searchParams.get("error");
      const errorDescription = callbackUrl.searchParams.get("error_description");
      const code = callbackUrl.searchParams.get("code");
      const { Browser } = await import("@capacitor/browser");

      await Browser.close().catch(() => undefined);

      if (error) {
        const message = errorDescription || `OAuth login failed: ${error}`;
        router.replace(`/login?message=${encodeURIComponent(message)}`);
        return;
      }

      if (!code) {
        router.replace(
          `/login?message=${encodeURIComponent("OAuth callback was missing a code.")}`
        );
        return;
      }

      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

      if (exchangeError) {
        router.replace(`/login?message=${encodeURIComponent(exchangeError.message)}`);
        return;
      }

      router.replace("/dashboard");
    }

    async function hydrateNativeSession() {
      const { Preferences } = await import("@capacitor/preferences");
      const { value } = await Preferences.get({ key: NATIVE_SESSION_STORAGE_KEY });
      const storedSession = parseStoredNativeSession(value);

      if (!isMounted) return;

      if (!storedSession) {
        if (value) {
          await Preferences.remove({ key: NATIVE_SESSION_STORAGE_KEY });
        }
        return;
      }

      const { error } = await supabase.auth.setSession(storedSession);
      if (error) {
        await Preferences.remove({ key: NATIVE_SESSION_STORAGE_KEY });
      }
    }

    const authListener = supabase.auth.onAuthStateChange(async (_event, session) => {
      const { Preferences } = await import("@capacitor/preferences");

      if (session?.access_token && session.refresh_token) {
        await Preferences.set({
          key: NATIVE_SESSION_STORAGE_KEY,
          value: JSON.stringify({
            access_token: session.access_token,
            refresh_token: session.refresh_token
          })
        });
        return;
      }

      await Preferences.remove({ key: NATIVE_SESSION_STORAGE_KEY });
    });

    hydrateNativeSession().catch(async () => {
      const { Preferences } = await import("@capacitor/preferences");
      await Preferences.remove({ key: NATIVE_SESSION_STORAGE_KEY });
    });

    async function registerNativeDeepLinkListener() {
      const { App } = await import("@capacitor/app");
      const appUrlOpenListener = await App.addListener("appUrlOpen", ({ url }) => {
        handleNativeAuthCallback(url).catch(() => undefined);
      });
      listenerCleanups.push(() => {
        appUrlOpenListener.remove();
      });

      const launchUrl = await App.getLaunchUrl();
      if (launchUrl?.url) {
        await handleNativeAuthCallback(launchUrl.url);
      }
    }

    registerNativeDeepLinkListener().catch(() => undefined);

    return () => {
      isMounted = false;
      listenerCleanups.forEach((cleanup) => cleanup());
      authListener.data.subscription.unsubscribe();
    };
  }, [router]);

  return null;
}
