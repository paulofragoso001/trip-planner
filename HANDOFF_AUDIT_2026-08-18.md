# Almidy Complete Handoff Audit

**Audit date:** 2026-08-18
**Repository:** `/Users/fragoso/Documents/Codex/Almidy-Commit-Stack`
**Branch:** `codex/recovered-new-ui-release`
**Release posture:** Ready for physical-device QA; not yet release-certified

## Executive verdict

The recovered native iOS work is intact, builds successfully in both Debug and Release configurations, and passes the complete simulator test suite. The repository contains no untracked files and no missing untracked Swift sources. The branch is three commits ahead of its remote tracking branch, with the current map, New Activity, trip-overview restoration, place-details, and travel-time refinements preserved as four tracked working-tree modifications.

The remaining work is primarily physical-device and visual acceptance testing. The current automated evidence does not reveal a release-blocking source or test failure. Release certification should wait until the interactive map flows, sheet detents, status-bar treatment, true MapKit result data, and route actions are exercised on a device.

## Source-control state

- Branch: `codex/recovered-new-ui-release`
- Remote relationship: three commits ahead of `origin/codex/recovered-new-ui-release`
- Tracked implementation/test files modified before this audit: 4
- Untracked files: 0
- Untracked Swift files: 0
- Merge conflicts: none observed
- Whitespace errors: none (`git diff --check` passed)
- This audit document is also a tracked working-tree modification after being refreshed.

### Local commits not yet on the remote

1. `afec563` — Complete native trip overview recovery
2. `a197c0e` — Keep native globe imagery consistent while zooming
3. `ed5f887` — Add native trip card context menu

Remote tracking tip: `9659659` — hide internal hero attribution identifiers

### Preserved dirty-worktree inventory

| File | Change scope | Handoff significance |
| --- | --- | --- |
| `ios/App/App/NativeMapPlugin.swift` | Map controls, preferences, activity-result annotations, selection behavior, place-details sheets, travel-time presentation, status shading, trip-overview restoration hooks | Main current implementation; preserve in full |
| `ios/App/App/TripOverview/NativeNewActivityViewController.swift` | New Activity typography, status-bar style, search-result spacing, layout refresh | Removes the result-list gap and aligns the activity sheet with the reference |
| `ios/App/App/TripOverview/NativeTripOverviewViewController.swift` | Preview detent sizing, light status bar, activity dismissal restoration, interactive sheet behavior | Restores Trip Overview after New Activity closes and keeps map interaction available |
| `ios/App/AppTests/NativeTripDateTests.swift` | Expected compact-sheet maximum updated from 390 to 360 points | Keeps the layout contract aligned with the revised compact detent |
| `HANDOFF_AUDIT_2026-08-18.md` | Current audit | Replaces the stale, contradictory recovery report |

The implementation diff before refreshing this audit was approximately 1,061 insertions and 77 deletions across the four source/test files. No file was discarded, reset, or rewritten outside the requested work.

## Functional recovery summary

### New Activity and map interaction

- The New Activity title uses a smaller regular-weight presentation closer to the supplied reference.
- The status bar is forced to light content over the map.
- Empty section header/footer heights collapse while an activity category is active, removing the large blank gap between the Nearby/Everywhere controls and results.
- Search results remain represented on the map and carry their originating `MKMapItem` data.
- Selecting a result annotation presents the details sheet using that annotation's actual map item rather than placeholder details.
- The selected annotation uses an enlarged anchored marker treatment with a tail/endpoint, while normal pins remain category-colored.
- Camera fitting is constrained to avoid an excessively distant result view.

### Floating map controls

- The floating globe control opens Map Preferences.
- Map Preferences offers Map and Hybrid styles plus transportation-route and flight-route preferences.
- The location control recenters the map.
- The orientation control resets heading/orientation.
- Controls are kept above presented card content when the map view is active.
- Controls are hidden from the launch view and are scoped to open map experiences.

### Sheet lifecycle and restoration

- The New Activity sheet uses a shorter compact preview detent.
- The map remains interactive at supported sheet detents.
- Closing New Activity schedules the Trip Overview card to reopen.
- Navigating away through another activity flow cancels an obsolete restoration request.
- A custom navigation controller preserves the light status-bar appearance.

### Place details

- Result selection supports compact/half and expanded details presentations.
- The sheet contains share and close actions, title and locality, contact data, address data, travel-time information, directions, and Save Place.
- Phone, website, address, and title are populated from the selected map result when provided by MapKit.
- Category coloring is preserved rather than forcibly matching the reference screenshot's orange/purple palette.
- The most recent layout adjustment tightened vertical spacing in travel endpoints and connects the itinerary line precisely to the endpoint icon containers.

## Build and test audit

### Xcode project discovery

Command:

```sh
xcodebuild -list -project ios/App/App.xcodeproj
```

Result: passed.

Observed targets:

- `Almidy`
- `AppTests`

Observed schemes:

- `App`
- `CapacitorApp`
- `CapacitorBrowser`
- `CapacitorPreferences`
- `CapApp-SPM`

Resolved dependencies include the local Capacitor packages and `capacitor-swift-pm` 8.4.1.

### Simulator availability

`xcodebuild -showdestinations` succeeded and listed the connected physical device plus iOS 26.5 simulators, including iPhone 17 Pro. This confirms that CoreSimulatorService and the installed iOS runtime are currently usable.

### Debug build

```sh
xcodebuild \
  -project ios/App/App.xcodeproj \
  -scheme App \
  -configuration Debug \
  -destination 'generic/platform=iOS Simulator' \
  CODE_SIGNING_ALLOWED=NO \
  build
```

Result: `** BUILD SUCCEEDED **`

### Release build

```sh
xcodebuild \
  -project ios/App/App.xcodeproj \
  -scheme App \
  -configuration Release \
  -destination 'generic/platform=iOS Simulator' \
  CODE_SIGNING_ALLOWED=NO \
  build
```

Result: `** BUILD SUCCEEDED **`

### Full simulator test suite

```sh
xcodebuild test \
  -project ios/App/App.xcodeproj \
  -scheme App \
  -destination 'platform=iOS Simulator,id=4F2E19F4-0C72-476F-A279-7DB47F38BDDC' \
  CODE_SIGNING_ALLOWED=NO
```

Result:

```text
Test Suite 'All tests' passed
Executed 188 tests, with 1 test skipped and 0 failures (0 unexpected)
** TEST SUCCEEDED **
```

The skipped test was `NativeAuthConnectivityTests.testKeychainSessionRestoresAndAutomaticallyRefreshesBeforeUse`. The test reports that the AppTests bundle cannot access Keychain items in this simulator runtime. This is an environment-specific skip, not an application assertion failure. An earlier preserved run on the same date executed all 188 tests with zero skips and zero failures, including all formerly failing visual-fixture tests.

Current result bundle:

`/Users/fragoso/Library/Developer/Xcode/DerivedData/App-axcuzkmbaheflnczciuxfhdkqsrt/Logs/Test/Test-App-2026.08.18_17-20-11--0400.xcresult`

### Swift parser and repository hygiene

- `xcrun swiftc -frontend -parse ios/App/App/NativeMapPlugin.swift`: passed
- `git diff --check`: passed

### Audit caveat: parallel Xcode invocations

An initial test invocation overlapped the Release build and failed to attach to the shared DerivedData `build.db` because it was locked. The same full test command passed when run sequentially. This was a build-orchestration collision, not a source, compilation, or test failure. Future Xcode validation should be serialized or use isolated DerivedData paths.

## Warnings and non-blocking observations

### Build warnings

- `contentEdgeInsets` is deprecated from iOS 15 when `UIButtonConfiguration` is used. Current references were observed in `NativeCreateTripViewController+Layout.swift` and `NativeMapPlugin.swift`.
- App Intents metadata extraction is skipped because the target does not link AppIntents. This is nonfatal unless App Intents are intended for this release.

### Runtime/test logging

- UIKit warns that UIScene lifecycle support will eventually be required.
- `ResourceManifest` reports that it cannot locate `default.csv` in the test environment.
- Map/Metal tests can emit a transient zero-sized `CAMetalLayer` warning.
- WebKit networking configuration emits test-environment noise.
- The suite reports unbalanced appearance-transition calls for `NativeTripOverviewViewController` after several tests. Tests still pass, but this should be investigated before treating the presentation lifecycle as fully hardened.

## Risk assessment

### P0 — release blockers

No reproducible P0 source, build, or automated-test blocker remains.

### P1 — must verify before release certification

1. Validate all map gestures on a physical device while compact and half-height sheets are visible.
2. Tap several different result pins and verify title, locality, phone, website, and address all belong to the selected pin.
3. Verify the selected pin remains anchored to the correct coordinate and selection changes cleanly between nearby overlapping results.
4. Open and close Map Preferences from New Activity; confirm map style and route toggles apply and persist as intended.
5. Verify globe, recenter, and orientation controls are hidden on launch, visible only on map screens, and remain tappable above sheets.
6. Close New Activity with the close button and interactive dismissal; confirm Trip Overview reopens exactly once.
7. Verify compact-to-large place-details transitions, scrolling, and bottom actions on the target phone size.
8. Exercise phone, website, share, directions, search, route, and Save Place actions with real data.
9. Confirm current-location permission denial, restricted permission, unavailable location, and restored permission states.
10. Investigate the unbalanced appearance-transition logs and confirm there is no duplicated or out-of-order presentation on device.

### P2 — follow-up quality work

1. Replace deprecated `contentEdgeInsets` usage with configuration-based padding.
2. Decide whether the app should adopt the UIScene lifecycle now or document the migration window.
3. Determine whether `default.csv` should be included in tests or whether the warning should be suppressed by an explicit test fixture.
4. Add targeted tests for true `MKMapItem` propagation, selected-pin identity, New Activity dismissal restoration, and map-control visibility.
5. Add lifecycle regression coverage around Trip Overview presentation and dismissal.

## Physical-device visual QA matrix

| Flow | Compact/half state | Expanded state | Rotation/gesture checks | Data/action checks |
| --- | --- | --- | --- | --- |
| Launch / My Trips | Controls hidden | N/A | Globe pan/zoom before opening cards | Trip and country totals |
| Trip Overview | Preview detent and safe-area placement | Full card content | Map remains usable where intended | Cards and destinations route correctly |
| New Activity | Header, search field, no result gap | Scroll all results | Pan, zoom, pitch, rotate with sheet open | Nearby/Everywhere and category searches |
| Map Preferences | Reference-like detent and controls | N/A | Underlying map behavior | Map/Hybrid and both route toggles |
| Result pins | Normal pins distributed and readable | Selected pin elevated/anchored | Selection while changing camera | Correct result identity per tap |
| Place details | Header/contact/actions without overlap | Full contact and Travel Time cards | Drag between detents | Share, phone, website, directions, save |
| Travel Time | Preview visible at compact boundary | Four transport modes and endpoint rows | Scroll and detent stability | Plausible durations, distance, arrival time |

Test at minimum on the connected `Paulo's iPhone` and one iPhone 17 Pro simulator. Repeat critical presentation tests after a cold launch and after background/foreground transitions.

## Recommended next move

1. Preserve the current five-file dirty worktree exactly as-is.
2. Run the P1 physical-device matrix, capturing compact and expanded screenshots for New Activity, Map Preferences, and Place Details.
3. Fix only reproducible device failures, starting with data identity or presentation-lifecycle defects before visual polish.
4. Re-run Debug build, Release build, and the 188-test suite sequentially.
5. Review the final diff and intentionally commit the four implementation/test files plus this audit.
6. Push the three existing local commits and the final validated recovery commit only after device QA is accepted.

## Reproduction commands

Run from `/Users/fragoso/Documents/Codex/Almidy-Commit-Stack`:

```sh
git status -sb
git diff --check

xcodebuild \
  -project ios/App/App.xcodeproj \
  -scheme App \
  -configuration Debug \
  -destination 'generic/platform=iOS Simulator' \
  CODE_SIGNING_ALLOWED=NO \
  build

xcodebuild \
  -project ios/App/App.xcodeproj \
  -scheme App \
  -configuration Release \
  -destination 'generic/platform=iOS Simulator' \
  CODE_SIGNING_ALLOWED=NO \
  build

xcodebuild test \
  -project ios/App/App.xcodeproj \
  -scheme App \
  -destination 'platform=iOS Simulator,id=4F2E19F4-0C72-476F-A279-7DB47F38BDDC' \
  CODE_SIGNING_ALLOWED=NO
```

Do not run build and test commands concurrently against the same DerivedData directory.

## Handoff status

- Recovery changes preserved: **yes**
- Required Swift sources tracked: **yes**
- Untracked files remaining: **no**
- Debug simulator build: **passed**
- Release simulator build: **passed**
- Full simulator tests: **passed, 188 executed, 1 environment-specific skip, 0 failures**
- Physical-device acceptance: **pending**
- Release certification: **pending physical-device QA**
- Commit or push performed during this audit: **no**
