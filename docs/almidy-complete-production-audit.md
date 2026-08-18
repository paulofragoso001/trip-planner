# Almidy complete production audit

Audit date: 2026-08-14
Audited branch: `codex/recovered-new-ui-release`
Audited committed HEAD: `a197c0e52e779fc5e63abc5bbccd378138e503bf`
Original Phase 0 production baseline: `a9ffb9a4b4c3d3552c286409ff6a260b16ded862`

## Purpose and status

This document is the durable source of truth for continuing Almidy work without relying on the previous long Codex conversation. It audits the current repository, not only the older Phase 0–2 documentation.

Release recommendation at this snapshot: **HOLD**.

The HOLD is based on unresolved or unverified production gates, not on a conclusion that the whole product is defective. The application now contains substantial working web and native functionality, including the native globe, native trip creation, persisted destination imagery, the native Settings work from Phases 0–2, and a versioned native Trip Overview. Before release, the repository still needs runtime database/storage isolation evidence, one legacy storage policy correction, clean locked-dependency validation, native build/device evidence, and deployment-contract alignment.

Status terms used below:

- **Real**: implemented against a persisted or authenticated production-shaped contract.
- **Partial**: implemented, but with an intentional limitation, handoff, missing parity, or unverified runtime gate.
- **Unavailable**: truthfully omitted or disabled; no production behavior should be inferred.
- **Audit gap**: behavior may exist, but this audit could not establish the required runtime evidence.

## Repository state and audit boundaries

At audit start, the branch was ahead of `origin/main` by approximately 146 commits and was not merged into the production line. The working tree already contained user-owned changes:

- `ios/App/App.xcodeproj/project.pbxproj` — native build number 7 to 8.
- `ios/App/App/NativeMapPlugin.swift` — globe camera, zoom range, hybrid labels, and related test hooks.
- `ios/App/AppTests/NativeMapConnectivityTests.swift` — matching globe connectivity expectations.
- `ios/App/App/config 2.xml` — untracked five-line XML file; its contents were not copied into this report.

Those changes are not part of the audited committed HEAD and were preserved. In particular, the exact globe presentation visible in a local build may differ from `a197c0e` because the working tree changes increase the maximum camera distance and switch populated globes to scale-aware hybrid labeling.

Protected recovery/security material was not edited by this audit:

- `.gitignore`
- `package.json`
- `package-lock.json`
- `docs/security/`

No deployment, merge, production migration, production secret change, provider change, or production Supabase mutation was performed.

## Executive product inventory

| Area | Status | Current contract and important limits |
| --- | --- | --- |
| Web authentication | Real | Supabase cookie sessions; dashboard APIs authenticate the current user. |
| Native authentication | Real, runtime recheck required | Native session coordinator stores/restores and refreshes Supabase sessions; bearer dashboard API authorization verifies the token and preserves user-scoped RLS. |
| Profile display name | Real | `profiles.username` is canonical; a trusted server path synchronizes Auth metadata. Existing mismatches reconcile through the documented profile contract, not a production-wide batch. |
| Avatar upload | Real with one separate storage risk | The `avatars` bucket uses owned UUID paths, MIME/size constraints, replacement ordering, and cleanup rules. The unrelated legacy `trip-images` bucket is not equivalently hardened. |
| Password reset | Real | Authenticated current-user email only; no arbitrary target-email parameter. Native initiation uses the approved web completion path. |
| Account deletion | Real request lifecycle | Creates and reads a user-owned deletion request; it does not instantly delete an account. Fulfilment remains an operator process. |
| Notification preferences | Real | Authenticated hydration and writes, comment/mention fields, optimistic rollback, stale-response protection, and reload persistence are implemented. Runtime backend replay remains a release gate. |
| Currency/distance preferences | Real | Explicit typed `user_preferences` columns and owner RLS; partial updates preserve the other value. Currency is a default, not conversion. Distance converts at presentation boundaries. |
| Native globe/dashboard | Real, active refinement | Interactive MapKit globe, trip annotations, location marker, native wallet and trip list. Current uncommitted presentation changes need review and build/device validation. |
| Create/edit trip | Real | Native MapKit destination resolution, dates, imagery discovery/manual override, persistence, reopen/edit behavior, and web trip creation exist. |
| Destination imagery | Real, provider-dependent | Native and web call server travel-data contracts; automatic and picker flows share resolved destination semantics. Provider credentials and authenticated API behavior must be verified per environment. |
| Web trip detail | Real | Overview, timeline, map, ideas, budget, imported documents preview, collaboration/sharing. |
| Native Trip Overview v1 | Real | Versioned shared contract, native cache, stale-while-refresh, partial section states, hero image, itinerary, imported items, expenses, recent items, and truthful actions. |
| Native quick actions | Partial by design | New Activity, Places, and Routes are exposed. Flights and Stays are disabled/hidden until real native destinations exist. |
| Itinerary/activities | Real on web; partial native | Persisted segments and itinerary operations exist. Native overview summarizes them and hands supported destinations to existing surfaces rather than duplicating every editor. |
| Places/routes | Real handoffs | Existing web/native route policy supports real Places and Routes destinations. |
| Documents | Partial | Imported/unfiled item preview is read-only in Trip Overview. It is not a general native file-management system. |
| Expenses | Real with two-domain caution | Trip Overview summarizes `budget_records` by currency without conversion. Segment-level expense/detail tables also exist; these should not be conflated without an explicit ledger migration. |
| Recently added | Real | Derived from persisted creation timestamps, limited for overview presentation. |
| Sharing/collaboration | Real on web | Collaborators/invites and public trip behavior exist. Native uses approved handoffs where a complete native flow is absent. |
| Manual reservation import | Real handoff | Manual importer is available. Email forwarding remains unavailable and must not be described as connected. |
| Calendar sync | Unavailable/deferred by default | `CALENDAR_SYNC_ENABLED` defaults off. Health reports it as deferred, and Calendar APIs reject use while disabled. EventKit and Calendar UI remain out of scope. |
| Trial/billing/Pro weather | Unavailable | Truthfully omitted/disabled. No entitlement or local fake activation should be restored. |
| Native app updates | Unavailable until listing | Disabled unless an exact approved App Store destination exists. |
| Widgets, shortcuts, MCP, app icons, localization | Unavailable | Deferred product areas; no enabled-looking placeholders should be presented. |

## Canonical Trip Overview v1

The current repository includes a dedicated native Trip Overview release rather than only the older wallet card. Its shared TypeScript contract is `lib/contracts/trip-overview-v1.ts`, served by `GET /api/trips/[id]/overview` and consumed by the Swift Trip Overview models/store/client.

The contract includes:

- Trip identity, destination, country code, dates, relative timing, duration, and status.
- Hero image URL, attribution, source, and fallback semantics.
- Itinerary date range, exact activity count, category preview, and section state.
- Imported/unfiled document previews.
- Expense totals and categories, segregated by currency.
- Recently added records ordered by insertion time.
- Explicit action availability.
- Per-section loading/empty/error/partial semantics.

Native implementation characteristics:

- Per-user/per-trip disk caching with a hashed cache key.
- Cached rendering followed by refresh rather than a blank restart.
- Auth-expiration recovery through the native session contract.
- Partial failure isolation so one section does not erase other usable content.
- Only real actions are shown: New Activity, Places, and Routes.
- Flights and Stays remain unavailable until they have real destinations.
- Weather/Pro promotion and Customize are intentionally omitted for now.
- Section architecture is separable so future reordering can be added without treating order as persisted user configuration today.

## Web and native parity

| Semantic definition | Web | Native | Assessment |
| --- | --- | --- | --- |
| Authenticated user identity | Cookie session | Supabase bearer/session coordinator | Semantically aligned; runtime token refresh/device evidence still required. |
| Display name | `profiles.username` plus reconciled metadata | Same backend contract | Aligned. |
| Currency | Supported code enum; default for new applicable records | Same API values | Aligned; never implies exchange conversion. |
| Distance | Miles/kilometers presentation preference | Same API values | Aligned. |
| Trip imagery | Persisted provider/manual URL and metadata | Same destination/image contract | Aligned, with provider availability dependency. |
| Trip Overview | Full web routes/components | Versioned summary and handoffs | Purposefully not identical UI, but data meanings align. |
| Expenses | Budget records and trip budget UI | Read-only overview summary/handoff | Partial native editing parity. |
| Documents | Imported-item preview | Imported-item preview/handoff | Partial, read-only overview. |
| Notification preferences | Interactive account settings | Native settings model/action | Aligned contract; runtime backend gate outstanding. |
| Password reset | Authenticated initiation | Same semantic action, web completion | Aligned by design. |
| Account deletion | Request/status UI | Controlled web handoff | Truthful partial native parity. |

## Supabase schema and migration audit

The repository contains the full numbered migration chain plus the isolated Phase 1 and Phase 2 migrations. Major persisted domains include:

- Profiles and trips.
- Notification records and notification preferences.
- Trip segments, segment details, and segment expenses.
- Budget records.
- Collaborators and invitations.
- Feedback and API error records.
- Unfiled/imported items, import sources, parse events, and review state.
- Flight truth events.
- Account deletion requests.
- Social imports and extracted places.
- Comments.
- Travel inventory and recommendations.
- Calendar connections, tokens, calendars, jobs, items, and OAuth events.
- User preferences.

### Phase 1 avatar hardening

The Phase 1 avatar migration is isolated and retains public-read product behavior. Authenticated writes require an owned path whose first segment is the authenticated UUID. The policy constrains supported image types and a five-MiB object limit. Application replacement ordering preserves the old avatar until the profile update succeeds and only removes an earlier owned object.

This policy still needs the requested two-user runtime proof in a disposable Supabase environment before release.

### Phase 2 user preferences

`supabase/migrations/20260806140000_create_user_preferences.sql` creates one typed row per user with explicit currency and distance columns, timestamps, constraints, RLS, and owner-only select/insert/update behavior. Server APIs derive ownership from the authenticated session and return virtual defaults when no row exists.

This migration also needs clean replay and two-user runtime RLS proof before release.

### High-risk legacy trip-image storage finding

The older `trip-images` bucket policy remains materially weaker than the avatar policy. Its insert policy is bucket-scoped and allows any authenticated user to insert an arbitrary object name within the bucket. The current browser upload helper also creates a root-level timestamp/browser-name path. No equivalent owner-prefix, server-normalized filename, size, or MIME policy was established by this audit.

Required correction before release:

1. Define a canonical owned trip-image path, including whether ownership is user- or trip-based.
2. Add a new corrective migration; do not rewrite the committed historical migration.
3. Constrain insert/update/delete at the storage policy layer.
4. Constrain MIME and object size, and reject path tricks.
5. Preserve public/private read behavior explicitly and establish legacy compatibility.
6. Add two-user runtime storage tests and replacement/cleanup tests.

### RLS compliance finding

The repository compliance audit currently fails because `public.travel_inventory` has an authenticated read policy with `USING (true)`. This may be a deliberate shared catalog, but it is not aligned with the audit allowlist/documentation. Before release, either document and allowlist this intentional public catalog policy or replace it with the intended scoped access. Do not weaken the compliance check merely to obtain a pass.

### Runtime database evidence

No runtime Supabase replay was completed during this audit. A global Supabase CLI was unavailable, and no working Docker or Podman runtime was established. All statements in this section are static migration/policy review unless explicitly described otherwise.

## Authentication and API security

### Established controls

- Dashboard APIs derive the user ID from authenticated cookie or bearer state.
- Bearer authorization verifies the supplied Supabase token and uses a bearer-scoped client, preserving RLS.
- The service-role client imports `server-only`; no service-role key was found in native configuration or a public browser variable.
- Newer sensitive mutations use same-origin/CSRF validation.
- Test bypass flags are explicitly forbidden by production preflight.
- Calendar and worker routes use separate server-only secrets where applicable.
- Reset tokens, refresh tokens, signed URLs, and provider credentials should never be logged; existing diagnostics are designed around sanitized categories/statuses.

### CSRF consistency gap

Several older session-authenticated mutation routes do not consistently call the shared mutation-origin validator. Examples found by static route review include itinerary creation/reordering/bulk operations, trip-segment creation, budget-record creation, comments, some recommendation/generation routes, trip sharing, location retry, and selected travel/calendar mutations.

This is a consistency and defense-in-depth gap. SameSite cookies and RLS may still block classes of abuse, so this audit does not label every route exploitable without a focused test. The production rule should nevertheless be simple: every browser session mutation uses the same origin/CSRF contract unless it is deliberately authenticated by a non-cookie worker secret.

### Public endpoint exposure decisions

The following unauthenticated surfaces need an explicit rate-limit/exposure review:

- `GET /api/travel-data/place-photo`: validates reference, timeout, image MIME, and response size, but can consume provider quota without user authentication.
- `/api/mapkit-token`: public token delivery is expected for MapKit JS, but origin restrictions and lifetime must be verified.
- `/api/metrics` and `/api/stream/metrics`: may disclose operational state.
- `/api/panel-errors`: redacts submitted data but may permit log-volume abuse without rate/size controls.
- `/api/alerts`: currently resembles in-memory/demo operational state and should not be treated as a durable production incident system.

### API response documentation drift

API documentation describes a uniform `{ data, error }` envelope, while a number of current routes return route-specific top-level JSON. The Trip Overview deliberately has a raw versioned contract, and other routes include trips, preferences, profile/avatar, health, comments, and lifecycle endpoints. Either update the documentation with intentional exceptions or normalize contracts incrementally; do not make breaking response changes only for stylistic uniformity.

## External providers and configuration

The source references Supabase, Google Places/Maps, MapKit JS, OpenAI, Resend, Vercel runtime/OIDC, and deferred Calendar providers. Native configuration exposes only a Supabase URL and publishable key through build settings; it contains no privileged service key and no EventKit/Calendar usage descriptions.

Calendar behavior is now correctly feature-flagged in application code:

- `CALENDAR_SYNC_ENABLED` defaults to disabled.
- Disabled Calendar does not require provider, redirect, encryption, or worker secrets.
- Health reports Calendar as disabled/deferred rather than unhealthy.
- Calendar routes reject activation while disabled.
- Enabling Calendar requires the full secret/redirect/provider/worker contract.

Deployment documentation and workflows have not fully caught up with that behavior.

## Deployment and CI audit

### Production preflight mismatch

The application production preflight requires core values that include the social-import worker secret and OpenAI key. The inspected production environment/deployment workflows do not supply all current required values, so the gate can fail even if the Vercel project is otherwise correctly configured.

The workflows also still exercise or supply parts of the deferred Calendar contract without explicitly enabling Calendar. This conflicts with the feature-flag decision and can turn a deferred feature into a false release blocker.

Required action:

1. Make the workflow call the same canonical environment validator used by the application.
2. Supply every current non-Calendar core variable to the validation job without printing values.
3. Set `CALENDAR_SYNC_ENABLED=false` explicitly for the Phase 0–2 release candidate.
4. Skip Calendar runtime tests when disabled; run the strict all-secrets suite only in an intentionally Calendar-enabled environment.
5. Update the production environment runbook to match.

### CI coverage gaps

- Native CI performs simulator build/test and secret scanning, but this exact recovered branch still needs a successful run and physical-device evidence.
- Dashboard workflow path filters may not include every Trip Overview contract/component/API path, allowing relevant changes to skip focused dashboard coverage.
- Dependency/security documentation predates recent dependency-file history and should be regenerated from the locked tree before release.

### Documentation drift

The README still describes an earlier scaffold/version and treats Calendar secrets as generally required. Older Settings release-validation documents are historically valuable but no longer fully describe the newer native Trip Overview and subsequent globe work. This complete audit supersedes them for current-state orientation while retaining their exact test evidence.

## Validation evidence from this audit

Environment observed:

- Node: `v24.15.0`
- npm: `11.12.1`
- Xcode: `26.6` (`17F113`)
- Swift: `6.3.3`
- iOS SDK: `26.5`
- Supabase CLI: unavailable globally
- Docker/Podman: unavailable for an executable local Supabase gate
- Simulator service: unavailable during inspection (`CoreSimulatorService` connection failure)

Commands and results:

| Command | Result | Classification |
| --- | --- | --- |
| `node --test tests/unit/*.test.mjs` | **Passed:** 128 tests, 0 failed, 0 skipped. Node emitted module-type warnings. | Real unit execution. |
| `npm run tokens:verify` | **Passed.** | Static design-token verification. |
| `npm run audit:compliance` | **Failed:** broad `public.travel_inventory` `USING (true)` policy. | Static SQL/RLS compliance. |
| `npm run guardrails:check` | **Failed:** committed heavy native font weights in `NativeMapPlugin.swift`. | Static UI guardrail; unrelated existing code, not changed by this audit. |
| `./node_modules/.bin/tsc --noEmit` | **Blocked/failed before source checking:** local `node_modules` contains duplicate/corrupt type-package directory names such as `node 2` and `react 2`. | Environment/dependency-tree failure; not a proven TypeScript source failure. |
| Supabase migration replay and two-user tests | **Not run:** no executable local Supabase/Docker/Podman environment. | Required runtime gate remains unverified. |
| Native build/XCTest/device pass | **Not run in this audit:** simulator service unavailable; no interactive physical-device session was controlled here. | Required runtime gate remains unverified. |

Do not interpret a static policy test, mocked route test, Swift parse, or earlier screenshot as a substitute for the required runtime gates.

## Ranked findings and required work

### P0 — must resolve before production rollout

1. **Harden `trip-images` storage ownership with an additive migration and two-user runtime proof.**
2. **Replay the complete migration chain on clean and representative legacy disposable data.** Include avatar and user-preference migrations.
3. **Prove two-user isolation at runtime.** Preferences, notifications, profiles, deletion requests, avatars, and trip images.
4. **Align production preflight/workflows with the current environment validator and Calendar-disabled release contract.**
5. **Restore a clean locked Node dependency tree and pass TypeScript plus production build.** Use the committed lockfile; do not upgrade dependencies as part of validation.
6. **Pass native build-for-testing, focused/combined XCTest, and physical-iPhone regression on one exact candidate SHA.**

### P1 — security and correctness stabilization

1. Normalize CSRF/origin enforcement across older cookie-authenticated mutation routes.
2. Resolve or explicitly approve the shared `travel_inventory` read policy and make compliance pass honestly.
3. Add rate limiting/abuse controls and exposure decisions for public provider proxy, error ingest, and metrics endpoints.
4. Reconcile CI path filters with current Trip Overview/API/native files.
5. Audit the untracked `config 2.xml`; either deliberately incorporate a sanitized non-secret configuration under a reviewed filename or remove it from the release working tree. Never commit provider secrets.
6. Clarify the canonical relationship between `budget_records` and segment-level expense tables.

### P2 — product parity and maintainability

1. Native edit/create flows for Trip Overview sections beyond current handoffs.
2. Native document management beyond imported-item previews.
3. Flights and Stays native destinations before exposing those quick actions.
4. Optional section reordering only after a persistence/accessibility design.
5. Update README, environment runbooks, and API contract documentation.
6. Remove or formalize demo-like operational alert behavior.

### Explicitly deferred; do not confuse with release defects

- Calendar provider UI, EventKit, or Apple Calendar integration.
- Reservation email forwarding.
- Billing, subscriptions, trials, or Pro entitlements.
- Weather promotion.
- Widgets, app-icon switching, localization/language switching, MCP, Shortcuts, custom categories, or storage controls.

## Recommended release milestones

### Milestone 1 — Backend Security & Persistence GO

Pass only when:

- Full migrations apply cleanly from an empty database and representative legacy state.
- User A cannot select, insert, update, or delete User B's preference/storage/account-lifecycle data.
- Avatar and trip-image policy ownership is proven at the Supabase layer.
- Legacy avatars/trip images follow a documented compatible path.
- Currency/distance and notification values persist through logout/reload.
- Profile name remains consistent in Auth metadata and `profiles`.
- Password reset always targets the authenticated account.
- Account deletion request/status is user-scoped.

### Milestone 2 — Web production runtime GO

Pass TypeScript, production build, focused real-backend API/Playwright suites, desktop/mobile visual checks, security guardrails, and deployment preflight with Calendar disabled.

### Milestone 3 — Native and physical-device GO

Resolve packages, generic build, build-for-testing, focused plus combined XCTest, then run the physical-iPhone checklist on the same SHA. Include globe interaction, trip creation/imagery, Trip Overview, Settings persistence, auth refresh, offline/error states, and `UIViewAlertForUnsatisfiableConstraints`.

### Milestone 4 — Production rollout

Only after the first three milestones are GO:

1. Back up and inventory production schema/policies/storage.
2. Apply migrations in repository order, including additive corrective migrations.
3. Verify RLS/policies with production-safe test accounts.
4. Deploy the web release with Calendar explicitly disabled.
5. Run health, authenticated smoke, and provider-quota checks.
6. Release the exact native build validated on device.
7. Monitor authentication, storage denials, API error rates, imports, and provider failures.

## Rollback procedure

1. Stop the rollout if migration, ownership, build, auth, or persistence checks fail.
2. Roll the web deployment back to the previously known deployment artifact.
3. Do not automatically reverse a data migration that has accepted writes. Use the migration-specific rollback guidance after backing up affected rows/policies.
4. For additive policy corrections, restore the prior policy only if doing so does not re-open cross-user access; prefer disabling the affected write path while correcting it.
5. Keep the previous native build available; do not promote a new App Store build until the validated binary is confirmed.
6. Record the exact SHA, migration version, environment, symptom, and remediation without logging tokens or sensitive metadata.

## Handoff for future Codex tasks

Start a fresh task rather than reopening the overloaded historical chat. Provide:

1. Repository: `/Users/fragoso/Documents/Codex/Almidy-Commit-Stack`
2. Branch and exact HEAD.
3. This file: `docs/almidy-complete-production-audit.md`.
4. The single milestone or finding to address.
5. Explicit protected paths and the instruction not to deploy/merge unless desired.
6. Current `git status --short`, especially whether the native globe changes and `config 2.xml` are still user-owned work.

Recommended next task prompt:

> Continue Almidy from `docs/almidy-complete-production-audit.md`. Work only on Milestone 1, Backend Security & Persistence GO. Preserve existing dirty native globe work and protected recovery/security files. Create an additive `trip-images` policy correction, establish a disposable Supabase runtime, replay all migrations, and execute two-user RLS/storage/lifecycle tests. Do not begin deferred features, deploy, merge, or mutate production.

## Final audit conclusion

Almidy is no longer an early Settings-only implementation. It has a substantial authenticated web application, a native globe/create-trip experience, persisted imagery, cross-platform Settings contracts, and a versioned native Trip Overview. The correct next move is stabilization, not Phase 3 expansion.

The release remains **HOLD** until the P0 gates are passed with runtime evidence on one exact release-candidate SHA.
