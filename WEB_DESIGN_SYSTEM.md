# Almidy Web Design System

## Foundations

The cross-platform source of truth is `design-system/almidy.tokens.json`; `lib/design-system/almidy-tokens.ts` adapts shared intent for Tailwind and CSS. Web owns responsive behavior, hover/focus/pressed mechanics, CSS line boxes and platform-appropriate control geometry. Shared token raw values, native UIKit mechanics and feature rendering are not web implementation details.

## Typography

Instrument Sans is the Almidy product family. `app/layout.tsx` loads the repository-approved Regular 400, Medium 500, SemiBold 600 and Bold 700 files once through `next/font/local`, exposes `--font-almidy-product`, preloads the faces and uses a system sans fallback. The authoritative files and OFL license live in `ios/App/App/Fonts/InstrumentSans`; the web build consumes them without modifying native assets. Product typography disables synthetic weights. Explicit `font-mono` remains appropriate for codes, routes, identifiers and technical data; provider-owned and embedded rendering may retain its own type system.

Tailwind exposes `font-almidy` and these semantic text utilities:

| Shared role | Web utility | Base size / weight | Web behavior |
| --- | --- | --- | --- |
| displayHero | `text-almidy-display-hero` | 52 / 400 | Responsive clamp to 72px on wide layouts |
| screenTitle | `text-almidy-screen-title` | 24 / 600 | 1.2 line height |
| sheetTitle | `text-almidy-sheet-title` | 22 / 600 | 28px line height |
| sectionTitle | `text-almidy-section-title` | 20 / 600 | 26px line height |
| cardTitle | `text-almidy-card-title` | 17 / 600 | 22px line height |
| body | `text-almidy-body` | 17 / 400 | 24px line height |
| bodyCompact | `text-almidy-body-compact` | 15 / 400 | 20px line height |
| bodyEmphasized | `text-almidy-body-emphasized` | 17 / 600 | 24px line height |
| action | `text-almidy-action` | 17 / 600 | 22px line height |
| metadata | `text-almidy-metadata` | 13 / 400 | 18px line height |
| metadataEmphasis | `text-almidy-metadata-emphasis` | 13 / 600 | 18px line height |
| caption | `text-almidy-caption` | 12 / 400 | 16px line height |
| badge | `text-almidy-badge` | 11 / 700 | 14px line height |

Visual role and HTML hierarchy are independent. Preserve correct `h1`–`h6`, labels, buttons and links. One-off editorial composition may retain local responsive sizes when it does not duplicate a shared role.

## Reusable component semantics

- Buttons use semantic roles such as primary, secondary, tertiary and destructive. Product actions generally use `action`; compact links do not become buttons merely for styling. Hover is web-owned, branded pressed states may use `accentPressed`, and the established accessible focus rings remain.
- Inputs, selects and textareas use semantic input colors and `bodyCompact` by default. Explicit labels remain required. Placeholder, disabled and error roles are distinct from ordinary body text.
- Ordinary reusable cards may adopt shared surface, border, radius and title roles. Trip editorial cards, media cards, Wallet composition, maps and provider panels remain feature-owned.
- Badges may share typography while keeping domain/status color ownership. Empty states should share hierarchy only when multiple active consumers express the same product pattern.

### Implemented ordinary primitives

- `AlmidyButton` owns the ordinary `primary` and compact `neutral` action variants. Primary uses `accent`, `accentPressed`, `textPrimary`, `action` typography, the web focus ring and disabled semantics. Neutral preserves the compact dark account action used by Profile and Security. Provider, map, Wallet, media and destructive confirmation buttons remain feature-owned.
- `AlmidyInput` and `AlmidySelect` preserve native HTML behavior and forward refs. They own the ordinary 44px minimum height, field radius, subtle border and padding; global input rules continue to own the established focus treatment. Invalid fields use `aria-invalid` and must retain an explicit label and described validation text.
- `AlmidyCard` owns only the ordinary raised surface shell: surface, subtle border, 28px compatibility radius, padding and panel elevation. Its class export supports form and conditional semantic hosts without changing their element type. Interactive, editorial, dashboard, Wallet, media and feature cards remain local.

No generic badge or empty-state primitive exists yet. The audit found feature/status ownership but no repeated ordinary production signature strong enough to justify another abstraction.

## Responsive behavior and accessibility

Web may expand display roles while preserving the shared family, hierarchy and weight intent. Validate major changes at canonical desktop and mobile widths and at 200% zoom. Preserve keyboard focus, semantic headings, explicit labels, contrast, disabled/error states, hit targets and responsive wrapping. Font migration must not add hardcoded text widths to hide metric differences.

## Feature exceptions

Tier C includes maps/globe, provider branding, Wallet/media composition, native-map underlays and feature-specific technical typography. Tier D slate/blue/orange/zinc/gray cleanup remains a future palette task. Broad web Dark Mode, admin visual consolidation, Android and native changes are outside v2.7.

## Visual regression

`npm run test:visual:web` runs eight deterministic visual fixtures plus one component accessibility/responsive test at zero pixel tolerance after `document.fonts.ready`. `npm run test:visual:web:update` is the explicit full recording command; use a focused `--grep` update when only one approved fixture changes. Pre-v2.7 system-font references for the trip and auth fixtures live under `design-baselines/web/v2.7-before/`; the pre-consolidation component gallery lives under `design-baselines/web/v2.7b-before/`.
