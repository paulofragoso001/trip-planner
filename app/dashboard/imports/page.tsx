import ImportsPage from "@/components/imports/imports-page";
import { loadImportsData } from "./loader";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams;
  const rawRunId = readFirst(params?.e2eRunId);
  const e2eRunId = rawRunId?.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || null;
  const data = await loadImportsData(e2eRunId ? `e2e-${e2eRunId}` : undefined);

  return <ImportsPage {...data} />;
}

function readFirst(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
