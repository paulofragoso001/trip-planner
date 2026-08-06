import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

test("migration constrains preferences and applies own-row RLS", () => {
  const sql = read("supabase/migrations/20260806140000_create_user_preferences.sql");
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /for select to authenticated[\s\S]*auth\.uid\(\)[\s\S]*user_id/i);
  assert.match(sql, /for insert to authenticated[\s\S]*with check[\s\S]*auth\.uid\(\)[\s\S]*user_id/i);
  assert.match(sql, /for update to authenticated[\s\S]*using[\s\S]*with check/i);
  assert.match(sql, /default_currency in \('USD', 'EUR', 'GBP', 'BRL', 'JPY', 'CAD'\)/);
  assert.match(sql, /distance_unit in \('miles', 'kilometers'\)/);
  assert.doesNotMatch(sql, /service_role/i);
});

test("API derives identity and uses strict, partial contracts", () => {
  const route = read("app/api/user-preferences/route.ts");
  const contract = read("lib/user-preferences.ts");
  assert.match(route, /authorizeDashboardApi/);
  assert.match(route, /auth\.userId/);
  assert.doesNotMatch(route, /body\.user_id|parsed\.data\.user_id/);
  assert.match(contract, /\.strict\(\)/);
  assert.match(contract, /default_currency: currencySchema\.optional/);
  assert.match(contract, /distance_unit: distanceSchema\.optional/);
  assert.match(route, /update\(patch\)/);
});

test("product consumers use preferences without rewriting stored values", () => {
  assert.match(read("app/api/budget-records/route.ts"), /user_preferences/);
  assert.match(read("components/trip/budget-record-form.tsx"), /default_currency/);
  const distance = read("lib/geo/distance.ts");
  assert.match(distance, /formatDistanceForPreference/);
  assert.match(distance, /distanceKm \* 0\.621371/);
});

test("version, share, update, and importer semantics are truthful", () => {
  assert.match(read("lib/app-metadata.ts"), /packageMetadata\.version/);
  const native = read("ios/App/App/NativeSettingsModel.swift");
  assert.match(native, /CFBundleShortVersionString/);
  assert.match(native, /CFBundleVersion/);
  assert.match(native, /https:\/\/almidy\.app/);
  assert.match(native, /Unavailable until App Store listing/);
  const wallet = read("components/dashboard/travel-wallet-sheet.tsx");
  assert.match(wallet, /navigator\.share/);
  assert.match(wallet, /navigator\.clipboard\.writeText/);
  assert.match(wallet, /Import reservations manually/);
  assert.doesNotMatch(wallet, /Last Sync|Force Sync/);
});

test("native parity uses the authenticated server contract", () => {
  const native = read("ios/App/App/NativeMapPlugin.swift");
  assert.match(native, /api\/user-preferences/);
  assert.match(native, /method: "PATCH"/);
  assert.match(native, /UIActivityViewController/);
  assert.match(native, /popoverPresentationController/);
});
