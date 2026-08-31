# Web design baselines

The v2.6C Tier B suite uses Playwright 1.60 Chromium on macOS. Desktop fixtures render at 1280×900 and the existing mobile-dark fixture at 390×844, in `en-US` with CSS-pixel screenshots. The harness waits for `document.fonts.ready`, requests reduced motion, disables animations/transitions and hides the caret. It compares with `threshold: 0` and `maxDiffPixels: 0`.

Run `npm run test:visual:web` for strict comparison. Recording is never automatic; `npm run test:visual:web:update` is the explicit full-suite update command, while approved family changes should use Playwright `--grep` to update only the affected fixture. The suite is locally deterministic with the repository-pinned Playwright Chromium. Hosted CI must pin the same browser, OS and font environment before treating pixels as portable.

`v2.6c-before/` contains the five twice-verified pre-reconciliation images. The active approved images live beside `tests/playwright/tier-b.visual.spec.ts`. Only `tier-b-mobile-dark-darwin.png` and `tier-b-selected-light-darwin.png` changed after review; warm, focus and shadow baselines remain identical to their pre-change images.

| Family | Audited | Changed | Retained | Decision |
| --- | ---: | ---: | ---: | --- |
| Warm trip neutrals | 53 occurrences / 9 files | 0 | 53 | Retained: strict candidate diff removed intentional editorial warmth |
| Mobile dark neutrals | 23 occurrences / 11 files | 6 | 17 | Partially reconciled: generic mobile form shells/groups/focus surfaces use shared Dark roles; wallet/map/auth composition remains scoped |
| Orange/blue focus | 124 occurrences / 29 files | 0 | 124 | Retained: existing keyboard focus remains more conspicuous; broad utility cleanup is Tier D |
| Selected-state fills | 4 classified candidates / 3 files | 1 | 3 | Partially reconciled: draggable selection uses muted accent surface; admin/map/feature selections remain scoped |
| Panel shadow | 26 consumers / 19 files | 0 | 26 | Retained: current CSS tuple already expresses web raised-panel intent |

## Approved rendered changes

- `components/ui/mobile-form.tsx`: `#1f1f21` → Dark `canvasGrouped` (`#1B1916`); `#1e1e24` → Dark `surface` (`#211F1B`); `#25252d` → Dark `surfaceNeutral` (`#292620`).
- `components/trip/trip-segment-form.tsx`: the same three role mappings for the shared mobile segment form.
- `components/DraggableList.tsx`: selected `blue-50` (`#EFF6FF`) → `accentMutedSurface` (`#F2EBDD`); the existing accent border and primary text remain.

The selected fixture deliberately uses `textPrimary`, not `accentText`: `accentText` on `accentMutedSurface` measured 4.47:1, while primary text preserves strong normal-text contrast. White on Dark canvas measures 18.54:1. Focus styling is unchanged and remains visibly represented in its baseline.

## v2.7 typography baselines

Two fixtures were added and twice verified before Instrument Sans adoption: `typography-trip-light` protects editorial hierarchy, metadata, cards and wrapping; `typography-auth-light` protects headings, labels, inputs, actions and supporting copy. Their system-font reference images live in `v2.7-before/`. The active suite has seven fixtures and continues to wait for `document.fonts.ready` with exact RGBA comparison (`threshold: 0`, `maxDiffPixels: 0`).

After visual review, all seven active PNGs were explicitly re-recorded for the approved product-family migration. Expected differences are glyph contours, widths, baselines and the semantic role metrics visible in the two typography fixtures. No color, radius, border, shadow or focus policy changed. Run `npm run test:visual:web`; recording remains opt-in through `npm run test:visual:web:update` or a focused Playwright `--grep` update.

## v2.7B component baseline

`web-components-light` was captured and verified before consolidation, then isolated behind the test-only `?components=true` fixture mode so the original seven screenshots retain exact document geometry. Its preserved reference lives in `v2.7b-before/`. The gallery covers primary, neutral and disabled actions; ordinary and invalid inputs; an ordinary card; representative badge typography; and an empty-state hierarchy.

After review, only `web-components-light` and `typography-auth-light` were explicitly updated. Approved visible changes are the product primary action from black to accent/accentPressed and Auth fields adopting the ordinary 44px/12px field geometry. The suite keeps exact RGBA comparison. A non-image test also verifies keyboard focus order, disabled skipping, the invalid-field description, no overflow at an effective 200% desktop width, and the canonical mobile width.
