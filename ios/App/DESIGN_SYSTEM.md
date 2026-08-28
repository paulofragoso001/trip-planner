# Almidy Native Design System

`AlmidyDesignTokens` is the single native design namespace. The design-system directory contains semantic foundations and lightweight UIKit primitives; feature controllers retain product behavior.

## Ownership

- `design-system/almidy.tokens.json`: genuinely shared brand values used across platforms—brand colors, shared canvas/text/border seeds, core spacing, and core radii.
- `AlmidyDesignTokens`: iOS semantic aliases, Dynamic Type, UIKit sizing, shapes, borders, elevation, motion, and compatibility names.
- `AlmidyDesignTokens.Component.*`: measured specifications owned by one reusable product component, such as Trip Overview composition or future map presentation roles.
- Feature-local code: camera distances, annotation geometry, calendar math, timeline positioning, focal-image calculations, custom detent formulas, and other values without reusable design intent.

The current appearance contract is a light branded planning surface with selected adaptive UIKit utilities. Phase 1 does not define a native Dark Mode.

## Token rule

> A value should become a global design token because it expresses reusable design intent, not merely because the same number appears more than once.

Compatibility names remain available while later phases migrate call sites. New foundation APIs prefer semantic aliases such as `Color.accent`, `Typography.body`, `Spacing.sheetContentInset`, `Radius.sheetEditor`, `Size.minimumTarget`, complete `Border.Configuration` and `Elevation.Configuration` values, and Reduce Motion-aware durations.

## Primitive components

- `AlmidyIconButton`: standard, prominent, floating, and on-media icon actions. Its initializer requires an accessibility label and supports measured overrides without rebuilding symbols, shape, borders, or shadows in feature code.
- `AlmidyButton`: primary, secondary, tertiary, and destructive text actions in compact or standard sizes, with Dynamic Type, disabled, pressed, and loading states.
- `AlmidyDivider`: full-width or inset pixel-correct semantic separators. Timeline connectors remain feature structure.
- `AlmidyBadge`: neutral, accent, success, and danger compact labels.
- `AlmidySurfaceStyle`: composable canvas, grouped, card, large-card, neutral, and on-media surface configurations.
- `AlmidyInputStyle`: standard, grouped, and search field styling with normal, focused, error, and disabled states.

Phase 2 migrates only the duplicated 50-point Itinerary timeline and more controls. Broad extraction from `NativeMapPlugin.swift` remains later work; shared components may be adopted there incrementally.

## Layer ownership

```text
Feature
   ↓
Shared Components
   ↓
Primitives
   ↓
Design Foundation
```

- **Design foundation:** `AlmidyDesignTokens` and semantic typography, spacing, size, shape, border, elevation, and motion configurations.
- **Primitives:** buttons, icon buttons, dividers, badges, input styling, and surface styling. They own individual-control presentation and state.
- **Shared components:** `AlmidySheetConfiguration`, `AlmidySheetHeader`, `AlmidyCard`, `AlmidyListRow`, `AlmidyFormSection`, `AlmidyActionRow`, `AlmidyEmptyState`, and `AlmidyFloatingControl`. They compose primitives into reusable presentation structures without product logic.
- **Feature components:** Trip Overview collapse geometry, itinerary timelines and calendars, map annotations, media composition, networking, routing, and editor state.

Dependencies flow downward only. Shared components may consume primitives and foundations; primitives must not depend on shared or feature components.

## Shared sheet roles

- `utility`: lightweight settings, search, account, authentication, date, and filter surfaces; 28pt semantic radius with feature detent overrides.
- `editor`: creation and editing workflows; 34pt radius and non-expanding scrolling by default. Feature-specific height calculations remain with `NativeActivitySheetMetrics`.
- `prominent`: larger detail surfaces; 36pt radius. Existing measured 38pt exceptions remain feature-owned.
- `overview`: forwards to the protected Trip Overview radius and presentation behavior without flattening its measured detents or custom chrome.

The Native Itinerary date picker is the first shared-sheet migration. It retains its custom 67% detent and explicit 30pt compatibility radius.

## Feature Adoption Rules

- Migrate ownership before normalizing values. A successful adoption moves an existing visual decision into the canonical layer without silently changing it.
- Prefer semantic components over feature-local styling helpers. Renaming a local `cornerRadius` assignment does not constitute design-system adoption.
- Keep measured compatibility overrides when a shared default would change the rendered result. Record them in tests and the baseline manifest.
- Extend shared components only when a real screen demonstrates a reusable Almidy behavior with a semantic name.
- Keep product geometry local when it controls feature composition, content height, map behavior, timelines, media, or other specialized layout.
- Extract controllers from monolithic files incrementally only when their callback and helper dependencies form a clean boundary.

Native Settings is the first adopted utility feature family. It uses the utility sheet configuration, a large-leading shared header with a measured icon-button close control, and the grouped-card surface. Native inset-grouped table rows and specialized promo/profile composition remain feature-owned until a shared component can reproduce their UIKit geometry exactly.

Native Search is the second controlled adoption. Its globe-search controller is extracted from `NativeMapPlugin.swift` and retains MapKit completion, query, keyboard, selection, and dismissal ownership. It uses the utility sheet role with its existing medium/large detents, the outlined semantic search input, a message-only empty-state presentation for its existing inline status state machine, and a composed surface style for its plain results table. The measured centered title/subtitle sequence and reusable UIKit result cells remain feature-owned because the current shared header and list row do not reproduce their geometry and table semantics exactly.

Search established two concrete reusable rules: native text fields keep their keyboard, clear-button, selection, and first-responder behavior while receiving semantic styling; and `AlmidyEmptyState.Presentation.messageOnly` represents an inline, state-aware message without imposing illustration or action geometry. Search result rows should remain native table cells until a shared row can participate in UIKit reuse and separator behavior without becoming an accessory-mode framework.

## Editor architecture

Native Total Cost is the first controlled editor adoption. `NativeTotalCostInputViewController` is extracted from the map-plugin monolith with its original accent initializer and `(Decimal, String, String)` save callback intact. It uses the editor sheet role, followed by `NativeActivitySheetMetrics` for the existing large selected detent and compact-height width behavior. Compatibility overrides retain the hidden grabber and UIKit's existing scrolling-expansion behavior.

Cost adopts the centered shared sheet header with measured 62pt geometry and existing 76×34 Cancel and 60×34 Save actions. Its currency button uses a composed surface style. The monetary entry remains a native 52pt decimal-pad field beside a local currency symbol: applying a standard input surface or creating a global currency component would change the current design and prematurely encode financial behavior in the design system. Currency selection, parsing, two-decimal display formatting, invalid-input shake, first-responder timing, and dismissal-before-callback semantics remain feature-owned.

Cost required no new shared API. Its fixed 52pt amount typography, 34pt minimum shrink size, 20pt currency-control radius, and measured header actions are compatibility values rather than new global defaults.

Native Note is the second controlled editor adoption. `NativeNoteInputViewController` is extracted with its original accent initializer and `(String) -> Void` save callback. It uses the same editor sheet role, large-detent feature metrics, hidden-grabber compatibility override, and measured centered header geometry proven by Cost, while preserving its distinct plain system background and secondary Cancel surface.

Note retains a native `UITextView`; the design system owns compatible header composition and semantic typography, while Note owns multiline editing, scrolling, selection, first-responder timing, newline preservation, trimming at save time, keyboard avoidance, and callback payload. The existing editor has no placeholder, initial-value contract, character limit, visual input border, or save-disabled state, so none were introduced. UIKit's existing 8pt vertical text-container inset and 5pt line-fragment padding are now recorded explicitly as compatibility geometry. No multiline `AlmidyInputStyle` was added because the current clear text area has no reusable styled-input surface to generalize.

Native Date and Time are the next controlled editor adoptions. `NativeFlightDateInputViewController` and `NativeFlightTimeInputViewController` are extracted independently with their original `(Date?) -> Void` callbacks. Both use the editor sheet role with hidden-grabber and UIKit scrolling-expansion compatibility overrides, while their existing custom 79%-capped-at-700pt and 47%-capped-at-410pt detents remain feature-owned.

Date retains its inline native `UIDatePicker`, local-calendar start-of-day semantics, Today/Tomorrow immediate-save shortcuts, clear-to-nil behavior, and measured 82×40/68×40 header actions, 405pt calendar, 58pt shortcut row, and 48pt destructive action. Time retains its native wheel `UIDatePicker`, one-minute interval, selected-day/time recombination with zero seconds, time-zone-aware subtitle and picker, clear-to-nil behavior, and measured 78×36/64×36 header actions, 190pt wheel, and 42pt time-zone/destructive actions. The adjacent searchable time-zone selector moved with Time because it is a private feature dependency; the shared stored preference and downstream transportation date/time relationship logic remain outside both editors. No shared header or input primitive was adopted because their current centered title/subtitle geometry and native picker surfaces do not match those components without visual change.

Phase 6D establishes a component boundary for reservation, link, and attachment utilities embedded in the manual activity editor. `NativeReservationDetailsView` owns only the existing optional-detail presentation and native editable fields; the activity owner still supplies field order/placeholders, retains the field dictionary, maps values to `TransportationActivityDraft.ReservationDetails`, and controls immediate refresh/autosave behavior. Its compatibility geometry remains an unbordered 18pt-radius system surface with 6pt vertical/16pt horizontal margins, 52pt rows, 138pt labels, 18pt label/value spacing, and 0.5pt separators. `AlmidyFormSection`, `AlmidyListRow`, and `AlmidyInputStyle` are not adopted because their border, divider inset, accessory, and input-surface contracts would change this form. The Location variant deliberately remains feature-local and untouched for Phase 6E.

`NativeLinkInputAlert` preserves the existing system alert, URL keyboard, no-capitalization/no-correction settings, whitespace trimming, explicit HTTP/HTTPS requirement, display-host derivation, and no-op invalid Save. URL semantics remain feature-owned; no link-specific design-system API was introduced. `NativeAttachmentActionView` owns only the existing 64pt, 18pt-radius menu-launch row and its four action callbacks. The parent controller continues to own `UIDocumentPickerViewController`, `PHPickerViewController`, `UIImagePickerController`, camera-unavailable messaging, delegate callbacks, attachment state, label updates, persistence, and save-state refresh. System picker UI is never styled or wrapped by the design system.

Phase 6E extracts the Location editor's feature-owned category, check-in/check-out, and optional-detail compositions into `NativeLocationCategoryView`, `NativeLocationScheduleView`, and `NativeLocationDetailsView`. They retain the existing unbordered system surfaces, native text fields and buttons, measured geometry, owner callbacks, and immediate autosave notifications. Shared form, list-row, action-row, header, and input components were evaluated but not adopted because their borders, action geometry, or semantic contracts do not reproduce these embedded cards exactly.

The Location form intentionally remains the `.location` mode of `NativeManualFlightRouteViewController`: its initializer, existing `MKMapItem`, date/time editors, attachment utilities, `NativeSavedPlaceDetailDraft` mapping, generation-guarded autosave, and parent presentation form one shared boundary with the current activity workflow. Extracting the controller would require refactoring Transportation or beginning Saved Place architecture. The upstream MapKit result selection, query completion, coordinate resolution, placemark/address representation, camera, and annotation behavior are unchanged and remain outside the design system. The existing form has no Location search field, result list, clear/remove action, or visible Save action; the selected map item is supplied by its presenter, Name and Address are prefilled, coordinates remain on the presenter-owned item, and text changes autosave after 0.45 seconds. Live `MKLocalSearchCompletion` values are not fabricated for tests.

Phase 6F establishes the first primary-editor composition above the shared design system. `NativeSavedPlaceEditorView` owns the Saved Place section hierarchy—Location category, Name/Address fields, check-in/check-out schedules, Location details, Cost, Note, and attachment actions—while consuming the already extracted Location and utility views. It exposes only the native fields and schedule buttons the existing parent needs for prepopulation, formatting, and callbacks. The 14pt section rhythm, unbordered 18pt cards, 48pt primary fields, and Phase 6E Location geometry remain compatibility values rather than new global defaults.

Saved Place remains the `.location` mode of `NativeManualFlightRouteViewController`; the parent continues to own its existing `MKMapItem`, `NativeSavedPlaceDetailDraft` mapping, Cost/Note/Date/Time presentation, native picker delegates, link/attachment state, error status, and dismissal. `NativeSavedPlaceAutosaveGeneration` extracts only the feature-specific monotonically increasing generation check used by the unchanged 0.45-second autosave delay. A later mutation still supersedes an earlier scheduled or in-flight mutation, and the parent still immediately reschedules after an obsolete completion. Autosave is feature behavior and must not move into DesignSystem.

No shared DesignSystem API was extended for Saved Place. `AlmidyFormSection`, `AlmidyActionRow`, `AlmidyListRow`, and `AlmidySheetHeader` remain unsuitable for exact parity with the current embedded cards and hidden-Save header. Feature components may compose shared primitives and extracted utilities without becoming design-system components themselves.

Phase 6G gives the ten non-Flight transportation kinds a dedicated feature composition. `NativeTransportationEditorConfiguration` owns the existing kind-to-title, primary-field, route-copy, and reservation-row mappings for Car, Train, Car Rental, Transfer, Cruise, Walk, Bus, Bike, Ferry, and Motorcycle. It deliberately rejects Flight so aviation semantics remain in the parent for Phase 6H. `NativeTransportationEditorView` composes the measured primary field card, parent-supplied route sections, `NativeReservationDetailsView`, and the existing Cost, Note, and attachment actions with the established 14pt section rhythm.

Transportation still uses explicit Save rather than Saved Place autosave. `NativeManualFlightRouteViewController` retains departure/arrival `MKMapItem` state, route search presentation, direction inversion, car-distance requests, date/time relationship rules, timezone selection, `TransportationActivityDraft` construction and validation, native picker delegates, error/loading state, submission callback, and dismissal. This keeps MapKit, route/domain semantics, and Flight-shared mechanics outside DesignSystem while removing Transportation kind mapping and content hierarchy from the parent.

No shared DesignSystem API was extended for Transportation. The 18pt unbordered primary/detail cards, 48pt fields, 52pt reservation rows, 64pt actions, and specialized route cards remain compatibility or transportation-feature presentation. Shared form, list-row, action-row, input, and header components still do not reproduce the current geometry without changing behavior or appearance. A generic route-editor superclass is deferred until Flight supplies a second deliberate evidence point.

Phase 6H gives Flight its own feature composition without turning aviation behavior into a generic travel editor. `NativeFlightEditorConfiguration` records the existing Flight title, Airline, Airline IATA Code, Flight Number, and ordered reservation/airport detail rows. `NativeFlightEditorView` composes those native fields, the parent-supplied departure and arrival route sections, the existing AR action, `NativeReservationDetailsView`, and the Cost, Note, and attachment actions. It preserves the established 20pt content insets, 14pt section rhythm, unbordered 18pt cards, 48pt primary fields, 52pt detail rows, and 64pt actions.

`NativeManualFlightRouteViewController` remains the final owner of departure and arrival `MKMapItem` state, MapKit completion and airport resolution, IATA extraction, airport time-zone inference, date/time relationship rules, draft construction and validation, explicit Save, error/loading state, submission, dismissal, and Flight AR presentation. The existing editor contains no live operational flight-status lookup, so none was invented or moved. Flight still requires airline, flight number, airline IATA, both airport IATA codes, both map locations, and an ordered start/end range before submission.

Flight provides evidence that route state is shared, but not that route presentation is yet genuinely reusable. Flight route cards display only the airport item name with a plus action, while Transportation displays name/address with an edit action and additionally owns inversion and car-distance behavior. Its MapKit search also has airport-specific completion resolution and IATA semantics. Those differences remain explicit feature code instead of a generic route component or editor superclass. No shared DesignSystem API was added: the shared form, row, input, action, and header contracts still cannot reproduce this embedded editor's geometry without visual or behavioral change.

## Phase 6 final ownership

```text
Design Foundation
      ↓
Shared Components / Primitives
      ↓
Extracted Utility Editors
      ↓
Feature Composition
      ├── Saved Place
      ├── Transportation
      └── Flight
      ↓
NativeManualFlightRouteViewController domain orchestration
```

Phase 6I confirms that the remaining parent is an orchestration boundary, not a presentation component awaiting wholesale extraction. Saved Place composition and generation-guarded autosave remain separate from route behavior. Transportation and Flight own their respective content hierarchies, while the parent intentionally retains route locations, date/time relationships, draft validation, explicit submission, shared compatible route/action card construction, and presentation of the extracted utility editors. MapKit search, resolution, placemarks, directions, and airport time-zone inference remain feature-domain logic. Flight AR remains a separate Flight-specific integration. None of those responsibilities belong in DesignSystem.

No generic route editor exists because the two route families remain materially different: Flight has airport completion resolution, IATA validation, airport time zones, AR, and aviation details; Transportation has general-place search, address rendering, inversion, car distance, and kind-specific details. Their selected shared mechanics do not justify a superclass or new abstraction model. The existing parent class name is retained to avoid broad private integration churn while it still owns the stable Flight-and-Transportation route workflow.

The Phase 6 editor-family runtime baseline is **65 passed / 0 failed** on an iPhone 17e simulator running iOS 26.5, recorded August 27, 2026. Recovery required only restarting CoreSimulatorService, booting the clean explicit simulator, removing any stale Almidy installation, and rebuilding the test host. The reusable command should select a stable device name and OS rather than checking a transient UDID into documentation.

## Globe and map presentation

```text
MapKit / Globe Domain
        ↓
Map Feature Components
        ↓
Shared Almidy Components
        ↓
Design Foundation
```

Phase 7 extracts the floating Globe control cluster into `NativeMapControlsView`. The feature component owns the existing map/style, location, and orientation ordering; 8pt cluster and 1pt grouped spacing; translucent grouped surfaces; compatibility borders; and explicit accessibility order. It consumes `AlmidyIconButton` for 48pt controls and `AlmidyDivider` for the grouped separator. `NativeMapViewController` retains safe-area placement, visibility, offline state, location permission requests, camera changes, and preference presentation callbacks.

The custom in-view Globe sheet remains feature-owned because it is not a `UISheetPresentationController`: its collapsed/medium/expanded heights, pan gesture, map interaction, trip content, and dynamic avoidance are a single Globe composition. Its established 40pt radius and 8pt horizontal/12pt bottom placement now use `AlmidyDesignTokens.Component.Map` semantics, and its exact upward sheet shadow uses `AlmidyDesignTokens.Elevation.sheet`. This moves reusable visual intent without moving sheet state or layout behavior into DesignSystem.

Map Preferences remains a map feature controller. It adopts `AlmidySheetConfiguration.prominent` with measured compatibility overrides, `AlmidyIconButton` for its 48pt close control, and `AlmidyDivider` for route preferences. Its custom 49.4%-height detent, hidden grabber, existing prominent corner radius, 34pt title, 170pt MapKit preview cards, 20pt radius, and 3pt selected border are unchanged. Preview snapshots, available styles, switches, persistence, and map callbacks remain feature-domain behavior.

`AlmidyIconButton` now implements VoiceOver activation by dispatching its existing touch-up-inside action when enabled. Icon-only map controls provide explicit labels and hints, preserve a minimum 44pt target, and expose a stable style/location/orientation reading order. Migration remains presentation-first: camera, coordinates, annotations, clustering, directions, overlays, search resolution, map gestures, offline rendering, and Place Card behavior were not changed. Annotation and Place Card presentation remain candidates for a separate map subphase.

### Annotation presentation boundary

Phase 7B introduces `NativeMapAnnotationPresentation` and `NativeActivityAnnotationSelectionPresentation` as map-feature presentation contracts. MapKit still owns annotation models, reuse identifiers, lifecycle, collision/display priority, selection callbacks, z-order, coordinates, and Place Card presentation. The feature presentation layer owns the existing 40pt activity badge, 20pt glyph, 132×22pt title geometry, white stroke, rendering shadow, selected tail/anchor, selected transforms, title visibility, and accessibility traits. Category tint remains supplied by the activity feature.

Selection state is now complete and deterministic: selected presentation applies the existing −54pt offset, 1.72 badge scale, 1.12 glyph scale, tail/anchor, title position, and `.selected` trait; reuse explicitly clears transforms, labels, selected chrome, offsets, and traits. Trip flags expose button semantics, while geographic labels and the user-location marker remain non-action content. Clustering behavior is unchanged—activity results intentionally retain `clusteringIdentifier = nil`—and annotation geometry remains feature-owned rather than becoming general DesignSystem tokens.

### Place Card boundary

`NativeActivityPlaceDetailsViewController` remains the place-domain owner for `MKMapItem`, identity, Look Around requests and containment, ETA/directions requests, route overlays, destination search, Save integration, phone/website actions, external maps, error handling, and dismissal. Its page sheet now uses `AlmidySheetConfiguration.prominent` with compatibility overrides for the existing 39.6% summary detent, 38pt radius, visible grabber, scrolling expansion, and large undimmed state.

`NativePlaceTravelModesView` owns only the four-mode visual selector: the existing Walk/Drive/Transit/Cycle order, 44pt neutral surface, 22pt outer radius, 18pt selected surface, duration labels, selected traits, reading order, and callback index. The controller still maps indices to `MKDirectionsTransportType`, formats ETA/distance, issues requests, and updates the component. Header/share/close/directions controls adopt `AlmidyIconButton` through the existing measured 44pt feature factory, and Place Card separators adopt `AlmidyDivider`; specialized cards, route endpoints, Save styling, and Look Around chrome remain feature-owned for pixel compatibility.

Phone and website rows now use `NativePlaceAccessibleActionView`, routing gesture and VoiceOver activation through one callback. No Place-specific DesignSystem styles or map-domain tokens were added. This preserves the dependency direction: MapKit/place domain → map/place feature components → shared Almidy components → design foundation.

### Globe card presentation boundary

Phase 7C completes the Globe card migration with the following dependency direction:

```text
Map / Trip Domain
       ↓
Globe + Place Feature Components
       ↓
Shared Almidy Components
       ↓
Design Foundation
```

`NativeGlobeTripCardView` owns the established media clipping, 36pt radius, on-media gradient and text layout, measured active/future height, and combined accessibility presentation. `NativeMapViewController` still owns trip ordering and identity, schedule-state inputs, image cache/URL/MapKit snapshot/destination-gradient selection, context menus, activation routing, and navigation. Trip Overview components are not shared with the Globe card because their composition and semantics differ.

`NativeGlobeReservationAutomationView` owns the existing importer suggestion surface, copy, independent CTA and dismiss controls, reading order, and compatibility geometry. Eligibility, visibility, dismissal state, importer routing, and reservation semantics remain with the Globe controller. The two remaining non-cluster search/add actions now consume `AlmidyIconButton` with exact 48pt and legacy elevation overrides; native menus and their selection/filter semantics remain feature-owned.

Place Card media, Look Around, Save treatment, information/contact grouping, route endpoint composition, and bottom action bar remain Place-feature presentation. Their operational `MKMapItem`, directions, ETA, URL, authentication, and media behavior stays in the controller. No new DesignSystem API or map token was required for Phase 7C.

## Trip Overview component specification

```text
Trip / Overview Domain
        ↓
Trip Overview Feature Components
        ↓
Component.TripOverview
        ↓
Shared Almidy Components / Primitives
        ↓
Design Foundation
```

`AlmidyDesignTokens.Component.TripOverview` is the semantic path for relationships shared across the Overview composition: expanded/compact and accessibility header heights, detent chrome, shortcut geometry, outer and card rhythm, common card/header geometry, icon clusters, and populated/empty action measurements. The original `AlmidyDesignTokens.TripOverview` path remains a compatibility alias while existing measured call sites migrate incrementally; both resolve to the same specification.

The Overview presentation now actively consumes `AlmidySheetConfiguration.overview`, including its 34pt radius, hidden system grabber, non-expanding scrolling, and compact-height attachment behavior. Its custom collapsed/reference detents, selected large detent, and large undimmed state remain feature configuration. `NativeTripOverviewCard` consumes `AlmidySurfaceStyle` with its exact 28pt component radius and no border/elevation, while generic card hairlines compose `AlmidyDivider` using the existing Overview divider color. Overview-specific typography, on-media colors, action surfaces, and shared motion duration continue through semantic foundation tokens.

`NativeTripOverviewHeaderView`, `NativeTripOverviewHeaderTransition`, `NativeTripOverviewActionsView`, itinerary/documents/expenses/recent cards, email forwarding, invitations, category bubbles, icon clusters, and compact/empty compositions remain specialized feature components. Their measured relationships are not generic cards, headers, toolbars, or empty states. The hero image source, focal crop, image-derived palette, gradients, attribution, fallback, parallax, and high-contrast adjustments remain media-owned.

Collapse progress, smooth-step handoff, title collision, hero occlusion, focal translation, and compact-detent endpoint composition are unchanged. Dynamic Type continues to select dedicated accessibility header heights and horizontally scrolling shortcuts. High contrast retains dynamic border and metadata treatment. Reduce Motion keeps linear progress while reaching the same final geometry. Custom header and action controls now route touch and VoiceOver activation through the same callback.

## Native Design System v1 closure

**Status:** Complete and frozen
**Freeze date:** August 27, 2026
**Runtime baseline:** 88 passed / 0 failed
**Visual policy:** Existing intended appearance preserved
**Recommended milestone:** `almidy-native-design-system-v1`

Future native work begins from this architecture and baseline. Normalization, Dark Mode, web reconciliation, Android planning and screenshot infrastructure are separate v2 tracks; they must not be described as unfinished v1 adoption. The detailed compatibility inventory, risk analysis and ordered plan live in [`DESIGN_SYSTEM_V2_ROADMAP.md`](../../DESIGN_SYSTEM_V2_ROADMAP.md).

## v2.1 exact-equivalent cleanup

v2.1 applies a zero-pixel-change rule. It removes obsolete zero-consumer forwards and migrates references only when the replacement has the same resolved UIKit value and behavior. The shared JSON contract and every canonical raw value remain unchanged.

The inaccurate fixed light-input names `darkInput`, `darkInputBorder`, and `darkPlaceholder` are replaced by `inputSurface`, `inputBorder`, and `inputPlaceholder`. The UIColor constructions remain exactly `#F5F5F7`, black at 12% alpha, and black at 44% alpha. `disabledActionBackground` references now use the identical `stateDisabledFill`; its unused text and border companions are removed. The unused orange, auth/wallet surface, soft-border and scalar shadow compatibility forwards are also removed, along with the dead `Control`, `Shadow`, `Font.regular`, and `Font.medium` APIs after exact reference migration.

Semantic distinctions intentionally remain for `canvas`/`surface`, grouped and settings surfaces, gold text/action roles, settings borders/icons, modal scrims, spacing/radius roles, adaptive metadata, map/media colors, and both Trip Overview namespace paths. Identical current values do not erase roles that may legitimately diverge in later appearance work. No shared-component API was removed.

Near-equivalent values remain deferred: `#F2F3F6` versus `#F3F3F5`, 17pt versus 18pt typography, 28pt versus 30pt radii, and 18pt versus 20pt spacing. Those require deterministic visual baselines and explicit approval; they are not v2.1 cleanup.

Governance rules:

- Keep feature/domain behavior above feature components and out of DesignSystem.
- Add shared semantics only with multiple equivalent consumers or strong reusable evidence.
- Document compatibility overrides and preserve them until an approved visual-change phase.
- Keep cross-platform JSON free of UIKit detents, MapKit geometry and other platform mechanics.
- Allow raw renderer, algorithmic, media and measured component values; discourage repeated raw brand colors, standard surface radii, control shadows and semantic fonts.
- Evolve tokens through proposed → active → compatibility alias → deprecated → removed.
- Require tests, accessibility review, backward-compatible migration, and visual parity or explicit approval for shared-component evolution.
