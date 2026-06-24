"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuthCallbackUrl } from "@/lib/auth/auth-redirect-url";
import { createClient } from "@/lib/supabase/server";

export async function signup(formData: FormData) {
  const supabase = await createClient();
  const origin = (await headers()).get("origin");
  const email = String(formData.get("email"));
  const password = String(formData.get("password"));

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: getAuthCallbackUrl(origin)
    }
  });

  if (error) {
    redirect(`/signup?message=${encodeURIComponent(error.message)}`);
  }

  redirect("/signup?message=Check your email to confirm your account.");
}
