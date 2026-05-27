"use client";

import { useRouter } from "next/navigation";
import { useWaylineAction } from "@/hooks/use-wayline-action";

export function TripSegmentDeleteButton({ segmentId }: { segmentId: string }) {
  const router = useRouter();
  const { isPending, run, state } = useWaylineAction();

  async function deleteSegment() {
    const result = await run({
      method: "DELETE",
      timeoutMs: 5000,
      url: `/api/trip-segments/${encodeURIComponent(segmentId)}`
    });

    if (result.status === "success") {
      router.refresh();
    }
  }

  return (
    <div className="grid gap-2">
      <button
        className="min-h-11 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-60"
        disabled={isPending}
        onClick={deleteSegment}
        type="button"
      >
        {isPending ? "Deleting..." : "Delete"}
      </button>
      {state.status === "error" ? (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
