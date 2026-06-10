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
import Link from "next/link";
import { useMemo, useState } from "react";
import type { SearchData, SearchResultIcon, SearchResultView } from "@/app/dashboard/search/types";
import { cn } from "@/components/trip-ui";

type SearchGroupProps = {
  emptyDescription: string;
  emptyTitle: string;
  id: string;
  results: SearchResultView[];
  showEmpty?: boolean;
  title: string;
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
  const hasResults =
    filteredTripItems.length > 0 ||
    filteredDocuments.length > 0 ||
    filteredSavedIdeas.length > 0;
  const isSearching = normalizedQuery.length > 0;

  return (
    <main
      className="min-h-dvh bg-[#171717] px-4 pb-[calc(96px+env(safe-area-inset-bottom))] pt-[calc(18px+env(safe-area-inset-top))] text-white sm:px-6 lg:min-h-0 lg:rounded-[2rem] lg:bg-slate-950/54 lg:p-8"
      data-testid="search-page"
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <div className="sticky top-0 z-10 -mx-4 border-b border-white/8 bg-[#171717]/95 px-4 pb-4 pt-[env(safe-area-inset-top)] backdrop-blur-xl sm:-mx-6 sm:px-6 lg:static lg:-mx-0 lg:border-b-0 lg:bg-transparent lg:px-0 lg:pb-0 lg:pt-0">
          <div className="flex items-center gap-3">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">Search Wayline</span>
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
              />
              <input
                autoComplete="off"
                autoFocus
                className="h-12 w-full rounded-2xl border border-white/6 bg-white/10 pl-12 pr-4 text-base font-semibold text-white outline-none placeholder:text-slate-400 focus:border-orange-300/60 focus:ring-4 focus:ring-orange-400/10"
                data-testid="search-input"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search trips, places, ideas, documents..."
                type="search"
                value={query}
              />
            </label>
            <Link
              className="rounded-xl px-1 py-3 text-base font-semibold text-orange-400 outline-none transition hover:text-orange-300 focus:ring-4 focus:ring-orange-400/15"
              href="/dashboard"
            >
              Cancel
            </Link>
          </div>
        </div>

        {error ? (
          <section className="rounded-3xl border border-amber-300/20 bg-amber-400/10 p-4 text-sm font-semibold text-amber-100">
            {error}
          </section>
        ) : null}

        {isSearching && !hasResults ? (
          <section className="rounded-3xl border border-white/8 bg-white/[0.04] p-6">
            <h2 className="text-lg font-black text-white">No results found</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-400">
              Try a trip name, place, address, saved idea, or document title.
            </p>
          </section>
        ) : (
          <>
            {(!isSearching || filteredTripItems.length > 0) ? (
              <SearchGroup
                emptyDescription="Trip items appear here after you create places, activities, reservations, or mapped places."
                emptyTitle="No trip items yet"
                id="search-group-trip-items"
                results={filteredTripItems}
                showEmpty={!isSearching}
                title="Trip items"
              />
            ) : null}
            {(!isSearching || filteredDocuments.length > 0) ? (
              <SearchGroup
                emptyDescription="Documents appear here when they are added to a trip."
                emptyTitle="No documents yet"
                id="search-group-documents"
                results={filteredDocuments}
                showEmpty={!isSearching}
                title="Documents & Emails"
              />
            ) : null}
            {(!isSearching || filteredSavedIdeas.length > 0) ? (
              <SearchGroup
                emptyDescription="Saved ideas from Plan appear here when Wayline finds places to review."
                emptyTitle="No saved ideas yet"
                id="search-group-saved-ideas"
                results={filteredSavedIdeas}
                showEmpty={!isSearching}
                title="Saved ideas"
              />
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}

function SearchGroup({
  emptyDescription,
  emptyTitle,
  id,
  results,
  showEmpty = true,
  title
}: SearchGroupProps) {
  if (results.length === 0 && !showEmpty) {
    return null;
  }

  return (
    <section className="space-y-2" data-testid={id}>
      <h2 className="px-1 text-sm font-black text-slate-400">{title}</h2>
      <div className="overflow-hidden rounded-3xl border border-white/8 bg-white/[0.035]">
        {results.length > 0 ? (
          <div className="divide-y divide-white/8">
            {results.map((result) => (
              <SearchResultRow key={result.id} result={result} />
            ))}
          </div>
        ) : (
          <div className="p-5">
            <p className="text-base font-black text-white">{emptyTitle}</p>
            <p className="mt-1 text-sm font-semibold leading-6 text-slate-400">
              {emptyDescription}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function SearchResultRow({ result }: { result: SearchResultView }) {
  const Icon = iconForResult(result.icon);

  return (
    <Link
      aria-label={`Open ${result.title}`}
      className="grid min-h-[76px] grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-3 px-3 py-3 outline-none transition hover:bg-white/[0.045] focus:bg-white/[0.055] focus:ring-4 focus:ring-orange-400/15"
      href={result.href}
    >
      <span
        className={cn(
          "grid h-12 w-12 place-items-center rounded-full",
          iconStyles[result.icon]
        )}
      >
        <Icon aria-hidden="true" className="h-6 w-6" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-base font-black text-white">{result.title}</span>
        {result.subtitle ? (
          <span className="mt-0.5 block truncate text-sm font-semibold text-slate-400">
            {result.subtitle}
          </span>
        ) : null}
      </span>
      <span className="flex min-w-0 items-center gap-3">
        {result.meta ? (
          <span className="hidden max-w-[92px] text-right text-sm font-semibold leading-5 text-slate-400 min-[380px]:block">
            {result.meta}
          </span>
        ) : null}
        {result.imageUrl ? (
          <Image
            alt={result.imageAlt ?? ""}
            className="h-12 w-12 rounded-xl object-cover"
            height={48}
            src={result.imageUrl}
            width={48}
          />
        ) : null}
      </span>
    </Link>
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
      result.meta
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(normalizedQuery)
  );
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
