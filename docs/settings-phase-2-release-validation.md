# Settings Phase 1–2 release validation

## Revision and decision

- Validation branch: `codex/settings-phase-2-release-validation`
- Parent: `8c13b23ecd7d9de71cc2d7c2b7c066e2e9324a9f`
- Phase 2 implementation: `0b310e00ea447809b010798a38718a420b95c8fe`
- Validation status commit: `f076c243981537434eed080e740e0e4ffe88a5d3`
- Calendar corrective commit: `7ccb5ad1c6b0393c48d7d34e8f6a3e9c333d60b7`
- Documentation finalization: the commit containing this report is branch HEAD.
- Exact recommendation: **HOLD**.

The branch is not a release candidate. Required migration, RLS/storage, production
build, browser runtime, native build/XCTest, and physical-device gates remain
unverified. Under the requested decision rules, none is eligible for Conditional GO.
No Phase 0–2 product defect was proven, so no corrective application or migration
commit was made. Phase 3 work was not started.

## Resumed validation attempt — 2026-08-06

Validation resumed at exact source SHA
`c954cdd972eda6d331d9da898aa7249d67a60cc3`. The actual execution host remained
the same managed environment rather than the fully capable host described in the
resume request. Repeated preflight and runtime probes confirmed:

- Branch `codex/settings-phase-2-release-validation` at the expected SHA; only the
  pre-existing protected `.gitignore`, `package.json`, `package-lock.json`, and
  `docs/security/` paths were dirty, and none was modified or staged.
- Node 24.15.0, repository test Node 20.20.2, npm 11.12.1, Playwright 1.60.0,
  Xcode 26.6 (17F113), Swift 6.3.3, and iOS SDK 26.5 were unchanged.
- Chromium/headless-shell 1223 remained installed. No Docker/Podman binary existed
  in PATH, Homebrew, `/Applications`, `/opt/homebrew/bin`, or `/usr/local/bin`.
- Supabase CLI package 2.111.0 was present only in the npm execution cache. Direct
  execution failed before command processing because the managed host denied its
  telemetry write beneath `~/.supabase`; no container engine existed regardless.
- No disposable Supabase URL/key set was configured. Only the already documented
  Vercel OIDC variable name and two UI feature-flag names were present; values were
  not recorded.
- A direct Node HTTP server probe on `127.0.0.1:3107` failed with
  `listen EPERM: operation not permitted`, proving localhost services cannot run.
- `simctl` still could not connect to CoreSimulatorService, `devicectl` timed out
  initializing CoreDeviceService, and no simulator or physical iPhone was visible.
- SwiftPM/Xcode cache access remained blocked even with module, source-package, and
  derived-data paths redirected to `/private/tmp`.

The production build was rerun with the locked Node 20 runtime:

`PATH="/Users/fragoso/.nvm/versions/node/v20.20.2/bin:$PATH" NEXT_TELEMETRY_DISABLED=1 npm run build`

It again failed in Turbopack while processing `app/globals.css` because an internal
worker could not bind a port (`Operation not permitted`). Focused Playwright again
failed before test execution because the configured server could not listen on
`127.0.0.1:3000`. Native package resolution again exited 74 after CoreSimulator and
SwiftPM cache failures. These are execution-environment failures, not passing gates.

The failed build temporarily left incomplete generated `.next/types` artifacts.
`next typegen` regenerated them successfully; `tsc --noEmit` then passed, followed by
all nine Phase 1–2 static contract tests. No committed application, migration, Xcode,
dependency, or protected file changed. No screenshots or physical-device claims were
created. All runtime sections and the **HOLD** recommendation below therefore remain
current.

## Confirmed Calendar environment defect and correction

A capable-host validation subsequently confirmed that `/api/health` and the
production environment contract required Calendar OAuth credentials—initially
surfacing `GOOGLE_CALENDAR_CLIENT_ID`—while Calendar UI remained disabled and Scope F
deferred. Supplying fake provider credentials would have hidden the defect and was
not accepted.

Corrective commit `7ccb5ad1c6b0393c48d7d34e8f6a3e9c333d60b7` adds the server-side
`CALENDAR_SYNC_ENABLED` contract. Absent, false, or zero means disabled. In that
state, Calendar credentials, token encryption configuration, and worker secret are
not production requirements; health reports `{ enabled: false, deferred: true,
configured: false, ok: true }`; and connections, OAuth start/callback, sync, and
worker routes return a canonical 501 `not_implemented` response before authentication,
database, provider, logging, or mutation work.

When explicitly enabled, production validation requires Google and Microsoft client
IDs/secrets/HTTPS callback URLs, Microsoft tenant, token encryption key/key ID, and
worker secret. The encryption key must be at least 32 characters, and both callback
URLs must exactly match the production app origin and approved paths. Secret values
remain server-only and health exposes only status and missing variable names.

Focused validation passed:

- `./node_modules/.bin/tsc --noEmit`
- `node --test tests/unit/calendar-feature-flag.test.mjs tests/unit/settings-phase-1-contracts.test.mjs tests/unit/settings-phase-2-contracts.test.mjs` — 13 passed, 0 failed/skipped
- Disabled Calendar without Calendar variables keeps otherwise healthy core checks healthy.
- Every disabled Calendar route has a fail-closed guard.
- Enabled/missing configuration fails production preflight.
- Enabled/complete strict configuration passes production preflight.
- `git diff --check` passed.

The focused Playwright Calendar suite could not start because this managed host still
denied localhost binding. The required production build was attempted with locked
Node 20 and again failed only at Turbopack's sandbox-denied internal port binding.
Those checks are not marked passed, and the overall release recommendation remains
**HOLD** pending the broader runtime gates already listed in this report.

## Dashboard Playwright selector correction

The capable-host run identified two failures in
`tests/playwright/dashboard-actions.spec.ts`; neither was a product defect.

- Mobile wallet Search was a stale role/navigation expectation. The collapsed home
  wallet intentionally renders an accessible `Search` button that opens the in-sheet
  search overlay; the routed Search link remains available in the expanded wallet.
  The test now asserts the button, `search` sheet state, visible search input, cancel
  action, and return to collapsed state.
- The Account Settings failure was an ambiguous locator. The disabled Add
  Reservations via Email row intentionally contains two `Coming soon` text badges.
  The test now resolves that exact `aria-disabled` row and asserts the status within
  it, while retaining the assertion that no Add Reservations link exists.

`npx tsc --noEmit` and `git diff --check` passed. The exact requested Playwright
command was attempted, but the managed host again denied the configured server's
localhost bind (`listen EPERM: operation not permitted 127.0.0.1:3000`), so no test
case ran and the suite is not recorded as passed.

Two subsequent capable-host failures were also test defects rather than product
defects:

- The trial assertion targeted a conditional promotional card and its local-only
  availability sheet. No entitlement exists. The stable mobile Settings contract
  truthfully exposes Pro as a disabled `Pro soon` control, which the test now checks
  without attempting activation.
- The account-deletion assertion matched both the `Account deletion` section and
  `Request account deletion` form headings. It now uses an exact accessible-name
  match for the intended section; product copy is unchanged.
- The remaining `Pro soon` assertion was ambiguous because the trial control has
  that exact accessible name while the disabled Calendar Feed row contains the same
  words in its longer accessible name. The test now uses an exact accessible-name
  match for the trial control; neither UI nor Calendar behavior changed.

After these corrections, `npx tsc --noEmit` and `git diff --check` passed. The exact
focused Playwright command was rerun, but this managed execution environment denied
the configured server bind with `listen EPERM: operation not permitted
127.0.0.1:3000`; consequently the expected 9-test result could not be observed here
and is not reported as passed.

## Validation environment

| Component | Observed version/state |
| --- | --- |
| Host date | 2026-08-06, America/New_York |
| Default Node | 24.15.0 |
| Playwright-configured Node | 20.20.2 |
| npm | 11.12.1 |
| Next.js | 16.3.0 |
| Playwright | 1.60.0 |
| Browser | Chromium 1223 and headless shell 1223 installation markers present |
| Supabase CLI | package 2.111.0 present in npm execution cache; no repository/global binary |
| Docker | unavailable: `command not found: docker` |
| Podman | unavailable: `command not found: podman` |
| Xcode | 26.6, build 17F113 |
| Swift | Apple Swift 6.3.3, swift-driver 1.148.6 |
| iOS SDK | 26.5 |
| Simulator | unavailable: CoreSimulatorService connection invalid/refused |
| Physical device | unavailable: CoreDeviceService initialization timed out |
| Signing | automatic, team `3JB4WR3PNU`; installed profiles emitted malformed-profile warnings |

`.env.local` contains only a Vercel OIDC variable name and `.env.production` contains
only the two UI feature-flag names; values were not recorded. No local/staging
Supabase URL, publishable key, service-role key, or approved disposable project was
configured. Runtime-required non-production values are documented in `.env.example`:
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
`NEXT_PUBLIC_APP_URL`, and feature flags; privileged server functions additionally
need `SUPABASE_SERVICE_ROLE_KEY`, which must remain server-only. Password-reset
staging requires an approved HTTPS app origin and allowlisted `/auth/reset-password`.

## Migration review

The relevant order is:

1. Earlier prerequisites: `004_create_profiles.sql`, `005_create_avatars_bucket.sql`,
   `007_create_notification_preferences.sql`, and
   `027_create_account_deletion_requests.sql`.
2. Phase 1: `20260806111021_settings_phase_1_account_security.sql`.
3. Phase 2: `20260806140000_create_user_preferences.sql`.

Phase 1 updates the existing public `avatars` bucket to a 5 MiB limit and JPEG/PNG/
WebP MIME allowlist, removes the legacy bucket-wide insert policy, and creates exact
owner-prefix INSERT/UPDATE/DELETE policies. It retains public SELECT. It neither
deletes nor rewrites objects. Representative legacy root objects should remain
publicly readable but are read-only under the new mutation contract; the next upload
creates a new owned path. No automatic cleanup is appropriate.

Phase 2 creates `public.user_preferences` with a user FK/primary key, constrained
currency/distance columns, timestamps, RLS, authenticated SELECT/INSERT/UPDATE
grants and owner policies, plus an `updated_at` trigger. It does not alter historical
money or distance data. Application rollback must precede its documented trigger,
function, and table removal. Neither migration is intrinsically destructive, though
Phase 1 intentionally removes permissive legacy mutation access.

No migration was applied. Docker/Podman are absent and no explicitly approved
disposable remote project was configured. Therefore resulting schema, policy catalog,
bucket configuration, trigger creation, clean replay, representative-data replay,
and warnings were not observed at runtime. Static SQL review is not represented as
runtime validation.

## Supabase and application runtime results

### Avatar storage and RLS — unverified

Two users could not be created. Own-path upload/read/replace/delete, cross-user
denials, encoded/repeated-separator/`..`/malformed path rejection, policy-layer
enforcement, MIME/size/content/SVG/HEIC rejection, replacement ordering, profile
failure preservation, external/default URL preservation, and legacy public reads
were not executed. Existing static contract tests passed, but this security gate
remains open.

### User preferences and consumers — unverified

No-row virtual defaults, independent partial persistence, logout/login/reload/native
restart parity, direct cross-user RLS denial, content-type/CSRF/auth validation,
budget defaults, historical-record preservation, canonical distance storage, and
web/native rounding were not executed against a backend. The API implementation
documents virtual USD/miles defaults without row creation. Static contracts passed.

### Notifications — unverified

Real hydration/defaults, all comment/mention fields, independent persistence,
reload, rollback/race behavior, cross-user denial, Auth, and CSRF were not executed.
Mocked/static Phase 1 coverage passed previously; it is not runtime evidence here.

### Profile synchronization — unverified

Web/native updates, `profiles.username`, Auth `full_name`, immediate refresh,
token/session refresh, restart/login persistence, parity, and an intentionally
mismatched account were not executed. Static review matches the documented contract:
`profiles.username` is canonical and metadata partial failure returns reconciliation
status; no wide reconciliation was run.

### Password reset — unverified

No reset email was initiated. Current-user email selection, arbitrary-email denial,
staging redirect allowlist, web/native initiation and web completion, missing-email,
rate limiting, provider errors, and success wording were not exercised with a real
provider. No link or token was logged.

### Account deletion — unverified

Creation, exact phrase, duplicate-open behavior, owned status, cross-user denial,
completed rendering, native controlled-WebView handoff, and CSRF were not executed.
Static review confirms `docs/account-deletion-operations.md` matches the table's
`requested`, `in_review`, `completed`, and `cancelled` statuses and operator model.
No user or request was deleted.

## Web build, Playwright, and visual validation

Production build commands and outcomes:

- `PATH="/Users/fragoso/.nvm/versions/node/v20.20.2/bin:$PATH" NEXT_TELEMETRY_DISABLED=1 npm run build`
  failed in Turbopack while processing `app/globals.css`: creating its worker tried to
  bind a port and returned `Operation not permitted (os error 1)`.
- `PATH="/Users/fragoso/.nvm/versions/node/v20.20.2/bin:$PATH" NEXT_TELEMETRY_DISABLED=1 ./node_modules/.bin/next build --webpack`
  reached `Creating an optimized production build ...`, emitted nothing further for
  approximately 90 seconds, and was stopped; exit 130.

Focused Playwright command:

`ALLOW_TEST_DASHBOARD_BYPASS=true npx playwright test tests/playwright/settings-phase-1.spec.ts tests/playwright/settings-phase-2.spec.ts tests/playwright/dashboard-settings-actions.spec.ts tests/playwright/dashboard-destructive-actions.spec.ts tests/playwright/native-map-sync-contract.spec.ts --workers=1 --output=/private/tmp/almidy-phase2-playwright-results`

The configured Next server failed before tests ran: `listen EPERM: operation not
permitted 127.0.0.1:3000`. Passed/failed/skipped browser test count is therefore
0/0/all-not-run. The in-app browser fallback selected its local target successfully,
but navigation to `/dashboard/account` returned `net::ERR_CONNECTION_REFUSED`.
Desktop/mobile layout, loading/disabled/saved/error states, controls, version, share,
import wording, deferred sync/email/calendar behavior, and screenshots remain
unverified. No screenshots were fabricated.

## Native build, XCTest, and device validation

`xcodebuild -resolvePackageDependencies -project ios/App/App.xcodeproj -scheme App
-clonedSourcePackagesDirPath /private/tmp/almidy-phase2-source-packages
-derivedDataPath /private/tmp/almidy-phase2-derived` was run with Clang/Swift module
caches redirected to `/private/tmp`. It exited 74: CoreSimulatorService was invalid,
and SwiftPM still attempted a sandbox-denied diagnostics file beneath
`~/Library/Caches/org.swift.swiftpm`. Package resolution did not complete.

Consequently generic unsigned build, build-for-testing, focused/combined XCTest,
simulator tests, result bundle, and pass/fail/skip counts do not exist. `simctl` could
not enumerate destinations. `devicectl list devices` timed out initializing
CoreDeviceService, so no physical iPhone was available. The requested Settings pass,
relaunch/offline/rotation, persistence/parity, and
`UIViewAlertForUnsatisfiableConstraints` breakpoint check were not performed. Exact
tested source was branch parent plus the documentation-only validation commit; no
runtime native claim is made.

## Checks that passed

- `./node_modules/.bin/tsc --noEmit`
- `node --test tests/unit/settings-phase-1-contracts.test.mjs tests/unit/settings-phase-2-contracts.test.mjs` — 9 passed, 0 failed/skipped
- `git diff --check` excluding protected pre-existing paths
- Static migration order/dependency/forward/rollback review
- Static account-deletion operations/schema comparison
- Static security scan of Phase 1–2 contracts and client/native configuration

These checks are static or compile-time only and do not replace runtime gates.

## Security regression review

No new client/native service-role reference, privileged secret, token, reset link, or
signed storage URL was introduced. `SUPABASE_SERVICE_ROLE_KEY` remains accessed by
server-only modules and is not `NEXT_PUBLIC_*`. Phase 1–2 API identities are derived
from authenticated sessions; preference payloads are strict; avatar ownership is
defined in storage policies as well as application validation. Calendar secrets are
now required only behind explicit server-side enablement and remain server-only.
EventKit, email forwarding, and Phase 3 features remain untouched. Redirect code
requires HTTPS in production, but the non-production reset allowlist was not
runtime-verified. No production resource was mutated.

## Failures, corrective commits, and risks

Calendar corrective commit `7ccb5ad1c6b0393c48d7d34e8f6a3e9c333d60b7`
resolves the confirmed deferred-feature environment defect without enabling Calendar
or adding provider credentials. No schema correction was needed. Remaining high-risk
unknowns are real migration replay, storage/RLS isolation, persistence and password
reset behavior, production compilation, browser runtime/visuals, native compilation
and XCTest, device persistence/parity, and Auto Layout. These mandate HOLD.

A later physical-device build exposed native Phase 1–2 call-site drift in
`NativeMapPlugin.swift`: session refresh omitted its required `URLSession`, password
reset referenced a file-private `Result` helper, and optional trip-store Settings
closures did not provide explicit unavailable completions. The corrective patch uses
`URLSession.shared`, handles the request result locally, and returns truthful failure
results when native persistence is unavailable. A generic unsigned build was
attempted with isolated derived-data and package-cache paths, but this managed host
failed during SwiftPM package resolution with `sandbox-exec: sandbox_apply: Operation
not permitted`; compilation and XCTest must therefore be rerun in Xcode on the
capable host and are not marked passed here.

Physical-device Create Trip testing also confirmed that destination gallery lookup
was geocoding a synthetic search phrase instead of the entered destination and that
new trips could display a random world-wonder fallback (for example, the Great Wall
for Italy). The correction resolves the unmodified destination, uses the same 25 km
destination-gallery radius as hero lookup, and prevents an unrelated default from
remaining after a destination lookup fails. Follow-up device testing showed that
applying the neutral globe at initial presentation removed the intended curated
default imagery. The refined contract restores curated imagery while the destination
is empty, then uses the neutral globe only when a resolved destination's lookup or
download fails. Focused regression tests cover the request and fallback contracts.
Another device pass exposed that the fallback completion was cached conditionally
and never rendered unless it represented a successful destination image, leaving the
curated default visible for Italy. The view now applies both successful and fallback
results and caches only successful destination imagery. A follow-up confirmed that
switching to the globe after two typed characters was premature, so curated defaults
remain while typing; replacement occurs only after destination resolution and image
lookup complete.
The next device pass confirmed that Italy's remote lookup could still return no
usable photo. Because the app already ships an approved Colosseum asset, Italy/Rome
now uses that destination-matched bundled image before falling back to the globe.
Unknown destinations still use the neutral fallback rather than an unrelated asset.
Further device evidence showed the same empty remote gallery for Italy and neutral
fallbacks for Brazil/Rio. Destination matching is now centralized across the
approved bundled wonder assets, and the image picker includes the matching bundled
choice alongside any downloaded results. Brazil and Rio use the bundled Christ the
Redeemer image when remote imagery is unavailable; unmapped destinations remain on
the neutral globe.

### Native destination-imagery root-cause correction

The full typed destination → MapKit → authenticated native API → Google Places →
photo proxy pipeline was traced after physical-device failures for Tokyo, Rio de
Janeiro, Brazil, and Italy. Rendering, manual selection, color derivation, and local
image caching were functional. The confirmed configuration-contract defect was that
production preflight required only `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, while the
server-side Google provider intentionally refuses public browser keys in production
and reads only `GOOGLE_PLACES_API_KEY` or `GOOGLE_MAPS_API_KEY`. A deployment could
therefore pass preflight while `/api/travel-data/resolve-place` had no usable server
credential and returned no provider image. Production preflight now requires one of
the server-only credentials in addition to the separately restricted browser key.
No credential was added or changed by this validation.

DEBUG-only, sanitized native diagnostics now record typed/normalized destination,
selected MapKit completion, locality/admin/country, coordinates, lookup query,
provider status/error category and result count, photo HTTP status, and chosen
provider/bundled/globe fallback. They never record keys, tokens, cookies, photo URLs,
or response bodies. MapKit metadata is retained in the resolved native destination.
Automatic and picker paths share destination matching, successful/manual images are
cached under the returned trip identity after save, stale request revisions remain
rejected, and manual selection remains authoritative.

Server tests cover Tokyo, Rio de Janeiro, Brazil, Italy, Rome, Paris, and Miami,
including country-level lookup, ranked hero selection, the native response shape,
provider failure behavior, and streamed photo bodies. The focused Node run passed
86/86. Swift parsing and TypeScript passed. Focused `NativeTravelImageConnectivityTests`
and `NativeTripBackgroundTests` were attempted, but this managed host failed during
SwiftPM resolution with `sandbox-exec: sandbox_apply: Operation not permitted` before
compilation or XCTest. A production health request was also attempted, but this host
could not resolve `almidy.app`; deployed credential presence is therefore unverified.

The supplied physical-iPhone evidence is pre-correction: Italy manual imagery and
layout passed, while remote automatic/gallery discovery failed for the listed
destinations. No post-correction device run was possible from this environment, so
Tokyo, Rio, Italy, manual Italy, saved-trip reopen, and
`UIViewAlertForUnsatisfiableConstraints` remain required at the exact corrective SHA.
Before any rollout, configure and verify a restricted server-side Places credential
in staging, rerun `/api/health`, the seven-destination device matrix, picker parity,
destination replacement, manual override, save/reopen, and sanitized DEBUG logs.

## Required rerun and production rollout

Before reconsidering the release:

1. Use an approved disposable/staging Supabase project or install Docker/Podman.
2. Apply all migrations cleanly, then against representative legacy data; capture
   schema, grants, RLS, storage policies/bucket settings, functions, and triggers.
3. Execute every two-user Phase 1/2 check in
   `docs/settings-phase-2-staging-verification.md`, plus notification, profile,
   reset, and deletion flows described above.
4. In unrestricted CI, pass the Node 20 production build and full focused Playwright
   runtime with desktop/mobile screenshots.
5. Resolve packages, pass unsigned native build/build-for-testing and affected
   XCTest suites with retained derived data/result bundles.
6. Pass the physical-iPhone checklist at the exact candidate SHA with the constraint
   breakpoint enabled. Review sanitized evidence and issue a new recommendation.

Only after a later GO: back up production and inventory avatar policy/data; apply the
reviewed Phase 1 migration, verify public legacy reads and ownership; apply Phase 2;
deploy server/web; release native; run authenticated smoke/parity/reset/lifecycle
checks; and monitor sanitized errors. This validation performs none of those steps.

## Production rollback

Stop rollout on any policy, persistence, build, or runtime regression. Roll back
native/server/web code first. Roll back Phase 2 by dropping its trigger, function,
and table only after code rollback. For Phase 1, follow its manual policy/bucket
guidance, preserve the public SELECT policy and all stored objects, and restore a
legacy mutation policy only with explicit security acceptance. Do not delete legacy
avatars or rewrite historical records during rollback.

## Protected material

Pre-existing `.gitignore`, `package.json`, `package-lock.json`, and `docs/security/`
changes remained untouched, unstaged, and outside validation commits. No dependency
was installed or upgraded. No deployment, merge, production migration, production
configuration mutation, calendar enablement, or Phase 3 implementation occurred.
