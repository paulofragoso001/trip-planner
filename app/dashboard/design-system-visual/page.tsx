import { TierBVisualFixture } from "@/components/design-system/tier-b-visual-fixture";
import { notFound } from "next/navigation";

export default function DesignSystemVisualPage() {
  if (process.env.ALMIDY_WEB_VISUAL_FIXTURES !== "true") notFound();
  return <TierBVisualFixture />;
}
