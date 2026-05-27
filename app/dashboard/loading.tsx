import { TripCard } from "@/components/trip-ui";

export default function DashboardLoading() {
  return (
    <TripCard className="grid min-h-[420px] place-items-center p-8 text-center">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
          Loading workspace
        </p>
        <h2 className="mt-2 text-2xl font-black">Preparing dashboard</h2>
        <p className="mt-2 text-sm text-slate-500">
          Trip operations will appear here as soon as the route is ready.
        </p>
      </div>
    </TripCard>
  );
}
