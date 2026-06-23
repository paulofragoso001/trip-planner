import { defineConfig } from "@playwright/test";

const port = process.env.PORT || "3000";
const baseURL = process.env.BASE_URL || `http://127.0.0.1:${port}`;
const socialImportWorkerSecret =
  process.env.SOCIAL_IMPORT_WORKER_SECRET || "test-social-import-worker-secret";

export default defineConfig({
  testDir: ".",
  use: {
    baseURL
  },
  webServer: {
    command: `PATH="/Users/fragoso/.nvm/versions/node/v20.20.2/bin:$PATH" ./node_modules/.bin/next dev --webpack -H 127.0.0.1 -p ${port}`,
    env: {
      ALLOW_LOCAL_DASHBOARD_BYPASS: "true",
      ALLOW_TEST_DASHBOARD_BYPASS: "true",
      NEXT_PUBLIC_UNIFIED_MAP_SURFACE: "true",
      SOCIAL_IMPORT_WORKER_SECRET: socialImportWorkerSecret
    },
    reuseExistingServer: process.env.PLAYWRIGHT_REUSE_EXISTING_SERVER === "true",
    timeout: 120_000,
    url: baseURL
  }
});
