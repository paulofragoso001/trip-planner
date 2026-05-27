import "server-only";

import { headers } from "next/headers";
import { allowsDashboardTestBypass } from "@/lib/server/auth-flags";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type AdminAuthResult =
  | { isAdmin: false; reason: "forbidden"; userId: string }
  | { isAdmin: false; reason: "unauthorized"; userId: null }
  | { isAdmin: true; reason: null; userId: string };

export async function requireAdmin(): Promise<AdminAuthResult> {
  const requestHeaders = await headers();

  if (
    allowsDashboardTestBypass() &&
    requestHeaders.get("x-cypress-dashboard") === "true"
  ) {
    return {
      isAdmin: true,
      reason: null,
      userId: await getDashboardTestAdminId()
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      isAdmin: false,
      reason: "unauthorized",
      userId: null
    };
  }

  const role =
    readRole(user.app_metadata?.role) ||
    readRole(user.app_metadata?.user_role) ||
    readRole(user.app_metadata?.wayline_role);

  if (role === "admin") {
    return {
      isAdmin: true,
      reason: null,
      userId: user.id
    };
  }

  return {
    isAdmin: false,
    reason: "forbidden",
    userId: user.id
  };
}

function readRole(value: unknown) {
  return typeof value === "string" ? value : null;
}

async function getDashboardTestAdminId() {
  const fallbackUserId = "00000000-0000-0000-0000-000000000000";
  const admin = createAdminClient();

  if (!admin) {
    return fallbackUserId;
  }

  const email = "cypress@wayline.test";
  const { data: users } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000
  });
  const existingUser = users?.users.find((user) => user.email === email);

  if (existingUser) {
    return existingUser.id;
  }

  const created = await admin.auth.admin.createUser({
    email,
    email_confirm: true
  });

  return created.data.user?.id || fallbackUserId;
}
