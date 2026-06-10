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
