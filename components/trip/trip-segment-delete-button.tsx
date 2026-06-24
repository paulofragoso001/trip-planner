"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAlmidyAction } from "@/hooks/use-wayline-action";

export function TripSegmentDeleteButton({ segmentId }: { segmentId: string }) {
  const router = useRouter();
  const { isPending, run, state } = useAlmidyAction();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  async function deleteSegment() {
    const result = await run({
      method: "DELETE",
      timeoutMs: 5000,
      url: `/api/trip-segments/${encodeURIComponent(segmentId)}`
    });

    if (result.status === "success") {
      setConfirmingDelete(false);
      router.refresh();
    }
  }

  return (
    <div className="grid gap-2">
      {confirmingDelete ? (
        <div className="grid gap-2 rounded-2xl bg-red-50 p-3">
          <p className="text-xs font-semibold text-red-800">
            Delete this itinerary item?
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              className="min-h-11 rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-700 ring-1 ring-red-100 transition hover:bg-red-100 disabled:opacity-60"
              disabled={isPending}
              onClick={() => setConfirmingDelete(false)}
              type="button"
            >
              Cancel
            </button>
            <button
              aria-busy={isPending}
              className="min-h-11 rounded-2xl bg-red-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-red-500 disabled:opacity-60"
              disabled={isPending}
              onClick={deleteSegment}
              type="button"
            >
              {isPending ? "Deleting..." : "Confirm delete"}
            </button>
          </div>
        </div>
      ) : (
        <button
          className="min-h-11 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-60"
          disabled={isPending}
          onClick={() => setConfirmingDelete(true)}
          type="button"
        >
          Delete
        </button>
      )}
      {state.status === "error" ? (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
