import { TierBVisualFixture } from "@/components/design-system/tier-b-visual-fixture";
import { notFound } from "next/navigation";

export default async function DesignSystemVisualPage({
  searchParams,
}: {
  searchParams: Promise<{ components?: string }>;
}) {
  if (process.env.ALMIDY_WEB_VISUAL_FIXTURES !== "true") notFound();
  const { components } = await searchParams;
  return <TierBVisualFixture componentsOnly={components === "true"} />;
}
