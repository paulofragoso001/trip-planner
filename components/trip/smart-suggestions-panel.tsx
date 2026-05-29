"use client";

import { ExternalLink, Loader2, Sparkles, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { TripRecommendationView } from "@/app/dashboard/trips/[tripId]/map/loader";

type SmartSuggestionsPanelProps = {
  mappedStopCount: number;
  recommendations: TripRecommendationView[];
  tripId: string;
};

export function SmartSuggestionsPanel({
  mappedStopCount,
  recommendations,
  tripId
}: SmartSuggestionsPanelProps) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  async function run(endpoint: string, label: string) {
    setPendingAction(endpoint);
    setMessage(`${label}...`);

    try {
      const response = await fetch(endpoint, {
        headers: { Accept: "application/json" },
        method: "POST"
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(readError(payload, response.status));
      setMessage(label === "Generating suggestions" ? "Suggestions updated." : "Done.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action failed.");
    } finally {
      setPendingAction(null);
    }
  }

  const groups = groupRecommendations(recommendations);

  return (
    <section
      className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
      id="smart-suggestions"
    >
      <div className="grid gap-3 sm:flex sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">
            Smart Suggestions
          </p>
          <h3 className="mt-1 text-base font-black text-slate-950">
            Nearby ideas for this route
          </h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Suggestions are based on your mapped stops, destination, travel style, and nearby places.
          </p>
        </div>
        <button
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-3 text-xs font-black text-white disabled:opacity-60 sm:w-auto"
          disabled={Boolean(pendingAction) || mappedStopCount === 0}
          onClick={() => run(`/api/trips/${tripId}/generate-suggestions`, "Generating suggestions")}
          type="button"
          title={mappedStopCount === 0 ? "Add a mapped stop before finding suggestions." : undefined}
        >
          {pendingAction?.includes("generate-suggestions") ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          Find ideas
        </button>
      </div>

      <div className="mt-4 grid gap-3">
        {groups.map((group) => (
          <div className="grid gap-2" key={group.label}>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
              {group.label}
            </p>
            {group.items.map((item) => (
              <article className="rounded-2xl bg-slate-50 p-3 sm:p-4" key={item.id}>
                <div className="grid gap-2 sm:flex sm:items-start sm:justify-between sm:gap-3">
                  <div>
                    <p className="text-sm font-black text-slate-950">{item.title}</p>
                    <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                      {item.provider.replace("_", " ")} · {item.type}
                    </p>
                  </div>
                  {item.ratingLabel ? (
                    <span className="w-fit rounded-full bg-white px-2 py-1 text-xs font-black text-slate-700">
                      {item.ratingLabel}
                    </span>
                  ) : null}
                </div>
                {item.reason ? (
                  <p className="mt-2 text-sm leading-6 text-slate-600">{item.reason}</p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  {item.priceLabel ? (
                    <span className="inline-flex min-h-9 items-center rounded-full bg-white px-3 text-xs font-black text-slate-700">
                      From {item.priceLabel}
                    </span>
                  ) : null}
                  {item.bookingUrl ? (
                    <a
                      className="inline-flex min-h-11 items-center gap-1 rounded-full bg-white px-4 text-xs font-black text-blue-700"
                      href={item.bookingUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Open source
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : null}
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                  <button
                    className="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-3 text-sm font-black text-white disabled:opacity-60"
                    disabled={Boolean(pendingAction)}
                    onClick={() => run(`/api/trip-recommendations/${item.id}/save`, "Saving suggestion")}
                    type="button"
                  >
                    Save to Trip
                  </button>
                  <button
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-3 text-sm font-black text-slate-700 disabled:opacity-60"
                    disabled={Boolean(pendingAction)}
                    onClick={() => run(`/api/trip-recommendations/${item.id}/dismiss`, "Dismissing suggestion")}
                    type="button"
                  >
                    <X className="h-4 w-4" />
                    Dismiss
                  </button>
                </div>
              </article>
            ))}
          </div>
        ))}

        {recommendations.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
            <p className="font-black text-slate-950">No suggestions yet.</p>
            <p className="mt-1 leading-6">
              Generate suggestions after your trip has at least one mapped stop.
            </p>
          </div>
        ) : null}
      </div>

      {message ? (
        <p aria-live="polite" className="mt-4 rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">
          {message}
        </p>
      ) : null}
    </section>
  );
}

function groupRecommendations(items: TripRecommendationView[]) {
  const groups = [
    { label: "Near your route", matcher: (item: TripRecommendationView) => /near|route|close/i.test(item.reason || "") },
    { label: "Food nearby", matcher: (item: TripRecommendationView) => /restaurant|food|meal|bar|cafe/i.test(`${item.type} ${item.title}`) },
    { label: "Activities", matcher: (item: TripRecommendationView) => /activity|tour|attraction|museum|park/i.test(`${item.type} ${item.title}`) },
    { label: "Evening options", matcher: (item: TripRecommendationView) => /evening|night|bar|dinner/i.test(`${item.reason || ""} ${item.title}`) },
    { label: "Popular places", matcher: () => true }
  ];
  const used = new Set<string>();

  return groups
    .map((group) => {
      const groupItems = items.filter((item) => !used.has(item.id) && group.matcher(item));
      groupItems.forEach((item) => used.add(item.id));
      return { items: groupItems, label: group.label };
    })
    .filter((group) => group.items.length > 0);
}

function readError(payload: unknown, status: number) {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof payload.error === "object" &&
    payload.error !== null &&
    "message" in payload.error &&
    typeof payload.error.message === "string"
  ) {
    return payload.error.message;
  }

  return `Request failed (${status}).`;
}
