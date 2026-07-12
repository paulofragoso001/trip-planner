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
  const normalizedEmail = dashboardTestUserEmail.toLowerCase();
  const existingUserId = await findDashboardTestUserId(admin, normalizedEmail);

  if (existingUserId) {
    return existingUserId;
  }

  const created = await admin.auth.admin.createUser({
    email: dashboardTestUserEmail,
    email_confirm: true
  });

  if (!created.error && created.data.user?.id) {
    return created.data.user.id;
  }

  return findDashboardTestUserId(admin, normalizedEmail);
}

async function findDashboardTestUserId(
  admin: SupabaseClient,
  normalizedEmail: string
) {
  const { data, error } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000
  });

  if (error) {
    return null;
  }

  const existingUser = data.users.find(
    (user) => user.email?.toLowerCase() === normalizedEmail
  );

  return existingUser?.id ?? null;
}

function withTimeout<T>(promise: PromiseLike<T>, timeoutMs: number, message: string) {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(message)), timeoutMs);
    })
  ]);
}
