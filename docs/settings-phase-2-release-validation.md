# Settings Phase 1–2 release validation

## Revision and decision

- Validation branch: `codex/settings-phase-2-release-validation`
- Parent: `8c13b23ecd7d9de71cc2d7c2b7c066e2e9324a9f`
- Phase 2 implementation: `0b310e00ea447809b010798a38718a420b95c8fe`
- Validation status commit: `f076c243981537434eed080e740e0e4ffe88a5d3`
- Documentation finalization: the commit containing this report is branch HEAD.
- Exact recommendation: **HOLD**.

The branch is not a release candidate. Required migration, RLS/storage, production
build, browser runtime, native build/XCTest, and physical-device gates remain
unverified. Under the requested decision rules, none is eligible for Conditional GO.
No Phase 0–2 product defect was proven, so no corrective application or migration
commit was made. Phase 3 work was not started.

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
defined in storage policies as well as application validation. Calendar secrets,
EventKit, email forwarding, and Phase 3 features remain untouched. Redirect code
requires HTTPS in production, but the non-production reset allowlist was not
runtime-verified. No production resource was mutated.

## Failures, corrective commits, and risks

All failed/blocked commands above are environment gates. There are no corrective
code or schema commits because no product defect was isolated. Remaining high-risk
unknowns are real migration replay, storage/RLS isolation, persistence and password
reset behavior, production compilation, browser runtime/visuals, native compilation
and XCTest, device persistence/parity, and Auto Layout. These mandate HOLD.

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
