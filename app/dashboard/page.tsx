import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/app/actions";
import { NotificationBell } from "@/components/NotificationBell";
import NotificationSettings from "@/components/NotificationSettings";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { TripDashboard } from "@/components/trip-dashboard";
import { ensureProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  await ensureProfile(supabase, user);
  const { data: profile } = await supabase
    .from("profiles")
    .select("username,avatar_url")
    .eq("id", user.id)
    .maybeSingle();
  const { data: preferences } = await supabase
    .from("notification_preferences")
    .upsert({ user_id: user.id }, { onConflict: "user_id" })
    .select("*")
    .single();

  return (
    <main className="min-h-screen px-6 py-8">
      <section className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
              Authenticated workspace
            </p>
            <h1 className="mt-2 text-4xl font-black tracking-tight">Wayline Dashboard</h1>
            <p className="mt-2 text-sm text-slate-600">{user.email}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <NotificationBell userId={user.id} />
            <ProfileAvatar
              email={user.email ?? ""}
              profile={profile}
              userId={user.id}
            />
            <form action={signOut}>
              <button className="rounded-lg border border-line bg-white px-5 py-3 text-sm font-bold text-ink transition hover:bg-slate-50">
                Sign out
              </button>
            </form>
          </div>
        </header>

        <TripDashboard userEmail={user.email ?? ""} />

        <NotificationSettings
          prefs={{
            email_comments: preferences?.email_comments ?? true,
            inapp_comments: preferences?.inapp_comments ?? true,
            email_mentions: preferences?.email_mentions ?? true,
            inapp_mentions: preferences?.inapp_mentions ?? true
          }}
          user={{ id: user.id }}
        />

        <Link className="mt-6 inline-flex text-sm font-bold text-brand hover:underline" href="/">
          Back to home
        </Link>
      </section>
    </main>
  );
}
