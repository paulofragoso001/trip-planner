import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountDeletionRequestForm } from "@/components/account/account-deletion-request-form";
import {
  allowsDashboardTestBypass,
  allowsLocalDashboardBypass
} from "@/lib/server/auth-flags";
import { createClient } from "@/lib/supabase/server";

const accountAuthTimeoutMs = 3000;

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

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <section className="rounded-2xl border border-line bg-white p-5 shadow-panel">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
          Account
        </p>
        <h2 className="mt-2 text-2xl font-black tracking-tight">Trust and data controls</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Review the legal documents and request account deletion from this page.
          Deletion requests are queued for operator review so connected account,
          calendar, and collaboration cleanup can be handled safely.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Link
            className="rounded-xl border border-line bg-slate-50 px-4 py-3 text-sm font-bold transition hover:bg-slate-100"
            href="/privacy"
          >
            Privacy Policy
          </Link>
          <Link
            className="rounded-xl border border-line bg-slate-50 px-4 py-3 text-sm font-bold transition hover:bg-slate-100"
            href="/terms"
          >
            Terms of Service
          </Link>
        </div>
      </section>

      <aside className="rounded-2xl border border-red-100 bg-white p-5 shadow-panel">
        <h3 className="text-lg font-black">Account deletion</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          This creates an auditable deletion request. The operator should delete
          or anonymize user-owned data, disconnect OAuth providers, and remove
          the account after review.
        </p>
        <div className="mt-5">
          <AccountDeletionRequestForm existingRequest={deletionRequest} />
        </div>
      </aside>
    </div>
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
