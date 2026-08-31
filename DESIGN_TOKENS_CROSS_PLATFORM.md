# Almidy Cross-Platform Design Token Contract

## Principles

The shared contract describes product intent, not UIKit, CSS, or Compose mechanics. Each platform renders the same semantic language with native accessibility, navigation, controls, sheets, maps, and responsive behavior.

## Source of truth and lifecycle

`design-system/almidy.tokens.json` is the canonical **Almidy Design Tokens 2.0.0** contract. Shared tokens move through `proposed → active → compatibility → deprecated → removed`. The root `colors`, `spacing`, and `radius` objects are compatibility mappings for current web consumers; new shared work uses `semantic`.

`lib/design-system/almidy-tokens.ts` is the typed web adapter. Swift remains a platform implementation validated against the canonical contract. Future Kotlin should consume the schema when Android work begins; no Android generator or build tooling is introduced now.

## Token schema

Colors model modes inside each semantic role:

```json
"canvas": { "light": "#FFFFFF", "dark": "#151310" }
```

Appearance-independent roles such as `onMediaPrimary` remain scalar values. Increased Contrast is platform-owned because accessibility mechanisms and required adjustments differ; it may strengthen the same intent without creating new shared role names.

## Semantic families

| Family | Shared contract | iOS | Web | Figma | Future Android |
| --- | --- | --- | --- | --- | --- |
| Color | Light/Dark semantic roles | Dynamic UIColor | Typed tokens; compatibility aliases remain | Light/Dark modes | Compose ColorScheme mapping |
| Typography | Instrument Sans base roles | UIFontMetrics scaling | `next/font/local` plus semantic responsive utilities | Shared text styles | TextStyle + Android scaling |
| Spacing | 4/8/12/16/20/24/32/48 | CGFloat aliases | px/rem adapter | Numeric variables | dp |
| Radius | small/field/control/card/cardLarge | CGFloat roles | CSS radius adapter | Numeric variables | RoundedCornerShape |
| Shape | circle/capsule intent | Native shape resolution | border-radius implementation | Shape variables | CircleShape/RoundedCornerShape |
| Elevation | Named intent levels | CALayer configurations | CSS shadow/surface mapping | Effect styles | Compose elevation/surface |
| Border | hairline/outline/outlineStrong/selected intent | Physical-pixel-aware borders | CSS pixel borders | Stroke styles | dp strokes |

## Colors

Shared adaptive roles are accent, accentPressed, accentText, accentMuted, accentMutedSurface, canvas, canvasGrouped, surface, surfaceNeutral, textPrimary, textSecondary, textTertiary, borderSubtle, dividerSubtle, borderStrong, inputSurface, inputBorder, inputPlaceholder, stateDisabledFill, stateDisabledText, success, danger, and info.

Shared fixed roles are onMediaPrimary, onMediaSecondary, onMediaTertiary, and overlayScrim. Map surfaces, generated-image gradients, image-derived palettes, annotations, and renderer colors remain feature/rendering-owned.

## Typography

Instrument Sans is the approved product family. Shared base roles are displayHero, screenTitle, sheetTitle, sectionTitle, cardTitle, body, bodyCompact, bodyEmphasized, action, metadata, metadataEmphasis, caption, and badge. The contract supplies base size and weight only. iOS Dynamic Type, web responsive/rem behavior, and Android font scaling remain platform-owned.

The web implementation loads the repository-approved 400/500/600/700 faces once from `ios/App/App/Fonts/InstrumentSans` through `next/font/local`; the adjacent OFL file documents licensing. The CSS variable `--font-almidy-product` and Tailwind `font-almidy` utility own product sans typography. Monospace technical data, third-party/provider rendering and feature/media-specific treatments remain explicit exceptions. Web line heights are platform mappings, and `displayHero` expands responsively from the shared 52px base without adding breakpoint values to the shared JSON.

## Platform and feature exclusions

The shared JSON excludes safe areas, sheet detents, MapKit camera values, CALayer tuples, CSS shadow tuples, Compose mechanics, keyboard offsets, accessibility layout mechanics, and measured 6/10/14/18 spacing. Trip Overview, Globe, Place Card, editor, media, and map geometry remain feature-owned. Compatibility aliases may stay platform-local until their consumers migrate.

## Web audit and risk classification

| Tier | Finding | Action |
| --- | --- | --- |
| A — exact semantic match (20 families) | Existing gold/ink/mist/line aliases and shared Light-role values | Adopted through the typed web adapter and `almidy-*` Tailwind utilities; ambiguous white/black feature composition remains scoped |
| B — same intent, different value (5 families) | Warm trip neutrals, mobile dark surfaces, focus colors, selected states, and panel shadows | Require visual coverage and product review |
| C — feature/platform semantic (6 families) | Maps/globe, wallet imagery, provider colors, auth chrome, admin status UI, native-map underlay | Keep scoped |
| D — legacy web debt (4 palette families) | Broad slate, blue, orange, and mixed zinc/gray utility usage | Inventory-backed future migration |

Current web has no comprehensive visual-regression suite for a global token migration. v2.6B therefore limits adoption to exact equivalents and verifies the generated semantic inputs deterministically, with no intentional visual changes.

### v2.6B Tier A adoption manifest

| Old source | Old value | Canonical role | Migrated consumers | Rendered difference |
| --- | --- | --- | ---: | --- |
| `ink` | `#050505` | `textPrimary` | 39 | None |
| `line` | `rgba(0,0,0,0.10)` | `borderSubtle` | 52 | None |
| `brand` / `--almidy-brand-gold` | `#D6A84F` | `accent` | 36 | None |
| `mist` global canvas | `#F2F3F6` | `canvasGrouped` | 1 | None |

The active consumers now use `almidy-text-primary`, `almidy-border-subtle`, `almidy-accent`, and `almidy-canvas-grouped`. Compatibility aliases remain available and resolve through the same semantic adapter. `#050505` dark import panels, white composition, scrim alpha values, and media colors were audited but retained because their semantic ownership is not shared text/accent/surface intent.

### Migration backlog

| Current usage | Desired direction | Risk | Coverage | Phase |
| --- | --- | --- | --- | --- |
| Exact gold/ink/mist/line values | Semantic web aliases/CSS variables | Low | Build/typecheck plus deterministic equivalence scan | Completed in v2.6B |
| Warm trip neutrals (#221d17, #6f675c, #8a8175, #f7f6f2, #faf8f5) | Decide shared feature palette vs local ownership | Medium | Feature tests, limited pixels | v2.6C |
| Dark/mobile neutrals (#121214, #1f1f21, #1e1e24, #25252d, #343338) | Compare with shared Dark roles | High | Partial | v2.6C |
| Slate/blue/orange Tailwind families | Intent-by-intent semantic migration | High | Fragmented | v2.6C |
| Map/media gradients and pins | Remain renderer/feature scoped | High | Specialized | Retain |

## Tailwind and CSS

The typed adapter exports the Light-mode `webSemanticColors` map, and Tailwind exposes it as stable `almidy-*` utilities. The current compatibility keys remain available but now resolve through that map. The global autocomplete accent uses `--almidy-color-accent`, resolved from the Tailwind semantic utility without another raw palette source. Broad web Dark Mode is not part of v2.6B.

`scripts/verify-web-token-adoption.mjs` rejects reintroduced `ink`/`line`/`brand` production utilities and raw canonical gold, verifies compatibility routing, and proves accent, grouped canvas, primary text, and subtle border values remain exact. It deliberately permits classified feature/provider/map/media values.

### v2.6C Tier B visual reconciliation

Five strict Playwright fixtures were established from the v2.6B rendering before any candidate change and reproduced with zero diff. The suite covers warm Light composition, mobile Dark composition, keyboard focus, selected/unselected state and raised-panel elevation. It uses pinned local Chromium, waits for fonts, disables motion and compares with zero channel threshold and zero differing pixels. See [`design-baselines/web/README.md`](design-baselines/web/README.md).

Warm trip neutrals were retained after the candidate made the editorial card visibly colder and more generic. Generic mobile form surfaces partially adopted shared Dark `canvasGrouped`, `surface` and `surfaceNeutral` roles; wallet, map, auth and other feature compositions remain scoped. The draggable-list selected fill adopted `accentMutedSurface` while retaining primary text for accessible contrast. Existing blue/orange keyboard focus and the web `panel` shadow tuple were retained because they provide stronger focus recognition and appropriate platform depth without unrelated compensation.

## Figma and Coolors

Figma uses one semantic variable collection with Light and Dark modes, matching JSON names. Typography, spacing, radius, shape, elevation intent, and border intent use the same roles. Feature exceptions remain scoped libraries. Increased Contrast stays platform-specific until design provides shared contrast modes. Coolors is reference/exploration only: contract → Figma/platforms → Coolors reference.

## Future Android

Map shared colors into a Compose color scheme, typography roles into Instrument Sans TextStyles, spacing into dp, radii into RoundedCornerShape, and shape intent into native shapes. Elevation and border names map to Compose-native implementations. Android retains Material navigation, accessibility scaling, native sheets/dialogs, and Android map controls; it must not copy UIKit mechanics.

## Validation

`npm run tokens:verify` validates contract version/schema, legacy compatibility, semantic names, Light/Dark modes, Swift role presence, typography bases, spacing/radius values, and TypeScript/Tailwind consumption. Native visual suites independently prove that reconciliation does not change Light or Dark pixels.

The same command now verifies the single Instrument Sans registration, all four approved weights, the product-font CSS variable, Tailwind typography consumption and the global product-font application. Exact web pixels are enforced separately by the seven-fixture Playwright suite.
