"use client";

import { TripButton, TripCard } from "@/components/trip-ui";

export default function DashboardError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <TripCard className="grid min-h-[420px] place-items-center p-8 text-center">
      <div className="max-w-md">
        <p className="text-xs font-black uppercase tracking-[0.12em] text-red-600">
          Workspace error
        </p>
        <h2 className="mt-2 text-2xl font-black">This panel could not load</h2>
        <p className="mt-2 text-sm text-slate-500">
          The app shell is still available. Retry the content area when you are ready.
        </p>
        {error.digest ? (
          <p className="mt-3 font-mono text-xs text-slate-400">{error.digest}</p>
        ) : null}
        <TripButton className="mt-5" onClick={reset} variant="primaryCompact">
          Retry content
        </TripButton>
      </div>
    </TripCard>
  );
}
