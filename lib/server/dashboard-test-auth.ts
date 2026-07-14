import "server-only";

import { headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { allowsDashboardTestBypass } from "@/lib/server/auth-flags";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type DashboardApiAuth<TClient = SupabaseClient> = {
  supabase: TClient;
  userId: string;
};

const dashboardTestUserEmail = "cypress@wayline.test";
const dashboardAuthTimeoutMs = 3000;
let dashboardTestUserId: string | null = null;

export async function authorizeDashboardApi<TClient = SupabaseClient>(): Promise<
  DashboardApiAuth<TClient> | null
> {
  const requestHeaders = await headers();
  const isCypressDashboard =
    allowsDashboardTestBypass() &&
    requestHeaders.get("x-cypress-dashboard") === "true";

  if (isCypressDashboard) {
    const admin = createAdminClient();
    if (!admin) {
      return null;
    }

    const testUserId = await getDashboardTestUserId(admin);
    if (!testUserId) {
      return null;
    }

    return { supabase: admin as TClient, userId: testUserId };
  }

  const supabase = await createClient();
  const authorization = requestHeaders.get("authorization");
  const bearerToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (bearerToken) {
    const {
      data: { user },
      error
    } = await withTimeout(
      supabase.auth.getUser(bearerToken),
      dashboardAuthTimeoutMs,
      "Supabase native dashboard auth lookup timed out."
    ).catch((error) => {
      if (process.env.NODE_ENV !== "production") {
        console.warn(error instanceof Error ? error.message : error);
      }

      return {
        data: { user: null },
        error
      };
    });

    if (!error && user) {
      return { supabase: supabase as TClient, userId: user.id };
    }
  }

  const {
    data: { user },
    error
  } = await withTimeout(
    supabase.auth.getUser(),
    dashboardAuthTimeoutMs,
    "Supabase dashboard auth lookup timed out."
  ).catch((error) => {
    if (process.env.NODE_ENV !== "production") {
      console.warn(error instanceof Error ? error.message : error);
    }

    return {
      data: { user: null },
      error
    };
  });

  if (!error && user) {
    return { supabase: supabase as TClient, userId: user.id };
  }

  return null;
}

async function getDashboardTestUserId(admin: SupabaseClient) {
  if (dashboardTestUserId) {
    return dashboardTestUserId;
  }

  const normalizedEmail = dashboardTestUserEmail.toLowerCase();
  const existingUserId = await findDashboardTestUserId(admin, normalizedEmail);

  if (existingUserId) {
    dashboardTestUserId = existingUserId;
    return existingUserId;
  }

  const created = await withRetry(
    () =>
      withTimeout(
        admin.auth.admin.createUser({
          email: dashboardTestUserEmail,
          email_confirm: true
        }),
        dashboardAuthTimeoutMs,
        "Dashboard test user creation timed out."
      ),
    3
  );

  if (!created.error && created.data.user?.id) {
    dashboardTestUserId = created.data.user.id;
    return created.data.user.id;
  }

  const recoveredUserId = await findDashboardTestUserId(admin, normalizedEmail);
  if (recoveredUserId) {
    dashboardTestUserId = recoveredUserId;
  }
  return recoveredUserId;
}

async function findDashboardTestUserId(
  admin: SupabaseClient,
  normalizedEmail: string
) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const { data, error } = await withTimeout(
        admin.auth.admin.listUsers({
          page: 1,
          perPage: 1000
        }),
        dashboardAuthTimeoutMs,
        "Dashboard test user lookup timed out."
      );

      if (!error) {
        const existingUser = data.users.find(
          (user) => user.email?.toLowerCase() === normalizedEmail
        );

        return existingUser?.id ?? null;
      }
    } catch {
      // Retry transient local-test network failures before giving up.
    }

    if (attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
    }
  }

  return null;
}

async function withRetry<T>(operation: () => Promise<T>, attempts: number) {
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Dashboard test auth request failed.");
}

function withTimeout<T>(promise: PromiseLike<T>, timeoutMs: number, message: string) {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(message)), timeoutMs);
    })
  ]);
}
