import { defineConfig } from "@playwright/test";

export default defineConfig({
  outputDir: "/tmp/almidy-playwright-results",
  testDir: "../.."
});
