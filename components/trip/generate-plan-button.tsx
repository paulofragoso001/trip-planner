"use client";

import { Route } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useWaylineAction } from "@/hooks/use-wayline-action";

type GeneratePlanResponse = {
  itinerary?: {
    assigned?: number;
    routeSummary?: Array<{
      day: string;
      warnings?: Array<{ message: string }>;
    }>;
  };
};

type GeneratePlanButtonProps = {
  context: "map" | "timeline";
  tripId: string;
};

export function GeneratePlanButton({ context, tripId }: GeneratePlanButtonProps) {
  const router = useRouter();
  const { isPending, run, state } = useWaylineAction<GeneratePlanResponse>();
  const storageKey = `wayline:generate-plan:${context}:${tripId}`;
  const [persistedFeedback, setPersistedFeedback] = useState("");
  const liveFeedback = buildFeedback(state.data, state.message, state.status, context);
  const feedback = liveFeedback || persistedFeedback;
  const feedbackStatus = state.status === "idle" && persistedFeedback ? "success" : state.status;

  useEffect(() => {
    setPersistedFeedback(window.sessionStorage.getItem(storageKey) || "");
  }, [storageKey]);

  async function generatePlan() {
    const result = await run({
      body: {},
      method: "POST",
      timeoutMs: 15000,
      url: `/api/trips/${encodeURIComponent(tripId)}/itinerary/generate`
    });

    if (result.status === "success") {
      const nextFeedback = buildFeedback(result.data, result.message, result.status, context);
      window.sessionStorage.setItem(storageKey, nextFeedback);
      setPersistedFeedback(nextFeedback);
      router.refresh();
    }
  }

  return (
    <div className="grid gap-2">
      <button
        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-left text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isPending}
        onClick={generatePlan}
        type="button"
      >
        <Route className="h-4 w-4" />
        {isPending ? "Generating plan..." : "Generate plan"}
      </button>
      {feedback ? (
        <p
          aria-live="polite"
          className={[
            "rounded-xl px-3 py-2 text-xs font-semibold",
            feedbackStatus === "success"
              ? "bg-emerald-50 text-emerald-700"
              : feedbackStatus === "error" || feedbackStatus === "timeout"
                ? "bg-red-50 text-red-700"
                : "bg-slate-50 text-slate-600"
          ].join(" ")}
        >
          {feedback}
        </p>
      ) : null}
    </div>
  );
}

function buildFeedback(
  data: GeneratePlanResponse | null,
  fallbackMessage: string,
  status: string,
  context: GeneratePlanButtonProps["context"]
) {
  if (status === "idle") return "";
  if (status === "loading") return "Optimizing day order and route summaries.";
  if (status !== "success") return fallbackMessage || "Could not generate plan.";

  const assigned = data?.itinerary?.assigned ?? 0;
  const days = data?.itinerary?.routeSummary?.length ?? 0;
  const warningCount =
    data?.itinerary?.routeSummary?.reduce(
      (total, day) => total + (day.warnings?.length || 0),
      0
    ) ?? 0;
  const surface = context === "map" ? "Map" : "Timeline";
  const warningText = warningCount ? ` ${warningCount} route warning${warningCount === 1 ? "" : "s"} found.` : "";

  return `${surface} order updated: ${assigned} stop${assigned === 1 ? "" : "s"} across ${days} day${days === 1 ? "" : "s"}.${warningText}`;
}
