import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BookOpen,
  CalendarDays,
  ChevronRight,
  CreditCard,
  LifeBuoy,
  LockKeyhole,
  Mail,
  MapPinned,
  PackageOpen,
  Plane,
  Shield,
  Sparkles,
  UserRound,
  Wallet
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { AccountDeletionRequestForm } from "@/components/account/account-deletion-request-form";
import {
  allowsDashboardTestBypass,
  allowsLocalDashboardBypass
} from "@/lib/server/auth-flags";
import { createClient } from "@/lib/supabase/server";
import { dashboardActionRoutes } from "@/lib/dashboard/action-routes";

const accountAuthTimeoutMs = 3000;

const iconClassName = "h-5 w-5";

const preferenceRows = [
  {
    description: "Review the privacy terms that govern saved trips and account data.",
    href: dashboardActionRoutes.settings.privacy,
    icon: Shield,
    label: "Privacy Policy",
    meta: "Legal"
  },
  {
    description: "Open the Almidy terms for account and service use.",
    href: dashboardActionRoutes.settings.terms,
    icon: LockKeyhole,
    label: "Terms of Service",
    meta: "Legal"
  },
  {
    description: "Open your visual travel book and profile stats.",
    href: dashboardActionRoutes.trips.stats,
    icon: BookOpen,
    label: "My Almidy Book",
    meta: "Profile"
  }
] as const;

const syncRows = [
  {
    description: "Forward hotel, flight, and activity reservations into Almidy.",
    href: dashboardActionRoutes.imports.forwardReservation,
    icon: Mail,
    label: "Add Reservations via Email",
    meta: "Available"
  },
  {
    description: "Calendar feed controls will appear here after provider setup.",
    icon: CalendarDays,
    label: "Calendar Feed",
    meta: "Pro soon"
  },
  {
    description: "Storage and data controls are reserved for connected services.",
    icon: PackageOpen,
    label: "Storage and Data",
    meta: "Soon"
  }
] as const;

const membershipRows = [
  {
    description: "Trial activation is visible in the mobile settings sheet and will wire into billing later.",
    icon: Sparkles,
    label: "Redeem 15 Days Free",
    meta: "Soon"
  },
  {
    description: "Billing controls remain unavailable until subscriptions are connected.",
    icon: CreditCard,
    label: "Billing",
    meta: "Soon"
  },
  {
    description: "Your trips remain available in the canonical My Trips wallet.",
    href: dashboardActionRoutes.trips.list,
    icon: Wallet,
    label: "My Trips",
    meta: "Open"
  }
] as const;

const helpRows = [
  {
    description: "Send a note to the Almidy support inbox.",
    href: dashboardActionRoutes.settings.talkToUs,
    icon: LifeBuoy,
    label: "Need help?",
    meta: "Email"
  },
  {
    description: "Share trip ideas, links, and notes from the planner surface.",
    href: dashboardActionRoutes.plan.addIdea,
    icon: Plane,
    label: "Start planning",
    meta: "Planner"
  },
  {
    description: "Open the map surface when a trip has route-ready places.",
    href: dashboardActionRoutes.trips.map,
    icon: MapPinned,
    label: "Map",
    meta: "Route"
  }
] as const;

export default async function AccountPage() {
  const requestHeaders = await headers();
  const hasDashboardBypass =
    allowsLocalDashboardBypass() ||
    (allowsDashboardTestBypass() && requestHeaders.get("x-cypress-dashboard") === "true");
  const supabase = await createClient();
  const {
    data: { user }
  } = await withTimeout(
    supabase.auth.getUser(),
    accountAuthTimeoutMs,
    "Account lookup timed out."
  ).catch(() => ({ data: { user: null } }));

  if (!user && !hasDashboardBypass) {
    redirect("/login");
  }

  const { data: deletionRequest } = user
    ? await supabase
        .from("account_deletion_requests")
        .select("id,status,requested_at")
        .eq("user_id", user.id)
        .in("status", ["requested", "in_review"])
        .order("requested_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  const accountLabel = user?.email ?? (hasDashboardBypass ? "Local dashboard preview" : "Signed in");

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-5 pb-8" data-testid="account-settings-page">
      <section className="overflow-hidden rounded-[2rem] bg-slate-950 text-white shadow-panel">
        <div className="relative isolate px-5 py-6 sm:px-7 lg:px-8">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_10%,rgba(249,115,22,0.30),transparent_30%),radial-gradient(circle_at_85%_20%,rgba(56,189,248,0.16),transparent_32%),linear-gradient(145deg,#020617,#0f172a_58%,#111827)]" />
          <div className="absolute right-5 top-5 -z-10 h-24 w-24 rounded-full border border-white/10 bg-white/5 blur-sm" />

          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-orange-200">
                Almidy Settings
              </p>
              <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
                Account & settings
              </h1>
              <p className="mt-3 text-sm leading-6 text-slate-200 sm:text-base">
                Manage trust, sync, membership, and support controls from one
                app-native settings surface.
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/10 p-4 backdrop-blur">
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-slate-950">
                  <UserRound className="h-6 w-6" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-300">
                    Signed in
                  </p>
                  <p className="max-w-56 truncate text-sm font-black text-white">
                    {accountLabel}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <nav aria-label="Settings sections" className="mt-6 grid gap-2 sm:grid-cols-4">
            <SectionJump href="#preferences" label="Preferences" />
            <SectionJump href="#sync" label="Sync" />
            <SectionJump href="#membership" label="Membership" />
            <SectionJump href="#help" label="Help" />
          </nav>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_390px]">
        <main className="grid gap-5">
          <SettingsSurfaceSection
            eyebrow="Account"
            id="preferences"
            rows={preferenceRows}
            title="Trust and data controls"
          >
            Review legal documents, profile surfaces, and account data controls
            without leaving the dashboard.
          </SettingsSurfaceSection>

          <SettingsSurfaceSection
            eyebrow="Sync"
            id="sync"
            rows={syncRows}
            title="Connected services"
          >
            Reservation forwarding is available from Imports. Provider-level
            calendar and storage controls stay unavailable until they are wired.
          </SettingsSurfaceSection>

          <SettingsSurfaceSection
            eyebrow="Membership"
            id="membership"
            rows={membershipRows}
            title="Almidy Pro"
          >
            Membership actions are visible so the settings model is complete,
            while billing-only controls remain clearly marked as coming soon.
          </SettingsSurfaceSection>

          <SettingsSurfaceSection
            eyebrow="Help"
            id="help"
            rows={helpRows}
            title="Support and shortcuts"
          >
            Reach support, continue planning, or jump back to the map and trip
            wallet surfaces from the same settings hub.
          </SettingsSurfaceSection>
        </main>

        <aside className="h-fit rounded-[1.75rem] border border-red-100 bg-white p-5 shadow-panel">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-red-50 text-red-600">
              <Shield className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-red-500">
                Protected action
              </p>
              <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950">
                Account deletion
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                This creates an auditable deletion request. An operator reviews
                account-owned data, connected providers, and cleanup before
                anything is removed.
              </p>
            </div>
          </div>
          <div className="mt-5">
            <AccountDeletionRequestForm existingRequest={deletionRequest} />
          </div>
        </aside>
      </div>
    </div>
  );
}

type SettingsRow = {
  description: string;
  href?: string;
  icon: LucideIcon;
  label: string;
  meta: string;
};

function SectionJump({ href, label }: { href: string; label: string }) {
  return (
    <Link
      className="flex min-h-11 items-center justify-center rounded-full border border-white/10 bg-white/10 px-4 text-sm font-black text-white transition hover:bg-white/15 focus:outline-none focus:ring-4 focus:ring-orange-300/25"
      href={href}
    >
      {label}
    </Link>
  );
}

function SettingsSurfaceSection({
  children,
  eyebrow,
  id,
  rows,
  title
}: {
  children: ReactNode;
  eyebrow: string;
  id: string;
  rows: readonly SettingsRow[];
  title: string;
}) {
  return (
    <section className="rounded-[1.75rem] border border-line bg-white p-5 shadow-panel" id={id}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-500">
            {eyebrow}
          </p>
          <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">
            {title}
          </h2>
        </div>
        <p className="max-w-xl text-sm leading-6 text-slate-600">{children}</p>
      </div>

      <div className="mt-5 grid gap-3">
        {rows.map((row) => (
          <SettingsActionRow key={row.label} row={row} />
        ))}
      </div>
    </section>
  );
}

function SettingsActionRow({ row }: { row: SettingsRow }) {
  const Icon = row.icon;
  const content = (
    <>
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-slate-100 text-slate-950">
        <Icon className={iconClassName} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-base font-black text-slate-950">{row.label}</span>
          <span className="rounded-full bg-orange-50 px-2 py-1 text-[0.68rem] font-black uppercase tracking-[0.12em] text-orange-600">
            {row.meta}
          </span>
        </span>
        <span className="mt-1 block text-sm leading-5 text-slate-600">{row.description}</span>
      </span>
      {row.href ? (
        <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
      ) : (
        <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-slate-400">
          Soon
        </span>
      )}
    </>
  );

  if (!row.href) {
    return (
      <div
        aria-disabled="true"
        className="flex items-center gap-3 rounded-3xl border border-line bg-slate-50 px-4 py-3"
      >
        {content}
      </div>
    );
  }

  return (
    <Link
      className="flex items-center gap-3 rounded-3xl border border-line bg-slate-50 px-4 py-3 transition hover:border-orange-200 hover:bg-orange-50/60 focus:outline-none focus:ring-4 focus:ring-orange-300/20"
      href={row.href}
    >
      {content}
    </Link>
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
