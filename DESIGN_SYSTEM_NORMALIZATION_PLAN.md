# Almidy Native Design System — Spacing, Radius & Surface Normalization Plan

## Executive summary

This document records the v2.4 planning audit against commit `459b139`. It proposes no production rendering change. The current foundation is coherent: most off-scale values belong to measured feature compositions, while a smaller set of neutral surfaces, generic separators, and reconstructed shadows are credible future normalization candidates.

The recommended first implementation is **v2.4A — Neutral Surface Normalization**. It should evaluate `tripOverviewNeutralSurface` (`#F3F3F5`) against the canonical grouped neutral (`#F2F3F6`) in isolation. Semantic role names should remain distinct even if their Light-mode pixels converge.

## Audit method and current state

The audit searched all production Swift for constraints, insets, margins, stack spacing, radii, backgrounds, borders, separators, shadows, semantic tokens, and shared-component overrides. Counts below are line-based usage indicators, not claims that every numeric occurrence has equivalent semantics.

- 12 spacing values audited: 4, 6, 8, 10, 12, 14, 16, 18, 20, 24, 32, 48.
- 13 radius values/families audited: 8, 10, 12, 18, 20, 22, 24, 28, 30, 34, 36, 38, 40, plus shape-derived circles.
- 12 active surface roles audited.
- 7 canonical elevation families plus 6 local/compatibility patterns audited.
- 8 border roles and six observed width families audited.
- 26 shared override/construction sites reviewed: 6 icon-button overrides, 9 sheet overrides, and 11 surface constructions (including canonical definitions).

## Spacing

| Value | Matching layout lines | Finding | Future recommendation |
|---:|---:|---|---|
| 4 | 43 | Canonical micro spacing; also renderer math | Retain token; keep renderer values local |
| 6 | 17 | Compact card/timeline gaps | Retain as measured local exception; no global token yet |
| 8 | 51 | Canonical small spacing and Globe inset | Retain canonical role |
| 10 | 30 | Compact card padding, title gaps, compatibility stacks | Review component-by-component; do not round globally |
| 12 | 66 | Canonical element gap and Globe bottom inset | Retain canonical role |
| 14 | 36 | Sheet/header top placement and measured editor/card padding | Retain as compatibility geometry unless equivalent consumers emerge |
| 16 | 81 | Canonical internal/card padding | Prefer for reusable components |
| 18 | 48 | Trip Overview rhythm, route/editor sections, card gaps | Mostly intentional; normalize only proven generic equivalents |
| 20 | 80 | Canonical native page/sheet inset | Default for reusable page/sheet composition |
| 24 | 34 | Canonical large spacing/content inset | Retain canonical role |
| 32 | 16 | Canonical section spacing and large composition gaps | Retain canonical role |
| 48 | 6 | Canonical extra-large spacing/control contexts | Retain canonical role |

### 18 versus 20

Twenty points is the reusable native sheet/page inset. Eighteen points primarily encodes Trip Overview inter-card rhythm, route/editor section spacing, and measured compatibility layouts. Keep both. A future implementation may migrate a local 18 to 20 only when its semantic role is demonstrably the same page inset and its covered screenshot is approved.

### 14 versus 16

Sixteen points is the reusable internal/card inset. Fourteen points commonly expresses top chrome placement, compact vertical padding, and measured editor geometry. It is not missing generic spacing. Retain 14 locally; prefer 16 for new reusable card content.

### Exception policy

The canonical scale remains 4/8/12/16/20/24/32/48. Values 6/10/14/18 remain permitted when documented as measured component, renderer, media, or accessibility geometry. Repetition alone does not justify a token.

## Radius

| Role/family | Current values | Consumers | Recommendation | Risk |
|---|---|---|---|---|
| Small/field | 8, 12 | compact surfaces, inputs | Retain `small` and `field` | A |
| Control | 18, local 20 | pills, controls, selected surfaces | Keep 18 canonical; review local 20 only with component evidence | B/C |
| Ordinary cards | 22, 24 | Place-specialized and shared cards | Keep 24 shared; retain Place 22 | C |
| Large cards | 28 | Trip Overview, large/shared compatibility surfaces | Retain 28 | D on Overview |
| Utility compatibility | 28, one 30 | utility sheets; Itinerary date picker uses 30 | Keep utility 28; retain measured 30 exception | C |
| Editor sheets | 34 | editor family and Overview | Retain semantic roles even when raw value matches | D |
| Prominent sheets | 36 | prominent editor/map family | Retain | D |
| Place Card | 38 | Place summary/large sheet | Retain feature identity | D |
| Globe sheet | 40 | in-view Globe sheet | Retain feature identity | D |
| Media cards | 36 | Globe trip cards | Retain feature-owned radius | D |
| Circles/capsules | derived | icon controls, badges | Continue shape derivation; never add numeric circle tokens | A |

The lone 30pt radius is the measured Native Itinerary date-picker sheet. It is not evidence that 28 should become 30. The 34/36/38/40 sheet family describes editor/Overview, prominent, Place, and Globe identities respectively and should remain separated.

## Surfaces

| Existing role | Current Light value | Role/consumers | Proposed direction | Risk |
|---|---:|---|---|---|
| `canvas` / `surface` / `settingsCard` | `#FFFFFF` | page and raised white surfaces | Retain distinct semantics | — |
| `canvasGrouped` | `#F2F3F6` | grouped canvas | Retain canonical value | — |
| `surfaceNeutral` | `#F2F3F6` | generic neutral cards, inputs, badges | Retain semantic role | — |
| `settingsBackground` | `#F2F3F6` | settings/account utility canvas | Retain semantic role | — |
| `tripOverviewNeutralSurface` | `#F3F3F5` | Overview/Itinerary/New Activity and travel selector | Candidate to render `#F2F3F6`; keep role name | B |
| `goldMutedSurface` | `#F2EBDD` | muted accent actions/timeline prompts | Retain | — |
| `inputSurface` | `#F5F5F7` | outlined custom inputs | Retain hierarchy | B/C |
| on-media roles | white alphas / scrim | media text and controls | Retain | D |
| `mapSurface` | `#030406` | map/globe rendering | Retain | D |

### `#F2F3F6` versus `#F3F3F5`

The one-channel-scale neutral difference is subtle and does not encode a clearly documented hierarchy. Consolidating the Trip Overview neutral pixel to `#F2F3F6` would improve consistency across grouped utilities and reduce accidental near-neutral drift. Because it touches Trip Overview, Itinerary, New Activity, and Place travel modes, it remains a visible Tier B proposal requiring isolated before/actual/diff review. Preserve the semantic name for future Dark Mode divergence.

## Borders

Canonical roles are hairline, outline, outlineStrong, selected, selectedProminent, onMedia, timeline, and input/settings compatibility lines.

- Future generic separators should use `1 / UIScreen.main.scale` through `Border.hairline`/`AlmidyDivider`.
- Existing local 0.5pt lines are compatibility geometry and should migrate only after comparing 2× and 3× rendering.
- 0.75pt map-control compatibility borders remain map-specific.
- 1pt outlines remain ordinary surface/input boundaries.
- 2pt selection/timeline roles and 3pt prominent map-selection borders remain specialized.
- On-media outlines retain their alpha-based white role.

## Elevation

| Family | Contract | Finding |
|---|---|---|
| `controlSubtle` | 8%, radius 10, y 4 | Exact local reconstructions exist; future Tier A API adoption |
| `controlRaised` | 10%, radius 14, y 5 | Native Itinerary close control is an exact candidate |
| `floating` | 16%, radius 12, y 5 | Itinerary floating controls match exactly |
| `cardRaised` | 18%, radius 24, y 12 | Existing local card match; future exact adoption |
| `sheet` | 20%, radius 34, y −4 | Preserve sheet-specific direction |
| `mapPin` | 24%, radius 5, y 2 | Renderer-specific; exclude from generic cleanup |
| `textOnMedia` | 90%, radius 2.5, zero | Media/rendering-specific; retain |
| local search chrome | 6%, radius 14, y 7 | Compatibility shadow; needs visual evidence |
| Globe action | 6–8%, radius 18, y 9 | Retain as Globe identity pending focused review |
| Place Save | 18%, radius 10, y 4 | Feature-specific; does not match raised card |
| annotation badge | 20%, radius 3, y 1.5 | Renderer-specific; retain |

Exact semantic matches are low-risk code cleanup only if they produce zero pixels. Near matches must not be folded into canonical elevation families without approval.

## Shared-component overrides

- `AlmidyIconButton`: six measured override sites. Globe, Place, and Trip Overview vary diameter, symbol size, foreground/background, border, or elevation for genuine feature composition. The repeated 50pt Itinerary control is a measured compatibility case, not a new global default.
- `AlmidySheetConfiguration`: nine override sites. Most override detents and grabber behavior rather than visual defaults. Place 38 and feature detents, Globe custom sheet behavior, and Overview detents remain specialized. The API is not overloaded.
- `AlmidySurfaceStyle`: canonical variants are sound. `groupedCard` represents a useful white-on-grouped surface with subtle border. Custom search, amount, form-section, and Overview styles reflect different compositions; do not add variants until a second equivalent consumer exists.
- `AlmidyButton`, `AlmidySheetHeader`, `AlmidyCard`, `AlmidyListRow`, `AlmidyFormSection`, `AlmidyActionRow`, `AlmidyEmptyState`, `AlmidyFloatingControl`, and `AlmidyInputStyle`: no evidence that their canonical defaults should change globally.

## Protected feature geometry

Retain by default: Trip Overview hero/collapse/cards/actions; Globe sheet and media cards; Place Card sheet and specialized cards; map annotations/renderers; Saved Place measured fields/schedules; Transportation routes; Flight aviation composition; Native Itinerary timeline; accessibility-specific layouts; media crop/contrast geometry.

## Candidate risk matrix

| Candidate | Tier | Consistency | Visual benefit | Cost | Regression | Coverage | Accessibility |
|---|---|---|---|---|---|---|---|
| Replace exact local shadows with identical elevation APIs | A | Medium | None | Low | Low | Mixed | Low |
| `tripOverviewNeutralSurface` pixel to `#F2F3F6` | B | High | Low | Low | Medium | Strong for Overview/Place; partial elsewhere | Low |
| Generic 0.5pt separators to pixel hairline | B/C | Medium | Low | Medium | Medium | Editor screenshots partial | Low |
| Generic page inset 18→20 where semantically identical | C | Medium | Medium | Medium | Medium | Mixed | Medium |
| Generic internal inset 14→16 where equivalent | C | Medium | Medium | Medium | Medium | Mixed | Medium |
| Ordinary 22/24/28 card convergence | C | Medium | Medium | Medium | Medium/high | Mixed | Medium |
| Globe action elevation to canonical raised control | C/D | Medium | Medium | Low | High | Globe screenshots strong | Low |
| Trip Overview, Place, Globe radii/geometry | D | Low | High/brand-changing | High | High | Strong but intentionally protected | High |

## Screenshot coverage and gaps

Pixel-protected: Trip Overview neutral/card rhythm; Globe cards/actions/controls; Place travel selector; Saved Place; Train transportation; Flight. Geometry-only or uncovered: full Globe sheet, full Place Card, Native Itinerary, Search, Settings, Cost, keyboard/pickers, and authenticated states. Add focused snapshots for Itinerary, Search, Settings, and Cost before normalizing their surfaces or spacing.

## Proposed target system

- Spacing: canonical 4/8/12/16/20/24/32/48 with documented 6/10/14/18 measured exceptions.
- Radius: retain `small`, `field`, `control`, `card`, `cardLarge`, `sheetUtility`, `sheetEditor`, and `sheetProminent`; keep Place 38, Globe 40, media 36, Overview 28/34, and date-picker 30 as feature contracts.
- Surfaces: preserve canvas, grouped canvas, surface, neutral surface, input, accent-muted, on-media, and map semantics. Light values may converge without deleting semantic roles.
- Borders: pixel hairline for new generic separators; semantic 1/2/3pt and renderer-specific compatibility roles remain.
- Elevation: prefer existing semantic configurations for exact matches; keep near-match compatibility and renderer shadows local.

## Implementation sequence

1. **v2.4A — Neutral Surface Normalization:** evaluate only `#F3F3F5` → `#F2F3F6`, preserve semantic roles, review all covered states.
2. **v2.4B — Exact Elevation API Adoption:** replace only provably pixel-identical local reconstructions.
3. **v2.4C — Generic Separator Policy:** add missing baselines, then migrate genuine generic separators one family at a time.
4. **v2.4D — Shared Spacing Review:** page insets first, internal card insets second; no feature geometry.
5. **v2.4E — Ordinary Card/Control Radius Review:** shared components only, with explicit visual approval.
6. **Feature compatibility reviews:** opt-in proposals for Globe, Place, editors, and Trip Overview only when product benefit outweighs identity/regression risk.

## Approval gates

Every visible implementation requires committed before baseline, actual normalized render, exact pixel diff, human approval, accessibility review, unchanged behavior suite, and explicit baseline recording. Never combine neutral, spacing, radius, border, and elevation changes in one review.

## Figma, Coolors, Dark Mode, and cross-platform

Figma should define semantic variables/styles for spacing, radius, surface, border, and elevation using the proposed roles, while retaining documented feature exceptions. Do not change Figma raw values until native approval. Coolors should retain both near-neutral references until v2.4A is approved. Canvas, grouped canvas, surface, neutral, input, on-media, and map semantics must remain distinct so future Dark Mode can diverge even if Light values converge. Web and Android implementation remains out of scope; approved reusable semantic decisions can be promoted during later cross-platform alignment.
