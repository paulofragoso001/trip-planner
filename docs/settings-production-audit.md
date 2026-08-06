# Almidy Settings Production Audit

**Audit date:** 2026-08-05
**Production behavior baseline:** `a9ffb9a4b4c3d3552c286409ff6a260b16ded862`
**Audit scope:** the full current working tree, with the baseline commit used to distinguish released behavior from unfinished work.

## Phase 1 implementation status (2026-08-06)

Implemented on `codex/settings-phase-1`, parent `9261275866147a87095fc8bad35f547458f9ae88`. Notification preferences now have an authenticated own-user GET contract, complete comment/mention UI hydration, guarded optimistic persistence, and mounted Account Settings UI. `profiles.username` is the canonical display name; Auth `full_name` is a synchronized cache updated by the same authenticated API, and existing mismatches resolve in favor of the profile row without a production-wide migration.

Avatar mutations now use a server-validated `<auth-user-id>/<generated-uuid>.<approved-extension>` path and an isolated migration tightens Storage ownership, MIME, and size enforcement while retaining the existing public-read product decision. Web avatar replacement preserves the old profile on failure and cleans up only previous owned objects. Native avatar upload remains visibly unavailable; adding a media dependency is deferred.

Authenticated password-reset initiation is available on web and native and always targets the session user's verified email. Completion uses the approved web reset route. Account deletion remains an operator-reviewed request; own-status reads, duplicate-open handling, completed status wording, and the operating lifecycle are documented. No production reconciliation, migration, deployment, provider mutation, or deferred Settings scope was performed.

## Executive summary

Almidy currently has two broad Settings experiences:

- Web: the authenticated account page plus a mobile wallet Settings panel.
- Native iOS: `NativeSettingsViewController`, with profile/account controllers and selected controlled-WebView handoffs.

The Settings interfaces are visually broad, but only a small subset is production-complete. Legal links, trip/stat navigation, sign-out, notification inbox state, and account-deletion request intake have real implementations. Most customization, membership, automation, and native Settings rows are disabled placeholders or display-only values. Several native rows appear actionable but only show a generic alert, which is more misleading than the web treatment because the web usually labels unfinished items as `Soon` or disables them.

The highest-risk surfaced gap is **Add Reservations via Email**. It is presented as an available/pro feature, but its target is hidden on mobile and the underlying `import_sources` records only persist connection-like metadata; no inbound forwarding address or provider connection flow was found. Calendar synchronization has substantial server-side infrastructure, but its UI is not mounted and Scope F remains deferred. It must not be confused with or used to reintroduce native EventKit.

The smallest safe first implementation batch is documentation/navigation truthfulness and Settings parity: correct misrouted/no-op entries, make all unfinished native rows visibly disabled with accurate labels, mount or remove the orphaned notification-preferences surface only after adding a read path, and stop advertising email forwarding as connected functionality. This batch avoids schema changes, external-provider launches, native plugins, and dependency churn.

## Audit safety and baseline preservation

At audit start, `HEAD` was exactly the requested baseline SHA. The pre-existing main-worktree recovery and dependency-security material was:

```text
 M .gitignore
 M package-lock.json
 M package.json
?? docs/security/
```

Those files are intentionally outside this audit's edit scope. This audit does not modify the release-candidate commit, preserved recovery material, dependency manifests/lockfile, Xcode project, migrations, application code, or deployment state. The only new audit artifact is this document.

No live production database introspection was performed. Supabase findings below describe the repository-declared migrations and application access paths; migration presence does not by itself prove that the same schema and policies are currently applied in production.

## Surface inventory

### Web Settings surfaces

- `app/dashboard/account/page.tsx` — primary authenticated account/Settings page.
- `components/dashboard/travel-wallet-sheet.tsx` — mobile wallet `SettingsPanel`, including account, Pro, automations, customization, help, and about sections.
- `app/dashboard/layout.tsx` — authenticated user menu, avatar, Account settings link, notification bell, and sign-out entry.
- `components/ProfileAvatar.tsx` and `lib/upload-avatar.ts` — avatar display/upload and profile-row update.
- `components/NotificationSettings.tsx` — notification preference toggles; implemented but not mounted anywhere.
- `components/NotificationBell.tsx` — mounted notification inbox/read-state control.
- `components/account/account-deletion-request-form.tsx` — account-deletion request form.
- `components/trip/calendar-sync-panel.tsx` — complete-looking calendar connection panel; implemented but not mounted anywhere.
- `components/imports/imports-page.tsx` — import UI and hidden desktop-only `reservation-forwarding` target.
- `components/dashboard/almidy-launch-globe.tsx`, `components/dashboard/mobile-trips-wallet.tsx`, `components/dashboard/mobile-trips-wallet-sheet.tsx`, `components/trip/trip-tabs.tsx`, `components/trip/trip-overview-page.tsx`, and `components/trip/trip-timeline-page.tsx` — Settings-related menu items and navigation.
- `lib/dashboard/action-routes.ts` — centralized web Settings/action destinations.
- `lib/map/feature-flags.ts` — mobile wallet/unified-map rollout flags affecting Settings visibility.

### Web routes and server handlers used by Settings

- `/dashboard/account` — Settings hub.
- `/dashboard/profile` — redirects to `/dashboard/profile/stats`; currently not an About/Profile Settings page.
- `/dashboard/imports` — importer and advanced source metadata.
- `/privacy`, `/terms` — legal pages.
- `/api/preferences` — notification preference POST/upsert only.
- `/api/notifications` and `/api/notifications/read` — notification retrieval/update.
- `/api/account/deletion-request` — account-deletion request intake.
- `/api/import-sources` — source connection metadata updates.
- `/api/calendar/connections`, `/api/calendar/oauth/[provider]`, `/api/calendar/sync`, and `/api/calendar/worker` — deferred calendar integration backend.
- `app/actions.ts` — web sign-out server action.

### Native iOS Settings surfaces

- `ios/App/App/NativeMapPlugin.swift`:
  - `NativeSettingsViewController` — native Settings sections and rows.
  - native profile menu — Edit Profile, Change Password, Sign Out.
  - native account/profile controller — name, email, and account-deletion handoff.
  - controlled WebView route handoffs for imports/help/account deletion.
- `ios/App/App/NativeSessionCoordinator.swift` — native session, profile name update, Keychain-backed authentication, and sign-out coordination.
- `ios/App/App/MainViewController.swift` — native plugin registration. Only the map-related plugins are registered; there is no Apple Calendar plugin.
- `ios/App/CapApp-SPM/Package.swift` and resolved package state — Capacitor dependency only; no EventKit wrapper or calendar plugin.
- `ios/App/App/Info.plist` — Supabase/location/photo configuration; no calendar usage description.

## Complete Settings implementation matrix

Readiness labels: **Ready**, **Conditional**, **Deferred**, or **Not ready**. Priority uses **P0** for user-trust/security defects, **P1** for the smallest safe production batch, **P2** for useful follow-up, and **P3** for explicitly deferred/optional work.

| Setting name | Web implementation file | Native implementation file | Current behavior | Backend/API dependency | Supabase dependency | External provider dependency | Test coverage | Production readiness | Recommended priority |
|---|---|---|---|---|---|---|---|---|---|
| Account settings / profile shell | `app/dashboard/account/page.tsx`; `app/dashboard/layout.tsx`; `components/dashboard/travel-wallet-sheet.tsx` | `ios/App/App/NativeMapPlugin.swift` | Web links to the account hub. Native header opens a real account controller. | Authenticated dashboard session | Supabase Auth; `profiles` indirectly | None | Web action-route checks; native route-policy coverage, but no native Settings UI test | Conditional: shell works, feature depth is inconsistent | P1 |
| Profile avatar | `components/ProfileAvatar.tsx`; `lib/upload-avatar.ts`; `lib/profile.ts` | `ios/App/App/NativeMapPlugin.swift` | Web uploads to a public bucket and writes `profiles.avatar_url`; native displays a static system avatar and cannot upload. | Supabase client calls; no custom API | `profiles`; public `avatars` bucket | None | No focused upload/security/persistence test found | Conditional: web works, native parity and storage-policy hardening needed | P1 |
| Profile display name and email | `lib/profile.ts`; account page displays session/profile information | `ios/App/App/NativeMapPlugin.swift`; `ios/App/App/NativeSessionCoordinator.swift` | Native edits Auth `data.full_name`; email is read-only. Web has no equivalent dedicated editor and separately maintains `profiles.username`. Token/profile refresh can temporarily leave views stale. | Supabase Auth `PUT /auth/v1/user` natively | Supabase Auth user metadata; `profiles` on web | None | Native session tests exist, but no focused name-update/restart parity test found | Conditional | P1 |
| Change password | No mounted Settings form found | `ios/App/App/NativeMapPlugin.swift` | Native row only says password reset is available from an email; it does not request or send one. | Missing reset initiation flow | Supabase Auth reset flow would be required | Email delivery through Supabase Auth | No direct coverage found | Not ready | P1 |
| Sign out | `app/dashboard/layout.tsx`; `app/actions.ts` | `ios/App/App/NativeMapPlugin.swift`; `ios/App/App/NativeSessionCoordinator.swift` | Web signs out and redirects. Native clears coordinated session/Keychain/WebView state. | Server action on web; native Supabase/WebView cleanup | Supabase Auth | None | Native session/sign-out reconciliation coverage; web route/action coverage | Ready, subject to physical-device regression pass | P2 |
| Delete account | `components/account/account-deletion-request-form.tsx`; `app/api/account/deletion-request/route.ts` | `ios/App/App/NativeMapPlugin.swift` | Web creates a reviewable deletion request after exact confirmation. Native opens the controlled web flow. It does not itself delete the account. | `POST /api/account/deletion-request`; an operator completion process is still required | `account_deletion_requests` | Operational support/admin process | Web UI and API-boundary coverage | Conditional: request intake is ready; fulfillment lifecycle is incomplete | P1 |
| Privacy | `app/dashboard/account/page.tsx`; `components/dashboard/travel-wallet-sheet.tsx`; `app/privacy/*` | `ios/App/App/NativeMapPlugin.swift` | Web legal link works. Native row currently shows the same generic placeholder alert as unfinished settings rather than opening the legal page. | Static route | None | None | Web route-contract coverage; no native row test | Web ready; native not ready | P1 |
| Terms | `app/dashboard/account/page.tsx`; `components/dashboard/travel-wallet-sheet.tsx`; `app/terms/*` | `ios/App/App/NativeMapPlugin.swift` | Web legal link works. Native row is a generic placeholder alert. | Static route | None | None | Web route-contract coverage; no native row test | Web ready; native not ready | P1 |
| About Almidy | `components/dashboard/travel-wallet-sheet.tsx`; `lib/dashboard/action-routes.ts`; `app/dashboard/profile/page.tsx` | `ios/App/App/NativeMapPlugin.swift` | Web points to `/dashboard/profile`, which redirects to stats rather than About. Native shows a generic alert. | Missing/correct About route | None | None | Contract tests do not detect the semantic misroute | Not ready | P1 |
| My Almidy Book / Travel Book | `app/dashboard/account/page.tsx`; `components/dashboard/travel-wallet-sheet.tsx` | `ios/App/App/NativeMapPlugin.swift` | Web opens profile stats. Native merely refreshes trips and shows an informational alert. | Dashboard stats route | User trip/stat data already used by dashboard | None | Web navigation coverage; no native behavior test | Web ready; native not ready | P1 |
| My Trips / Trips Timeline | `app/dashboard/account/page.tsx`; `components/dashboard/travel-wallet-sheet.tsx` | `ios/App/App/NativeMapPlugin.swift` | Web opens trip list. Native refreshes trips and shows an alert rather than navigating. | Existing trip routes/store | Existing trip tables | None | Web navigation coverage; no native Settings row coverage | Web ready; native not ready | P1 |
| Add Reservations via Email | `app/dashboard/account/page.tsx`; `components/dashboard/travel-wallet-sheet.tsx`; `components/imports/imports-page.tsx` | `ios/App/App/NativeMapPlugin.swift` | Web/native route to `/dashboard/imports#reservation-forwarding`. The target is hidden on mobile. Desktop advanced-source controls only persist source-like metadata; no forwarding address or provider setup was found. | `/api/import-sources`; missing inbound-mail/provider connection workflow | `import_sources` | A real implementation would need an inbound email/provider service | Route/contract tests only; no successful forwarding ingestion test | Not ready and currently over-promised | P0 |
| Reservation importer | `components/dashboard/travel-wallet-sheet.tsx`; `components/imports/imports-page.tsx` | `ios/App/App/NativeMapPlugin.swift` | Opens the importer. Manual/social import paths exist, but this must not be represented as working email forwarding. | Existing import routes/APIs | Import/trip persistence tables | Source-specific services depending on import type | Import-area tests exist; no full Settings-to-persisted-reservation E2E identified | Conditional | P2 |
| Calendar Feed / calendar sync | `app/dashboard/account/page.tsx`; `components/dashboard/travel-wallet-sheet.tsx`; orphaned `components/trip/calendar-sync-panel.tsx` | `ios/App/App/NativeMapPlugin.swift` | Visible Settings rows are disabled/`Pro soon` on web; native shows a misleading generic alert. A substantial web backend and an unmounted panel exist. Scope F remains deferred. | Calendar connection, OAuth, sync, and worker routes | Five calendar tables plus OAuth event table; service-role mutation path | Google Calendar API; Microsoft Graph/Entra | Contract, redirect URI, worker, destructive-action tests; real OAuth commonly environment-gated; no mounted user-flow test | Deferred | P3; do not reopen without explicit Scope F approval |
| Storage and Data | `app/dashboard/account/page.tsx`; `components/dashboard/travel-wallet-sheet.tsx` | `ios/App/App/NativeMapPlugin.swift` | Disabled/`Soon` on web; generic alert on native. No user storage-control implementation found. | Missing | No dedicated settings/storage-usage table | Potential storage provider requirements undefined | Disabled-state contract only | Not ready | P3 |
| Redeem 15 Days Free / trial | `components/dashboard/travel-wallet-sheet.tsx`; membership placeholders in `app/dashboard/account/page.tsx` | No real native implementation found | Opens a local-only sheet that explicitly says activation is coming soon; no entitlement is created and state will not persist. | Missing entitlement/billing API | No membership/entitlement table identified | Billing provider would be required | Mobile UI verifies modal text, not activation | Not ready | P2 after billing design |
| Billing / membership | `app/dashboard/account/page.tsx`; `components/dashboard/travel-wallet-sheet.tsx` | No real native implementation found | Links to a membership anchor whose rows remain placeholders; no billing portal or subscription state found. | Missing | No billing/subscription schema identified | Billing provider, likely Stripe or App Store, is not integrated here | Route/disabled-state checks only | Not ready | P2 after product/provider decision |
| Custom Categories | `components/dashboard/travel-wallet-sheet.tsx` | No equivalent implementation found | Disabled `Soon`; no persistence model found. | Missing | No categories preference table identified | None | Disabled-state UI coverage only | Not ready | P3 |
| Connect with Claude / MCP | `components/dashboard/travel-wallet-sheet.tsx` | `ios/App/App/NativeMapPlugin.swift` | Disabled on web; generic alert on native. No connection/auth/token flow found. | Missing | No connection/token table identified | Anthropic/MCP provider connection would be required | None beyond static contract | Not ready | P3 |
| Shortcuts | `components/dashboard/travel-wallet-sheet.tsx` | `ios/App/App/NativeMapPlugin.swift` | Disabled on web; generic alert on native. | Missing | None identified | Apple Shortcuts/App Intents if reopened | No implementation coverage | Not ready | P3 |
| Currency preference | `components/dashboard/travel-wallet-sheet.tsx` | `ios/App/App/NativeMapPlugin.swift` | Hard-coded `US Dollar` on web and native; disabled/alert only. Existing expense currencies are record-level, not a user preference. | Missing | No user currency preference table | Exchange-rate provider only if conversion is later promised | Static label coverage only | Not ready | P2 |
| Distance unit | `components/dashboard/travel-wallet-sheet.tsx` | `ios/App/App/NativeMapPlugin.swift` | Hard-coded `Miles`; no persistence or behavioral use found. | Missing | No preference table | None | Static label coverage only | Not ready | P2 |
| Language | `components/dashboard/travel-wallet-sheet.tsx` | `ios/App/App/NativeMapPlugin.swift` | Hard-coded `English`; no locale persistence or app-wide localization switching found. | Missing | No preference table | OS localization resources would be required | Static label coverage only | Not ready | P2/P3 |
| App Icon | `components/dashboard/travel-wallet-sheet.tsx` | No equivalent implementation found | Disabled `Soon`; no native alternate-icon integration found. | None | None | iOS alternate icons for native parity | Disabled-state coverage only | Not ready | P3 |
| Notification preferences | Orphaned `components/NotificationSettings.tsx`; `app/api/preferences/route.ts` | `ios/App/App/NativeMapPlugin.swift` row only | Component has two optimistic toggles and POSTs an upsert, but is not mounted. It has no GET/hydration path, so it cannot reliably show persisted state. Native row is a generic alert. Mention columns exist but have no UI. | `POST /api/preferences`; missing read/hydration endpoint | `notification_preferences` | Email delivery system for email preferences; in-app notification producer | API auth/CSRF/shape tests, but no mounted persistence/restart E2E | Not ready as a user-facing setting | P1 |
| Notification inbox / mark read | `components/NotificationBell.tsx`; notification API routes | No equivalent Settings implementation found | Mounted web bell fetches notifications, listens via Realtime, and optimistically marks read with rollback. This is behavior, not a preference editor. | `/api/notifications`; `/api/notifications/read` | `notifications`; Supabase Realtime | None | API-boundary tests and test-bypass mark-read path; no live DB/Realtime E2E identified | Conditional-to-ready on web | P2 |
| Widgets | `components/dashboard/travel-wallet-sheet.tsx` | `ios/App/App/NativeMapPlugin.swift` | Disabled on web; generic alert on native. No widget extension/data contract found. | Missing | None identified | WidgetKit for iOS | No implementation coverage | Not ready | P3 |
| Need help? | `app/dashboard/account/page.tsx`; `components/dashboard/travel-wallet-sheet.tsx` | `ios/App/App/NativeMapPlugin.swift` | Web routes to the help section. Native opens the controlled account help route. | Static/account route | None | None | Route-policy/contract coverage; limited UX coverage | Conditional: route works, help content depth should be reviewed | P2 |
| Talk to us | `app/dashboard/account/page.tsx`; `components/dashboard/travel-wallet-sheet.tsx` | `ios/App/App/NativeMapPlugin.swift` | Web uses `mailto:` support. Native incorrectly opens the same account-help route as Need help instead of composing email. | Mail client handoff | None | User mail client | Web href checks; no native handoff test | Web ready; native not ready | P1 |
| Review App | `components/dashboard/travel-wallet-sheet.tsx` | `ios/App/App/NativeMapPlugin.swift` | Disabled on web; generic alert on native; no App Store review request/deep link. | None | None | Apple App Store/StoreKit | No implementation coverage | Not ready | P3 |
| App Updates | `components/dashboard/travel-wallet-sheet.tsx` | `ios/App/App/NativeMapPlugin.swift` | Disabled on web; generic alert on native; no version-check/update flow. | Missing or OS-store handoff | None | App Store | No implementation coverage | Not ready | P3 |
| Share with a friend | `components/dashboard/travel-wallet-sheet.tsx` | `ios/App/App/NativeMapPlugin.swift` | Disabled on web; generic alert on native; no share sheet/link contract found. | Static share URL would suffice | None | Native/web share APIs | No implementation coverage | Not ready | P2/P3 |
| Version, Last Sync, Force Sync | `components/dashboard/travel-wallet-sheet.tsx` | No equivalent complete implementation found | Version is hard-coded `1.0.0`; Last Sync is hard-coded `Never`; Force Sync is disabled. | Missing sync/status endpoint and build-version source | No Settings sync-state record identified | None | Mobile UI confirms disabled control only | Not ready | P1 for truthful values/removal; P2 for real sync |
| Start planning and Map shortcuts | `app/dashboard/account/page.tsx` | Native map is the containing experience | Web links to existing planner/map routes. | Existing dashboard routes | Existing trip/map data | Map services already used by app | Navigation coverage | Ready as navigation | P3 |
| Trip settings menu items | `components/dashboard/almidy-launch-globe.tsx`; wallet and trip components | `ios/App/App/NativeMapPlugin.swift` | One launch-globe callback is explicitly `() => {}`; overview/timeline `Settings` labels can route to a trip overview rather than settings. Other entries correctly reach `/dashboard/account`. | Existing routes; missing consistent destination contract | None specific | None | Existing tests do not catch every no-op/semantic misroute | Not ready | P0/P1 |

## Nonfunctional, mock, local-only, and parity findings

### Does nothing

- `components/dashboard/almidy-launch-globe.tsx` passes `onOpenSettings={() => {}}` and `onOpenStats={() => {}}`; the corresponding visible action can be a no-op.
- Several trip `Settings` labels route to the trip overview rather than a Settings destination.
- The native `Account settings` row handler is unreachable because no row with that name exists; the header is the actual entry point.

### Mock, placeholder, or local-only behavior

- Redeem trial only opens local component state and explicitly says activation is coming soon.
- `import_sources` can persist a `connected`-style state without a verified provider connection or inbound-email workflow. This is durable metadata, but functionally behaves like a mocked connection.
- Native Trips Timeline and Travel Book refresh trips and show an informational alert without navigation.
- Most native Settings rows show the same generic alert claiming availability while performing no operation.
- Currency, distance, language, version, and last-sync values are hard-coded.

### Fails to persist or cannot hydrate correctly

- Trial modal state has no backend persistence.
- Currency, distance, language, app icon, widgets, storage, shortcuts, MCP, review, updates, and sharing have no identified preference store.
- `NotificationSettings` can write but has no read path and is unmounted; it cannot reliably rehydrate the persisted value after navigation/restart.
- Native profile name is written to Auth user metadata while web display state also uses `profiles.username`; without an explicit synchronization contract, temporary or persistent parity drift is possible.

### Missing or incomplete APIs

- No inbound reservation-forwarding endpoint/address provisioning was found.
- No notification-preferences GET/hydration route was found.
- No password-reset initiation action is wired to the native Change Password row.
- No billing/trial entitlement, generic user-preferences, force-sync/status, or app-update APIs were found.
- Account deletion captures requests but still depends on an external/operator fulfillment process.

### Hidden or unfinished feature flags

- The mobile wallet Settings experience is controlled by the unified-map/mobile-wallet feature switches in `lib/map/feature-flags.ts`, including `NEXT_PUBLIC_MOBILE_GLOBE_WALLET` and `NEXT_PUBLIC_UNIFIED_MAP_SURFACE`.
- The reservation-forwarding target in `components/imports/imports-page.tsx` is hidden at mobile widths even though the native iPhone route links directly to it.
- Calendar Settings are visibly disabled while the unmounted calendar panel and backend remain in the repository.

### Web/native parity

- **Web only or substantially better on web:** Privacy, Terms, My Trips, My Almidy Book, avatar upload, support email, notification inbox, and account Settings navigation.
- **Native only:** editable Auth display name and coordinated Keychain/WebView sign-out implementation.
- **Present on both but incomplete:** calendar, email reservations, currency, distance, language, notifications preferences, storage/data, help/about, and most future settings.
- **Misleading on native:** unfinished rows appear enabled and use disclosure indicators, then show a generic alert. Web generally disables and labels the same work `Soon`.

## Placeholder and hard-coded behavior search

The scoped search covered `TODO`, `FIXME`, `placeholder`, `mock`, `coming soon`, `Soon`, `disabled`, `unimplemented`, and hard-coded Settings values.

- No actionable `TODO` or `FIXME` marker was found in the core Settings files.
- Explicit `Soon`, `Pro soon`, disabled rows, and “activation is coming soon” text are widespread in the mobile web Settings panel and account page.
- Native incompleteness is mostly not marked with TODO/FIXME; it is encoded as the generic `UIAlertController` fallback in the row-selection handler.
- Hard-coded Settings values include `US Dollar`, `Miles`, `English`, version `1.0.0`, and Last Sync `Never`.
- “Change Password” is presentation-only and does not trigger a reset.
- `CalendarSyncPanel` and `NotificationSettings` are orphaned components: implemented-looking code that is not imported/mounted by a user-facing route.

## Supabase, backend, RLS, storage, environment, and plugin trace

### `profiles` and avatars

- Migration: `supabase/migrations/004_create_profiles.sql`.
- Application paths: `lib/profile.ts`, `components/ProfileAvatar.tsx`, `lib/upload-avatar.ts`.
- RLS: users can insert/update their own profile. The repository policy permits public profile reads, which should be explicitly accepted as a product/privacy decision rather than assumed safe.
- Storage migration: `supabase/migrations/005_create_avatars_bucket.sql`.
- Bucket: public `avatars`.
- Storage policy concern: authenticated inserts are bucket-scoped but not owner/path-scoped. A malicious authenticated client is not constrained to its own path namespace. File size/type checks and obsolete-avatar cleanup were not found in the client path.
- Native parity: no upload plugin or native upload UI.

### Notification preferences

- Migration: `supabase/migrations/007_create_notification_preferences.sql`.
- Table: `notification_preferences` with email/in-app comment and mention booleans.
- RLS: enabled; policy scopes operations to `auth.uid() = user_id`. The trigger initializes preference rows for new auth users.
- API: `POST /api/preferences` authenticates, enforces CSRF and strict input, rejects cross-user mutation, and upserts.
- Gap: no Settings GET/hydration route and no mounted UI. An UPDATE/UPSERT persistence design must retain an allowed SELECT path because PostgreSQL RLS updates need corresponding row visibility.

### Notifications

- Migrations: `supabase/migrations/006_create_notifications.sql` and schema alignment in `032`.
- Table: `notifications`.
- RLS: own-row SELECT/UPDATE/DELETE and constrained insert policies in repository migrations.
- APIs: notification list/update and mark-read route.
- Runtime: Supabase Realtime subscription in the notification bell.

### Account deletion

- Migration: `supabase/migrations/027_create_account_deletion_requests.sql`.
- Table: `account_deletion_requests`.
- RLS/grants: users can select and insert their own requests; direct arbitrary status mutation is not granted.
- API: authenticated, CSRF-protected request creation with duplicate-open-request handling.
- Gap: audit found request intake, not a complete erasure/export/operator lifecycle.

### Import sources and reservation forwarding

- Migration: `supabase/migrations/012_create_import_sources.sql`.
- Table: `import_sources` for `email_forwarding`, `gmail`, `outlook`, and `calendar`-like sources.
- RLS: own-row SELECT/INSERT/UPDATE.
- API/server code: `/api/import-sources`; `lib/server/import-sources.ts`.
- Gap: source flags and timestamps do not establish an OAuth connection, provision a forwarding inbox, or prove ingestion. No dedicated inbound-email storage bucket is involved. Existing Resend configuration elsewhere is outbound email and is not evidence of inbound forwarding.

### Calendar backend — Scope F deferred

- Migrations: `016` creates `calendar_connections`, `calendar_connection_tokens`, `calendar_connection_calendars`, `calendar_sync_jobs`, and `calendar_sync_items`; `017` adds `calendar_oauth_events` and KPI views.
- RLS: users can read their own connection/calendars/jobs/items. Token rows have RLS enabled without user-facing policies and are intended for privileged server access. OAuth events are own-user readable. KPI views are declared with security-invoker behavior and normal-role access is restricted where specified.
- Server routes: connections, OAuth start/callback, sync request, and worker.
- Required server environment variables found in the code contract:
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `CALENDAR_TOKEN_ENCRYPTION_KEY`
  - `CALENDAR_TOKEN_KEY_ID`
  - `CALENDAR_SYNC_WORKER_SECRET`
  - Google client ID, client secret, and redirect URI
  - Microsoft client ID, client secret, redirect URI, and tenant
  - `NEXT_PUBLIC_APP_URL`
- Provider dependencies: Google Calendar API/OAuth and Microsoft Graph/Entra.
- Configuration concern: `lib/server/env.ts` makes calendar variables production-required despite the feature being disabled/deferred. That creates release coupling to an unavailable UI and should be separated when Scope F is deliberately closed.
- Security rule: `SUPABASE_SERVICE_ROLE_KEY` and calendar token secrets are server-only and must never be exposed through `NEXT_PUBLIC_*`, native Info.plist, Capacitor configuration, or a client bundle.

### General Settings persistence gap

No generic user-settings/preferences table was found for currency, distance unit, language, app icon, widgets, storage preferences, force-sync state, shortcuts, MCP, trial, or membership. Expense/budget currency fields are per-record business data and are not a substitute for a user default.

### Native configuration and plugin trace

- Client configuration uses `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` through native build/Info.plist configuration.
- Authentication/session persistence uses Keychain plus a UserDefaults sign-out marker in `NativeSessionCoordinator`.
- Native package resolution contains Capacitor; map plugins are registered in `MainViewController`.
- No EventKit import, `EKEvent` implementation, Apple Calendar Capacitor plugin, calendar plugin registration, or calendar usage-description key was found.
- `docs/native-hybrid-architecture-boundary.md` contains a stale reference to a native EventKit bridge. It does not match the release baseline implementation and must not be treated as authorization to restore EventKit.

## Test coverage assessment

### Web

- `tests/playwright/dashboard-actions.spec.ts` verifies key Settings visibility and destinations.
- `tests/playwright/mobile-ux.spec.ts` covers opening mobile Settings, the local trial sheet, several links/labels, disabled `Soon` controls, Force Sync disabled state, and responsive behavior.
- `tests/playwright/dashboard-settings-actions.spec.ts` covers authentication, CSRF, payload boundaries, and notification read action boundaries.
- `tests/playwright/dashboard-action-contracts.spec.ts` verifies that Settings contracts are routed, disabled, or server-bound. It cannot establish that a semantically wrong destination or placeholder backend is production-complete.
- Calendar tests cover contracts, redirect URIs, worker behavior, and destructive actions; real provider OAuth and mounted Settings UX are not comprehensively exercised.
- Account-deletion request flow has UI and API coverage.
- Missing focused coverage: avatar upload/storage policy, notification preference hydration/restart persistence, inbound email forwarding, billing/entitlements, native/web profile synchronization, and actual Settings-to-database E2E success paths.

### Native

- XCTest coverage exists for native route policy and session coordinator behavior, including sign-out/reconciliation.
- No focused test was found for `NativeSettingsViewController` row actions or enabled/disabled presentation.
- No focused test was found for native display-name update followed by token refresh/restart and web profile parity.
- No native UI automation was found for legal/support WebView handoffs, account deletion, or misleading placeholder rows.
- The release process still requires the physical-iPhone pass with `UIViewAlertForUnsatisfiableConstraints`; this audit does not claim that manual gate has passed.

## Production blockers and risk ranking

### P0 — correct before representing the Settings catalog as production-ready

1. Stop presenting Add Reservations via Email as working until a real inbound flow exists; the current native target is also hidden on mobile.
2. Remove/fix visible no-op Settings callbacks and semantic `Settings` links that route to a non-Settings page.
3. Do not let native generic alerts state that unfinished settings are available. Match web disabled/`Soon` semantics.

### P1 — smallest safe implementation batch

1. **Truthful navigation and parity**
   - Route every Account/Trip Settings entry to one canonical destination.
   - Fix About, Terms, Privacy, Talk to us, My Trips, and Travel Book native/web destinations.
   - Replace unfinished native disclosure rows with disabled rows and `Soon`/`Pro soon` labels.
2. **Notification preference completion boundary**
   - Add an authenticated read/hydration path and mount the existing component only after persistence and rollback behavior are tested.
   - Either expose mention preferences too or explicitly remove them from the first UI contract.
3. **Profile consistency and avatar hardening**
   - Define one display-name source of truth and refresh semantics.
   - Constrain avatar upload policy to an owned path, validate file type/size, and decide whether public profile reads/public avatars are intentional.
4. **Account lifecycle truthfulness**
   - Label deletion as a request, document fulfillment ownership/status, and make Change Password initiate a real reset or disable it.
5. **Real runtime metadata**
   - Source version from the build/package and remove or implement Last Sync/Force Sync rather than showing fabricated values.

This batch should not add calendar providers, billing, native plugins, new dependency versions, or broad schema churn. Any migration should be isolated, reviewed with its RLS policies, and delivered separately from the preserved dependency-security work.

### P2 — second phase

- Implement a narrowly scoped general preferences model for currency and distance first, with authenticated read/update APIs, RLS, defaults, restart tests, and web/native consumers.
- Complete manual reservation importer wording and flows independently of email forwarding.
- Implement share/support/app-update handoffs that require no sensitive backend state.
- Decide membership provider and entitlement source before enabling trial/billing UI.

### P3 — explicit product phases

- Localization/language switching, app icon, widgets, storage controls, shortcuts, custom categories, MCP, review prompts, and full sync controls.
- Calendar providers only after Scope F is explicitly reopened, security configuration is re-reviewed, and the unmounted UI is reconciled with the current product design.

## Phased delivery and release gates

### Phase 0 — contract correction

- Make Settings labels, disabled state, and destinations truthful on both surfaces.
- Add route-level and native controller tests for every currently visible row.
- No schema/provider/plugin changes.

**Gate:** no visible no-op action, no generic “available” alert for unfinished work, and no Settings label routing to a non-Settings destination.

### Phase 1 — account and preferences foundation

- Finish notification preference hydration.
- Unify profile name behavior and harden avatar storage.
- Wire password reset or disable it.
- Define deletion-request operational ownership.

**Gate:** authenticated user changes persist after restart, cannot mutate another user, and have database/API/native tests plus RLS review.

### Phase 2 — low-risk personal preferences

- Add currency and distance preferences with a small, versioned schema.
- Consume the values consistently on web/native.
- Replace hard-coded version/sync metadata.

**Gate:** defaults, migrations, rollback, RLS, offline/restart behavior, and parity tests pass.

### Phase 3 — provider-backed features

- Reservation email forwarding and membership/billing require separate product/security designs.
- Each provider should have an explicit connection state, revoke/delete path, secret boundary, audit log, and E2E test.

**Gate:** no provider is enabled based only on a local or metadata toggle; production secrets remain server-only.

### Phase F — calendar, only if explicitly reopened

- Review the existing web calendar backend and unmounted panel.
- Revalidate OAuth redirect URIs, token encryption/key rotation, worker authentication, RLS, provider revocation, production environment contracts, and tests.
- Native Apple Calendar/EventKit is a separate decision and is not implied by reopening web provider sync.

**Gate:** explicit Scope F approval. Until then, do not add EventKit, Apple Calendar plugins, registration, or calendar usage keys.

## Smallest safe first implementation batch

The recommended first batch is a **Settings truthfulness and navigation patch**, not a new feature launch:

1. Fix the launch-globe no-op and all Settings/About/legal/support/trips/book misroutes.
2. Render unfinished native rows disabled with the same `Soon`/`Pro soon` wording as web.
3. Hide or relabel Add Reservations via Email as unavailable until a genuine inbound flow is approved.
4. Replace hard-coded version/Last Sync presentation with real metadata or remove the rows.
5. Add a compact native Settings row-action test matrix and web route-semantic tests.

This is the smallest batch because it reduces user-trust risk without changing Supabase schema, RLS, secrets, external providers, npm dependencies, Xcode packages, or the release-candidate commit. Notification preferences and avatar policy hardening should follow as a separately reviewed persistence/security batch.

## Explicit non-goals for this audit

- No Settings implementation changes.
- No migration execution or production Supabase mutation.
- No Vercel deployment or environment-variable mutation.
- No commit, rebase, cherry-pick, release-candidate designation, or worktree cleanup.
- No modification of `.gitignore`, `package.json`, `package-lock.json`, or `docs/security/` recovery/security material.
- No EventKit, native Apple Calendar plugin, plugin registration, or calendar usage-description restoration.

## Phase 0 implementation status appendix

**Implementation branch:** `codex/settings-phase-0`
**Baseline:** `a9ffb9a4b4c3d3552c286409ff6a260b16ded862`
**Status:** implemented for review; not merged or deployed.

Phase 0 now establishes canonical web destinations for Account Settings, My Trips,
My Almidy Book, Privacy, Terms, About Almidy, Need Help, and Talk to Us. A real
public `/about` page replaces the former profile-statistics misroute. Trip menus and
launch-globe Settings controls now use the canonical Account Settings route rather
than empty callbacks or trip overview links.

The web and native Settings catalogs now distinguish working actions from deferred
ones. Add Reservations via Email is disabled and marked `Coming soon`; the existing
manual importer remains available under truthful wording. Calendar remains disabled
and marked `Pro soon`. Native placeholder rows no longer display disclosure
indicators or a generic availability alert, and Change Password is explicitly
disabled as `Soon`. Talk to Us composes support email while Need Help retains the
help destination.

Fabricated sync metadata was removed. Web version text comes from `package.json` and
native version text comes from `CFBundleShortVersionString`. No Last Sync or Force
Sync claim remains.

Focused web contract tests now cover canonical route semantics, real metadata, and
the former empty callbacks. Playwright Settings coverage was expanded for every
enabled/disabled web row, and a native Settings row model plus XCTest matrix covers
row availability, disclosure state, and action mapping. Validation details and
environment limitations are recorded in `docs/settings-phase-0-implementation-summary.md`.

This phase did not add migrations, dependencies, providers, calendar behavior,
EventKit, Apple Calendar plugins, plugin registration, or usage-description keys.
The preserved `.gitignore`, dependency manifests/lockfile, and `docs/security/`
material remain outside the implementation commit.

## Phase 2 implementation status appendix

**Implementation branch:** `codex/settings-phase-2`

**Parent:** `86da2f304af0b58e446b22e67524594da1529c51`

**Status:** implemented for staging review; not merged, deployed, or migrated in production.

Phase 2 adds the isolated `user_preferences` model for default currency and distance
unit. The authenticated GET/PATCH contract derives ownership from the session,
returns typed defaults without creating a row, rejects unknown fields, supports
independent partial changes, and uses CSRF protection. Account Settings and the
mobile wallet surface hydrate the same server state; native loads and saves through
that API after session restoration. Failed optimistic web changes roll back, stale
responses cannot replace newer intent, and native never reports success before the
server confirms it.

The default currency is consumed only when a new budget record has no explicit
record currency. Existing money is neither rewritten nor converted. Distance stays
canonical in kilometers and is converted at display boundaries using one shared web
formatter; native preference semantics and allowed values match web. Existing data
is unchanged.

Web version text continues to come from package metadata. Native now reads both
`CFBundleShortVersionString` and `CFBundleVersion`. A build SHA is reserved for
diagnostics and is not exposed in Settings. There is still no reliable product-wide
sync timestamp, so Last Sync and Force Sync remain absent. There is no approved App
Store product identifier, so native App Updates remains disabled with explicit
listing wording and web shows no store action.

Web and native share the canonical `https://almidy.app` URL using platform share
sheets, with a web copy-link fallback and iPad-safe native presentation. Manual
reservation import routes to `/dashboard/imports` under explicit manual wording;
email forwarding remains unavailable and no provider connection is implied.

The Phase 2 migration was not executed. Static RLS validation passes; runtime RLS,
native compilation, and authenticated staging parity must be repeated using
`docs/settings-phase-2-staging-verification.md`. Protected recovery/security
material remains outside this phase.

## Phase 1–2 release-validation status appendix

**Validation branch:** `codex/settings-phase-2-release-validation`

**Parent:** `8c13b23ecd7d9de71cc2d7c2b7c066e2e9324a9f`

**Recommendation:** **HOLD**. No production deploy, merge, or migration is approved.

The validation host identified Node 24.15.0 (the Playwright server contract pins
Node 20.20.2), npm 11.12.1, Playwright 1.60.0 with its lockfile-compatible Chromium
installed, Supabase CLI package 2.111.0 in the npm execution cache, Xcode 26.6,
Swift 6.3.3, and iOS SDK 26.5. Docker and Podman are absent. No disposable/staging
Supabase credentials are configured, so clean migration application and real
two-user RLS/storage tests could not be executed.

Migration review confirms Phase 1
`20260806111021_settings_phase_1_account_security.sql` precedes Phase 2
`20260806140000_create_user_preferences.sql`. Phase 1 depends on the existing public
avatars bucket and policies; it tightens mutation ownership and MIME/size limits
without deleting data. Existing legacy avatar objects remain publicly readable but
cannot be mutated through the new owner-path rules. Phase 2 depends on Auth users,
creates the isolated typed preference table and trigger, and has explicit manual
rollback. No compatibility rewrite or destructive data step is present.

Static TypeScript and nine focused policy/contract tests pass. Runtime gates do not:
Turbopack production build cannot bind an internal worker port under the sandbox;
Webpack remained silent in optimization and was stopped; Playwright cannot bind
localhost; the in-app browser confirms connection refusal; CoreSimulator/CoreDevice
services are unavailable; Swift package resolution cannot write its host cache; and
no physical iPhone can be enumerated. These environment failures are not treated as
application passes. Consequently avatar ownership, preferences, notifications,
profile synchronization, password-reset delivery/redirect, deletion lifecycle,
browser visuals, native compilation/XCTest, restart parity, and physical-device
constraints remain release gates.

No corrective code or migration was added because runtime testing did not reveal a
Phase 0–2 product defect. Full commands, outputs, security review, rerun procedure,
rollout/rollback steps, and the release decision are recorded in
`docs/settings-phase-2-release-validation.md`. Protected recovery/security material
remained untouched and outside validation commits.

Validation was resumed on 2026-08-06 at
`c954cdd972eda6d331d9da898aa7249d67a60cc3`, but the actual host still lacked
Docker/Podman, a disposable Supabase configuration, localhost binding permission,
working CoreSimulator/CoreDevice services, and writable SwiftPM host caches. The
production build, Playwright server, native package resolution, and device discovery
reproduced their prior environment failures. Next route types were regenerated after
the failed build; TypeScript and nine static Phase 1–2 contract tests passed. No
runtime gate changed status, no product defect was proven, no corrective code was
added, and the recommendation remains **HOLD**.
