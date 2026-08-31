# Almidy Design System v2 Release

## Status

Design System v2 is complete with a non-blocking post-v2 backlog and is approved for freeze. The release candidate is `d6e8d6f4337d3ff51e013d8495f4488c07d02cb0`; the final freeze commit and annotated tag are recorded after this document is committed.

## What v2 establishes

- One canonical shared contract: `design-system/almidy.tokens.json`, named **Almidy Design Tokens**, version `2.0.0`, with Light and Dark modes.
- One native semantic namespace, `AlmidyDesignTokens`, and a typed web adapter in `lib/design-system/almidy-tokens.ts`.
- Instrument Sans Regular, Medium, SemiBold, and Bold as product typography on native and web.
- Semantic color, typography, spacing, radius, shape, border, and elevation intent with platform-owned rendering and accessibility mechanics.
- Reusable native and web components, while preserving intentional Trip Overview, Globe, Place Card, editor, map, media, provider, Wallet, and admin composition.

## Native

Native supports Light and Dark appearance plus platform-owned Increased Contrast. Dynamic `UIColor` values flow through `AlmidyDesignTokens.Color`; layer-backed shared components refresh after trait changes. The component system includes icon and text buttons, dividers, badges, surfaces, inputs, sheets, cards, rows, sections, empty states, and floating controls. `AlmidyBadge`, `AlmidyCard`, `AlmidyFormSection`, `AlmidyActionRow`, and `AlmidyFloatingControl` are currently tested canonical APIs without production consumers; they are not duplicate sources of truth and are retained for governed adoption.

The two historical `.bold` scan results are intentional: the Trip Overview removal glyph is an SF Symbol configuration weight, and Saved Search's empty title resolves through `AlmidyDesignTokens.Font` to Instrument Sans Bold with `UIFontMetrics`. Neither is unsupported product typography.

## Web

Web consumes JSON through the typed adapter, semantic Tailwind/CSS roles, and focused primitives (`AlmidyButton`, `AlmidyInput`, `AlmidySelect`, and `AlmidyCard`). Ordinary reusable styling has canonical ownership; feature/provider/map/media/admin presentation remains scoped. Instrument Sans loads once through `next/font/local`, with local approved faces, fallback behavior, preload, and `font-synthesis` governance.

The v2.6C Tier B decisions are final: warm trip neutrals, focus colors, and the panel shadow remain web-specific; generic mobile dark surfaces and the draggable selected fill are partially reconciled through shared semantics. Tier C remains feature/platform-owned. Tier D slate, blue, orange/amber, and zinc/gray debt moves to post-v2.

## Cross-platform tokens

The canonical flow is:

```text
design-system/almidy.tokens.json
→ Swift and TypeScript platform adapters
→ semantic native/web APIs
→ shared and feature components
```

Shared meaning does not require identical UIKit, CSS, or future Compose mechanics. The frozen token checksum is `02dafa56733843c6cb575a3fc78939cdc1ff4701f00b734c290425c01db26741` (SHA-256).

## Governance

- Spacing: 4/8/12/16/20/24/32/48; measured 6/10/14/18 values remain feature-scoped.
- Radius: small 8, field 12, control 18, card 24, cardLarge 28; circles/capsules are shapes, and 28/30/34/36/38/40 sheet/feature radii remain intentional.
- Borders: native generic custom hairlines are one physical pixel; outlines, selections, renderer strokes, and measured compatibility lines remain distinct.
- Elevation: controlSubtle, controlRaised, floating, cardRaised, and sheet express shared intent with platform rendering.
- Token lifecycle: proposed → active → compatibility → deprecated → removed.
- Future visual changes follow semantic proposal → affected-platform audit → fixture coverage → implementation → visual review → parity verification.

## Accessibility

Native coverage includes Dynamic Type, AX XXXL, VoiceOver activation, minimum targets, Light/Dark, and Increased Contrast semantics. Web coverage includes headings and labels, keyboard/focus behavior, disabled/error semantics, representative 200% width behavior, mobile wrapping, and deterministic component fixtures. Full automated coverage of every feature, assistive technology, and browser remains continuous post-v2 work.

## Visual regression contract

Native uses iPhone 17e, iOS 26.5, 393×852 points at 3×, portrait, `en_US`, Large content size, with one AX XXXL fixture. Twelve Light and twelve Dark PNGs compare with exact RGBA equality. The four-test harness validates naming, decoding, dimensions, and mismatch reporting.

Web uses repository-pinned Playwright Chromium on macOS. Desktop fixtures use 1280×900 and mobile uses 390×844; the harness waits for `document.fonts.ready`, requests reduced motion, freezes animations/transitions and caret rendering, uses fixed fixture data, and allows zero differing pixels. Eight screenshots are active; the ninth test is accessibility/responsive behavior.

Active fixture PNGs are canonical regression baselines. Images under `design-baselines/web/v2.6c-before`, `v2.7-before`, and `v2.7b-before` are design-review references only and never active expected output. The validated repository inventory is 24 native canonical PNGs, 8 active web PNGs, and 8 preserved web references: 40 total.

## Verification matrix

| Gate | Frozen result |
| --- | --- |
| Native runtime | 95/95 |
| Native Light | 12/12 |
| Native Dark | 12/12 |
| Native snapshot harness | 4/4 |
| Web visual/accessibility | 9/9 |
| PNG validation | 40/40 |
| TypeScript | Passed |
| Web production build | Passed |
| Shared token verification | Passed |

## Known non-blocking gaps

- Broad global web Dark Mode is post-v2: the shared Dark contract exists, but rollout needs its own product scope and regression review.
- Tier D web palette cleanup, additional deterministic fixtures, deeper feature-level consolidation, broader accessibility automation, Android implementation, automated Figma synchronization, and optional token code generation are post-v2.
- Full native Globe/map, Map Preferences, Place Card, Itinerary, Search, Settings/account, and system-input pixels remain geometry/behavior-covered where stable deterministic pixels are unavailable.
- The calendar-sync auth-boundary test receives 501 where it expects 401. This is a pre-existing backend/API mismatch, not a design-system release blocker.

Figma should mirror the contract's Light/Dark variables and semantic styles; the JSON contract remains implementation authority until automated synchronization exists. Coolors remains reference/exploration only.

## Tag

The release tag is `almidy-design-system-v2`, an annotated tag that points to the final documentation/freeze commit.
