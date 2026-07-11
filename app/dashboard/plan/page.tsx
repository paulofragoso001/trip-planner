import { headers } from "next/headers";
import { loadImportsData } from "@/app/dashboard/imports/loader";
import ImportsPage from "@/components/imports/imports-page";
import { NativeImportsWallet } from "@/components/imports/native-imports-wallet";
import { readSampleInspiration } from "@/lib/wayline-onboarding";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Page({ searchParams }: PageProps) {
  const userAgent = (await headers()).get("user-agent") ?? "";
  const isNativeApp = userAgent.includes("AlmidyNativeApp/");

  const params = await searchParams;
  const rawRunId = readFirst(params?.e2eRunId);
  const e2eRunId = rawRunId?.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || null;
  const sample = readSampleInspiration(params?.sample);
  const data = await loadImportsData(e2eRunId ? `e2e-${e2eRunId}` : undefined);

  const page = <ImportsPage {...data} sampleInspiration={sample} walletMounted={isNativeApp} />;
  return isNativeApp ? <NativeImportsWallet>{page}</NativeImportsWallet> : page;
}

function readFirst(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
