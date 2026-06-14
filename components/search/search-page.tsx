"use client";

import {
  Bed,
  FileText,
  ImageIcon,
  Luggage,
  MapPin,
  Plane,
  Search,
  Sparkles,
  Ticket,
  Utensils
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { SearchData, SearchResultIcon, SearchResultView } from "@/app/dashboard/search/types";
import { cn } from "@/components/trip-ui";

type SearchGroupProps = {
  id: string;
  leading?: boolean;
  results: SearchResultView[];
  title?: string;
};

const iconStyles: Record<SearchResultIcon, string> = {
  activity: "bg-orange-500/18 text-orange-300",
  document: "bg-slate-500/18 text-slate-200",
  flight: "bg-sky-500/18 text-sky-300",
  hotel: "bg-purple-500/18 text-purple-300",
  idea: "bg-pink-500/18 text-pink-300",
  place: "bg-blue-500/18 text-blue-300",
  restaurant: "bg-amber-500/18 text-amber-300",
  trip: "bg-emerald-500/18 text-emerald-300"
};

export function SearchPage({
  documents,
  error,
  initialQuery,
  savedIdeas,
  tripItems
}: SearchData) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredTripItems = useMemo(
    () => filterResults(tripItems, normalizedQuery),
    [normalizedQuery, tripItems]
  );
  const filteredDocuments = useMemo(
    () => filterResults(documents, normalizedQuery),
    [documents, normalizedQuery]
  );
  const filteredSavedIdeas = useMemo(
    () => filterResults(savedIdeas, normalizedQuery),
    [normalizedQuery, savedIdeas]
  );
  const activityResults = useMemo(
    () => dedupeResults([...filteredTripItems, ...filteredSavedIdeas]),
    [filteredSavedIdeas, filteredTripItems]
  );
  const hasResults =
    activityResults.length > 0 ||
    filteredDocuments.length > 0;

  return (
    <main
      className="min-h-dvh bg-[#1f1f1f] text-white lg:min-h-0 lg:rounded-[2rem]"
      data-testid="search-page"
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col pb-[calc(7.25rem+env(safe-area-inset-bottom))] lg:pb-8">
        <div className="sticky top-0 z-20 border-b border-white/10 bg-[#1f1f1f]/95 px-4 pb-3 pt-[calc(14px+env(safe-area-inset-top))] backdrop-blur-xl sm:px-6 lg:static lg:rounded-t-[2rem]">
          <div className="flex items-center gap-3">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">Search Wayline</span>
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-[#9b9ba1]"
              />
              <input
                autoComplete="off"
                autoFocus
                className="h-11 w-full rounded-xl border border-transparent bg-[#343338] pl-11 pr-3 text-[17px] font-medium leading-none text-white outline-none placeholder:text-[#a6a5ad] focus:border-orange-400/60 focus:ring-4 focus:ring-orange-400/10"
                data-testid="search-input"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search saved activities and documents"
                type="search"
                value={query}
              />
            </label>
            <button
              className="shrink-0 rounded-xl px-1 py-2.5 text-[17px] font-medium text-[#ff7a2f] outline-none transition hover:text-orange-300 focus:ring-4 focus:ring-orange-400/15"
              onClick={() => {
                if (window.history.length > 1) {
                  router.back();
                } else {
                  router.push("/dashboard");
                }
              }}
              type="button"
            >
              Cancel
            </button>
          </div>
        </div>

        {error ? (
          <section className="mx-4 mt-4 rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4 text-sm font-semibold text-amber-100 sm:mx-6">
            {error}
          </section>
        ) : null}

        {!hasResults ? (
          <section className="mx-4 mt-6 rounded-2xl border border-white/10 bg-white/[0.035] p-5 sm:mx-6">
            <h2 className="text-lg font-black text-white">No results found</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-400">
              Try searching a place, activity, document, or trip.
            </p>
          </section>
        ) : (
          <div className="flex flex-col">
            {activityResults.length > 0 ? (
              <SearchGroup
                id="search-group-activity-results"
                leading
                results={activityResults}
              />
            ) : null}
            {filteredDocuments.length > 0 ? (
              <SearchGroup
                id="search-group-documents"
                results={filteredDocuments}
                title="Documents & Emails"
              />
            ) : null}
          </div>
        )}
      </div>
    </main>
  );
}

function SearchGroup({
  id,
  leading = false,
  results,
  title
}: SearchGroupProps) {
  return (
    <section
      className={cn("border-b border-white/10", leading ? "pt-2" : "pt-8")}
      data-testid={id}
    >
      {title ? (
        <h2 className="px-4 pb-3 text-[19px] font-black leading-tight text-[#a7a7ad] sm:px-6">
          {title}
        </h2>
      ) : null}
      <div className="divide-y divide-white/10">
        {results.map((result) => (
          <SearchResultRow key={result.id} result={result} />
        ))}
      </div>
    </section>
  );
}

function SearchResultRow({ result }: { result: SearchResultView }) {
  const Icon = iconForResult(result.icon);

  return (
    <a
      aria-label={`Open ${result.title}`}
      className="grid min-h-[84px] grid-cols-[56px_minmax(0,1fr)_minmax(58px,auto)] items-center gap-3 px-4 py-3 outline-none transition hover:bg-white/[0.045] focus:bg-white/[0.055] focus:ring-4 focus:ring-orange-400/15 sm:px-6"
      href={result.href}
    >
      <span
        className={cn(
          "relative grid h-[52px] w-[52px] place-items-center overflow-hidden rounded-full",
          iconStyles[result.icon]
        )}
      >
        {result.imageUrl ? (
          <Image
            alt={result.imageAlt ?? ""}
            className="absolute inset-0 h-full w-full object-cover"
            height={52}
            src={result.imageUrl}
            width={52}
          />
        ) : (
          <Icon aria-hidden="true" className="h-7 w-7" />
        )}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[17px] font-black leading-tight text-white">
          {result.title}
        </span>
        {result.subtitle ? (
          <span className="mt-1 block truncate text-[16px] font-medium leading-tight text-[#9c9ba2]">
            {result.subtitle}
          </span>
        ) : null}
      </span>
      <span className="min-w-0 text-right">
        {result.metaPrimary ? (
          <span className="block truncate text-[15px] font-bold leading-tight text-[#a7a6ad]">
            {result.metaPrimary}
          </span>
        ) : null}
        {result.metaSecondary ? (
          <span className="mt-1 block truncate text-[15px] font-medium leading-tight text-[#a7a6ad]">
            {result.metaSecondary}
          </span>
        ) : null}
      </span>
    </a>
  );
}

function filterResults(results: SearchResultView[], query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return results;
  return results.filter((result) =>
    [
      result.searchText,
      result.title,
      result.subtitle,
      result.meta,
      result.metaPrimary,
      result.metaSecondary
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(normalizedQuery)
  );
}

function dedupeResults(results: SearchResultView[]) {
  const seen = new Set<string>();
  return results.filter((result) => {
    const key = `${result.href}:${result.title.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function iconForResult(icon: SearchResultIcon) {
  switch (icon) {
    case "activity":
      return Ticket;
    case "document":
      return FileText;
    case "flight":
      return Plane;
    case "hotel":
      return Bed;
    case "idea":
      return Sparkles;
    case "place":
      return MapPin;
    case "restaurant":
      return Utensils;
    case "trip":
      return Luggage;
    default:
      return ImageIcon;
  }
}
