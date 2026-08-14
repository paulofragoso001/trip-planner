import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [scope, loader, nativeSections] = await Promise.all([
  readFile("lib/trip-overview-feature-scope.ts", "utf8"),
  readFile("app/dashboard/trips/[tripId]/overview-loader.ts", "utf8"),
  readFile("ios/App/App/TripOverview/NativeTripOverviewSectionViews.swift", "utf8")
]);

test("first-release overview exposes only truthful supported actions", () => {
  assert.match(scope, /newActivity[\s\S]*available: true/);
  assert.match(scope, /places[\s\S]*available: true/);
  assert.match(scope, /routes[\s\S]*available: true/);
  assert.match(scope, /flights[\s\S]*available: false, href: null/);
  assert.match(scope, /stays[\s\S]*available: false, href: null/);
  assert.match(scope, /documentsPreview: "include-read-only"/);
  assert.match(scope, /weatherPromotion: "omit"/);
  assert.match(scope, /customization: "omit"/);
});

test("native overview keeps Imported items and has no misleading reference affordances", () => {
  assert.match(nativeSections, /NativeTripOverviewReleaseScope\.importedItemsTitle/);
  for (const unsupported of ["Add Document", "Email Forwarding", "Invite Guests", "Share Trip", "Customize", "PRO"]) {
    assert.doesNotMatch(nativeSections, new RegExp(unsupported));
  }
});

test("expenses stay currency-isolated on budget_records", () => {
  assert.match(loader, /\.from\("budget_records"\)/);
  assert.match(loader, /ledger: "budget_records"/);
  assert.match(loader, /groupExpensesByCurrency\(budgets\)/);
});

test("Latest Added is creation-ordered with deterministic ID tie-break and five-item limit", () => {
  assert.match(loader, /\.order\("inserted_at", \{ ascending: false/);
  assert.match(loader, /\.order\("id", \{ ascending: true \}\)/);
  assert.match(loader, /b\.inserted_at\.localeCompare\(a\.inserted_at\) \|\| a\.id\.localeCompare\(b\.id\)/);
  assert.match(loader, /\.slice\(0, 5\)/);
  assert.match(loader, /createdAt: row\.inserted_at/);
});
