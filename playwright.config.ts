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
    command: `npm run dev -- -H 127.0.0.1 -p ${port}`,
    env: {
      ALLOW_TEST_DASHBOARD_BYPASS: "true",
      SOCIAL_IMPORT_WORKER_SECRET: socialImportWorkerSecret
    },
    reuseExistingServer: false,
    timeout: 120_000,
    url: baseURL
  }
});
