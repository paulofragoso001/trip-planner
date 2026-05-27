#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

loadLocalEnv();

const commands = [
  ["TypeScript", "./node_modules/.bin/tsc --noEmit"],
  [
    "Smoke tests",
    "ALLOW_TEST_DASHBOARD_BYPASS=true npx playwright test tests/playwright/dashboard.smoke.spec.ts --workers=1"
  ],
  ["Auth boundary tests", "npx playwright test tests/playwright/auth-boundary.spec.ts --workers=1"],
  [
    "Calendar OAuth contract tests",
    "ALLOW_TEST_DASHBOARD_BYPASS=true npx playwright test tests/playwright/calendar-contract.spec.ts --workers=1"
  ],
  ["Calendar worker integration tests", "npx playwright test tests/playwright/calendar-worker.spec.ts --workers=1"],
  [
    "Imports write protected lane",
    "ALLOW_TEST_DASHBOARD_BYPASS=true npx playwright test tests/playwright/imports-write.spec.ts --workers=1"
  ],
  ["Import parse RLS/security audit", "npm run audit:import-parse-rls"]
];

for (const [label, command] of commands) {
  console.log(`\n== ${label} ==`);
  const result = spawnSync(command, {
    env: process.env,
    shell: true,
    stdio: "inherit"
  });

  if (result.status !== 0) {
    console.error(`\nProduction test suite failed at: ${label}`);
    process.exit(result.status ?? 1);
  }
}

console.log("\nProduction test suite passed.");

function loadLocalEnv() {
  if (!existsSync(".env.local")) {
    return;
  }

  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separator = trimmed.indexOf("=");
    if (separator === -1) {
      continue;
    }

    const name = trimmed.slice(0, separator);
    const value = trimmed.slice(separator + 1).replace(/^["']|["']$/g, "");

    if (!process.env[name]) {
      process.env[name] = value;
    }
  }
}
