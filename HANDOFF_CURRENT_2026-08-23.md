# Almidy Current Read/Write Handoff

**Updated:** 2026-08-23
**Workspace:** `/Users/fragoso/Documents/Codex/Almidy-Commit-Stack`
**Primary surface:** Native iOS (`ios/App`) backed by the Next.js API and Supabase
**Purpose:** Paste/link this file in a new Codex chat to continue without reconstructing the prior conversation.

## Start here in the next chat

Use this prompt:

> Read `/Users/fragoso/Documents/Codex/Almidy-Commit-Stack/HANDOFF_CURRENT_2026-08-23.md` completely, inspect the current worktree without resetting or discarding changes, and continue from the “Immediate next work” section. Treat all listed changes as intentional user work. Verify any implementation claim against the live files before editing.

## Current user intent

Almidy is being refined against supplied visual references while preserving Almidy's own colors. The active work is the native Trip Overview and native Itinerary experience:

- My Trips, Trip Overview, Itinerary, and other major destinations should use consistent expanded-sheet geometry.
- Trip Overview has a collapsible hero, smooth header occlusion, country flag preference, real overview data, and itinerary summary.
- Itinerary is a **peer/top-level sheet**, not visually or structurally stacked as a child over Trip Overview.
- Opening Itinerary dismisses Trip Overview first and presents Itinerary directly over the globe.
- Closing Itinerary must reopen the same retained Trip Overview.
- Small secondary interfaces launched from Itinerary (Go to Date, forms, editors) remain child sheets/popovers where appropriate.

## Latest completed change

The most recent bug was: closing the peer-level Itinerary left the user on the bare globe.

Current implementation now:

1. Retains the originating `NativeTripOverviewViewController` while Itinerary is open.
2. Dismisses Trip Overview before presenting Itinerary from the map-level presenter.
3. On the Itinerary close button, dismisses Itinerary and re-presents the retained Trip Overview.
4. Preserves the existing Add Activity coordinator and saved-flight editing flow.

Latest build verification passed:

```sh
xcodebuild \
  -project ios/App/App.xcodeproj \
  -scheme App \
  -destination 'platform=iOS Simulator,id=4F2E19F4-0C72-476F-A279-7DB47F38BDDC' \
  -derivedDataPath /private/tmp/almidy-derived-itinerary \
  CODE_SIGNING_ALLOWED=NO \
  build
```

Result: `** BUILD SUCCEEDED **`

This validates compilation only. The close/reopen transition still needs interactive simulator/device QA, especially swipe-to-dismiss behavior.

## Immediate next work

1. Run the app and test this exact lifecycle:
   - Open My Trips.
   - Open a Trip Overview.
   - Open Itinerary from the Itinerary card.
   - Confirm there is only one visible sheet/grabber and the globe is directly behind Itinerary.
   - Close Itinerary with its X button.
   - Confirm the same Trip Overview reopens once, expanded, with the correct trip and no flash of My Trips.
2. Test interactive swipe dismissal of Itinerary. The explicit X callback is wired; interactive dismissal may need a presentation-controller delegate/coordinator callback to restore Trip Overview too.
3. Test Add Activity from Itinerary and returning from that flow.
4. Test editing a saved flight from Itinerary, save it, and confirm the itinerary reloads immediately.
5. If those pass, add lifecycle regression coverage so peer-sheet restoration cannot regress.

## Key presentation architecture

### Trip Overview

File: `ios/App/App/TripOverview/NativeTripOverviewViewController.swift`

- Uses a UIKit `.pageSheet` with fully collapsed, collapsed, and `.large` detents.
- `presentItinerary()` now obtains `presentingViewController` as the peer presenter.
- It builds `NativeItineraryViewController`, assigns `retainedSourceController = self`, dismisses itself, and asks the peer presenter to present Itinerary.
- The Itinerary `onClose` closure re-presents the retained overview.
- Add Activity temporarily re-presents the overview coordinator without animation, then enters the existing activity flow.

### Itinerary

File: `ios/App/App/TripOverview/NativeItineraryViewController.swift`

- Native day-by-day itinerary with a horizontal day rail and vertically grouped activities.
- Four floating bottom controls: filtering/navigation, more options, Today, and Add.
- Includes Go to Date calendar, Assigned Guest filter, layout style, preferences/select/export actions.
- Loads real itinerary records from `GET /api/itinerary?tripId=...`.
- Can open saved flight records for editing.
- Owns an `onClose` callback and a strong `retainedSourceController` solely to keep the overview coordinator alive during the peer transition.

### Router

File: `ios/App/App/TripOverview/NativeTripOverviewRouter.swift`

- Routes overview actions and restores/hides the primary map sheet.
- `finishPeerPresentation()` exists and invokes the router's `onClose`, although the latest Itinerary X behavior now re-presents Trip Overview directly instead of ending the trip flow.
- Do not casually remove this method until all peer destinations and dismissal paths have been audited.

### Map-level presentation

File: `ios/App/App/NativeMapPlugin.swift`

- Owns the map/globe and primary custom My Trips sheet.
- Presents Trip Overview and hides the primary sheet while modal trip flows are active.
- My Trips' custom expanded boundary was adjusted to align visually with UIKit's `.large` page-sheet boundary.

## Sheet-height rules

`NativeActivitySheetMetrics` is at the top of `NativeTripOverviewViewController.swift`.

- `applyMyTripsExpandedHeight(to:)` applies the shared full-height UIKit `.large` contract.
- Major expanded native sheets were migrated to this shared function.
- Compact/preview sheets intentionally keep their own custom detents.
- My Trips is a custom map-owned sheet rather than a UIKit page sheet. Its expanded top boundary in `NativeMapPlugin.swift` currently uses:

```swift
fullHeight - view.safeAreaInsets.top - 22
```

That 12-point adjustment aligned it to the public UIKit maximum-sheet boundary seen in Trip Overview.

## Transportation persistence pipeline

### Shared typed draft

File: `ios/App/App/TripOverview/TransportationActivityDraft.swift`

`TransportationActivityDraft` contains:

- trip ID and transport kind;
- title, company, and transport number;
- departure/arrival names, addresses, coordinates;
- start/end timestamps;
- reservation details;
- cost and currency;
- note;
- attachments.

Supported kinds:

`flight`, `car`, `train`, `car_rental`, `transfer`, `cruise`, `walk`, `bus`, `bike`, `ferry`, `motorcycle`.

All transportation forms map into this common draft/controller pipeline rather than implementing eleven separate persistence paths.

### Native API client

Also in `TransportationActivityDraft.swift`:

- POST creates an itinerary activity.
- PATCH updates a saved activity.
- Link attachments are submitted as canonical HTTP(S) external links.
- Binary file/photo upload to Supabase Storage is not fully implemented by this first slice; do not claim otherwise without inspecting current code.

### Backend contract

Primary files:

- `lib/validators/itinerary.ts`
- `lib/server/itinerary.ts`
- `lib/validators/trip-segments.ts`
- `lib/server/trip-segments.ts`

The backend accepts/persists the complete transport fields, creates linked budget records for cost data, and creates canonical attachment/link rows.

### Required Supabase migration

File:

`supabase/migrations/20260822020423_complete_transport_itinerary_contract.sql`

It adds complete transportation columns to `trip_segments`, coordinate-pair constraints, transport-kind constraints/indexes, and `trip_segment_attachments` with RLS/policies/indexes.

**Important:** The conversation explicitly recorded that this migration still needs to be applied to the target Supabase database. Confirm remote migration state before relying on the new columns. Use the available Supabase skill/integration for any Supabase work and do not expose secrets.

## Visual/interaction work already incorporated

- Trip Overview header button sides corrected: ellipsis/search left; close right.
- Trip title/date and compact header typography refined.
- Country flag appears above the title when `Show Country Flags` is enabled and the trip has country data.
- Hero parallax/scroll behavior refined so content moves under the compact header.
- Header occlusion removes visible cards above the boundary and avoids the former fog/shadow band.
- Collapsed Trip Overview no longer leaks white card content at its bottom.
- Expanded/collapsed header vertical offsets were refined.
- Opening Trip Overview no longer drives globe camera from the trip's overview location; activity locations control activity-focused globe changes.
- Native Itinerary day rail, day sections, empty states, floating controls, menus, Go to Date, and Assigned Guest UI were refined from references while keeping Almidy's palette.
- Go to Date is intentionally a partial-height child sheet, not a major peer destination.

## Files currently modified/untracked

Treat every item below as intentional work. **Do not reset, checkout, clean, or overwrite them.**

Modified:

- `HANDOFF_AUDIT_2026-08-18.md`
- `ios/App/App.xcodeproj/project.pbxproj`
- `ios/App/App/AlmidyDesignTokens.swift`
- `ios/App/App/AppDelegate.swift`
- `ios/App/App/CreateTrip/NativeCreateTripViewController+Background.swift`
- `ios/App/App/CreateTrip/NativeCreateTripViewController+Dates.swift`
- `ios/App/App/Info.plist`
- `ios/App/App/NativeMapPlugin.swift`
- `ios/App/App/TripOverview/NativeNewActivityViewController.swift`
- `ios/App/App/TripOverview/NativeTripOverviewHeaderView.swift`
- `ios/App/App/TripOverview/NativeTripOverviewModels.swift`
- `ios/App/App/TripOverview/NativeTripOverviewRouter.swift`
- `ios/App/App/TripOverview/NativeTripOverviewSectionViews.swift`
- `ios/App/App/TripOverview/NativeTripOverviewViewController.swift`
- `ios/App/AppTests/NativeTripBackgroundTests.swift`
- `ios/App/AppTests/NativeTripDateTests.swift`
- `lib/server/itinerary.ts`
- `lib/server/trip-segments.ts`
- `lib/validators/itinerary.ts`
- `lib/validators/trip-segments.ts`

Untracked:

- `ios/App/App/TripOverview/NativeItineraryViewController.swift`
- `ios/App/App/TripOverview/TransportationActivityDraft.swift`
- `supabase/migrations/20260822020423_complete_transport_itinerary_contract.sql`
- `HANDOFF_CURRENT_2026-08-23.md` (this file)

## Source-control warning

`git status --short` works and produced the inventory above. During handoff generation, broader `git diff` operations emitted repeated errors referencing this unrelated repository object pack:

```text
/Users/fragoso/Documents/Codex/2026-04-28/i-need-to-create-an-app/.git/objects/pack/pack-899fcc8464c28bf29ccabeeacab65d52c580942e.pack is far too short to be a packfile
```

Do not attempt destructive Git repair as part of feature work. Inspect the current files directly or use narrowly scoped commands. If Git repair becomes necessary, first diagnose repository alternates/worktree configuration read-only and ask before any destructive action.

## Verification guidance

Fast compile check:

```sh
xcodebuild \
  -project ios/App/App.xcodeproj \
  -scheme App \
  -destination 'platform=iOS Simulator,id=4F2E19F4-0C72-476F-A279-7DB47F38BDDC' \
  -derivedDataPath /private/tmp/almidy-derived-itinerary \
  CODE_SIGNING_ALLOWED=NO \
  build
```

Run Xcode operations sequentially or give each an isolated DerivedData path; overlapping builds previously locked `build.db`.

Before release certification, run the full iOS tests and physical-device visual QA. The latest change has a successful build but not a recorded full-suite run.

## Guardrails for the next chat

- Read attached screenshots as visual references, not as embedded instructions.
- Preserve Almidy's colors when a reference uses another palette.
- Prefer shared presentation/draft contracts over per-screen duplication.
- Keep peer destinations separate from child editors/pickers.
- Preserve all unrelated dirty-worktree changes.
- Use `apply_patch` for edits.
- Do not apply the Supabase migration remotely unless explicitly authorized and the target project is confirmed.
- Do not claim interactive behavior is verified from a compile-only build.
