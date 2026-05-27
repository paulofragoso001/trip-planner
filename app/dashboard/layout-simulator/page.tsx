import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  DashboardLayoutSimulator,
  type LayoutIntegrityScorecard
} from "@/components/dashboard-layout-simulator";

async function readLayoutIntegrityScorecard(): Promise<LayoutIntegrityScorecard | null> {
  try {
    const scorecardPath = path.join(
      process.cwd(),
      ".github/dashboard/layout-integrity-scorecard.json"
    );
    const scorecard = await readFile(scorecardPath, "utf8");
    return JSON.parse(scorecard) as LayoutIntegrityScorecard;
  } catch {
    return null;
  }
}

export default async function LayoutSimulatorPage() {
  const scorecard = await readLayoutIntegrityScorecard();

  return <DashboardLayoutSimulator scorecard={scorecard} />;
}
