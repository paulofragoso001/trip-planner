import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { NotificationBell } from "@/components/NotificationBell";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { dashboardActionRoutes } from "@/lib/dashboard/action-routes";
import { ensureProfile } from "@/lib/profile";
import {
  allowsDashboardTestBypass,
  allowsLocalDashboardBypass
} from "@/lib/server/auth-flags";
import { createClient } from "@/lib/supabase/server";

type DashboardLayoutProps = {
  children: React.ReactNode;
};

const dashboardAuthTimeoutMs = 3000;

export default async function DashboardLayout({ children }: DashboardLayoutProps) {
  const requestHeaders = await headers();
  const isCypressDashboard =
    allowsDashboardTestBypass() &&
    requestHeaders.get("x-cypress-dashboard") === "true";
  const isLocalDashboard = allowsLocalDashboardBypass();

  if (isCypressDashboard || isLocalDashboard) {
    return (
      <AppShell
        userEmail={isCypressDashboard ? "cypress@wayline.test" : "local@wayline.test"}
        userMenu={<TestUserMenu />}
        workspaceName="Wayline"
      >
        {children}
      </AppShell>
    );
  }

  const supabase = await createClient();
  const {
    data: { user }
  } = await withTimeout(
    supabase.auth.getUser(),
    dashboardAuthTimeoutMs,
    "Dashboard auth lookup timed out."
  ).catch(() => ({ data: { user: null } }));

  if (!user) {
    redirect("/login");
  }

  await ensureProfile(supabase, user);
  const { data: profile } = await supabase
    .from("profiles")
    .select("username,avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <AppShell
      notifications={<NotificationBell userId={user.id} />}
      userEmail={user.email ?? "Signed in"}
      userMenu={
        <div className="grid gap-3">
          <ProfileAvatar
            email={user.email ?? ""}
            profile={profile}
            userId={user.id}
          />
          <Link
            className="min-h-11 rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-center text-sm font-bold text-white transition hover:bg-white/15 focus:outline-none focus:ring-4 focus:ring-blue-400/20"
            href={dashboardActionRoutes.settings.account}
          >
            Account settings
          </Link>
          <form action={signOut}>
            <button className="min-h-11 w-full rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/15 focus:outline-none focus:ring-4 focus:ring-blue-400/20">
              Sign out
            </button>
          </form>
        </div>
      }
      workspaceName="Wayline"
    >
      {children}
    </AppShell>
  );
}

function withTimeout<T>(promise: PromiseLike<T>, timeoutMs: number, message: string) {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(message)), timeoutMs);
    })
  ]);
}

function TestUserMenu() {
  return (
    <div className="grid gap-3 rounded-xl border border-white/10 bg-white/[0.08] p-3 text-sm text-slate-100">
      <p className="font-black text-white">Cypress workspace</p>
      <p className="mt-1 text-slate-400">Authenticated test shell</p>
      <Link
        className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-center font-bold text-white transition hover:bg-white/15"
        href={dashboardActionRoutes.settings.account}
      >
        Account settings
      </Link>
    </div>
  );
}
