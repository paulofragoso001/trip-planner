# Settings Phase 2 implementation summary

## Revision

- Branch: `codex/settings-phase-2`
- Parent commit: `86da2f304af0b58e446b22e67524594da1529c51`
- Phase 1 implementation preserved: `a37f340451b190c612e1e09fbb62a56a679a3296`
- Final Phase 2 implementation commit: `0b310e00ea447809b010798a38718a420b95c8fe`
- Documentation finalization: the commit containing this summary is the branch HEAD;
  the immutable implementation SHA above contains runtime, migration, tests, audit,
  and staging guidance.

## Delivered behavior

The isolated `user_preferences` table stores one authenticated user's typed
`default_currency` and `distance_unit`, with timestamps, safe USD/miles defaults,
constraints, RLS, and owner-only SELECT/INSERT/UPDATE. Supported currencies are USD,
EUR, GBP, BRL, JPY, and CAD; distance values are `miles` and `kilometers`.

`GET /api/user-preferences` returns the current user's persisted record or typed
defaults without creating a row. `PATCH /api/user-preferences` accepts a strict,
non-empty partial body, rejects unknown/identity fields, enforces CSRF, derives the
owner from authentication, preserves omitted fields, handles concurrent first
writes, and returns the normalized persisted record. No service-role credential is
needed or exposed.

Account Settings and the mobile wallet Settings surface hydrate before showing a
selected value, save each field independently, roll back the latest failed intent,
ignore stale responses, and expose loading/saving/saved/error states accessibly.
Native uses the same API semantics after session restoration, keeps presentation
state separate from UIKit, refreshes from confirmed responses, and never announces
a save before server confirmation. Expired-session and network handling reuse the
authenticated native HTTP client; no native-only source of truth was introduced.

New budget records use the user's default currency only when the record has no
explicit supported currency. Existing records are never rewritten or converted.
Distances remain canonical in kilometers and convert only at display boundaries
through `formatDistanceForPreference`; no exchange-rate support is claimed.

Web version text comes from package metadata. Native reads
`CFBundleShortVersionString` and `CFBundleVersion` and formats
`Version <version> (<build>)`. Build SHA remains diagnostics-only. No trustworthy
global sync timestamp exists, so Last Sync/Force Sync remain absent. No approved App
Store ID exists, so native App Updates remains disabled with accurate wording and
web has no store-update action.

Web share uses the Web Share API and copy-link fallback; native uses
`UIActivityViewController` with iPad-safe popover anchoring. Both share
`https://almidy.app` and the same short message. Manual import wording routes to
`/dashboard/imports`; email forwarding stays unavailable and no provider connection
or forwarding address is implied.

## Schema, RLS, and security

The unexecuted migration is
`supabase/migrations/20260806140000_create_user_preferences.sql`. It enables RLS,
revokes table access from anon/authenticated before granting only authenticated
SELECT/INSERT/UPDATE, scopes policies to `(select auth.uid()) = user_id`, checks the
allowed values, updates `updated_at` by trigger, and embeds manual rollback commands.
No DELETE grant is added because this API does not expose preference deletion.

User IDs always come from the authenticated session. Mutation validation is strict
and CSRF-protected. Errors are sanitized and no access token, storage signature,
reset link, raw provider response, or sensitive user metadata is newly logged.
Existing Phase 1 public-avatar behavior is unchanged. No production Supabase,
Vercel, DNS, secret, provider, storage, migration, deploy, or merge action occurred.

## Files changed

- API/contracts/state: `app/api/user-preferences/route.ts`,
  `lib/user-preferences.ts`, `hooks/use-user-preferences.ts`
- Web settings/consumers: `app/dashboard/account/page.tsx`,
  `components/account/user-preferences-settings.tsx`,
  `components/dashboard/travel-wallet-sheet.tsx`,
  `components/trip/budget-record-form.tsx`,
  `components/trip/trip-ideas-page.tsx`, `app/api/budget-records/route.ts`,
  `lib/geo/distance.ts`
- Native: `ios/App/App/NativeMapPlugin.swift`,
  `ios/App/App/NativeSettingsModel.swift`,
  `ios/App/AppTests/NativeSettingsTests.swift`
- Migration/tests/docs: `supabase/migrations/20260806140000_create_user_preferences.sql`,
  `tests/unit/settings-phase-2-contracts.test.mjs`,
  `tests/playwright/settings-phase-2.spec.ts`,
  `tests/playwright/mobile-ux.spec.ts`,
  `docs/settings-production-audit.md`,
  `docs/settings-phase-2-staging-verification.md`

## Validation record

Passed:

- `./node_modules/.bin/tsc --noEmit`
- `node --test tests/unit/settings-phase-1-contracts.test.mjs tests/unit/settings-phase-2-contracts.test.mjs` — 9/9 static contract and policy tests
- `git diff --check -- . ':(exclude).gitignore' ':(exclude)package.json' ':(exclude)package-lock.json' ':(exclude)docs/security/**'`
- Staged-file review confirmed no protected path entered the implementation commit.

Environment-blocked or incomplete (not passed):

- `NEXT_TELEMETRY_DISABLED=1 ./node_modules/.bin/next build --webpack` reached
  `Creating an optimized production build ...` but emitted no additional output for
  more than two minutes and was stopped; exit 130. Repeat the full build in CI/staging.
- `ALLOW_TEST_DASHBOARD_BYPASS=true npx playwright test tests/playwright/settings-phase-2.spec.ts --workers=1`
  could not write `test-results/.last-run.json`: `EPERM: operation not permitted`.
  Retrying with a writable `--output` then failed to start the web server:
  `listen EPERM: operation not permitted 127.0.0.1:3000`. The authored UI/API suite
  is mocked for persistence/races where stated and must run in CI/staging.
- `xcodebuild -project ios/App/App.xcodeproj -scheme App -destination 'platform=iOS Simulator,id=4F2E19F4-0C72-476F-A279-7DB47F38BDDC' -only-testing:AppTests/NativeSettingsTests test`
  was blocked by an invalid CoreSimulatorService connection and sandbox-denied
  writes to Clang/SwiftPM cache and log paths (`Operation not permitted`), preventing
  standard-library/package loading. Repeat native build and focused XCTest in CI.
- Local Supabase runtime/RLS testing was not established. `npx supabase status` did
  not produce usable runtime evidence in this managed environment; Phase 1 had also
  reported no Docker/Podman runtime. Static policy checks passed, but two-user runtime
  checks remain mandatory in staging.

Skipped:

- Formatting and lint: the repository exposes no formatting/lint script or local
  Prettier/ESLint executable, and protected dependency files could not be changed.
- Physical-device share, native restart, and real authenticated cross-user manual
  tests were not possible in this host. Playwright/browser manual testing was not
  performed because the local server could not bind.

No test was marked passed when its runtime was blocked. The React quality review
confirmed unconditional hooks, labeled native selects/buttons, live status text,
and field-local stale-response guards; no dependency or broad state framework was
introduced.

## Staging, rollout, and rollback

Follow `docs/settings-phase-2-staging-verification.md`. In staging, first apply and
verify the Phase 1 avatar policy migration, then apply the Phase 2 preference
migration. Run two-user storage/RLS checks, API tests, the focused Playwright suites,
native compilation/XCTest, restart parity, preference consumers, share handoffs,
metadata, and importer semantics. Do not promote until every blocked runtime check
passes.

Production rollout order after separate approval is: backup/policy inventory;
reviewed Phase 1 migration if not already applied; reviewed Phase 2 migration;
server/web deployment; native release; authenticated smoke/parity tests; monitoring.
This phase performs none of those production steps.

To roll back, revert the application release first. Then drop the Phase 2 trigger,
function, and table using the migration comments. Follow the Phase 1 migration's
avatar rollback guidance separately, preserving public reads and stored objects. Do
not rewrite historical expenses or delete avatars/preferences during application-only
rollback.

## Remaining Settings gaps

Runtime RLS/storage validation, production build, browser suite, native compilation,
simulator/device tests, and restart/offline parity remain release gates. Distance
consumption is limited to existing activity-distance presentation, and default
currency affects only new budget records; no conversion exists. Native App Updates
requires an approved public App Store URL. Language/localization, billing/trials,
reservation email forwarding, calendars/EventKit, widgets, icon switching, MCP,
custom categories, storage controls, and Shortcuts remain intentionally out of scope.

## Protected material

Pre-existing changes to `.gitignore`, `package.json`, `package-lock.json`, and
`docs/security/` remained untouched, unstaged, and outside the Phase 2 implementation
commit. No dependencies were upgraded.
