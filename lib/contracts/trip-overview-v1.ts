import { z } from "zod";

const state = z.enum(["available", "empty", "failed"]);
const error = z.string().nullable();

export const tripOverviewV1Schema = z.object({
  version: z.literal(1),
  trip: z.object({
    id: z.string(), title: z.string(), destination: z.string(), countryCode: z.string().length(2).nullable(),
    startDate: z.string().nullable(), endDate: z.string().nullable(), dateRange: z.string(),
    relativeTiming: z.string().nullable(), durationDays: z.number().int().positive().nullable(), status: z.string()
  }),
  hero: z.object({
    imageUrl: z.string().nullable(), alt: z.string(), attribution: z.string().nullable(),
    sourceLabel: z.string().nullable(), fallbackColor: z.string()
  }),
  itinerarySummary: z.object({
    state, error, exactCount: z.number().int().nonnegative(), dateRange: z.string(),
    categories: z.array(z.object({ key: z.string(), label: z.string(), count: z.number().int().positive(), icon: z.string() }))
  }),
  documentsPreview: z.object({
    state, error,
    items: z.array(z.object({ id: z.string(), title: z.string(), type: z.string(), date: z.string().nullable(), href: z.string() }))
  }),
  expenseSummary: z.object({
    state, error, ledger: z.literal("budget_records"),
    currencies: z.array(z.object({
      currency: z.string().length(3), total: z.number(), totalLabel: z.string(),
      categories: z.array(z.object({ key: z.string(), label: z.string(), amount: z.number(), amountLabel: z.string() }))
    }))
  }),
  recentItems: z.object({
    state, error,
    items: z.array(z.object({
      id: z.string(), title: z.string(), category: z.string(), icon: z.string(), createdAt: z.string(), href: z.string()
    }))
  }),
  supportedActions: z.array(z.object({
    key: z.enum(["newActivity", "places", "routes", "flights", "stays"]),
    label: z.string(), available: z.boolean(), href: z.string().nullable(),
    handoff: z.enum(["web", "native-route"]).nullable()
  })),
  sections: z.object({ itinerary: state, documents: state, expenses: state, recentItems: state })
});

export type TripOverviewV1 = z.infer<typeof tripOverviewV1Schema>;
