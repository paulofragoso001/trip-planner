"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import {
  isNativeCapacitorRuntime,
  NATIVE_AUTH_CALLBACK_URL
} from "@/lib/native/capacitor-runtime";
import {
  NativeAuthEchoGuard,
  nativeEventForAuthChange,
  sessionIdentity,
  sessionsLogicallyEqual,
  type NativeSessionIdentity
} from "@/lib/native/auth-session-reconciliation";
import { createClient } from "@/lib/supabase/client";

type NativeAuthSessionContract = {
  event: "SIGNED_IN" | "SIGNED_OUT" | "TOKEN_REFRESHED";
  revisionId: number;
  state: "missing" | "valid" | "expired" | "invalid" | "explicitly_signed_out";
  accessToken?: string | null;
  refreshToken?: string | null;
  expiresAt?: number | null;
  signOutGeneration?: number | null;
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

function safeNativeAuthErrorCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return "unknown";
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" && /^[a-z0-9_-]{1,64}$/i.test(code) ? code : "unknown";
}

function reportNativeAuthBridgeFailure(operation: string, error: unknown) {
  console.error("Native authentication bridge operation failed.", {
    operation,
    code: safeNativeAuthErrorCode(error)
  });
}

export function CapacitorAuthSessionBridge() {
  const router = useRouter();

  useEffect(() => {
    if (!isNativeCapacitorRuntime()) return;

    let isMounted = true;
    const supabase = createClient();
    supabase.auth.stopAutoRefresh();
    const listenerCleanups: Array<() => void> = [];
    let latestNativeRevision = 0;
    let isApplyingNativeState = false;
    const echoGuard = new NativeAuthEchoGuard();

    function sessionContract(
      event: AuthChangeEvent,
      session: Session | null,
      revisionId: number
    ): NativeAuthSessionContract {
      const nativeEvent = nativeEventForAuthChange(event);
      return {
        event: nativeEvent,
        revisionId,
        state: nativeEvent === "SIGNED_OUT" ? "explicitly_signed_out" : session ? "valid" : "missing",
        accessToken: session?.access_token ?? null,
        refreshToken: session?.refresh_token ?? null,
        expiresAt: session?.expires_at ?? null,
        isSignedIn: Boolean(session?.access_token && session?.refresh_token)
      };
    }

    async function syncNativeSession(contract: NativeAuthSessionContract) {
      if (!isMounted || contract.revisionId < latestNativeRevision) return;
      latestNativeRevision = contract.revisionId;
      if (contract.state === "missing" || contract.state === "invalid") {
        echoGuard.observeNative(null);
        return;
      }
      isApplyingNativeState = true;
      try {
        if (contract.state === "explicitly_signed_out" || contract.event === "SIGNED_OUT") {
          echoGuard.observeNative(null);
          await supabase.auth.signOut({ scope: "local" });
          return;
        }
        if (
          !contract.isSignedIn
          || !contract.accessToken
          || !contract.refreshToken
          || !contract.expiresAt
        ) return;
        const nativeIdentity: NativeSessionIdentity = {
          accessToken: contract.accessToken,
          refreshToken: contract.refreshToken,
          expiresAt: contract.expiresAt
        };
        const { data: currentData } = await supabase.auth.getSession();
        const currentIdentity = sessionIdentity(currentData.session);
        echoGuard.observeNative(nativeIdentity);
        if (!echoGuard.shouldApplyNative(currentIdentity, nativeIdentity)) return;
        echoGuard.beginNativeApplication(nativeIdentity);
        const { data, error } = await supabase.auth.setSession({
          access_token: contract.accessToken,
          refresh_token: contract.refreshToken
        });
        if (error) {
          echoGuard.cancelNativeApplication();
          throw error;
        }
        const appliedIdentity = sessionIdentity(data.session);
        if (!sessionsLogicallyEqual(appliedIdentity, nativeIdentity)) {
          echoGuard.cancelNativeApplication();
        }
      } finally {
        isApplyingNativeState = false;
      }
    }

    async function syncWebSessionToNative(
      event: AuthChangeEvent,
      session: Session | null,
      revisionId: number
    ) {
      if (!isMounted) return;
      const contract = sessionContract(event, session, revisionId);
      latestNativeRevision = Math.max(latestNativeRevision, contract.revisionId);
      try {
        if (event === "SIGNED_OUT") {
          await NativeAuth.clearNativeAuthSession();
        } else if (contract.isSignedIn) {
          await NativeAuth.syncNativeAuthSession({
            jsonString: JSON.stringify(contract)
          });
        }
      } catch (error) {
        reportNativeAuthBridgeFailure("sync_web_session_to_native", error);
        throw error;
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
      if (!isMounted) {
        void listener.remove();
        return;
      }
      nativeAuthListener = listener;
    }).catch((error) => {
      if (!isMounted) return;
      reportNativeAuthBridgeFailure("subscribe_to_native_session", error);
    });

    NativeAuth.getNativeAuthSession()
      .then((contract) => {
        // An empty native Keychain is not an explicit sign-out. The WebView may
        // already hold the active Supabase session and will sync it through
        // onAuthStateChange below. Only restore native state when it exists.
        if (contract.state === "valid" || contract.state === "expired") {
          return syncNativeSession(contract);
        }
      })
      .catch((error) => {
        reportNativeAuthBridgeFailure("restore_native_session", error);
      });

    const authListener = supabase.auth.onAuthStateChange((event, session) => {
      const identity = sessionIdentity(session);
      if (echoGuard.consumeExpectedWebEcho(event, identity)) return;
      if (isApplyingNativeState) return;
      const reservation = echoGuard.reserveWebForward(event, identity, Date.now);
      if (!reservation) return;
      void syncWebSessionToNative(event, session, reservation.revisionId).catch(() => {
        echoGuard.releaseWebForward(reservation);
      });
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
