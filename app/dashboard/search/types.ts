export type SearchResultIcon =
  | "activity"
  | "document"
  | "flight"
  | "hotel"
  | "idea"
  | "place"
  | "restaurant"
  | "trip";

export type SearchResultView = {
  href: string;
  icon: SearchResultIcon;
  id: string;
  imageAlt: string | null;
  imageUrl: string | null;
  meta: string | null;
  metaPrimary: string | null;
  metaSecondary: string | null;
  searchText: string;
  subtitle: string | null;
  title: string;
};

export type SearchData = {
  documents: SearchResultView[];
  error: string | null;
  initialQuery: string;
  savedIdeas: SearchResultView[];
  tripItems: SearchResultView[];
};

export type UnifiedSearchResultType = "activity" | "document" | "place" | "trip";

export type UnifiedSearchResult = {
  href: string;
  id: string;
  subtitle: string | null;
  title: string;
  type: UnifiedSearchResultType;
  updated_at: string | null;
};

export type UnifiedSearchResponse = {
  meta: {
    processing_time_ms: number;
    total_results: number;
  };
  query: string;
  results: UnifiedSearchResult[];
};
