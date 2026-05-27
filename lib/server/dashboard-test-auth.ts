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

    const { data: existingUser, error: lookupError } = await admin
      .from("trips")
      .select("user_id")
      .limit(1)
      .maybeSingle();

    if (!lookupError && existingUser?.user_id) {
      return { supabase: admin as TClient, userId: existingUser.user_id };
    }

    const created = await admin.auth.admin.createUser({
      email: dashboardTestUserEmail,
      email_confirm: true
    });

    if (created.error || !created.data.user) {
      return null;
    }

    return { supabase: admin as TClient, userId: created.data.user.id };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (!error && user) {
    return { supabase: supabase as TClient, userId: user.id };
  }

  return null;
}
