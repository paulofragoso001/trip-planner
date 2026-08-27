# Almidy Design Audit v1

**Audit date:** 2026-08-25
**Scope:** current repository implementation; native iOS, the web/native-transition UI, asset catalogs, shared design infrastructure, presentation behavior, states, motion, and accessibility
**Change policy:** discovery and proposal only. No application styling or behavior was changed by this audit.

## 1. Executive Summary

Almidy already has a recognizable visual language: airy white/mist planning surfaces, near-black primary copy, champagne/muted gold for elevated actions, deeply photographic trip heroes, large rounded cards, circular floating controls, and native sheet-driven workflows. The strongest expression is the recent UIKit Trip Overview. The weakest architectural area is not identity but distribution: the same decisions are repeatedly reconstructed inside feature controllers.

The repository contains:

- 39 production Swift files, approximately 27,269 lines. UIKit and MapKit are the native UI stack; no production SwiftUI view was found.
- 172 TSX presentation files under `app` and `components`, approximately 35,831 lines. These remain relevant because several native routes still hand off to web surfaces.
- No Android directory, Kotlin, Jetpack Compose, Android XML theme, or Android asset implementation. Android can share the eventual semantic contract, but there is nothing current to audit or migrate.
- One cross-platform token seed, [`design-system/almidy.tokens.json`](design-system/almidy.tokens.json), exposed to Tailwind through [`lib/design-system/almidy-tokens.ts`](lib/design-system/almidy-tokens.ts) and mirrored manually by [`ios/App/App/AlmidyDesignTokens.swift`](ios/App/App/AlmidyDesignTokens.swift).

Current architecture is partially centralized:

- Color has meaningful semantic coverage and substantial native adoption.
- Trip Overview has a detailed, feature-specific geometry system with accessibility variants.
- General spacing and shadow namespaces exist but have no production call sites.
- Typography helpers are wrappers around arbitrary sizes, not semantic roles.
- Sheet configuration, elevation, headers, cards, form rows, and icon controls are duplicated heavily.
- The web app mixes canonical gold/ink/mist tokens with an older orange/blue/slate vocabulary and several independent dark mobile palettes.

The correct v1 direction is to evolve `AlmidyDesignTokens`; creating a parallel `AlmidyDesign` namespace would introduce a competing source of truth. The first migration must be visual-preserving: capture current values, introduce semantic roles and component configurations, then migrate one component family at a time with screenshots and accessibility tests.

## 2. Current Design Inventory

### 2.1 Platforms and implementation boundaries

| Surface | Current implementation | Audit conclusion |
|---|---|---|
| iOS | UIKit, MapKit, ARKit, SceneKit, `UISheetPresentationController` | Primary native source of truth |
| SwiftUI | No production views found | No current system to preserve |
| Android / Compose | No implementation found | Future consumer only |
| Web/native transition | React/Next.js + Tailwind + global CSS | Still product-visible and a source of shared identity/debt |
| Maps | Apple MapKit native; Google/custom globe on web | Platform-native rendering should remain platform-specific |

### 2.2 Colors

Canonical shared values are defined in [`design-system/almidy.tokens.json`](design-system/almidy.tokens.json:1). Native extensions and aliases are in [`AlmidyDesignTokens.swift`](ios/App/App/AlmidyDesignTokens.swift:4).

| Existing native token | Resolved value | Current purpose / behavior | Native references | Assessment |
|---|---:|---|---:|---|
| `brandGold`, `gold`, `brandOrange` | `#D6A84F` | Brand/action gold; aliases are identical | `gold` 28 | Keep `brandGold`; deprecate orange compatibility name after migration |
| `brandGoldDeep`, `goldDeep`, `brandOrangeStrong` | `#B88A2E` | Pressed/deeper gold | 8 combined | Keep as accent pressed/emphasis |
| `brandGoldText`, `goldDark`, `goldSoft`, `settingsGold`, `settingsIcon` | `#8C641E` | Contrast-safe gold on light surfaces | 49+ combined | One value with several legitimate semantic roles; aliases should map to semantic names |
| `goldMuted`, `tripOverviewAccent` | `#9F8857` | Subordinate Trip Overview accent | 40 combined | Preserve distinct muted accent |
| `goldMutedSurface`, `tripOverviewAccentSurface` | `#F2EBDD` | Muted accent fill | 12 combined | Keep |
| `bgLight`, `background`, `surface`, `settingsCard`, `settingsRowBackground`, `authSurface`, `walletSurface` | `#FFFFFF` | Base/elevated light surfaces | 40+ combined | Consolidate by semantic role, retain aliases during migration |
| `bgLightMist`, `card`, `settingsBackground` | `#F2F3F6` | Grouped background / neutral card | 25+ combined | Naming conflict: `card` is mist while several cards use white |
| `canonicalTextPrimary`, `textPrimary`, `settingsText` | `#050505` | Primary text | 55+ combined | Keep semantic `textPrimary` |
| `canonicalTextSecondary`, `textSecondary`, `overviewMetadata`, `searchEmptyState` | `#7D7D84`, high contrast `#4A4A50` for metadata | Secondary text | 25+ | Expand dynamic high-contrast behavior beyond one role |
| `textTertiary` | `#A2A2A8` | Tertiary text | 7 | Keep |
| `settingsSecondary` | `#8B8B92` | Settings metadata | 22 | Near-duplicate of iOS system gray and overview neutrals |
| `tripOverviewNeutralText` | `#8E8E93` | Trip Overview neutral text | 8 | Exact iOS `systemGray`; consider semantic system mapping |
| `tripOverviewNeutralIcon` | `#929297` | Neutral icon | 14 | Near-duplicate; retain only if screenshot comparison proves distinction |
| `tripOverviewNeutralSurface` | `#F3F3F5` | Neutral icon/action fill | 10 | Near-duplicate of mist/card (`#F2F3F6`) |
| `tripOverviewDivider` | `#E7E7EA` | Card divider | 6 | Keep as divider-on-light candidate |
| `borderSubtle`, `line`, `borderSoft` | black 10% | General border | 5 via `line` plus aliases | Keep semantic border |
| `settingsLine` | black 8% | Settings separators | 9 | Legitimate hairline/subtler variant |
| `darkInput` | `#F5F5F7` | Despite name, light input fill | 4 | Rename eventually; current name is inaccurate |
| `darkInputBorder`, `disabledActionBorder` | black 12% | Input/disabled outlines | 4 combined | Share border-strong token if visually equivalent |
| `darkPlaceholder` | black 44% | Placeholder on light input | 2 | Rename eventually |
| `disabledActionBackground` | black 6% | Disabled fill | 2 | Keep semantic state |
| `disabledActionText` | black 38% | Disabled text | 0 | Keep if adopted; otherwise remove after migration |
| `success` | `#3C8F5A` | Success | 2 | Keep |
| `danger` | `#C2413A` | Destructive/error | 8 | Keep; currently some features bypass with `.systemRed` |
| `info` | `#6D86A8` | Informational | 7 | Keep |
| `mapSurface` | `#030406` | Native map base | 6 | Map-specific, intentionally local semantic role |
| `offlineGlobeTint` | RGB 30/66/92% | Offline globe | 1 | Keep map-specific |
| `generatedTripImageBase` | RGB 9/20/28% | Generated image base | 5 | Media-specific |
| `generatedTripGradientStart` | RGB 8/38/48% | Generated travel gradient | 7 | Media-specific |
| `generatedTripGradientEnd` | RGB 88/38/18% | Generated travel gradient | 2 | Media-specific |
| `tripCardGradientStart` | clear | Hero overlay start | 1 | Keep hero-specific |
| `tripCardGradientEnd` | black 78% | Hero overlay end | 1 | Keep hero-specific |
| `tripCardTextPrimary` | white | Hero primary text | 5 | Keep on-media role |
| `tripCardTextSecondary` | white 92% | Hero secondary text | 3 | Keep on-media role |
| `tripCardTextTertiary` | white 82% | Hero tertiary text | 4 | Keep on-media role |
| `tripOverviewMetadataPrimary` | white 82%; high contrast 94% | Hero metadata | 1 | Keep dynamic on-media role |
| `tripOverviewMetadataSecondary` | white 74%; high contrast 88% | Hero metadata | 1 | Keep dynamic on-media role |
| `tripOverviewActionSurface` | `#C9B989` | Populated shortcut fill | 1 | Feature-approved value; preserve |
| `tripOverviewActionIcon` | `#76531A` | Populated shortcut icon | 1 | Preserve |
| `tripOverviewActionLabel` | white 72%; high contrast 90% | Shortcut label | 2 | Preserve dynamic behavior |
| avatar rose/peach/lavender surfaces | `#FFD6D9`, `#FFDECC`, `#F5C9F0` approximate | Decorative account avatars | 1 each | Component-specific palette |
| `modalDimmingBackground` | black 48% | Custom modal scrim | 2 | Keep overlay role |
| `overlayPlaceholderText` | white 45% | Overlay placeholder | 2 | Keep on-media role |
| `shadowBlack`, `shadowSoft` | black; black 12% | Shadow sources | 7 / 0 | `shadowSoft` is currently unused |

#### System colors in active use

UIKit feature code also uses `.systemBackground`, `.secondarySystemBackground`, `.systemGroupedBackground`, `.secondarySystemGroupedBackground`, `.label`, `.secondaryLabel`, `.tertiaryLabel`, `.separator`, `.systemFill`, `.secondarySystemFill`, `.tertiarySystemFill`, `.systemRed`, `.systemGreen`, `.systemBlue`, `.systemOrange`, white, black, and clear. These are not automatically debt: they are correct where the intent is native adaptation. They become inconsistent when an Almidy semantic token exists for the same branded role—most notably gold/action, destructive, card surface, and primary/secondary copy.

#### Hard-coded native colors outside tokens

- Place save gradient: RGB `(1.0, 0.91, 0.67)` in [`NativeMapPlugin.swift`](ios/App/App/NativeMapPlugin.swift:2548).
- Map compass/location translucent grays in [`NativeMapPlugin.swift`](ios/App/App/NativeMapPlugin.swift:7515) and [`NativeMapPlugin.swift`](ios/App/App/NativeMapPlugin.swift:7545).
- Geographic annotation fill/stroke in [`NativeMapPlugin.swift`](ios/App/App/NativeMapPlugin.swift:12660).
- Trip Overview dynamic image-analysis colors and burgundy fallback in [`NativeTripOverviewHeaderView.swift`](ios/App/App/TripOverview/NativeTripOverviewHeaderView.swift:891). These are algorithms/media treatments, not global palette candidates.
- `#6B625B` Trip Overview fallback in [`NativeMapPlugin.swift`](ios/App/App/NativeMapPlugin.swift:10098).

#### Web palette divergence

Web consumes the eight canonical values, but also relies heavily on Tailwind slate, orange, blue, teal, amber, zinc, red, and arbitrary hex colors. Notable independent families:

- Older warm trip UI: `#221d17`, `#6f675c`, `#8a8175`, `#f7f6f2`, `#faf8f5` across trip detail, flight truth, timeline, and API transition views.
- Dark mobile UI: `#121214`, `#1f1f21`, `#1e1e24`, `#25252d`, `#343338` across wallet, search, mobile forms, and native-map overlays.
- Map visualization palette is explicitly defined in [`lib/map/almidy-map-visuals.ts`](lib/map/almidy-map-visuals.ts:3) and should remain map-specific.
- Tailwind still defines `evergreen: #14805e`, `shadow-panel`, blue focus rings, and orange state styling in [`tailwind.config.ts`](tailwind.config.ts:8).

### 2.3 Light, dark, and contrast behavior

- Native `AlmidyDesignTokens` is predominantly fixed-light. `background`, `surface`, `card`, primary text, settings, inputs, and borders do not switch for Dark Mode.
- Native feature code frequently uses adaptive system colors, producing mixed behavior: some screens adapt while branded token-backed screens remain light.
- Only a small set of tokens responds to accessibility contrast: overview metadata and Trip Overview on-image labels.
- Web declares light `color-scheme` by default and class-driven dark mode in [`app/globals.css`](app/globals.css:5), but many arbitrary light/dark colors bypass semantic variables.
- Conclusion: Almidy currently has an intentional light native planning surface, not a complete native Dark Mode. V1 should document this as `light-only branded surface + adaptive system utilities` until product approval, rather than inventing a dark palette.

### 2.4 Typography

All native product typography is San Francisco through system fonts. No bundled custom font was found. `AlmidyDesignTokens.Font` contains size-parameterized weight helpers rather than semantic styles.

Observed direct `.systemFont` combinations (token helper calls add further uses at arbitrary sizes):

| Size / weight | Direct count | Common semantic use |
|---|---:|---|
| 18 semibold | 21 | Form actions, row titles, buttons |
| 17 semibold | 15 | Headings/actions |
| 17 regular | 11 | Form fields/body |
| 16 semibold | 7 | Buttons/metadata emphasis |
| 22 semibold | 6 | Sheet/editor title |
| 16 medium | 6 | Controls |
| 18 medium | 5 | Buttons/section labels |
| 16 regular | 5 | Body |
| 14 regular | 5 | Supporting metadata |
| 20 semibold | 4 | Section/screen title |
| 19 semibold | 4 | Card/action label |
| 24 semibold | 3 | Large heading |
| 20 regular | 3 | Prominent body/title |
| 15 regular | 3 | Body |
| 15 medium | 3 | Metadata/action |
| 52 regular | 2 | Hero destination title |
| 18 regular / bold | 2 each | Form/title variants |
| 17 medium | 2 | Control |
| 13 semibold | 2 | Compact labels |
| 36 bold, 34 regular, 32 bold | 1 each | Display titles |
| 23 semibold, 19 regular, 14 semibold/medium/bold, 12 semibold, 11 bold | 1 each | One-off feature roles |

Token helper references: `Font.body` 34, `Font.button` 25, `Font.title` 13, `Font.section` 4, `Font.semibold` 3, `Font.display` 3. Because callers still supply sizes, these helpers do not prevent 16/17/18-point semantic drift.

Dynamic Type is strongest in Trip Overview, New Activity, and Saved Search, using `UIFontMetrics`, `adjustsFontForContentSizeCategory`, and accessibility-category layout changes. Much of Native Map, authentication, settings, create-trip, and editor UI uses fixed fonts without scaling. Several labels use `minimumScaleFactor` 0.68–0.75, sometimes as a substitute for reflow. Multiline and truncation behavior are locally configured; no shared text primitive governs it.

Current implicit native type hierarchy:

| Proposed semantic observation (not yet a rename) | Existing implementations |
|---|---|
| Hero display | 52 regular; occasional 36/38 |
| Screen/sheet title | 22 semibold; 24 semibold; 34 regular in Map Preferences |
| Section/card title | 17–20 semibold/medium |
| Body | 15–17 regular |
| Emphasized body/action | 15–18 semibold/medium |
| Metadata | 13–15 regular/medium |
| Caption/badge | 11–13 semibold/bold |

### 2.5 Spacing and layout

`AlmidyDesignTokens.Spacing` defines `4, 8, 12, 16, 24, 32, 48` plus aliases (`content = 24`, `safeTop = 14`, `section = 32`, etc.). **No production call site currently references this namespace.** The scale nevertheless matches dominant feature-local values and is a valid seed.

Most frequent literal Auto Layout constants (sign indicates inset direction):

| Absolute value | Positive/negative references | Typical context |
|---:|---:|---|
| 20 | 39 / 35 | Screen/sheet horizontal inset |
| 16 | 37 / 23 | Card inset, compact screen inset |
| 8 | 25 / 11 | Internal gap |
| 18 | 24 / 12 | Card/sheet gap |
| 12 | 24 / 16 | Element gap |
| 14 | 22 / 6 | Safe/header spacing |
| 24 | 16 / 19 | Larger content inset |
| 4 | 16 / 7 | Micro spacing |
| 10 | 12 / 7 | Compact gap |
| 32 | 6 / 8 | Section spacing / wide inset |

Stack spacing frequencies: 12 (16), 4 (10), 8 (9), 14 (8), 10 (8), 2 (7), 0 (7), 16 (5), 18 (4), then component-specific values. Negative `-5`/`-7` spacings intentionally create overlapping icon clusters and must remain component geometry.

Observed layout families:

- Standard sheet/editor horizontal inset: 20.
- Trip Overview outer inset: 20; card inner horizontal inset: 16; card gap: 18.
- Form cards: 16–18 horizontal, 6–15 vertical.
- Compact controls: 4–12 internal spacing.
- Larger setup/onboarding screens: 24–32.
- Map controls use safe-area-relative 14–20 offsets and component-specific camera/sheet calculations.

### 2.6 Sizing

Existing general tokens: button 60, compact button 48, icon button 56, map control 56. Only `Control.buttonHeight` has a production reference; the other three are currently unused.

Recurring native dimensions:

| Archetype | Observed sizes | Assessment |
|---|---|---|
| Minimum touch target | 44; explicit Trip Overview token | Correct baseline, but not universal |
| Header close/back | 40, 43, 44, 48, 56 | Same intent is fragmented |
| Primary button height | 48, 52, 56, 58, 60 | Normalize by density/placement, not one universal height |
| Form row | 48, 52, 56, 64 | 52 dominant in activity editor; 64 action cards |
| Trip Overview shortcut | 64 populated, 70 collapsed, 72 empty | Deliberate state/composition variants |
| Trip Overview header control | 48 expanded; 43 collapsed | Deliberate transition geometry |
| Map floating control | 56 | Strong canonical candidate |
| Icon surfaces | 32, 36, 40, 44, 48, 56 | Needs semantic scale |
| Icons | 16, 18, 19, 20, 24, 27, 28, 34 | Several coherent roles, inconsistent local selection |
| Itinerary day button | 48 | Reusable date-rail size |
| Category bubble | 36 with 19-point symbol | Trip Overview-specific |
| Sheet/editor title controls | 40–48 | Header primitive candidate |

### 2.7 Radius

Literal native radius frequency excludes values applied indirectly through tokens:

| Radius | Count | Current uses / interpretation |
|---:|---:|---|
| 34 | 30 | Editor/detail sheet radius; strongest modal convention |
| 18 | 16 | Form/action cards and control token |
| 24 | 15 | Cards and current card token |
| 22 | 12 | 44-point circular controls |
| 20 | 9 | Buttons/cards |
| 28 | 8 | Trip Overview cards, settings/auth/search sheets |
| 36 | 6 | Larger sheets/location detail |
| 12 | 5 | Compact controls/fields |
| 27, 26 | 4 each | Circular 54/52 controls |
| 8, 14 | 4 each | Small fields/badges |
| 25, 21, 16, 11 | 3 each | Mixed circles/cards |
| 32, 23, 17, 10 | 2 each | One component family each |
| 2.5, 3, 3.5, 5, 30, 31, 38, 40 | 1 each | Timeline/map/special media geometry |
| 999 token | 7 references | Capsule intent |

Many 21–28 radii are simply half the corresponding square control dimension and should be expressed as circular clipping, not radius tokens. Sheet radii represent three real families: 28 for general utility/settings, 34 for editor flows, 36–38 for prominent place/detail surfaces. Do not collapse these until their presentation roles are named.

### 2.8 Elevation and shadows

`AlmidyDesignTokens.Shadow` defines opacity 0.22, radius 22, offset `(0,-8)` and has no call sites. Native elevation is entirely local.

Observed native shadow families:

| Role | Color / opacity / radius / offset | Examples |
|---|---|---|
| Text on media | black 0.8–1.0 / 2–3 / zero | Background picker labels, map labels |
| Compact control | black 0.06–0.10 / 10–14 / y 4–7 | Cancel, close, search controls |
| Floating control | black 0.16 / 12 / y 5 | Itinerary floating buttons |
| Large floating card | black 0.18 / 24 / y 12 | Native trip card |
| Map sheet | black 0.20 / 34 / y -4 | Globe bottom sheet |
| Map badge/pin | black 0.20–0.24 / 3–5 / y 1.5–2 | Annotation badges |
| Book/action | black 0.06–0.08 / 18 / y 9 | Map actions |

These establish real semantic levels. Text/pin shadows are rendering aids and should not share card-elevation tokens.

Web has `shadow-panel = 0 18px 60px rgba(24,38,58,.12)` plus many arbitrary mobile dark shadows. The semantic level exists, but implementation is fragmented.

### 2.9 Borders and dividers

- Standard native hairline: `1 / UIScreen.main.scale` or 0.5 points using `.separator`/`settingsLine`.
- Card outline: typically 1 point, black 8–12% or white 8–20% on media/dark surfaces.
- Selection outlines: 2–3 points in gold/accent.
- Trip flag outline: 1.5 points.
- Timeline connector: 2 points; semantic structure, not a divider.
- Map pins and badges use 2–3 point white/dark strokes for legibility.

The system should distinguish `hairline`, `outline`, `selected`, `onMedia`, and `timeline` instead of one border width.

### 2.10 Iconography

Native uses SF Symbols extensively with a small set of custom/image assets. Filled and outline variants are mixed based on selection and context but not centrally mapped. Common point sizes are 16, 18–20, 24, 27–28, and 34. Symbol weights are mostly inherited; explicit configurations are local.

Implicit semantic icon scale:

- Compact/accessory: 16.
- Standard row/card: 18–20.
- Control: 24.
- Prominent shortcut: 27–28.
- Empty-state/hero action: 34.

Map annotation glyphs and country flags are special-purpose and should remain outside the general icon scale.

### 2.11 Images and media

- Asset catalog contains App Icon, Splash, Google G, offline globe, six travel background images, and fourteen Wonder images.
- Trip heroes use aspect-fill clipping, focal-point adjustment, gradients, on-image text colors, and high-contrast variants.
- Background picker thumbnails add text shadows for legibility.
- Map snapshots use fixed preview frames and rounded clipping.
- Web wallet/trip surfaces use many gradient fallbacks; [`lib/wallet/hero-image.ts`](lib/wallet/hero-image.ts:140) and [`lib/trip-overview-presentation.ts`](lib/trip-overview-presentation.ts:20) are partial centralization points.
- Placeholder/loading treatment varies between system fills, skeletons, generated gradients, and image-specific fallback colors.

### 2.12 Motion

Native motion values found: 0.14, 0.2, 0.24, 0.28, 0.45, 0.48 seconds; a 0.48 spring uses damping 0.84 and initial velocity 0.45. Shake animations are used for invalid actions. Trip Overview collapse has custom progress/easing and honors Reduce Motion. Create Trip background transition uses 0.45 seconds and becomes zero under Reduce Motion.

Web defines wallet slide-up at 220ms with cubic-bezier `(0.25,1,0.5,1)`, Tailwind fade-in at 450ms ease-out, and disables the wallet animation for reduced motion.

There is enough evidence for `fast=0.14–0.2`, `standard=0.24–0.28`, `expressive=0.45–0.48`, but not enough consistency to canonize one easing curve beyond preserving the existing Trip Overview spring.

### 2.13 Accessibility

Strengths:

- 428 native references to accessibility labels, identifiers, traits, announcements, Dynamic Type, or related behavior.
- Trip Overview handles accessibility content categories, darker system colors, Reduce Motion, expanded geometry, minimum hit areas, and horizontal shortcut scrolling.
- New Activity and Saved Search use `UIFontMetrics` and scalable labels.
- Many icon-only buttons have explicit labels/hints; save status uses announcements.

Gaps:

- Fixed-size fonts dominate legacy Native Map/editor/settings/auth/create-trip code.
- Several controls below 44 points rely on surrounding layout without a minimum hit-area wrapper.
- `minimumScaleFactor` is used in places where multiline/reflow may be more accessible.
- Fixed-light tokens do not support system Dark Mode.
- High-contrast dynamic colors are limited to Trip Overview roles.
- Custom selected/disabled states are inconsistent; some use opacity only.
- Native custom controls do not consistently expose selected/value state.

## 3. Current Component Inventory

### Foundations

- `AlmidyDesignTokens`: colors, general spacing/radius/control/shadow/font helpers, and detailed Trip Overview geometry.
- `NativeAdaptiveLayout`: compact-height behavior and `NativeGradientButton`.
- `NativeActivitySheetMetrics`: reusable activity detent height calculations.
- `NativeTripOverviewHeaderTransition`: collapse interpolation and Reduce Motion behavior.
- Web canonical tokens + Tailwind aliases; `tripUi` and map visual configuration are secondary local systems.

### Native primitives

- `NativeTripActionButton`, `NativeGradientButton`.
- `NativeTripOverviewMinimumHitButton`.
- `NativeTripOverviewDivider`.
- `NativeTextFieldPadding`.
- `NativeActivityQuickButton`, `NativeTripOverviewActionButton`, `NativeTripOverviewEmptyActivityAction`.
- Category bubbles, icon clusters, badges, annotation views, day buttons, and timeline nodes/connectors.

### Native components

- Page/sheet headers are feature-local in Native Map editors, Trip Overview, Itinerary, New Activity, Saved Search, Create Trip, Settings, Account, and Auth.
- Cards: `NativeTripOverviewCard` plus itinerary/documents/expenses/recent subclasses; email-forwarding/invite cards; activity/action/form cards built by local factories in `NativeMapPlugin`; trip cards and background cells.
- Rows: Trip Overview document/currency/recent rows; itinerary timeline/calendar promo cells; activity category cells; settings/profile table rows; form and reservation rows.
- Inputs: destination controller, padded text fields, search fields, note/cost/date/time/location editors, native calendars, web mobile form primitives.
- Map UI: preference style cards, floating controls, annotations, place detail card, route/ETA controls, map sheet.
- Media: focal image view, gradient view, compact surface, background picker cells, snapshot previews.

### Native patterns and screens

- Globe + bottom sheet + floating map controls.
- Trip Overview photographic hero + shortcut rail + stacked cards.
- Peer native Itinerary sheet + day rail + timeline.
- New Activity category/search sheet + MapKit selection.
- Place Card + saved-place detail editor.
- Transportation/flight editor with nested location/date/time/cost/note/link sheets.
- Create Trip staged destination/date/background workflow.
- Settings, Profile/Account, Auth, Search, Capture Ideas.

### Web component families

The web layer has only one directory-level UI primitive module, [`components/ui/mobile-form.tsx`](components/ui/mobile-form.tsx). Most reusable styling is encoded as exported feature components or Tailwind strings:

- Dashboard shells/nav/sidebar/mobile wallet/trip cards/onboarding/loading.
- Trip shell/header/tabs/pass hero/overview/timeline/map/budget/ideas/documents/sharing.
- Wallet card/page shell.
- Search and imports flows.
- Account/settings/auth forms.
- Flight operations panels/maps/status/truth.
- Google/custom globe renderers and map markers.

This explains why visual decisions proliferate: component reuse exists at feature level, but foundational primitives are sparse.

## 4. Screen-to-Component Matrix

| Screen/pattern | Header/navigation | Surface/card | Inputs/rows | Presentation |
|---|---|---|---|---|
| Native Globe | custom map controls/title | native map sheet, trip cards | search, trip list | persistent custom sheet + modal sheets |
| Trip Overview | photographic collapsing header | `NativeTripOverviewCard` family | shortcut actions, compact rows | page sheet with reference/large detents |
| Native Itinerary | custom close/title controls | timeline cells, promo cell | day rail, filters, date picker | peer page sheet + calendar sheet |
| New Activity | custom navigation appearance | category/result rows | search, quick actions | navigation controller in activity sheet |
| Place Details | custom place card header | Look Around/media/action blocks | travel mode controls | summary/large page sheet |
| Saved Place / transport editor | back/title/save header | form, location, detail/action cards | text/date/time/cost/note/attachments | expanded page sheet + nested utility sheets |
| Create Trip | staged custom header/footer | destination/date/background blocks | text input, calendar, image picker | full-screen native flow + sheets |
| Settings | custom title/close | grouped table/preview cards | switches and rows | 28-point utility sheet |
| Account/Profile | custom sheet header | grouped account cards | fields/actions | 28-point utility sheet/web handoff |
| Auth | custom header | social/password blocks | text fields/buttons | 28-point utility sheet |
| Native Search | custom search header | results list | search field | medium/large sheet |
| Capture Ideas | custom header | upload/import cards | photo/file actions | page sheet |
| Web mobile wallet | feature-local dark shell | wallet/trip cards | search/actions | CSS fixed layers/bottom sheets |
| Web trip workspace | trip header/tabs | warm light + dark mobile cards | timeline/forms/maps | route pages and CSS sheets |
| Web account/settings | dashboard shell | repeated 1.75rem panel | standard HTML inputs/toggles | page content |

## 5. Hard-Coded Styling Report

### Repeated values that already imply tokens

- Layout: 4, 8, 12, 16, 20, 24, 32. Existing spacing tokens cover all except the dominant 20-point native sheet inset.
- Typography: 17 regular/semibold and 18 semibold recur most; current font helpers do not encode their roles.
- Radius: 18/24 correspond to existing control/card tokens; numerous equivalent call sites bypass them.
- Sheet radius: 34 is repeated 30 times and is partly represented by `TripOverview.sheetCornerRadius`, but used far beyond Trip Overview.
- Floating shadows: opacity 0.06–0.10 with radius 10–18 and y 4–9 are repeatedly reconstructed.
- Header control sizes: 44/48 recur across sheets.
- Form cards: 18 radius, white/system background, 16–18 horizontal padding, 52/64 rows.

### Existing tokens with little or no adoption

- Every member of `AlmidyDesignTokens.Spacing`: zero call sites.
- `Shadow.opacity/radius/offset`: zero call sites.
- `Control.compactButtonHeight`, `iconButton`, `mapControl`: zero call sites.
- `Radius.sheet`: no direct call site; sheets more often use 28, 34, 36, or 38.
- `disabledActionText`, `shadowSoft`: zero call sites.

### Values that should probably become semantic tokens/configurations

- 20-point sheet/page content inset.
- 34 editor-sheet and 28 utility-sheet radii as distinct presentation roles.
- Header icon controls: standard 44/48 plus circular hit-area behavior.
- Form row (52), action row (64), primary button (60), compact button (48).
- Elevation configurations rather than independent shadow scalar tokens.
- Semantic typography roles with `UIFontMetrics` baked in.
- Hairline vs outline vs selected border configurations.
- Motion duration bands and Reduce Motion resolution.

### Values that should remain local

- Trip Overview measured expanded/collapsed geometry and screenshot tolerances.
- Map camera distances, annotation geometry, route widths, pin strokes.
- Image focal analysis, generated gradients, media overlay strengths.
- Timeline connector placement and icon-cluster negative overlap.
- Calendar grid calculations and custom detent percentage calculations.

## 6. Inconsistency Report

### Critical

1. **Token contract is manually duplicated.** JSON is consumed by web, while Swift repeats values by hand in [`AlmidyDesignTokens.swift`](ios/App/App/AlmidyDesignTokens.swift:6). Drift is possible despite the comment claiming canonical parity.
2. **Native appearance contract is incomplete.** Fixed-light tokens coexist with adaptive system colors, so Dark Mode behavior varies by component rather than screen intent.
3. **`NativeMapPlugin.swift` is a visual monolith.** It contains Map Preferences, Place Details, calendars, flight/location editors, utility sheets, globe, settings, auth, account, search, capture, and annotation views. Shared visual patterns cannot be safely governed while embedded in a 12k+ line feature file.

### High

1. **Sheet architecture is repeated dozens of times.** Radius 34 alone appears 30 times; grabber, detent, scrolling, and dimming settings are rebuilt in `NativeMapPlugin` and `NativeTripOverviewViewController`.
2. **Typography wrappers are not semantic.** `Font.body(17)` and `Font.title(17)` still permit equivalent roles to use 16/17/18 inconsistently and do not guarantee Dynamic Type.
3. **General spacing and elevation tokens are effectively documentation-only.** Zero call sites means feature code remains the real source of truth.
4. **Headers/back/close controls have the same intent but 40/43/44/48/56 dimensions, several shadows, and radii derived locally.**
5. **Form/card factories are duplicated.** Activity/transport editor `card`, `detailCard`, `actionCard`, `routeCard`, `timeOnlyCard`; Create Trip; Settings; and Itinerary encode related surface behavior independently.
6. **Web has competing palettes.** Canonical gold/ink/mist, Tailwind orange/blue/slate, warm trip neutrals, and dark mobile neutrals each act like separate systems.

### Medium

1. `card` means mist in native tokens, while many visual cards are white/system background.
2. `darkInput`, `darkInputBorder`, and `darkPlaceholder` name light-surface values.
3. `goldSoft`, `goldDark`, `settingsGold`, `settingsIcon`, and `brandGoldText` resolve identically; roles are useful but naming/alias policy is unclear.
4. Neutral grays `#7D7D84`, `#8B8B92`, `#8E8E93`, `#929297`, and `#A2A2A8` are close enough to create accidental drift.
5. General sheet radius token is 36 while the dominant editor value is 34 and utility value is 28.
6. Error/success states mix Almidy `danger`/`success` with `.systemRed`/`.systemGreen`.
7. Some icon buttons achieve circularity through literal half-size radii, others through capsule/circle conventions.
8. Focus/pressed states are strong on web via Tailwind but sparse/inconsistent in custom UIKit controls.

### Low

1. Hairlines alternate between 0.5 and pixel-derived widths.
2. Equivalent compact gaps use 10, 12, and 14 depending on feature.
3. Icon sizes 18, 19, and 20 often serve the same row/card role.
4. One-off radii 21, 23, 25, 26, 27 are usually circular math and obscure intent.

## 7. Existing Design Token Assessment

### Keep and strengthen

- `AlmidyDesignTokens` as the native namespace.
- `design-system/almidy.tokens.json` as the shared brand foundation.
- Brand gold trio, white/mist/ink foundation, border subtle.
- On-media text and hero gradients.
- Map-specific and generated-media colors as scoped tokens.
- Detailed Trip Overview geometry, but keep it a component specification rather than general foundations.
- Spacing scale values 4/8/12/16/24/32/48.

### Change without immediate visual change

- Generate Swift constants from canonical JSON or verify parity in CI.
- Replace size-parameter font functions with semantic scalable styles; keep compatibility helpers temporarily.
- Replace scalar shadow namespace with complete elevation styles.
- Split surface semantics into canvas, grouped canvas, surface, raised surface, and neutral fill.
- Add the observed 20-point native content inset.
- Name sheet presentations by intent (`utility`, `editor`, `placeDetail`, `overview`) rather than global radius.

### Merge/deprecate gradually

- `brandOrange` aliases after all native references are gone.
- Identical gold-text aliases should remain as semantic forwarding properties only where roles differ.
- `borderSoft` into `borderSubtle`.
- `authSurface`/`walletSurface` into surface roles unless future appearance diverges.
- Investigate merging near-neutral Trip Overview values only through screenshot comparison.

### Remove only after migration

- Unused `shadowSoft`, scalar `Shadow`, and unused `Control` properties if replaced by configurations.
- Inaccurate `darkInput*` names.
- Feature-local duplicate factories after canonical components are adopted.

## 8. Proposed Almidy Native Design System v1

Evolve the existing namespace:

```swift
enum AlmidyDesignTokens {
    enum Color { /* semantic dynamic colors */ }
    enum Typography { /* UIFontMetrics-backed roles */ }
    enum Spacing { /* existing scale + native content inset */ }
    enum Radius { /* shape and presentation roles */ }
    enum Size { /* targets, controls, rows, icons */ }
    enum Border { /* complete border styles */ }
    enum Elevation { /* complete shadow styles */ }
    enum Motion { /* duration + reduced-motion resolution */ }
    enum Component {
        enum TripOverview { /* measured component geometry */ }
        enum Map { /* map-only geometry */ }
    }
}
```

Principles:

1. Shared JSON contains cross-platform brand semantics, not UIKit-specific geometry.
2. Swift adds platform semantics and dynamic providers.
3. Component specifications hold tightly coupled geometry; not every measurement becomes a foundation token.
4. Reusable UIKit components encode visual behavior and accessibility, while feature controllers retain product behavior.
5. Native platform conventions remain native: MapKit Place Cards, alerts, menus, toggles, calendars, and standard navigation behavior are configured, not reimplemented.

## 9. Proposed Token Definitions

All values below are derived from current implementation. “New name” means a semantic alias/migration target, not a visual change.

### Color

```text
accent                    #D6A84F
accentPressed             #B88A2E
accentText                #8C641E
accentMuted               #9F8857
accentMutedSurface        #F2EBDD
canvas                    #FFFFFF
canvasGrouped             #F2F3F6
surface                   #FFFFFF
surfaceNeutral            #F2F3F6 (evaluate #F3F3F5 merge visually)
textPrimary               #050505
textSecondary             #7D7D84
textTertiary              #A2A2A8
borderSubtle              black 10%
dividerSubtle             black 8%
borderStrong              black 12%
stateDisabledFill         black 6%
stateDisabledText         black 38%
success                   #3C8F5A
danger                    #C2413A
info                      #6D86A8
onMediaPrimary            white 100%
onMediaSecondary          white 92%
onMediaTertiary           white 82%
overlayScrim              black 48%
```

Keep map, avatar, generated-media, Trip Overview shortcut, and hero metadata colors as scoped component tokens.

### Typography

Each style should return `UIFontMetrics(...).scaledFont(for:)` and configure the corresponding label/button to adjust for content size.

```text
displayHero       52 regular, title1 metrics, multiline
screenTitle       24 semibold, title2 metrics
sheetTitle        22 semibold, title2 metrics
sectionTitle      20 semibold, title3/headline metrics
cardTitle         17 semibold, headline metrics
body              17 regular, body metrics
bodyCompact       15 regular, subheadline metrics
bodyEmphasized    17 semibold, body/headline metrics
action            17 semibold, body/headline metrics
metadata          13 regular, caption1 metrics
metadataEmphasis  13 semibold, caption1 metrics
caption           12 regular, caption2 metrics
badge             11 bold, caption2 metrics
```

Trip Overview’s existing 17/15/13/12 roles already align closely. The proposed 24-point screen title must not replace the intentionally 34-point Map Preferences title or 52-point hero without component review.

### Spacing

```text
xxs 4
xs 8
sm 12
md 16
nativeContent 20
lg 24
xl 32
xxl 48
```

Retain semantic aliases `elementGap=12`, `cardPadding=16`, `contentInset=24`; introduce `sheetContentInset=20`. Preserve 10, 14, and 18 as component-local values until families are migrated.

### Radius and shape

```text
small 8
field 12
control 18
card 24
cardLarge 28
sheetUtility 28
sheetEditor 34
sheetProminent 36
pill/circle semantic shapes (do not expose 999 to call sites)
```

Place Details’ 38 radius remains component-specific pending visual comparison.

### Size

```text
minimumTarget 44
headerControl 44 (standard) / 48 (prominent)
buttonCompact 48
buttonStandard 60
rowStandard 52
rowAction 64
mapControl 56
iconSmall 16
iconStandard 20
iconControl 24
iconProminent 28
iconHero 34
```

### Border

```text
hairline       1 / screen scale, dividerSubtle
outline        1, borderSubtle
outlineStrong  1, borderStrong
selected       2–3, accent/accentText
onMedia        1, white 10–20%
timeline       2, component color
```

### Elevation

```text
controlSubtle  black 0.08, radius 10, y 4
controlRaised  black 0.10, radius 14, y 5
floating       black 0.16, radius 12, y 5
cardRaised     black 0.18, radius 24, y 12
sheet          black 0.20, radius 34, y -4
mapPin         black 0.24, radius 5, y 2
textOnMedia    black 0.8–1.0, radius 2–3, y 0
```

### Motion

```text
fast       0.16 (observed 0.14–0.20)
standard   0.24 (observed 0.24–0.28)
expressive 0.45 (observed 0.45–0.48)
overviewSpring 0.48, damping 0.84, velocity 0.45
```

All APIs must resolve duration to zero or direct state changes when Reduce Motion requires it. Shake feedback remains a validation behavior, not a general transition token.

## 10. Proposed Native Component Library

### First-release primitives

| Component/configuration | Variants | Responsibilities |
|---|---|---|
| `AlmidyTextStyle` | semantic typography roles | Font metrics, Dynamic Type, default lines/truncation guidance |
| `AlmidySurfaceStyle` | canvas, grouped, card, onMedia | Background, border, radius; not a mandatory view subclass |
| `AlmidyButton` | primary, secondary, text, destructive | Typography, 48/60 height, disabled/loading/pressed states |
| `AlmidyIconButton` | standard, prominent, floating, onMedia | 44+ target, circular shape, symbol sizing, accessibility label requirement |
| `AlmidyDivider` | inset/full/hairline | Pixel-correct width and semantic color |
| `AlmidyBadge` | neutral, accent, success, danger | Compact type, padding, state semantics |
| `AlmidyInputStyle` | plain/grouped/search | Font, fill, border, placeholder, focus/error/disabled states |

### Shared components

| Component | Variants / responsibilities |
|---|---|
| `AlmidySheetConfiguration` | utility (28), editor (34), prominent (36), overview (measured); detents, grabber, scrolling, dimming |
| `AlmidySheetHeader` | back/close, centered title, optional save/action/status; safe-area and hit targets |
| `AlmidyCard` | standard, compact, actionable, onMedia; surface/radius/border/elevation |
| `AlmidyListRow` | title, subtitle, leading symbol, trailing value/chevron, destructive/selectable states |
| `AlmidyFormSection` | stacked fields with shared separators and validation states |
| `AlmidyActionRow` | icon + label, 64-point action form used by cost/note/attachments |
| `AlmidyEmptyState` | symbol/illustration, title/body/action, loading/error/offline variants |
| `AlmidySearchField` | native search typography, clear/cancel behavior, focus state |
| `AlmidyFloatingControl` | map/itinerary variants using scoped elevation |
| `AlmidyDateRail` | 48-point day controls, selection/accessibility behavior |
| `AlmidyTimelineNode` | connector/node semantics; itinerary-specific |

### Components that should remain specialized

- `NativeTripOverviewHeaderView` and its focal-image/collapse transition.
- `NativeTripOverviewActionsView` measured expanded/collapsed composition.
- MapKit Place Card and annotations.
- Native vertical calendar and itinerary timeline layout.
- Look Around and flight AR/map renderers.

## 11. Migration Plan

### Phase 0 — Baseline and governance

1. Capture representative screenshots for Globe, Trip Overview (empty/populated/collapsed/accessibility), Itinerary, New Activity, Place Details, saved-place editor, Create Trip, Settings, Account/Auth, and Search in current light appearance.
2. Add automated token parity verification from JSON to Swift; do not yet alter values.
3. Add a design-system ownership note defining brand/shared, iOS platform, map, media, and component-scoped tokens.

### Phase 1 — Foundations, visual-preserving

1. Add semantic aliases in `AlmidyDesignTokens` while retaining old properties.
2. Add scalable `Typography`, complete `Border`, `Elevation`, `Size`, and `Motion` configurations.
3. Move Trip Overview geometry under `Component.TripOverview` through compatibility forwarding.
4. Document intentional light-native appearance; do not invent dark colors.

### Phase 2 — Primitive components

1. Implement icon button, divider, text style, button configuration, input style, and surface configuration.
2. Migrate duplicate controls with exact existing sizes first.
3. Add snapshot/layout tests for normal and accessibility content sizes, high contrast, and Reduce Motion.

### Phase 3 — Shared components

1. Introduce semantic sheet configurations and replace repeated `UISheetPresentationController` blocks.
2. Extract sheet header, form section, action row, card, list row, empty state, and floating control.
3. Split presentation classes out of `NativeMapPlugin.swift` without changing behavior.

### Phase 4 — Feature migration

Recommended order, lowest visual risk to highest:

1. Settings, Account, Auth, Search.
2. Cost/note/date/time/location utility sheets.
3. Saved-place and transportation editor.
4. Create Trip.
5. Native Itinerary and New Activity.
6. Globe/map controls.
7. Trip Overview last, preserving its measured component contract.

### Phase 5 — Web alignment and Android contract

1. Expand canonical JSON with semantic roles that are truly shared.
2. Replace web warm/dark duplicated neutrals with named scoped palettes; do not force native and web implementation identity.
3. When Android begins, generate/translate shared semantic tokens into Compose `ColorScheme`, typography, dimensions, and native components rather than copying UIKit APIs.

### Phase 6 — Remove legacy styling

1. Remove compatibility aliases and unused token members only after zero references.
2. Delete local factories only after all variants are represented.
3. Enforce hard-coded brand-color and sheet-style lint rules while permitting documented component-local geometry.

## 12. Files To Change

No application files were changed during this audit. Recommended future changes:

### Existing foundations

- `design-system/almidy.tokens.json` — expand shared semantic contract only after approval.
- `lib/design-system/almidy-tokens.ts` — update type contract/generated consumption.
- `tailwind.config.ts` and `app/globals.css` — expose approved semantics and appearance roles.
- `ios/App/App/AlmidyDesignTokens.swift` — evolve in place; do not create a second token system.
- `scripts/verify-design-token-parity.mjs` — expand parity enforcement.

### Recommended new native files

- `ios/App/App/DesignSystem/AlmidyTypography.swift`
- `ios/App/App/DesignSystem/AlmidyElevation.swift`
- `ios/App/App/DesignSystem/AlmidySheetConfiguration.swift`
- `ios/App/App/DesignSystem/AlmidyButton.swift`
- `ios/App/App/DesignSystem/AlmidyIconButton.swift`
- `ios/App/App/DesignSystem/AlmidySheetHeader.swift`
- `ios/App/App/DesignSystem/AlmidyCard.swift`
- `ios/App/App/DesignSystem/AlmidyFormSection.swift`
- `ios/App/App/DesignSystem/AlmidyListRow.swift`
- `ios/App/App/DesignSystem/AlmidyEmptyState.swift`
- `ios/App/AppTests/AlmidyDesignSystemTests.swift`

### First native migration targets

- `ios/App/App/NativeMapPlugin.swift`
- `ios/App/App/NativeAdaptiveLayout.swift`
- `ios/App/App/NativeTripActionButton.swift`
- `ios/App/App/NativeTextFieldPadding.swift`
- `ios/App/App/TripOverview/NativeTripOverviewViewController.swift`
- `ios/App/App/TripOverview/NativeTripOverviewHeaderView.swift`
- `ios/App/App/TripOverview/NativeTripOverviewSectionViews.swift`
- `ios/App/App/TripOverview/NativeItineraryViewController.swift`
- `ios/App/App/TripOverview/NativeNewActivityViewController.swift`
- `ios/App/App/TripOverview/NativeTripSavedSearchViewController.swift`
- `ios/App/App/CreateTrip/NativeCreateTripViewController+Layout.swift`
- `ios/App/App/CreateTrip/Dates/NativeTripDatesViewController.swift`
- `ios/App/App/CreateTrip/Dates/NativeVerticalCalendarViews.swift`
- `ios/App/App/CreateTrip/Background/NativeTripBackgroundPickerViewController.swift`

### Web alignment targets

- `components/trip-ui.tsx`
- `components/ui/mobile-form.tsx`
- `components/wallet/wallet-card.tsx`
- `components/wallet/wallet-page-shell.tsx`
- `components/dashboard/travel-wallet-sheet.tsx`
- `components/dashboard/mobile-trips-wallet.tsx`
- `components/trip/trip-overview-page.tsx`
- `components/trip/trip-detail.tsx`
- `components/search/search-page.tsx`
- `lib/map/almidy-map-visuals.ts`
- `lib/wallet/hero-image.ts`

## Audit conclusion

Almidy does not need a new visual identity. It needs its existing identity made explicit and enforceable. The approved foundation is the current champagne-gold, white/mist, near-black, highly rounded, photographic, sheet-driven language. The safest next milestone is Phase 0 plus Phase 1: establish screenshot baselines, make JSON/Swift parity enforceable, and add semantic forwarding tokens and scalable typography without changing a rendered pixel.
