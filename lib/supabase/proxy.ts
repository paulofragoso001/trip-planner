import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const sessionRefreshTimeoutMs = 3000;

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        }
      }
    }
  );

  await withTimeout(
    supabase.auth.getUser(),
    sessionRefreshTimeoutMs,
    "Supabase session refresh timed out."
  ).catch((error) => {
    if (process.env.NODE_ENV !== "production") {
      console.warn(error instanceof Error ? error.message : error);
    }
  });

  return supabaseResponse;
}

function withTimeout<T>(promise: PromiseLike<T>, timeoutMs: number, message: string) {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(message)), timeoutMs);
    })
  ]);
}
