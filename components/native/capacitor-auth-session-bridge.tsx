"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import {
  isNativeCapacitorRuntime,
  NATIVE_AUTH_CALLBACK_URL
} from "@/lib/native/capacitor-runtime";
import { createClient } from "@/lib/supabase/client";

type NativeAuthSessionContract = {
  event: "SIGNED_IN" | "SIGNED_OUT" | "TOKEN_REFRESHED";
  revisionId: number;
  accessToken?: string | null;
  refreshToken?: string | null;
  expiresAt?: number | null;
  userId?: string | null;
  isSignedIn: boolean;
};

interface NativeAuthPlugin {
  addListener(
    eventName: "nativeAuthStateChanged",
    listener: (contract: NativeAuthSessionContract) => void
  ): Promise<PluginListenerHandle>;
  getNativeAuthSession(): Promise<NativeAuthSessionContract>;
  syncNativeAuthSession(options: { jsonString: string }): Promise<{ success: boolean }>;
  clearNativeAuthSession(): Promise<{ success: boolean }>;
}

const NativeAuth = registerPlugin<NativeAuthPlugin>("MapGateway");

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
    let latestNativeRevision = 0;

    function sessionContract(event: AuthChangeEvent, session: Session | null): NativeAuthSessionContract {
      const nativeEvent = event === "TOKEN_REFRESHED" ? "TOKEN_REFRESHED" : event === "SIGNED_OUT" ? "SIGNED_OUT" : "SIGNED_IN";
      return {
        event: nativeEvent,
        revisionId: Date.now(),
        accessToken: session?.access_token ?? null,
        refreshToken: session?.refresh_token ?? null,
        expiresAt: session?.expires_at ?? null,
        userId: session?.user?.id ?? null,
        isSignedIn: Boolean(session?.access_token && session?.refresh_token)
      };
    }

    async function syncNativeSession(contract: NativeAuthSessionContract) {
      if (!isMounted || contract.revisionId < latestNativeRevision) return;
      latestNativeRevision = contract.revisionId;
      if (!contract.isSignedIn || !contract.accessToken || !contract.refreshToken) {
        await supabase.auth.signOut({ scope: "local" });
        return;
      }
      await supabase.auth.setSession({
        access_token: contract.accessToken,
        refresh_token: contract.refreshToken
      });
    }

    async function syncWebSessionToNative(event: AuthChangeEvent, session: Session | null) {
      if (!isMounted) return;
      const contract = sessionContract(event, session);
      latestNativeRevision = Math.max(latestNativeRevision, contract.revisionId);
      try {
        if (contract.event === "SIGNED_OUT") {
          await NativeAuth.clearNativeAuthSession();
        } else if (contract.isSignedIn) {
          await NativeAuth.syncNativeAuthSession({
            jsonString: JSON.stringify(contract)
          });
        }
      } catch (error) {
        console.error("Failed to sync the WebView session to native Keychain storage:", error);
      }
    }

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

    let nativeAuthListener: PluginListenerHandle | null = null;
    NativeAuth.addListener("nativeAuthStateChanged", (contract) => {
      void syncNativeSession(contract);
    }).then((listener) => {
      nativeAuthListener = listener;
    }).catch((error) => {
      console.error("Failed to subscribe to native authentication changes:", error);
    });

    NativeAuth.getNativeAuthSession()
      .then((contract) => syncNativeSession(contract))
      .catch((error) => {
        console.error("Failed to restore the native authentication session:", error);
      });

    const authListener = supabase.auth.onAuthStateChange((event, session) => {
      void syncWebSessionToNative(event, session);
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
      nativeAuthListener?.remove();
      authListener.data.subscription.unsubscribe();
    };
  }, [router]);

  return null;
}
