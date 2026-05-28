import "server-only";

import type { ProviderAdapter } from "@/lib/travel-data/types";

export const getYourGuideProvider: ProviderAdapter = {
  name: "getyourguide",
  async searchNearbyActivities() {
    return [];
  }
};
