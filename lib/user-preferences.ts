import { z } from "zod";

export const supportedCurrencyCodes = ["USD", "EUR", "GBP", "BRL", "JPY", "CAD"] as const;
export const supportedDistanceUnits = ["miles", "kilometers"] as const;
export type SupportedCurrencyCode = (typeof supportedCurrencyCodes)[number];
export type UserDistanceUnit = (typeof supportedDistanceUnits)[number];
export type UserPreferences = { default_currency: SupportedCurrencyCode; distance_unit: UserDistanceUnit };
export const defaultUserPreferences: UserPreferences = { default_currency: "USD", distance_unit: "miles" };
const currencySchema = z.string().trim().toUpperCase().pipe(z.enum(supportedCurrencyCodes));
const distanceSchema = z.enum(supportedDistanceUnits);
export const userPreferencesPatchSchema = z.object({ default_currency: currencySchema.optional(), distance_unit: distanceSchema.optional() }).strict().refine((value) => Object.keys(value).length > 0, "At least one preference is required.");
export type UserPreferencesPatch = z.infer<typeof userPreferencesPatchSchema>;
export type UserPreferencesResponse = { preferences: UserPreferences; source: "default" | "persisted" };
export const currencyLabels: Record<SupportedCurrencyCode, string> = { BRL: "Brazilian Real (BRL)", CAD: "Canadian Dollar (CAD)", EUR: "Euro (EUR)", GBP: "British Pound (GBP)", JPY: "Japanese Yen (JPY)", USD: "US Dollar (USD)" };
export const distanceLabels: Record<UserDistanceUnit, string> = { kilometers: "Kilometers", miles: "Miles" };
