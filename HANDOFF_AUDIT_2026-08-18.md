# Almidy Complete Handoff Audit

> **Validation update (2026-08-18):** CoreSimulatorService was restored after this snapshot. The Debug and Release simulator builds succeeded, `git diff --check` passed, and the complete `AppTests` suite passed with 188 tests and 0 failures. Physical-device and live MapKit verification remain release gates.

**Audit date:** 2026-08-18
**Repository:** `/Users/fragoso/Documents/Codex/Almidy-Commit-Stack`
**Branch:** `codex/recovered-new-ui-release`
**Purpose:** Current-state engineering handoff for the native iOS New Activity category, search, globe, annotation, results-list, and sheet work.

## 1. Executive verdict

**Status: implementation in progress; release HOLD.**

The current source contains most of the requested New Activity search-and-globe architecture: non-transport categories operate as search filters, results are shared between the list and globe, the sheet supports a preview detent, map annotations use Almidy styling, and result cells have normalized layouts. Swift syntax parsing and whitespace validation pass.

This is not yet a production-ready handoff because:

- the working tree is broad and uncommitted;
- a full Xcode build could not be completed in the current sandbox;
- the screenshot history documents several runtime defects, while the latest source has not been revalidated end-to-end on supported devices;
- transportation regressions, location-mode semantics, sheet geometry, map/list synchronization, and iOS 15 compatibility still require device testing;
- broader backend security and persistence release gates identified by the prior production audit remain open unless another workstream has independently closed them.

The next engineer should treat the source behavior described below as **implemented but not fully runtime-certified**.

## 2. Supersession and scope

This audit supersedes the 2026-08-17 pasted handoff as the current repository snapshot. That earlier audit remains useful historical context, but the working tree has changed materially: it now contains 20 modified tracked files and 4 untracked files.

This document focuses on the native iOS activity workflow requested during the latest iteration:

- New Activity categories;
- filtered place discovery;
- Nearby versus Everywhere origin selection;
- list and globe population;
- branded map annotations;
- map/list selection synchronization;
- half-height and full-height sheet behavior;
- preservation of transportation-specific activity forms;
- visual consistency using existing Almidy colors.

It does not claim that unrelated modified files are complete or owned by this workstream.

## 3. Repository snapshot

### Git position

The local branch is two commits ahead of its remote tracking branch.

Recent commits:

1. `a197c0e Keep native globe imagery consistent while zooming`
2. `ed5f887 Add native trip card context menu`
3. Remote baseline: `9659659 hide internal hero attribution identifiers`

### Dirty working tree

Modified tracked files:

- `ios/App/App.xcodeproj/project.pbxproj`
- `ios/App/App.xcodeproj/xcshareddata/xcschemes/App.xcscheme`
- `ios/App/App/AlmidyDesignTokens.swift`
- `ios/App/App/Info.plist`
- `ios/App/App/NativeMapPlugin.swift`
- `ios/App/App/TripOverview/NativeTripOverviewHeaderView.swift`
- `ios/App/App/TripOverview/NativeTripOverviewModels.swift`
- `ios/App/App/TripOverview/NativeTripOverviewRouter.swift`
- `ios/App/App/TripOverview/NativeTripOverviewSectionViews.swift`
- `ios/App/App/TripOverview/NativeTripOverviewViewController.swift`
- `ios/App/AppTests/NativeAuthConnectivityTests.swift`
- `ios/App/AppTests/NativeCreateTripLocationTests.swift`
- `ios/App/AppTests/NativeMapConnectivityTests.swift`
- `ios/App/AppTests/NativeSessionCoordinatorTests.swift`
- `ios/App/AppTests/NativeSettingsTests.swift`
- `ios/App/AppTests/NativeTravelImageConnectivityTests.swift`
- `ios/App/AppTests/NativeTripBackgroundTests.swift`
- `ios/App/AppTests/NativeTripDateConnectivityTests.swift`
- `ios/App/AppTests/NativeTripDateTests.swift`
- `ios/App/AppTests/NativeTripStoreTestSupport.swift`

Untracked files:

- `docs/almidy-complete-production-audit.md`
- `ios/App/App/TripOverview/NativeNewActivityViewController.swift`
- `ios/App/App/TripOverview/NativeTripSavedSearchViewController.swift`
- `ios/App/App/config 2.xml`

The tracked diff observed during this audit was approximately 4,099 insertions and 432 deletions. Do not discard, reset, or bulk-stage this worktree without first identifying ownership of every path.

## 4. Product contract captured from the iteration

The intended behavior is:

1. Transportation activities retain their dedicated creation forms.
2. Every other New Activity category acts as a search filter.
3. Selecting a category places a category token in the search field and immediately starts place discovery.
4. Search results populate both the list and globe from one ordered result collection.
5. The globe updates as soon as a usable result snapshot is available.
6. Nearby searches around the user's current location.
7. Everywhere searches around the selected trip locality or explicit location.
8. The visible map center is only a last-resort origin.
9. Search bounds remain city-scale; camera fitting happens after discovery.
10. Distant outliers must not force a statewide camera.
11. The camera accounts for the visible collapsed sheet.
12. Pins preserve Almidy teal, use a circular white-bordered treatment, and use a consistently sized category glyph.
13. Default unwanted clustering is disabled at the intended zoom.
14. Selecting a list row focuses its pin; selecting a pin highlights or scrolls to its row.
15. The New Activity sheet supports a lower preview/half state and a full-height state.
16. Activity screens use consistent sheet width, corner radius, placement, and presentation ownership so sheets do not visibly stack.
17. The header is compact, the clear button remains available for active searches, and result rows follow a stable two-line layout.
18. Existing Almidy teal and gold are preserved; readability improvements must not replace the brand palette.

## 5. Current implementation architecture

### `NativeNewActivityViewController.swift`

This untracked source file is the primary New Activity UI and search controller. Current source inspection found:

- non-transport categories are filters;
- transportation categories are identified by `opensDedicatedActivityForm` and remain routed to dedicated forms;
- category selection installs a search token and category-specific search configuration;
- the clear affordance remains visible while a query or category is active;
- search publishes the first nonempty ranked snapshot immediately, then continues enrichment until its target count or search terms are exhausted;
- `replacePlaceResults` atomically replaces the ordered results, reloads the list, and publishes the same collection to the map callback;
- the controller exposes map-to-list selection through a stable result identifier;
- result cells use fixed icon containers, two text labels, a stable row height, truncation, and `prepareForReuse` resets;
- the view requests collapse to the preview detent after initial results become available;
- colors are derived from the current Almidy teal/gold language.

Important caveat: this file is not tracked by Git. Until it is intentionally added, a clone or clean checkout will not contain this implementation.

### `NativeMapPlugin.swift`

Current source inspection found:

- one ordered `[MKMapItem]` model feeds annotations and selection;
- search has region-based ranking, deduplication, filtering, and progressive publication;
- camera fitting uses dynamic padding and a maximum camera distance;
- bottom map padding incorporates the collapsed sheet height;
- custom selected detent identifier use is guarded for iOS 16 availability;
- annotations use a circular 48-point badge, 3-point white border, 24-point white glyph, circular collision mode, disabled clustering, and stable display priorities;
- annotation labels are constrained and truncated rather than allowed to expand indefinitely;
- selected/focused annotations receive higher priority.

### `NativeTripOverviewViewController.swift`

Current source inspection found shared sheet geometry through `NativeActivitySheetMetrics`:

- preview height is derived from safe height and bottom inset;
- preview height is bounded to approximately 320–390 points;
- iOS 16 uses a custom preview detent plus large;
- iOS 15 falls back to medium plus large;
- the sheet supports expansion to full height;
- the grabber is visible;
- the New Activity callback hides the prior primary sheet/modal before presenting the activity sheet and synchronizes map selection.

This is directionally consistent with the request to avoid visibly stacked activity views, but it still requires runtime verification across all entry paths.

## 6. Search origin and bounds assessment

### Implemented direction

The controller distinguishes Nearby and Everywhere search modes and exposes a resolved region to the map callback. Search and map receive the same result replacement event rather than running independent result pipelines.

### Remaining risk

The deterministic precedence must be verified with actual trip data:

1. explicit selected locality;
2. active trip destination;
3. user location only for Nearby;
4. visible map center only when no higher-priority location exists.

The current filtering is primarily region/radius based. It is not evidence of a true municipal or metropolitan polygon boundary. Searches near dense metro borders can still admit semantically distant results, and MapKit can return generic or unexpectedly distant matches. The screenshot history showing Chicago, Connecticut, New York, Miami, and other displaced result regions makes this the highest-priority runtime verification area.

## 7. Result retrieval and quality assessment

Implemented source behavior includes progressive search-term enrichment, deduplication, distance-based ranking, generic-result rejection, and a result target of roughly 12 items.

Open questions:

- Twelve results may be insufficient for some categories or map densities.
- Generic-result filtering needs validation against real MapKit responses.
- The current metro rejection is radius-based and may not match locality boundaries.
- Search cancellation and atomic replacement must be stress-tested while changing query, category, and location rapidly.
- The catalog contains a duplicate `Park` purpose entry that should be removed or intentionally differentiated.

## 8. Map annotation and camera assessment

### Implemented in source

- Almidy teal is retained.
- Custom circular annotations replace the default teardrop visual.
- A white border and uniform glyph treatment are applied.
- Clustering is disabled for these search annotations.
- Selection priority is stable.
- Camera fitting is separate from search bounds.
- Camera distance is capped at approximately 80 km.
- Fit padding changes with result count.
- Bottom padding accounts for collapsed sheet height.

### Runtime risks documented by screenshots

Historical snapshots show all of the following at different stages:

- no annotations despite visible list results;
- a statewide or multi-state camera caused by distant outliers;
- all pins stacked at one coordinate;
- many overlapping labels and pins;
- single oversized annotations that hide result density;
- default or inconsistent annotation treatments;
- camera centering on the wrong locality;
- list and globe containing different result sets.

The source now addresses several likely causes, but screenshots alone do not prove the latest implementation is correct. Device validation must confirm the final state.

## 9. Sheet geometry and visual assessment

The requested reference state exposes a substantial portion of the globe while retaining the title, search controls, location mode, and two result rows in the preview sheet.

Current source includes a bounded custom preview height and large expansion. Historical snapshots, however, show:

- sheets beginning too high;
- different sheet widths and corner radii between screens;
- prior sheets visibly stacked behind the active sheet;
- oversized empty space between the location controls and results;
- title/search controls clipped into each other;
- inconsistent placement when the keyboard appears;
- the preview sheet occupying too much of the globe;
- result rows partially clipped at the bottom.

The final implementation should derive preview geometry from safe-area dimensions and actual content needs, use one presentation owner, and ensure only the active sheet is visible.

## 10. Verification performed

### Passed

`git diff --check`

- Result: passed with no whitespace errors.

Swift frontend syntax parsing:

```sh
xcrun swiftc -frontend -parse \
  ios/App/App/NativeMapPlugin.swift \
  ios/App/App/TripOverview/NativeNewActivityViewController.swift
```

- Result: exit code 0 with no parser errors.
- Scope: syntax only. This does not type-check imports, resolve packages, compile the target, link, or run tests.

### Blocked by the current environment

`xcodebuild -list -project ios/App/App.xcodeproj`

and an isolated generic iOS Debug build with code signing disabled both failed before source compilation because:

- CoreSimulatorService was unavailable;
- the sandbox denied access to Xcode/SwiftPM diagnostic and cache paths under the user's Library;
- package dependencies could not be resolved in the restricted environment.

The isolated build exited with code 74. This is an environment failure, not evidence that the source either passes or fails compilation.

### Not completed

- full Xcode compile;
- unit/UI test suite;
- device or simulator interaction tests;
- iOS 15 compatibility build;
- supported iPhone size matrix;
- live MapKit result-quality testing;
- transportation form regression testing;
- VoiceOver, Dynamic Type, keyboard, and rotation checks.

## 11. Readiness matrix

| Area | Source status | Verification status | Handoff status |
|---|---|---|---|
| Non-transport categories as filters | Implemented | Syntax inspected | Needs device QA |
| Transportation dedicated forms | Preserved by routing intent | Not regression tested | At risk until QA |
| Progressive result publication | Implemented | Source inspected | Needs live MapKit QA |
| Shared list/map result model | Implemented | Source inspected | Needs synchronization QA |
| Nearby/Everywhere separation | Implemented directionally | Not fully runtime verified | High-priority QA |
| Explicit locality origin | Present in region flow | Precedence not proven | High-priority QA |
| Deduplication/ranking/filtering | Implemented | Real-result quality unverified | Needs tuning |
| Branded circular annotations | Implemented | Not visually certified | Needs screenshot QA |
| Clustering disabled | Implemented | Not runtime certified | Needs density QA |
| Camera fit and zoom cap | Implemented | Outlier behavior unverified | High-priority QA |
| Row/pin two-way selection | Implemented callbacks | Not interaction tested | Needs QA |
| Half/full sheet detents | Implemented with OS fallback | Device geometry unverified | High-priority QA |
| Sheet stacking prevention | Presentation cleanup present | All paths unverified | Needs navigation QA |
| Header and rows | Normalized in source | Multiple sizes unverified | Needs visual QA |
| Almidy colors | Preserved in inspected code | Visual QA pending | Expected complete |
| Full build | Unknown | Environment blocked | Release blocker |

## 12. Known defects and risks

### P0 — must resolve before release

1. **No clean full build result.** Run Xcode build and tests in an unrestricted local environment.
2. **Untracked core feature files.** Add intended New Activity and saved-search files to version control.
3. **Broad dirty worktree.** Separate, review, and commit coherent changes; do not ship an unidentified working tree.
4. **Search-origin correctness.** Prove Nearby, Everywhere, selected locality, trip destination, and map-center fallback separately.
5. **Map/list parity.** Prove every row has one annotation and every search annotation derives from the same ordered result collection.
6. **Transportation regression.** Confirm every transportation category still opens its established form and never enters place-filter search.

### P1 — required for feature acceptance

1. Tune city/metro bounds so searches cannot jump across states.
2. Confirm camera zoom cap, map padding, and outlier handling.
3. Confirm preview detent matches the reference on small and large iPhones.
4. Eliminate all sheet stacking and mismatched sheet dimensions.
5. Confirm the globe populates on the first usable search snapshot.
6. Validate pin selection scrolls the list and row selection focuses the correct pin.
7. Remove the duplicate `Park` purpose or document why both entries are needed.
8. Validate result-cell reuse so icon and subtitle states never collapse.

### P2 — polish and resilience

1. Tune result count by category and density.
2. Improve semantic locality filtering beyond a radial metro approximation if MapKit quality remains inconsistent.
3. Add loading, empty, error, and permission-denied states without reintroducing large blank regions.
4. Validate accessibility labels, Dynamic Type, reduced motion, and keyboard transitions.
5. Reduce map bleed-through while preserving the existing glass language and brand colors.

## 13. Required QA matrix

### Search origin

- Active trip destination, no explicit selection, Everywhere.
- Explicit locality selected, Everywhere.
- Location permission granted, Nearby.
- Location permission denied, Nearby fallback.
- No trip locality and no user location, map-center fallback.
- Switch Nearby → Everywhere → Nearby during an active query.

### Category routing

- Stay, restaurant, tour, health, shopping, services, and other non-transport categories create filter searches.
- Flight, car, train, car rental, transfer, cruise, walk, and all remaining transportation categories retain their existing forms.

### Search behavior

- Category token with empty free-text query.
- Category token plus free-text query.
- Clear query while retaining/removing category as designed.
- Rapid query edits and rapid category changes.
- Explicit location change during an active search.
- Empty, network-limited, and permission-denied states.

### Globe behavior

- First result snapshot appears immediately.
- List and map counts and stable identifiers match.
- Camera remains metro-scale.
- Distant outlier cannot zoom to state or country scale.
- Preview sheet does not cover the fitted annotations.
- Dense results remain individually selectable at intended zoom.
- Row selection focuses a pin; pin selection scrolls/highlights its row.

### Sheet and layout

- Preview and large detents on the smallest supported iPhone.
- Preview and large detents on a current Pro Max-size iPhone.
- iOS 15 medium fallback and iOS 16+ custom preview.
- Keyboard shown and hidden in both detents.
- Repeated navigation through trip overview → new activity → location → results.
- Confirm previous sheets are hidden/dismissed rather than visible behind the active sheet.

## 14. Recommended implementation sequence

1. **Stabilize source control.** Review all modified/untracked paths, add intended files, split unrelated work, and create a safety commit.
2. **Restore build certainty.** Resolve packages and run a clean Debug build plus tests outside the sandbox.
3. **Write origin-unit tests.** Centralize origin resolution into a pure, testable policy covering trip, explicit locality, Nearby location, and map fallback.
4. **Write one search snapshot model.** Keep query, category, origin, region, ordered results, and generation ID together; publish one atomic state to list and map.
5. **Harden metro filtering.** Add category-aware quality checks, distance limits, dedupe keys, and cancellation/generation guards.
6. **Finalize camera policy.** Fit only accepted results, cap distance, incorporate measured sheet height, and reject outlier influence.
7. **Finalize annotations.** Retain teal circular pins, stable identifiers, predictable labels, priorities, and explicit non-clustering behavior.
8. **Finalize presentation ownership.** Route every activity-related view through one sheet presenter and common metrics; hide/dismiss the previous sheet before the next appears.
9. **Visual normalization.** Compress header spacing, remove blank regions, normalize two-line rows, and tune glass opacity without changing colors.
10. **Run the full QA matrix.** Capture reference screenshots for collapsed, expanded, keyboard, pin selection, and transportation paths.

## 15. Next-engineer runbook

From `/Users/fragoso/Documents/Codex/Almidy-Commit-Stack`:

```sh
git status -sb
git diff --check
git diff --stat
xcodebuild -resolvePackageDependencies -project ios/App/App.xcodeproj -scheme App
xcodebuild -project ios/App/App.xcodeproj \
  -scheme App \
  -configuration Debug \
  -destination 'platform=iOS Simulator,name=iPhone 16 Pro' \
  build
xcodebuild -project ios/App/App.xcodeproj \
  -scheme App \
  -destination 'platform=iOS Simulator,name=iPhone 16 Pro' \
  test
```

If the simulator name differs, list destinations first:

```sh
xcodebuild -project ios/App/App.xcodeproj -scheme App -showdestinations
```

Then perform the QA matrix with network access and Location Services enabled. Record the exact OS/device, origin source, query, category, result count, map region, and screenshot for every failure.

## 16. Safe handoff rules

- Do not run destructive Git cleanup commands against this worktree.
- Do not assume untracked files are disposable; two are core feature implementations.
- Do not stage all changes blindly.
- Preserve Almidy teal and gold unless the product owner explicitly changes the palette.
- Do not “fix” transportation by routing it into the generic search flow.
- Do not let list and map execute separate discovery requests.
- Do not fit the camera before quality filtering and outlier rejection.
- Do not claim release readiness from parser success alone.

## 17. Definition of done

The activity-search work is ready to hand off as complete only when:

- the intended source files are tracked and coherently committed;
- a clean build and automated tests pass;
- all non-transport categories filter search;
- all transportation categories retain dedicated forms;
- deterministic origin tests pass for Nearby and Everywhere;
- list and globe consume the same ordered results atomically;
- first results appear on the globe immediately;
- metro bounds and camera caps prevent statewide zoom-outs;
- annotations match the Almidy circular teal/white treatment;
- row/pin selection works both directions;
- preview and large sheets match across supported iPhone sizes;
- no prior sheet is visible behind the active sheet;
- header, location controls, and rows match the reference geometry without color changes;
- the complete QA matrix is documented with passing evidence.

Until those conditions are met, the correct release decision remains **HOLD**.
