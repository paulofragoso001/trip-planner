import "server-only";

import type { ProviderAdapter } from "@/lib/travel-data/types";

export const viatorProvider: ProviderAdapter = {
  name: "viator",
  async searchNearbyActivities() {
    return [];
  }
};
