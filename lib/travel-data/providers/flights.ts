import "server-only";

import type { ProviderAdapter } from "@/lib/travel-data/types";

export const flightsProvider: ProviderAdapter = {
  name: "amadeus"
};
