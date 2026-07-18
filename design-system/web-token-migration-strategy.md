# Almidy Web Token Migration Strategy

## Purpose

This document defines a controlled migration from raw web styling values to the canonical Almidy design tokens. It is an inventory and sequencing plan, not authorization for a global visual rewrite.

The framework-neutral source of truth is [`almidy.tokens.json`](./almidy.tokens.json). TypeScript and Tailwind are consuming representations; neither is independently authoritative.

## Current audit baseline

The original audit reported 622 raw hex/RGB/RGBA occurrences and 914 `font-bold`, `font-extrabold`, or `font-black` occurrences. A fresh source scan for this phase found 627 raw color matching lines and 915 heavy-typography matching lines. Counts can move as unrelated work lands, so migration progress should be measured with the same scoped scan rather than treated as a fixed acceptance target.

The inventory groups drift as follows:

| Group | Examples | Migration treatment |
| --- | --- | --- |
| Release-visible app UI | Wallets, dashboard, search, trip overview, timeline, and ideas | Migrate screen by screen, starting with active mobile surfaces. |
| Maps, globe, and charts | `lib/map/almidy-map-visuals.ts`, connected trip maps, map markers, flight/map panels | Require semantic review for readability, data meaning, and platform behavior. Do not replace with brand gold mechanically. |
| Provider and system assets | Apple/Google identity marks and system-owned states | Preserve provider specifications and system semantics as documented exceptions. |
| Test-only, simulator, and demo UI | Dashboard simulator and Playwright fixtures | Update only with the production surface they verify; do not lead migration with fixtures. |
| Documentation | Examples and historical design notes | Correct when referenced by active implementation work. |
| Legacy brand drift | Autocomplete orange and isolated old action accents | Replace only after confirming the color is a brand action rather than warning, status, category, or data color. |
| Shadows and overlays | Wallet/card shadows, scrims, translucent map layers | Introduce semantic tokens only after comparing visual depth and contrast on the owning screen. |

## Priority files

### Migrate first

These active, release-visible surfaces combine high raw-color or typography density with direct product impact:

1. `components/dashboard/travel-wallet-sheet.tsx`
2. `components/dashboard/mobile-trips-wallet.tsx`
3. `components/trip/trip-overview-page.tsx`
4. `components/trip/trip-timeline-page.tsx`
5. `components/trip/trip-ideas-page.tsx`
6. `components/trip/connected-trip-map.tsx`, with map-specific semantic review
7. `components/search/search-page.tsx`
8. `app/globals.css`, limited to shared rules with verified semantics

`components/dashboard-layout-simulator.tsx` is high density but should follow the production surfaces it simulates rather than define their tokens.

### Avoid broad migration for now

- Map, globe, route, chart, category, warning, error, and status palettes until their meanings are classified.
- Provider logos and provider-owned controls.
- Admin and observability interfaces unless they are part of a separately approved release surface.
- Tests, demos, and documentation ahead of the production component they mirror.
- Shadows and translucent overlays without visual regression captures.

## Migration principles

1. Migrate one release-visible screen family at a time.
2. Compare before/after screenshots at supported responsive sizes.
3. Map each literal to a semantic role before replacing it.
4. Gold replaces the primary Almidy brand action; it does not replace every colored element.
5. Blue remains valid only for informational, map, or system states where blue communicates meaning.
6. Preserve warning, destructive, success, category, chart, and map distinctions.
7. Preserve provider colors and logos.
8. Prefer the existing Tailwind semantic aliases over introducing component-local CSS variables.
9. Add a new canonical token only when an enduring cross-platform role is established.
10. Do not combine token migration with route, data, behavior, or layout changes.

## Legacy orange decision

The Google Places autocomplete matched-text highlight in `app/globals.css` was release-visible brand drift. It now uses `var(--almidy-brand-gold, #D6A84F)`, backed by a root variable whose value matches the canonical token contract.

The separate `#E67E22` expense-total color in `components/trip/segment-expense-ledger.tsx` was not changed in this phase. It sits within a dark trip ledger alongside category and financial semantics and should be reviewed with the trip screen rather than assumed to be a brand action.

## Typography policy

Do not globally remove `font-bold`, `font-extrabold`, or `font-black`.

- Review large page, sheet, card, and trip titles first; hierarchy should come from size, spacing, contrast, and composition.
- Prefer regular or medium for titles, with limited semibold where readability or accessibility requires it.
- Small badges, compact labels, numeric totals, and dense operational UI may need stronger weight; classify them in context.
- Leave map labels, provider-owned UI, test fixtures, and admin tools unchanged until their owning surface is reviewed.
- Treat `components/dashboard-layout-simulator.tsx`, wallet surfaces, `app/page.tsx`, and the trip overview/timeline/ideas family as the first title-weight review set.

## Accessibility requirements

- Maintain WCAG AA contrast for body text and interactive controls; test large text under the appropriate threshold.
- Do not use gold alone to communicate status or selection.
- Preserve visible focus, hover, pressed, disabled, error, and destructive states.
- Verify browser autocomplete and provider widgets in both supported color schemes.
- Check Dynamic Type-equivalent responsive behavior: zoom, text wrapping, truncation, and 44-pixel minimum interactive targets.
- Validate map and chart palettes for label legibility and non-color cues.

## Validation plan per migrated screen

1. Run token parity verification and TypeScript checks.
2. Run the production Next.js build.
3. Run focused component or Playwright tests for the changed surface.
4. Capture responsive before/after screenshots, including interactive states.
5. Check light/dark variants where the surface supports both.
6. Search the migrated files for remaining raw values and document intentional exceptions.
7. Review the diff to ensure no route, auth, API, persistence, or production configuration changes are mixed in.

Lightweight inventory checks may be added later, initially as reporting-only checks. They should support an explicit exception list and must not fail the build on the existing backlog until each surface has an approved migration.

## Do not do

- Do not mass-convert raw colors.
- Do not mass-remove heavy font classes.
- Do not use gold for every semantic color.
- Do not recolor provider assets.
- Do not flatten map, globe, chart, shadow, or overlay depth.
- Do not redesign layouts during token migration.
- Do not combine token work with routes, authentication, sessions, APIs, trip persistence, maps behavior, or production settings.
- Do not declare the migration complete based only on lower occurrence counts.
