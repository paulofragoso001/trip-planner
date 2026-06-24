"use client";

import { useState } from "react";
import { useAlmidyAction } from "@/hooks/use-wayline-action";

export function ShareTripButton({ tripId }: { tripId: string }) {
  const [clipboardMessage, setClipboardMessage] = useState("");
  const { isPending, run, state } = useAlmidyAction();

  async function shareTrip() {
    setClipboardMessage("");
    const result = await run({
      timeoutMs: 5000,
      url: `/api/trips/${encodeURIComponent(tripId)}/share`
    });

    if (result.status === "success") {
      const shareUrl = `${window.location.origin}/dashboard/trips/${tripId}`;

      if (window.navigator.clipboard?.writeText) {
        try {
          await window.navigator.clipboard.writeText(shareUrl);
          setClipboardMessage("Share link copied.");
          return;
        } catch {
          setClipboardMessage(`Share link ready: ${shareUrl}`);
          return;
        }
      }

      setClipboardMessage(`Share link ready: ${shareUrl}`);
    }
  }

  const message =
    state.status === "success" ? clipboardMessage || state.message : state.message;

  return (
    <div className="grid gap-2">
      <button
        className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isPending}
        onClick={shareTrip}
        type="button"
      >
        {isPending ? "Sharing..." : "Share trip"}
      </button>
      {state.status !== "idle" && message ? (
        <p className="text-xs font-semibold text-slate-600">{message}</p>
      ) : null}
    </div>
  );
}
