import { redirect } from "next/navigation";
import { Map, Plane, Sparkles } from "lucide-react";
import { authorizeDashboardApi } from "@/lib/server/dashboard-test-auth";
import { WalletActionLink, WalletCard } from "@/components/wallet/wallet-card";
import { WalletPageShell } from "@/components/wallet/wallet-page-shell";

type TripIdRow = {
  id: string;
};

export default async function DashboardMapPage() {
  const auth = await authorizeDashboardApi();
  let loadFailed = false;

  if (auth) {
    const { data, error } = await auth.supabase
      .from("trips")
      .select("id")
      .eq("user_id", auth.userId)
      .order("updated_at", { ascending: false })
      .limit(1);

    if (!error) {
      const latestTrip = ((data || []) as TripIdRow[])[0];
      if (latestTrip?.id) {
        redirect(`/dashboard/trips/${latestTrip.id}/map`);
      }
    } else {
      loadFailed = true;
      console.warn(
        JSON.stringify({
          area: "dashboard-map",
          event: "latest_trip_lookup_failed",
          message: error.message
        })
      );
    }
  }

  return (
    <WalletPageShell
      actions={
        <>
          <WalletActionLink href="/dashboard/trips#new-trip">Create trip</WalletActionLink>
          <WalletActionLink className="bg-white text-slate-950 hover:bg-slate-100" href="/dashboard/imports">
            Start planning
          </WalletActionLink>
        </>
      }
      compactHero
      eyebrow="MAP"
      fallbackGradient="bg-[linear-gradient(135deg,#020617,#1d4ed8_54%,#0f766e)]"
      subtitle="Open a trip map after you create or continue a trip pass."
      title="Your route map"
    >
      <div className="grid gap-4">
        {loadFailed ? (
          <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
            Some trip details are unavailable. You can still create a trip or start planning.
          </p>
        ) : null}

        <WalletCard
          eyebrow="Route"
          icon={<Map className="h-5 w-5" aria-hidden="true" />}
          title="No route map yet"
          variant="utility"
        >
          <p className="text-sm font-semibold leading-6 text-slate-600">
            Create a trip, add places, and Wayline will turn confirmed locations into a route map.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <WalletActionLink href="/dashboard/trips#new-trip">
              <Plane className="mr-2 h-4 w-4" aria-hidden="true" />
              Create trip
            </WalletActionLink>
            <WalletActionLink className="bg-blue-50 text-blue-700 hover:bg-blue-100" href="/dashboard/imports">
              <Sparkles className="mr-2 h-4 w-4" aria-hidden="true" />
              Add ideas
            </WalletActionLink>
          </div>
        </WalletCard>
      </div>
    </WalletPageShell>
  );
}
