import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const snapshotDir = path.join(root, "tests/playwright/layout-simulator.spec.ts-snapshots");
const visualSnapshotDir = path.join(root, "tests/playwright/layout-simulator.visual.spec.ts-snapshots");
const jsonOut = path.join(root, ".github/dashboard/layout-integrity-scorecard.json");
const markdownOut = path.join(root, "docs/layout-integrity-scorecard.md");

const presets = [
  {
    name: "mobile-drawer",
    expectedContract: {
      contentLayout: "single",
      mockPreset: "overview",
      rightRail: "off",
      sidebarMode: "mobile",
      topbarMode: "minimal"
    },
    expectedOptionalRegions: {
      mobileDrawer: true,
      rightRail: false
    },
    visualBaselines: [
      "layout-visual-mobile-drawer-shell",
      "layout-visual-mobile-drawer-panel"
    ]
  },
  {
    name: "collapsed-right-rail",
    expectedContract: {
      contentLayout: "timeline-inspector",
      mockPreset: "trip-detail",
      rightRail: "on",
      sidebarMode: "collapsed",
      topbarMode: "trip-context"
    },
    expectedOptionalRegions: {
      rightRail: true,
      sidebar: true,
      timeline: true
    },
    visualBaselines: ["layout-visual-collapsed-right-rail-shell"]
  },
  {
    name: "wide-map-workspace",
    expectedContract: {
      containerWidth: "full",
      contentLayout: "map-list",
      mockPreset: "map-workspace",
      rightRail: "off",
      sidebarMode: "expanded",
      topbarMode: "filter-heavy"
    },
    expectedOptionalRegions: {
      map: true,
      rightRail: false,
      sidebar: true
    },
    visualBaselines: [
      "layout-visual-wide-map-workspace-shell",
      "layout-visual-wide-map-workspace-map"
    ]
  }
];

const points = {
  accessibilityLayout: 10,
  contractMetadata: 5,
  navigationClarity: 15,
  responsiveIntegrity: 20,
  shellContract: 25,
  visualStability: 25
};

function findSnapshotFile(directory, stem, extension) {
  if (!existsSync(directory)) return null;
  return readdirSync(directory).find((file) => file.startsWith(stem) && file.endsWith(extension)) ?? null;
}

function readStructuralSnapshot(preset) {
  const stem = `layout-contract-${preset}`;
  const file = findSnapshotFile(snapshotDir, stem, ".json");
  if (!file) return null;
  return JSON.parse(readFileSync(path.join(snapshotDir, file), "utf8"));
}

function hasVisualBaselines(stems) {
  return stems.every((stem) => Boolean(findSnapshotFile(visualSnapshotDir, stem, ".png")));
}

function allEntriesMatch(actual = {}, expected = {}) {
  return Object.entries(expected).every(([key, value]) => actual[key] === value);
}

function allRequiredRegionsPresent(snapshot) {
  return Object.values(snapshot?.regions ?? {}).every(Boolean);
}

function scorePreset(preset) {
  const snapshot = readStructuralSnapshot(preset.name);
  const contractMatches = allEntriesMatch(snapshot?.contract, preset.expectedContract);
  const optionalRegionsMatch = allEntriesMatch(snapshot?.optionalRegions, preset.expectedOptionalRegions);
  const requiredRegionsPresent = allRequiredRegionsPresent(snapshot);
  const visualBaselinesPresent = hasVisualBaselines(preset.visualBaselines);

  const scores = {
    shellContract: requiredRegionsPresent ? points.shellContract : 0,
    visualStability: visualBaselinesPresent ? points.visualStability : 0,
    responsiveIntegrity: contractMatches && visualBaselinesPresent ? points.responsiveIntegrity : 0,
    navigationClarity: optionalRegionsMatch ? points.navigationClarity : 0,
    accessibilityLayout: requiredRegionsPresent && optionalRegionsMatch ? points.accessibilityLayout : 0,
    contractMetadata: contractMatches ? points.contractMetadata : 0
  };

  const score = Object.values(scores).reduce((total, value) => total + value, 0);

  return {
    name: preset.name,
    score,
    status: score === 100 ? "clean-pass" : score >= 90 ? "minor-review" : "requires-action",
    checks: {
      contractMatches,
      optionalRegionsMatch,
      requiredRegionsPresent,
      visualBaselinesPresent
    },
    scores
  };
}

const presetResults = presets.map(scorePreset);
const averageScore = Math.round(
  presetResults.reduce((total, preset) => total + preset.score, 0) / presetResults.length
);

const scorecard = {
  generatedAt: new Date().toISOString(),
  averageScore,
  presets: presetResults,
  thresholds: {
    cleanPass: 100,
    minorReview: "90-99",
    requiresAction: "<90"
  }
};

const markdown = [
  "# Layout Integrity Scorecard",
  "",
  `Generated: ${scorecard.generatedAt}`,
  "",
  `Overall score: ${averageScore}`,
  "",
  "| Preset | Score | Status | Shell | Visual | Responsive | Navigation | Accessibility | Metadata |",
  "|---|---:|---|---:|---:|---:|---:|---:|---:|",
  ...presetResults.map((preset) =>
    `| ${preset.name} | ${preset.score} | ${preset.status} | ${preset.scores.shellContract} | ${preset.scores.visualStability} | ${preset.scores.responsiveIntegrity} | ${preset.scores.navigationClarity} | ${preset.scores.accessibilityLayout} | ${preset.scores.contractMetadata} |`
  ),
  "",
  "Scoring model: shell contract 25, visual stability 25, responsive integrity 20, navigation clarity 15, accessibility layout 10, contract metadata 5.",
  "",
  "This report is generated from structural layout snapshots and committed visual baselines for the simulator edge presets."
].join("\n");

mkdirSync(path.dirname(jsonOut), { recursive: true });
mkdirSync(path.dirname(markdownOut), { recursive: true });
writeFileSync(jsonOut, `${JSON.stringify(scorecard, null, 2)}\n`);
writeFileSync(markdownOut, `${markdown}\n`);

console.log(`Wrote ${path.relative(root, jsonOut)}`);
console.log(`Wrote ${path.relative(root, markdownOut)}`);
