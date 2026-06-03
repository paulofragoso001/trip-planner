"use client";

import { ExternalLink, Loader2, Sparkles, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { TripRecommendationView } from "@/app/dashboard/trips/[tripId]/map/loader";
import { PlacePhoto } from "@/components/place-photo";
import { waylineCopy } from "@/lib/copy/wayline-copy";

type SmartSuggestionsPanelProps = {
  mappedStopCount: number;
  recommendations: TripRecommendationView[];
  tripId: string;
};

type SuggestionFilterId = "all" | "food" | "places" | "activities" | "shopping" | "nightlife";

const suggestionFilters: { id: SuggestionFilterId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "food", label: "Food" },
  { id: "places", label: "Places" },
  { id: "activities", label: "Activities" },
  { id: "shopping", label: "Shopping" },
  { id: "nightlife", label: "Nightlife" }
];

export function SmartSuggestionsPanel({
  mappedStopCount,
  recommendations,
  tripId
}: SmartSuggestionsPanelProps) {
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);
  const [message, setMessage] = useState("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<SuggestionFilterId>("all");

  useEffect(() => {
    setHydrated(true);
  }, []);

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
      if (payload?.data?.skippedReason === "no_mapped_segments") {
        setMessage(waylineCopy.suggestions.noMappedStops);
      } else if (payload?.data?.partialFailure) {
        setMessage(waylineCopy.suggestions.partialFailure);
      } else {
        setMessage(label === "Generating suggestions" ? "Suggestions updated." : "Done.");
      }
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : waylineCopy.suggestions.unavailable
      );
    } finally {
      setPendingAction(null);
    }
  }

  const filteredRecommendations =
    activeFilter === "all"
      ? recommendations
      : recommendations.filter((item) => normalizeSuggestionCategory(item) === activeFilter);
  const groups = groupRecommendations(filteredRecommendations);
  const activeFilterLabel =
    suggestionFilters.find((filter) => filter.id === activeFilter)?.label ?? "selected";

  return (
    <section
      className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
      id="smart-suggestions"
    >
      <div className="grid gap-3 sm:flex sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">
            Nearby Ideas
          </p>
          <h3 className="mt-1 text-base font-black text-slate-950">
            Ideas near this route
          </h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">{waylineCopy.suggestions.intro}</p>
        </div>
        <button
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-3 text-xs font-black text-white disabled:opacity-60 sm:w-auto"
          disabled={Boolean(pendingAction) || mappedStopCount === 0}
          onClick={() => run(`/api/trips/${tripId}/generate-suggestions`, "Generating suggestions")}
          type="button"
          title={mappedStopCount === 0 ? waylineCopy.suggestions.noMappedStops : undefined}
        >
          {pendingAction?.includes("generate-suggestions") ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          Find ideas
        </button>
      </div>

      <div className="mt-4" data-testid="nearby-ideas-filters">
        <p className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-slate-500">
          Explore nearby
        </p>
        <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Nearby Ideas categories">
          {suggestionFilters.map((filter) => {
            const active = activeFilter === filter.id;
            return (
              <button
                aria-pressed={active}
                className={[
                  "inline-flex min-h-11 shrink-0 items-center justify-center rounded-full px-4 text-xs font-black ring-1 transition disabled:cursor-not-allowed disabled:opacity-60",
                  active
                    ? "bg-slate-950 text-white ring-slate-950"
                    : "bg-slate-50 text-slate-700 ring-slate-200 hover:bg-slate-100"
                ].join(" ")}
                disabled={!hydrated}
                key={filter.id}
                onClick={() => setActiveFilter(filter.id)}
                type="button"
              >
                {filter.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        {groups.map((group) => (
          <div className="grid gap-2" key={group.label}>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
              {group.label}
            </p>
            {group.items.map((item) => (
              <article className="overflow-hidden rounded-[1.35rem] bg-slate-50 shadow-sm ring-1 ring-slate-100" key={item.id}>
                <PlacePhoto
                  alt={item.imageAlt || `Photo of ${item.title}`}
                  attribution={item.imageAttribution}
                  className="h-44 w-full rounded-none sm:h-52"
                  fallbackLabel={item.category || item.type}
                  src={item.imageUrl}
                />
                <div className="p-3 sm:p-4">
                <div className="grid gap-2 sm:flex sm:items-start sm:justify-between sm:gap-3">
                  <div>
                    <p className="text-base font-black leading-tight text-slate-950">{item.title}</p>
                    <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                      {item.type}
                    </p>
                  </div>
                  {item.ratingLabel ? (
                    <span className="w-fit rounded-full bg-white px-2.5 py-1 text-xs font-black text-slate-700 ring-1 ring-slate-200">
                      {item.ratingLabel} ★
                    </span>
                  ) : null}
                </div>
                {item.reason ? (
                  <p className="mt-2 text-sm leading-6 text-slate-600">{item.reason}</p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="inline-flex min-h-9 items-center rounded-full bg-white px-3 text-xs font-black text-slate-700 ring-1 ring-slate-200">
                    {item.provider.replace("_", " ")}
                  </span>
                  {item.priceLabel ? (
                    <span className="inline-flex min-h-9 items-center rounded-full bg-white px-3 text-xs font-black text-slate-700 ring-1 ring-slate-200">
                      From {item.priceLabel}
                    </span>
                  ) : null}
                  {item.bookingUrl ? (
                    <a
                    className="inline-flex min-h-11 items-center gap-1 rounded-full bg-white px-4 text-xs font-black text-blue-700 ring-1 ring-blue-100"
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
                    className="inline-flex min-h-11 items-center justify-center rounded-full bg-blue-600 px-4 text-sm font-black text-white disabled:opacity-60"
                    disabled={Boolean(pendingAction)}
                    onClick={() => run(`/api/trip-recommendations/${item.id}/save`, "Saving suggestion")}
                    type="button"
                  >
                    Save to Trip
                  </button>
                  <button
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-white px-4 text-sm font-black text-slate-700 ring-1 ring-slate-200 disabled:opacity-60"
                    disabled={Boolean(pendingAction)}
                    onClick={() => run(`/api/trip-recommendations/${item.id}/dismiss`, "Dismissing suggestion")}
                    type="button"
                  >
                    <X className="h-4 w-4" />
                    Dismiss
                  </button>
                </div>
                </div>
              </article>
            ))}
          </div>
        ))}

        {recommendations.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
            <p className="font-black text-slate-950">No suggestions yet.</p>
            <p className="mt-1 leading-6">
              {mappedStopCount === 0
                ? waylineCopy.emptyStates.smartSuggestions
                : "Find ideas to load suggestions near your route."}
            </p>
          </div>
        ) : null}

        {recommendations.length > 0 && filteredRecommendations.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
            <p className="font-black text-slate-950">No {activeFilterLabel.toLowerCase()} ideas yet.</p>
            <p className="mt-1 leading-6">Try another category or find new ideas near your route.</p>
            <button
              className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-3 text-xs font-black text-white disabled:opacity-60 sm:w-auto"
              disabled={Boolean(pendingAction) || mappedStopCount === 0}
              onClick={() => run(`/api/trips/${tripId}/generate-suggestions`, "Generating suggestions")}
              type="button"
            >
              {pendingAction?.includes("generate-suggestions") ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Find ideas
            </button>
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

function normalizeSuggestionCategory(item: TripRecommendationView): SuggestionFilterId {
  const text = `${item.type || ""} ${item.category || ""} ${item.title || ""} ${item.reason || ""}`
    .toLowerCase()
    .replace(/[_-]+/g, " ");

  if (/\b(nightlife|club|lounge|cocktail|evening|late night|bar)\b/.test(text)) return "nightlife";
  if (/\b(shopping|shop|mall|store|market|boutique|retail)\b/.test(text)) return "shopping";
  if (/\b(restaurant|food|meal|cafe|coffee|bakery|brunch|dinner|lunch|breakfast|sushi|tapas)\b/.test(text)) {
    return "food";
  }
  if (/\b(activity|tour|experience|entertainment|excursion|boat|guided|class)\b/.test(text)) return "activities";
  return "places";
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
