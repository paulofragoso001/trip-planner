# Settings Phase 1 and Phase 2 staging verification

This checklist is for an isolated staging Supabase project and staging application.
It must not be run against production as part of Phase 2.

## Preparation

1. Back up the staging database and inventory the current `avatars` bucket settings,
   storage policies, and representative legacy/public avatar URLs.
2. Confirm the checked-out release contains Phase 1 migration
   `20260806111021_settings_phase_1_account_security.sql` followed by Phase 2
   `20260806140000_create_user_preferences.sql`.
3. Use two ordinary authenticated staging accounts. Do not use service-role access
   for ownership tests. Record their UUIDs without placing tokens in logs.
4. Apply migrations to staging through the normal reviewed migration workflow. Do
   not paste secrets, reset links, storage signatures, or access tokens into output.

## Phase 1 avatar policy runtime checks

- Confirm the `avatars` bucket remains public and existing public URLs still read.
- Upload valid JPEG, PNG, and WebP files at or below 5 MiB into the signed-in user's
  exact `<user-id>/<uuid>.<approved-extension>` path.
- Confirm empty, SVG, HEIC, malformed-magic, disallowed MIME, oversized, root-level,
  nested, path-trick, and other-user uploads fail.
- Confirm own-path update/delete succeeds and another user's update/delete fails.
- Exercise replacement: verify the new object, profile update, old owned-object
  cleanup, profile-failure preservation, and external/default URL preservation.

## Phase 2 preference runtime checks

- Verify RLS is enabled and only `authenticated` has SELECT/INSERT/UPDATE grants.
- With account A, verify no-row GET returns USD/miles defaults without exposing B.
- Insert A's own row and confirm owner, timestamps, constraints, and defaults.
- Confirm A cannot select, insert, or update B's row or assign B's `user_id`.
- Confirm anonymous requests fail and invalid currency/distance values fail at both
  API validation and database constraints.
- PATCH currency alone, then distance alone; confirm the untouched field remains.
- Send concurrent changes and confirm the final stored value matches latest intent.
- Restart/reload web and native clients and confirm the same persisted values.
- Create a budget item without an explicit currency and confirm it uses the stored
  default; create one with an explicit supported currency and confirm it wins.
- Confirm existing expenses are unchanged and no conversion claim appears.
- Confirm displayed distances use the selected unit while canonical stored distance
  values remain unchanged.

## Platform and handoff checks

- Confirm web and native show the same currency/distance labels and allowed values.
- Confirm native expired-session recovery and offline errors do not show a false save.
- Confirm web version comes from package metadata and native renders
  `Version <short-version> (<build>)` from bundle metadata.
- Confirm no Last Sync/Force Sync appears.
- Confirm web share sheet and copy fallback use `https://almidy.app`; confirm native
  share works on phone and iPad without a popover crash.
- Confirm native App Updates is disabled until an approved App Store URL exists and
  web has no store-update row.
- Confirm manual import opens `/dashboard/imports`, while email forwarding remains
  disabled/absent and no connection is inferred from `import_sources` metadata.

## Rollback and evidence

Roll back the application before schema rollback. For Phase 2, drop the preference
trigger, function, and table using the commands embedded in its migration. For Phase
1, follow that migration's policy/bucket rollback guidance; preserve public reads and
objects, and do not delete user avatars during rollback. Retain sanitized test output,
policy listings, migration versions, and sign-off. Repeat focused API, Playwright,
native XCTest/build, and cross-account RLS checks before production approval.
