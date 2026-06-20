import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: ["tests/playwright/dashboard-action-contracts.spec.ts"]
});
