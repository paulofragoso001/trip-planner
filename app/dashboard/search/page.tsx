import { SearchPage } from "@/components/search/search-page";
import { loadSearchData } from "./loader";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type DashboardSearchPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DashboardSearchPage({ searchParams }: DashboardSearchPageProps) {
  const params = await searchParams;
  const query = readFirst(params?.q)?.slice(0, 120) ?? "";
  const data = await loadSearchData(query);

  return <SearchPage {...data} />;
}

function readFirst(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
