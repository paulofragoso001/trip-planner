import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const error = requestUrl.searchParams.get("error");
  const errorDescription = requestUrl.searchParams.get("error_description");

  if (error) {
    const message = errorDescription || `OAuth login failed: ${error}`;
    return NextResponse.redirect(
      new URL(`/login?message=${encodeURIComponent(message)}`, request.url)
    );
  }

  if (code) {
    const supabase = await createClient();
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      return NextResponse.redirect(
        new URL(
          `/login?message=${encodeURIComponent(exchangeError.message)}`,
          request.url
        )
      );
    }
  }

  return NextResponse.redirect(new URL("/dashboard", request.url));
}
