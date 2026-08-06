# Settings Phase 1 implementation summary

## Revision

- Branch: `codex/settings-phase-1`
- Parent commit: `9261275866147a87095fc8bad35f547458f9ae88`
- Production baseline preserved: `a9ffb9a4b4c3d3552c286409ff6a260b16ded862`
- Final Phase 1 implementation commit SHA: `a37f340451b190c612e1e09fbb62a56a679a3296`
- Documentation finalization: the commit containing this summary is the branch HEAD; the implementation SHA above is immutable and contains all runtime, migration, test, audit-status, and operations changes.

## Implementation

Phase 1 adds authenticated `GET/POST /api/preferences`, `GET/POST /api/account/profile`, `POST /api/account/avatar`, `POST /api/account/password-reset`, and `GET/POST /api/account/deletion-request`. All ownership comes from the authenticated session. Mutation bodies are strict and CSRF-protected. Shared TypeScript contracts define notification fields/defaults, profile normalization, and deletion status semantics.

Account Settings mounts profile editing, password-reset initiation, and fully hydrated email/in-app comment/mention preferences. Preference updates use versioned optimistic state: the latest failed intent rolls back and stale responses cannot overwrite newer intent. `profiles.username` is canonical; Auth `full_name` is a synchronized cache. A failed metadata synchronization returns `202` with `metadata_reconciliation_required` while preserving the canonical profile update. Existing mismatches resolve to `profiles.username`; no production-wide reconciliation is run.

Avatar upload is server-mediated, limited to validated JPEG/PNG/WebP files up to 5 MiB, verifies magic bytes, rejects SVG/HEIC/empty/malformed files, generates UUID paths, confirms upload existence, updates the profile, removes the new object on profile failure, and deletes only a prior URL proven to be owned in the same bucket/path. Avatars remain publicly readable because they appear on public/collaborative profile surfaces. Native avatar upload remains unavailable without adding a media dependency.

Password reset uses only the authenticated account email and redirects to `/auth/reset-password` on the configured production origin. Success wording does not promise delivery; provider and rate-limit failures are sanitized. Native calls the same backend contract and states that completion opens the web flow.

Deletion remains a request. The API exposes the latest owned status, prevents duplicate `requested`/`in_review` requests, and the UI clarifies review, follow-up, non-immediate deletion, and completion. The operator lifecycle is in `docs/account-deletion-operations.md`.

## Database, RLS, and storage

The isolated migration `supabase/migrations/20260806111021_settings_phase_1_account_security.sql` is not executed. It retains the public avatars bucket/read behavior, adds bucket-level 5 MiB and MIME restrictions, replaces the bucket-only insert policy, and adds authenticated exact-prefix INSERT/UPDATE/DELETE policies. Paths require one owner folder matching `auth.uid()` and a server-shaped UUID filename. Rollback guidance is embedded in the migration.

## Security review

No user ID or reset target email is accepted from clients. No service-role credential was added to client/native code or a `NEXT_PUBLIC_*` variable. Storage ownership is policy-enforced. API errors avoid raw database/provider details. Logs do not add tokens, reset links, signed URLs, or user metadata. Native and web use the same profile/password semantics.

## Files changed

Changed files:

- API/routes: `app/api/account/avatar/route.ts`, `app/api/account/deletion-request/route.ts`, `app/api/account/password-reset/route.ts`, `app/api/account/profile/route.ts`, `app/api/preferences/route.ts`, `app/auth/reset-password/page.tsx`
- Web UI: `app/dashboard/account/page.tsx`, `app/dashboard/layout.tsx`, `components/NotificationSettings.tsx`, `components/ProfileAvatar.tsx`, `components/account/account-deletion-request-form.tsx`, `components/account/password-reset-button.tsx`, `components/account/profile-settings-form.tsx`, `components/account/reset-password-form.tsx`
- Shared/server logic: `lib/account/contracts.ts`, `lib/avatar.ts`, `lib/profile.ts`, `lib/server/dashboard-test-auth.ts`, `lib/upload-avatar.ts`
- Native: `ios/App/App/MainViewController.swift`, `ios/App/App/NativeMapPlugin.swift`, `ios/App/App/NativeSettingsModel.swift`, `ios/App/AppTests/NativeMapConnectivityTests.swift`, `ios/App/AppTests/NativeSettingsTests.swift`
- Database/tests/docs: `supabase/migrations/20260806111021_settings_phase_1_account_security.sql`, `tests/playwright/settings-phase-1.spec.ts`, `tests/unit/settings-phase-1-contracts.test.mjs`, `docs/account-deletion-operations.md`, `docs/settings-production-audit.md`, `docs/settings-phase-1-implementation-summary.md`

## Validation record

Passed:

- `node --test tests/unit/settings-phase-1-contracts.test.mjs`
- `./node_modules/.bin/tsc --noEmit`
- `npm run build` (after moving a stale generated `.next/lock` to `/private/tmp/almidy-next-build-lock-stale-20260806`)
- `ALLOW_TEST_DASHBOARD_BYPASS=true npx playwright test tests/playwright/settings-phase-1.spec.ts tests/playwright/dashboard-settings-actions.spec.ts tests/playwright/dashboard-destructive-actions.spec.ts tests/playwright/native-map-sync-contract.spec.ts --workers=1`
- `xcodebuild -project ios/App/App.xcodeproj -scheme App -destination 'platform=iOS Simulator,id=4F2E19F4-0C72-476F-A279-7DB47F38BDDC' -only-testing:AppTests/NativeSettingsTests -only-testing:AppTests/NativeSessionCoordinatorTests -only-testing:AppTests/NativeMapConnectivityTests test`
- `git diff --check -- . ':(exclude).gitignore' ':(exclude)package.json' ':(exclude)package-lock.json' ':(exclude)docs/security/**'`

Static policy validation passed through the focused Node contract suite. Local Supabase runtime/RLS integration was environment-blocked: `npx supabase status` returned `docker: command not found (podman also not found)`. No migration was applied. Browser verification through the `agent-browser` skill was environment-blocked because the `agent-browser` executable is not installed; the Playwright browser/UI suite passed instead. Formatting and lint were skipped because this repository exposes neither a formatting/lint script nor local Prettier/ESLint executable; dependencies were not added. No failed validation remains. Manual browser interaction is represented by the Playwright hydration, remount, rapid-toggle, rollback, profile persistence, lifecycle wording, and native-route tests; no physical-device or real email-delivery test was performed.

## Production migration and deployment

1. Back up and review current `avatars` bucket configuration and `storage.objects` policies.
2. Confirm `NEXT_PUBLIC_APP_URL` is the HTTPS production origin and `/auth/reset-password` is allow-listed in Supabase Auth redirect URLs/email templates.
3. Apply the isolated migration in staging, never by editing an old migration. Verify existing public avatar URLs remain readable, new own-path writes work, and cross-user writes fail.
4. Deploy the application to staging and run authenticated web/native parity, reset-email, persistence/restart, and avatar replacement tests with two real users.
5. Apply the reviewed migration and application release through the normal production change process, then monitor sanitized API/storage errors. This Phase 1 task performs none of these production actions.

## Rollback

Revert the focused application commit. For the database, use the migration's manual rollback guidance: drop the three owned-avatar mutation policies, restore the prior bucket-scoped INSERT policy only if the security rollback is explicitly accepted, and clear bucket MIME/size restrictions as required. Keep the public SELECT policy so existing avatars remain readable. Do not delete existing objects during rollback.

## Remaining risks

- Local/mocked coverage cannot prove production Auth email delivery or deployed redirect allow-list configuration.
- Existing root-level legacy avatar objects remain readable and are not automatically moved or deleted.
- Auth metadata synchronization can require a later authenticated reconciliation after partial failure; the canonical profile value remains correct.
- Native avatar upload remains intentionally unavailable.
- Account deletion fulfillment remains an operator process and needs organization-specific retention/legal approval.

## Protected material

Pre-existing changes to `.gitignore`, `package.json`, `package-lock.json`, and `docs/security/` remain untouched and are excluded from staging and the Phase 1 commit. No dependency upgrade was performed.
