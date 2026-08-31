# Almidy Design System v2 Roadmap

## Native Design System v1 freeze

**Status:** Complete and frozen
**Freeze date:** August 27, 2026
**Runtime baseline:** 88 executed / 88 passed / 0 failed
**Visual policy:** Existing intended appearance preserved
**Recommended milestone:** `almidy-native-design-system-v1`

The working tree contains the complete multi-phase migration, so repository commit `afec563` is only the current base commit and is not claimed as the v1 milestone. Create the named milestone after the closure changes are committed and reviewed.

The frozen dependency model is:

```text
Feature / Domain
        ↓
Feature Components
        ↓
Shared Native Components
        ↓
Primitives
        ↓
AlmidyDesignTokens / Design Foundation
```

Map and Trip Overview retain their specialized intermediate boundaries:

```text
MapKit / Map Domain                 Trip / Overview Domain
        ↓                                    ↓
Map Feature Components             Trip Overview Feature Components
        ↓                                    ↓
Shared Almidy Components           Component.TripOverview
        ↓                                    ↓
Design Foundation                  Shared Components / Primitives
                                             ↓
                                    Design Foundation
```

## v1 coverage matrix

| Surface | v1 status | Ownership retained | Future normalization candidate |
|---|---|---|---|
| Globe | Canonical adoption complete | Custom sheet state, camera and trip domain | Header/action typography and exact aliases only |
| Map Preferences | Canonical adoption complete | Map previews, switches and persistence | Preview-card radius after screenshots |
| Search | Canonical adoption complete | MapKit completion/results and native table reuse | Result typography and search-field radius |
| Annotations | Canonical adoption complete | MapKit reuse, collision, selection and rendering offsets | None without renderer baselines |
| Place Card | Canonical adoption complete | Look Around, ETA, routes, contact and Save composition | Contact-card typography; radius/elevation only with fixtures |
| Globe trip cards | Canonical adoption complete | Trip media lookup, fallback and navigation | None before stable media substitution |
| Trip Overview | Canonical adoption complete | Hero/media, collapse, actions and specialized cards | Treat future changes as explicit redesign |
| Native Itinerary | Canonical adoption complete | Timeline, date composition and menus | 17/18 typography and 20/24 radii after screenshots |
| New Activity | Canonical adoption complete | Category/search/editor orchestration | Typography, 24pt cards and icon sizing |
| Cost | Canonical adoption complete | Monetary parsing and keyboard geometry | Header typography only |
| Note | Canonical adoption complete | Native multiline editing and keyboard behavior | Header typography only |
| Date / Time | Canonical adoption complete | Native pickers, locale and timezone behavior | Header action typography |
| Location | Canonical adoption complete | Map item, autosave and measured embedded cards | 18pt card family and 14pt rhythm |
| Saved Place | Canonical adoption complete | Saved-place state and autosave | Same embedded-card family as Location |
| Transportation | Canonical adoption complete | Routes, drafts, validation and submission | Route-card typography and icon sizing |
| Flight | Canonical adoption complete | Airport/IATA/timezone/AR behavior | Route-card typography and icon sizing |
| Reservation / Links / Attachments | Canonical adoption complete | System alerts/pickers and feature payloads | 18pt/64pt utility geometry after fixture coverage |
| Settings | Canonical adoption complete | Native table and account routing | Neutral aliases and 24/28 radii |
| Account / Profile | Canonical adoption complete | Authentication/account domain | Pastel surfaces and grouped typography |
| Auth | Canonical adoption complete | Provider/session behavior | Input/card surface alignment |
| Create Trip | Canonical adoption complete | Destination, dates and media selection | 17/18 typography and card-radius family |

No genuine missed v1 adoption was found. “Specialized” and “platform-native” in this matrix are valid ownership outcomes, not incomplete migration.

## Compatibility debt inventory

Consumer counts are approximate static call-site families, not runtime instances.

| Owner / role | Current values | Consumers | Classification | Change risk |
|---|---|---:|---|---|
| Native typography | 16 regular; 17 regular/medium/semibold; 18 medium/semibold | 19 / 44 / 28 raw declarations repository-wide | Likely normalization debt where semantic roles match | High |
| Specialized typography | 11–15 captions, 20–24 titles, 27/32/36/38/52 display/media | Feature-specific | Intentional or requires evidence | High |
| Shared radii | 8 field-small, 12 field, 18 control, 24 card, 28 large card | Shared components | Intentional semantic family | Medium |
| Sheet radii | 28 utility, 34 editor/Overview, 36 prominent, 38 Place, 40 Globe | Five presentation roles | Intentional measured presentation | High |
| Local surface radii | 18, 20, 22, 24, 26, 28, 30 | Editors, routes, previews, cards | Mixed; 18/20/24 are candidates after screenshots | Medium |
| Global spacing | 4, 8, 12, 16, 20, 24, 32, 48 | Foundation | Intentional scale | Low |
| Frequent local spacing | 14, 16, 18, 20, 24, 32 | 27 / 40 / 25 / 39 / 13 / 6 positive constraint or stack uses | 14/18 often measured; 16/20/24 partly semantic drift | Medium |
| Control elevation | 8%/10pt/4pt; 10%/14pt/5pt; 16%/12pt/5pt | Headers, standard controls, floating controls | Shared and compatibility variants | Low–medium |
| Cards/sheets | 18%/24pt/12pt; 20%/34pt/−4pt | Raised cards and sheets | Shared semantics | Medium |
| Map action compatibility | 8%/18pt/9pt | Two Globe sheet actions | Feature compatibility; consider named map-sheet variant only with another consumer | Medium |
| Pins/text rendering | 24%/5pt/2pt; 90%/2.5pt/0 | Annotations and on-media text | Rendering, not surface elevation | High |
| Standard symbols | 16, 18, 20 | Rows and controls | Potential semantic consolidation | Medium |
| Rich-action symbols | 27, 28, 29 | Overview, Globe and editor actions | Component-specific unless screenshots show equivalence | Medium–high |

### Typography proposal

Future work should compare by semantic role, not globally replace numbers:

| Role | Current range | Proposed v2 investigation |
|---|---|---|
| Screen/hero title | 24–52, feature-dependent | Keep hero/display roles specialized; define one ordinary screen-title role |
| Sheet title | 20–34 | Compare utility/editor titles and retain measured hero sheets |
| Card/section title | 17–22 | Test a 17pt standard plus explicit prominent variant |
| Body | 15–18 | Test 17pt standard native body; keep compact 15/16 variants only where measured |
| Action | 15–20 | Separate compact, standard and prominent semantics |
| Metadata/caption | 11–15 | Keep 13pt metadata and 12pt caption anchors; audit one-off 14/15 uses |
| Badge | 11–14 | Keep badge geometry component-owned |

All typography changes require Dynamic Type, truncation, localization and baseline comparison. No bulk `systemFont` rewrite is safe.

### Color proposal

| Current family | Recommendation | Reason |
|---|---|---|
| `#7D7D84` canonical secondary | Keep | Cross-platform semantic anchor |
| `#8B8B92` Settings secondary | Needs screenshot comparison | Close to secondary but tuned for Settings |
| `#8E8E93` Overview neutral text | Keep distinct initially | Overview uses measured neutral hierarchy |
| `#929297` Overview neutral icon | Keep distinct initially | Icon contrast differs from text |
| `#A2A2A8` tertiary text | Keep | Separate tertiary hierarchy |
| `#F2F3F6` mist/grouped canvas | Keep | Cross-platform canonical value |
| `#F3F3F5` Overview neutral surface | Merge candidate after comparison | Near-duplicate but feature evidence is required |
| Gold aliases (`gold`, `accent`, `brandGold`) | Rename/deprecate aliases incrementally | Exact values; low pixel risk |
| Orange compatibility aliases | Deprecate alias | Same gold values; misleading name |
| Border/disabled alpha aliases | Rename-only first | Exact or near-exact roles with broad reach |
| Map/generated/media colors | Keep distinct | Renderer and media semantics |

### Radius and spacing policy

- Circles and capsules remain shape semantics; never add numeric “circle radius” tokens.
- Fields, controls, cards and large cards remain the shared surface family.
- Utility, editor, prominent, Place, Globe and Overview radii remain presentation roles until approved comparison proves consolidation.
- Adopt 4/8/12/16/20/24/32/48 for ordinary composition.
- Permit 14 and 18 only as documented native/feature compatibility or component specification.
- Negative spacing for icon clusters and timelines stays feature-owned.

## Shared component override audit

| Component | Current pattern | Assessment / v2 action |
|---|---|---|
| `AlmidyIconButton` | Six production override call sites, mostly diameter/elevation parity | Highest override pressure. Group by Itinerary 50pt, Place/header 44pt, Globe 48pt, not by arbitrary numbers; add a variant only with multiple equivalent consumers |
| `AlmidyButton` | Standard primary/secondary/tertiary/destructive and compact/standard sizes; few consumers | API is sound; adoption remains intentionally conservative |
| `AlmidySheetHeader` | Centered/leading composition with measured action overrides | Keep; do not absorb photographic or picker headers |
| `AlmidySheetConfiguration` | Four semantic roles and four main feature override families | Healthy: overrides mostly detents and documented radii, which are presentation-owned |
| `AlmidyCard` | Few direct consumers | Do not force rich feature cards into it; evaluate whether limited adoption reflects correct boundary rather than missing variants |
| `AlmidyListRow` | Limited use because native table and route rows differ | Keep focused; avoid accessory-mode explosion |
| `AlmidyFormSection` | Limited use; embedded editors preserve borderless geometry | No new variant until a second equivalent bordered/borderless form family exists |
| `AlmidyActionRow` | Limited use; feature action cards vary materially | Keep canonical standard action only |
| `AlmidyEmptyState` | Standard plus message-only use | Healthy semantic evidence from Search |
| `AlmidyFloatingControl` | Wraps icon-button semantics for floating controls | Healthy; Map feature clusters should remain composed above it |
| `AlmidyInputStyle` | Native text-field styling with a few semantic styles | Healthy; do not absorb multiline/currency/domain behavior |
| `AlmidySurfaceStyle` | Seven shared definitions plus three feature-exact compositions | Healthy. Exact compositions are preferable to adding one-use global variants |

Override frequency alone does not prove a missing variant. Repeated overrides with the same semantic role and equivalent interaction are required evidence.

## Dark Mode readiness

The v1 appearance contract remains **light branded planning surface + adaptive native utilities**.

| Family | Current readiness | Required v2 work |
|---|---|---|
| UIKit labels/system fills/materials | Already adaptive | Validate contrast and surrounding fixed surfaces |
| Canvas/grouped/surface/card | Fixed light intentionally | Product-approved dark surface hierarchy |
| Primary/secondary/tertiary text | Mostly fixed light | Dynamic semantic equivalents and contrast audit |
| Borders/dividers/disabled | Alpha-based and partly adaptive | Test on dark surfaces; define dark opacities only with evidence |
| Gold accent | Fixed brand | Validate contrast; likely retain hue with role-specific foregrounds |
| Settings/Auth/editors | Mixed fixed and system-native | Highest inconsistency risk when forced into Dark Mode |
| Map overlays | Mostly intentional dark/rendering-specific | Validate controls and sheets independently of tiles |
| Trip Overview | Media-dependent plus fixed surfaces | Preserve image analysis; approve dark terminal/card surfaces separately |
| Place Card | Fixed light cards plus MapKit media | Requires full contact, Save, route and Look Around baseline set |

Recommended sequence: approve dark canvas/surface/text/border semantics first; implement dynamic token providers; migrate low-complexity utilities; validate editors; then handle Map/Place and Trip Overview as separate high-risk tracks. Do not derive final dark hex values without product/design approval.

## Cross-platform contract

`design-system/almidy.tokens.json` is the small cross-platform source for brand gold, light canvas/mist, primary/secondary text, subtle border, core spacing and card/control radii. `lib/design-system/almidy-tokens.ts` is a typed import of that file. `AlmidyDesignTokens.swift` mirrors those values and adds UIKit-only semantics, adaptive providers, component specifications and compatibility aliases. `scripts/verify-design-token-parity.mjs` currently verifies the shared subset.

Manual parity risk remains when shared roles are added independently. Keep UIKit geometry, detents, Dynamic Type fonts, MapKit rendering and component-specific measurements out of JSON. Extend JSON only for semantics required by at least two platforms.

Web currently mixes canonical gold/ink/mist with older warm trip values (`#6f675c`, `#f7f6f2`, `#faf8f5`), Tailwind slate/blue/orange/amber, intentional dark wallet/operations palettes, and map-specific colors. Reconciliation should classify first:

- Brand semantic: canonical gold, ink, mist and border roles.
- Web-only feature semantic: wallet, operations and responsive web shells.
- Legacy debt: arbitrary warm trip values and orange labels that represent brand emphasis.
- Intentional dark/mobile palette: wallet and account deletion surfaces.
- Map-specific: `almidy-map-visuals.ts`; keep outside brand palette normalization.

Android should consume semantic color roles, typography hierarchy, spacing/radius philosophy, elevation intent, minimum control sizes and component identity. It should implement navigation, sheets, pickers, menus, maps, accessibility and motion using Android/Compose conventions rather than copying UIKit APIs or detent geometry.

## Screenshot infrastructure

| Surface | Main blocker | Difficulty |
|---|---|---|
| Trip Overview | Authenticated state and remote hero media | High |
| Globe | Authenticated trips, live tiles and remote trip media | High |
| Place Card | `MKMapItem`, Look Around, ETA and routes | High |
| Saved Place | Upstream MapKit selection and saved segment | Medium–high |
| Transportation / Flight | Route locations, airport completion and parent callbacks | Medium–high |
| Settings | Account/auth variants | Medium |
| Search | `MKLocalSearchCompletion` lacks deterministic public construction | High |
| Itinerary | Authenticated trip/data fixture and optional media | Medium |
| Cost/Note/Date/Time | Keyboard, locale and native-picker timing | Medium |

Proposed harness:

```text
Deterministic fixture state
        ↓
test-only stable local media/map substitute
        ↓
production controller and feature views
        ↓
pinned simulator, locale, calendar, time zone, appearance and content size
        ↓
geometry assertions + approved screenshot comparison
```

Test substitutes must be injected through test-only protocols or target support and must never alter production fallback behavior. Use licensed local hero/trip images; replace map snapshots and Look Around with stable test surfaces only at existing media boundaries. Capture both standard and accessibility content sizes. Store metadata for device, OS, scale, locale and appearance with every approved image.

## Normalization risk matrix

| Risk | Candidate work | Required gate |
|---|---|---|
| Low | Exact aliases, misleading names, duplicate exact colors, comments, dead compatibility forwards after zero use | Token parity, 88+ runtime baseline, static usage proof |
| Medium | Near-neutral consolidation, 18/20/24 spacing alignment, icon size/weight alignment, ordinary card radii, repeated compatibility elevation | Deterministic affected-screen screenshots, Dynamic Type and contrast review |
| High | Typography, control dimensions, sheet radii/detents, Trip Overview geometry, map/Place geometry, media contrast, Dark Mode | Product approval, complete fixture matrix, accessibility review and staged rollout |

## v2 roadmap

### v2.0 — Baseline freeze and governance

Land this documentation, create `almidy-native-design-system-v1`, and make 88 plus later additions the mandatory behavioral baseline. No pixel changes.

### v2.1 — Exact-equivalent cleanup

Completed as a zero-pixel-change mechanical pass. The audit covered color, spacing, radius, typography, control-size, shadow/elevation, component namespace, map namespace, shared-component API and documentation candidates.

- Migrated `darkInput`, `darkInputBorder`, and `darkPlaceholder` to the accurately named, value-identical `inputSurface`, `inputBorder`, and `inputPlaceholder` roles.
- Migrated `disabledActionBackground` consumers to identical `stateDisabledFill` and removed its unused text/border companions.
- Removed zero-consumer `brandOrange`, `brandOrangeStrong`, `authSurface`, `walletSurface`, `borderSoft`, `shadowSoft`, legacy scalar `Control`/`Shadow` properties, and unused `Font.regular`/`Font.medium` forwards.
- Retained meaningful semantic identities for canvas/surface, settings, gold text/action, modal overlay, spacing/radius, map/media, dynamic metadata, and Trip Overview roles.
- Retained the `Component.TripOverview` compatibility bridge because both namespace paths still have real consumers.
- Removed no shared-component API and changed no cross-platform JSON or canonical raw token value.

Deferred non-exact candidates remain assigned to later approved phases: `#F2F3F6` versus `#F3F3F5`, 17pt versus 18pt typography, 28pt versus 30pt radii, and 18pt versus 20pt spacing.

### v2.2 — Screenshot and fixture foundation

**Completed August 28, 2026.** Added a test-only deterministic rendering/comparison harness, explicit opt-in recording, strict zero-tolerance RGBA comparison, retained expected/actual/difference failure artifacts, and twelve reviewed Light-mode baselines. Pixel protection now covers four Trip Overview states, active/future Globe cards, reservation automation, map controls, Place Card travel modes, and representative Saved Place, Train, and Flight compositions. Existing deterministic geometry and behavior tests remain the protection tier for full Map/Globe, Map Preferences, full Place Card, Itinerary, Search, Settings/account, and system keyboard/picker states whose pixels depend on authentication, Apple services, runtime data, or system timing.

The canonical profile is iPhone 17e on iOS 26.5, portrait, `en_US`, 3×, Large content size, with AX XXXL for the Trip Overview accessibility state. Baseline updates require an explicit simulator-scoped `ALMIDY_RECORD_SNAPSHOTS=1` recording run and manual PNG review; normal tests cannot overwrite images. Hosted pixel gating remains conditional on pinning the identical Xcode/runtime/device/locale/font-rasterization environment and preserving failure attachments. No production token, component, value, appearance, behavior, or fallback changed.

### v2.3 — Instrument Sans typography migration

**Completed August 29, 2026.** Almidy-owned native typography now resolves through four bundled static Instrument Sans faces—Regular, Medium, SemiBold, and Bold—under the existing `AlmidyDesignTokens.Typography` authority. Semantic sizes, Dynamic Type behavior, protected component geometry, colors, spacing, radii, elevations, icons, and product behavior remain unchanged. UIKit/MapKit-owned presentation remains platform typography.

All twelve deterministic states were compared to the committed v2.2 reference before explicit approval and re-recording. Eleven changed as expected from typography pixels; the icon-only map controls remained identical. No metric safety correction or new baseline was required. Figma should use the documented Display/Title/Body/Action/Metadata/Caption/Badge hierarchy; web and Android adoption remain later cross-platform alignment work.

### v2.4 — Surface, radius and elevation normalization

**Planning completed August 29, 2026.** The repository-wide audit retains the canonical spacing/radius/elevation foundation, formally documents measured exceptions, protects feature geometry, and identifies neutral-surface convergence as the safest first visible proposal. No production value or canonical screenshot changed. The detailed candidate inventory, risk matrix, coverage gaps, target system, and approval gates live in `DESIGN_SYSTEM_NORMALIZATION_PLAN.md`.

Recommended implementation sequence: neutral surfaces; exact-equivalent elevation API adoption; generic separator policy after adding coverage; generic spacing by semantic family; ordinary shared card/control radii; then opt-in feature compatibility reviews. Do not combine these families in one visual diff.

#### v2.4A — Neutral Surface Normalization

**Completed August 29, 2026.** The independent native `tripOverviewNeutralSurface` semantic changed from `#F3F3F5` to `#F2F3F6` in Light mode. Four Trip Overview baselines and the Place travel-mode baseline were reviewed and explicitly re-recorded; the other seven canonical states remained exact. No geometry, typography, spacing, radius, border, elevation, behavior, Dark Mode, web, or Android change was included. The next proposed phase is v2.4B exact elevation API adoption.

#### v2.4B — Exact Elevation API Adoption

**Completed August 29, 2026.** Exact reconstructed shadows now use the existing `controlSubtle`, `controlRaised`, `floating`, and `cardRaised` configurations. Six raw declaration blocks covering seven controls/cards were migrated, and the zero-use itinerary floating-shadow helper was removed. Canonical elevation values, local near-matches, renderer/media shadows, behavior, and all twelve baseline PNGs remain unchanged. The next proposed phase is v2.4C generic separator policy.

#### v2.4C — Generic Separator Policy

**Completed August 29, 2026.** Generic custom separators now consistently express one physical device pixel through `AlmidyDivider` and `Border.hairline`. Four exact local constructions adopted the primitive with zero pixel change. Eight 0.5pt editor/date/time lines remain documented measured compatibility geometry; 0.75pt map borders, structural/timeline lines, outlines, selection borders, media/map rendering, and UIKit-native separators remain specialized. Canonical colors, values, behavior, and all twelve PNGs are unchanged. The next proposed phase is v2.4D shared spacing review.

#### v2.4D — Shared Spacing Review

**Completed August 31, 2026.** Shared components already conform to the canonical 4/8/12/16/20/24/32/48 scale. `AlmidyBadge`'s exact 4×8 inset now references `Spacing.xxs/xs`; no numeric geometry changed. Repeated 6/10/14/18 values remain documented feature, accessibility, or rendering exceptions. No visible normalization was approved for protected or uncovered surfaces, all twelve PNGs remain unchanged, and the next proposed phase is v2.4E ordinary card/control radius review.

#### v2.4E — Ordinary Card & Control Radius Review

**Completed August 31, 2026.** The ordinary shared hierarchy remains 8/12/18/24/28 for small, field, control, card, and large-card roles. The reservation-details and attachment-action shared surfaces now reference `Radius.control` at their existing 18pt geometry, with focused contract tests. No raw radius or screenshot changed; circles/capsules remain shape semantics, sheet and feature radii remain distinct, and uncovered visible candidates remain deferred. The recommended next milestone is v2.5 Dark Mode preparation and implementation as separately approved appearance work.

### v2.5 — Dark Mode

Run as product-approved appearance work: foundations, utilities, editors, Map/Place, then Trip Overview/media. Do not combine with unrelated normalization.

### v2.6 — Cross-platform alignment

Reconcile web brand semantics and legacy warm/orange debt, evolve the shared JSON subset, and publish the Android semantic contract. Web and Android retain platform-native behavior.

Each phase starts with the current baseline plus later additions at 100%, and finishes with the same baseline plus new tests at 100%. Intentional pixel changes never excuse behavioral regression.

## Visual-change policy

Every intentional v2 pixel change requires:

1. documented current state and token/component owner;
2. proposed target and design rationale;
3. affected-screen and state inventory;
4. approved geometry/screenshot baselines;
5. Dynamic Type, contrast, VoiceOver and target-size review;
6. unchanged behavioral regression baseline;
7. focused tests for the new contract;
8. explicit approval before broad rollout.

## Governance and lifecycle

- Do not introduce raw brand colors outside approved scoped semantics.
- Do not add generic numeric radius tokens for circles or capsules.
- Keep feature/domain types and behavior out of DesignSystem.
- Add shared variants only with multiple equivalent consumers or strong reusable semantic evidence.
- Document every compatibility override with its owner, parity reason and intended lifecycle.
- Keep shared JSON limited to cross-platform semantics.
- Keep navigation, sheets, pickers, menus, maps, accessibility mechanics and motion implementation platform-owned.
- Permit raw values for renderer math, algorithms, media analysis and measured feature/component geometry.
- Discourage repeated brand colors, generic card radii, standard control shadows and semantic font declarations.
- Add lint rules only for exact raw brand colors and proven duplicate configurations; avoid noisy numeric linting.

Token lifecycle states are `proposed`, `active`, `compatibility alias`, `deprecated`, and `removed`. A proposal needs semantic ownership and consumer evidence. Deprecation requires a replacement and usage inventory. Removal requires zero production consumers, parity verification and release notes.

Shared components evolve through actual product evidence, semantic naming, backward-compatible migration, deterministic tests, accessibility verification and either visual parity or explicit visual-change approval. Feature-specific option growth is a signal to keep composition feature-owned rather than expanding a generic component.

## Architecture assessments

### NativeMapPlugin

Current size: approximately **11,569 lines**. It still owns plugin entry points, MapKit maps/camera/annotations/delegates, offline behavior, trip/map domain orchestration, Place operations, activity search integration, route/editor presentation, account/auth entry points and compatibility composition. Some specialized Place, map-overlay and workflow presentation remains embedded by design.

Further extraction is warranted only when a responsibility has a clean state/callback boundary or a second consumer. File size alone is not sufficient evidence; splitting MapKit delegate and controller state mechanically would make behavior harder to reason about.

### Trip Overview

The specialized header, hero/media pipeline, collapse transition, action rail, component specification and card families are intentional. `Component.TripOverview` owns stable measured relationships; shared surfaces, dividers, sheet semantics, colors, typography and motion are adopted where exact. No missed canonical adoption remains. Future geometry or appearance changes are v2 redesign/normalization work.

## Debt classification

- Architecture debt: minimal; monitor `NativeMapPlugin` boundaries without LOC-driven extraction.
- Visual normalization debt: expected and explicitly planned.
- Appearance debt: Dark Mode is a separate product track, not a v1 failure.
- Cross-platform debt: web reconciliation and future Android semantic contract.
- Test infrastructure debt: deterministic fixtures, stable local media and screenshot governance.
- Specialized feature complexity: MapKit, media, Trip Overview and route/editor orchestration are not automatically debt.

## v2.5 — Dark Mode (complete)

The native semantic namespace now supports Light, Dark, and independent Increased Contrast resolution. Shared layer-backed components and configuration-owned control colors refresh across appearance transitions. Deterministic coverage is the same 12 scenarios in both appearances (24 exact-RGBA PNGs). Existing Light tokens, geometry, typography, and Light baselines remain frozen. Palette and exception details live in `DARK_MODE_SPEC.md`.

## v2.6 — Cross-platform semantic contract

`design-system/almidy.tokens.json` is now the versioned Almidy Design Tokens 2.0.0 source for shared Light/Dark color intent, Instrument Sans base typography, spacing, radius, shape, elevation names, and border names. Existing web compatibility keys remain pixel-stable. Increased Contrast, scaling mechanics, sheets, maps, media, and measured feature geometry remain platform/feature-owned. The audit, platform matrix, and Tier A–D migration backlog live in [`DESIGN_TOKENS_CROSS_PLATFORM.md`](DESIGN_TOKENS_CROSS_PLATFORM.md). Recommended follow-up: v2.6B exact-equivalent web semantic adoption.

## v2.6B — Web semantic token adoption

Tier A exact equivalents are now owned by the shared TypeScript/Tailwind path. Active `ink`, `line`, `brand`, and global `mist` consumers migrated to semantic `almidy-*` utilities while all compatibility aliases remain available. The autocomplete accent now resolves through a semantic CSS variable. A deterministic adoption guard proves the four compatibility values remain identical and prevents their raw/legacy reintroduction in production paths. There are no shared JSON raw-value, native, native PNG, typography, spacing, radius, or intentional web visual changes.

The five Tier B families remain deferred: warm trip neutrals versus shared Light text/surfaces; mobile dark neutrals versus shared Dark surfaces; orange/blue focus colors versus accent interaction roles; selected-state fills versus accent-muted intent; and panel-shadow tuples versus elevation intent. Feature/platform Tier C and broad slate/blue/orange/zinc/gray Tier D families remain classified in the cross-platform specification. Recommended follow-up: v2.6C, limited to visually reviewed Tier B reconciliation.
