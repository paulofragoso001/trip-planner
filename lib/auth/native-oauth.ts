"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isNativeCapacitorRuntime,
  NATIVE_AUTH_CALLBACK_URL
} from "@/lib/native/capacitor-runtime";

export type NativeOAuthProvider = "google" | "github" | "facebook";

type NativeOAuthResult =
  | { handled: false }
  | { error?: Error; handled: true };

export async function signInWithNativeOAuth(
  supabase: SupabaseClient,
  provider: NativeOAuthProvider
): Promise<NativeOAuthResult> {
  if (!isNativeCapacitorRuntime()) {
    return { handled: false };
  }

  const { Browser } = await import("@capacitor/browser");
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: NATIVE_AUTH_CALLBACK_URL,
      skipBrowserRedirect: true
    }
  });

  if (error) {
    return { error, handled: true };
  }

  if (!data.url) {
    return {
      error: new Error("OAuth provider did not return an authorization URL."),
      handled: true
    };
  }

  await Browser.open({
    presentationStyle: "fullscreen",
    url: data.url
  });

  return { handled: true };
}
