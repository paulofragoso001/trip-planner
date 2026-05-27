# Wayline Dashboard App Router Map

This document describes the implemented dashboard route split and the remaining
cleanup direction. Keep route entries thin, keep reusable feature UI in
`components/`, and keep action state in `hooks/use-wayline-action.ts`.

## Current implemented structure

```txt
app/
  dashboard/
    layout.tsx
    page.tsx
    trips/
      page.tsx
      [tripId]/
        layout.tsx
        page.tsx
        budget/page.tsx
        map/page.tsx
        sharing/page.tsx
        timeline/page.tsx
    imports/page.tsx
    admin/page.tsx
    api-transition/page.tsx
    layout-simulator/page.tsx
  api/
    admin/
      jobs/route.ts
      sync/route.ts
    calendar/
      connections/route.ts
      oauth/[provider]/route.ts
      oauth/[provider]/callback/route.ts
      sync/route.ts
      worker/route.ts
    import-sources/route.ts
    itinerary/
      flight-status/route.ts
      reorder/route.ts
      route.ts
    trips/
      route.ts
      [id]/
        route.ts
        share/route.ts
    unfiled-items/
      route.ts
      [id]/route.ts
components/
  admin/
    admin-page.tsx
  dashboard/
    async-action-button.tsx
    dashboard-page.tsx
    router-refresh-button.tsx
    trip-create-form.tsx
    trips-page.tsx
  imports/
    imports-page.tsx
  trip/
    connected-trip-map.tsx
    invite-collaborator-form.tsx
    map-tools.tsx
    share-trip-button.tsx
    trip-budget-page.tsx
    trip-map-page.tsx
    trip-overview-page.tsx
    trip-sharing-page.tsx
    trip-tabs.tsx
    trip-timeline-page.tsx
hooks/
  use-wayline-action.ts
lib/
  calendar/
    event-mapping.ts
    sync-manager.ts
    types.ts
    providers/
      google-calendar.ts
      outlook-calendar.ts
  server/
    calendar-sync.ts
    calendar-oauth.ts
    calendar-token-encryption.ts
    calendar-token-refresh.ts
supabase/
  migrations/
    016_create_calendar_sync.sql
```

## Route-to-component map

| Area | Route | Component |
| --- | --- | --- |
| Dashboard summary | `app/dashboard/page.tsx` | `components/dashboard/dashboard-page.tsx` |
| Trip database | `app/dashboard/trips/page.tsx` | `components/dashboard/trips-page.tsx` |
| Trip workspace shell | `app/dashboard/trips/[tripId]/layout.tsx` | `components/trip/share-trip-button.tsx`, `components/trip/trip-tabs.tsx` |
| Trip overview | `app/dashboard/trips/[tripId]/page.tsx` | `components/trip/trip-overview-page.tsx` |
| Timeline | `app/dashboard/trips/[tripId]/timeline/page.tsx` | `components/trip/trip-timeline-page.tsx` |
| Map | `app/dashboard/trips/[tripId]/map/page.tsx` | `components/trip/trip-map-page.tsx` |
| Budget | `app/dashboard/trips/[tripId]/budget/page.tsx` | `components/trip/trip-budget-page.tsx` |
| Sharing | `app/dashboard/trips/[tripId]/sharing/page.tsx` | `components/trip/trip-sharing-page.tsx` |
| Imports | `app/dashboard/imports/page.tsx` | `components/imports/imports-page.tsx` |
| Admin tools | `app/dashboard/admin/page.tsx` | `components/admin/admin-page.tsx` |

## Action wiring

Use `hooks/use-wayline-action.ts` for client-side mutation state:

- `idle`
- `loading`
- `success`
- `error`
- `timeout`

Use `components/dashboard/async-action-button.tsx` for simple button-triggered
API calls. It centralizes disabled state, loading labels, success/error/timeout
feedback, and route refresh behavior.

Current action-backed surfaces:

| Surface | Action target |
| --- | --- |
| Trip create form | `POST /api/trips` |
| Trip share button | `POST /api/trips/[id]/share` |
| Sharing invite form | `POST /api/trips/[id]/share` |
| Import source toggle | `PATCH /api/import-sources` |
| Unfiled item creation | `POST /api/unfiled-items` |
| Timeline reorder | `POST /api/itinerary/reorder` |
| Flight status refresh | `POST /api/itinerary/flight-status` |
| Calendar sync | `POST /api/calendar/sync` |
| Admin sync health | `POST /api/admin/sync` |
| Admin job status/run request | `POST /api/admin/jobs` |

Do not create parallel `*-with-action.tsx` copies. Fold generated action
behavior into the canonical component files above.

## API route map

| Endpoint | Purpose |
| --- | --- |
| `POST /api/trips` | Create trips |
| `POST /api/trips/[id]/share` | Create or update trip share/invite state |
| `PATCH /api/import-sources` | Toggle import source connection state |
| `POST /api/unfiled-items` | Create unfiled itinerary/import items |
| `POST /api/itinerary/reorder` | Reorder trip itinerary items |
| `POST /api/itinerary/flight-status` | Refresh one flight itinerary item |
| `GET /api/calendar/oauth/[provider]` | Build Google or Outlook Calendar OAuth authorization URL |
| `GET /api/calendar/oauth/[provider]/callback` | Exchange provider OAuth code and store encrypted server-side tokens |
| `GET /api/calendar/connections` | List the signed-in user's connected calendar accounts |
| `DELETE /api/calendar/connections` | Mark a signed-in user's provider connection revoked and clear encrypted tokens |
| `POST /api/calendar/sync` | Stage one-way trip calendar sync work |
| `POST /api/calendar/worker` | Protected backend worker entrypoint for queued calendar sync jobs |
| `GET/POST /api/admin/sync` | Admin sync/diagnostic health wrapper |
| `GET/POST /api/admin/jobs` | Admin job status and protected job-control wrapper |

`/api/admin/sync` intentionally returns a canonical degraded health response
when optional infrastructure such as Redis is not configured locally.
`/api/admin/jobs` intentionally does not execute protected background jobs
without cron/admin authorization.

Calendar sync is intentionally one-way first. The current implementation adds
the storage model, normalized event mapping, provider adapters, and action/API
wiring. It stages provider event payloads and returns explicit "not connected
yet" responses until OAuth token exchange and encrypted token storage are wired.

Calendar persistence:

| Table | Purpose |
| --- | --- |
| `calendar_connections` | One active provider account per user/provider with token family/version state, rotation lock fields, granted scopes, default calendar metadata, provider cursor, and reconnect status. |
| `calendar_connection_tokens` | Versioned encrypted access/refresh token rows with one current token per connection, rotation lineage, revocation, and reuse detection timestamps. |
| `calendar_connection_calendars` | Optional selectable calendar inventory for each provider connection. |
| `calendar_sync_jobs` | Idempotent worker queue with `queued`, `running`, `succeeded`, `failed`, `retry_wait`, and `blocked` states plus lock/backoff/result fields. |
| `calendar_sync_items` | Per Wayline itinerary item or trip segment mapping to one provider event. |

Token columns are server-only. Authenticated users can read their own connection
and sync status rows through RLS, while mutation paths should run from Route
Handlers or workers with service-role access. `/api/calendar/sync` authenticates
the user with the SSR client, then uses the server admin client when available
to stage sync item rows.

Calendar token handling:

- OAuth callbacks require `SUPABASE_SERVICE_ROLE_KEY` and
  `CALENDAR_TOKEN_ENCRYPTION_KEY` before provider tokens are stored.
- Access and refresh tokens are stored only in `calendar_connection_tokens` and
  encrypted with server-only AES-GCM helpers.
- Refresh token rotation increments `current_token_version`, replaces the
  current token row, links `rotated_from_token_id`, and uses
  `token_rotation_locked_at` / `token_rotation_lock_owner` to prevent parallel
  refreshes for the same connection.
- Refresh failures mark the connection `needs_reauth`; `invalid_grant` marks
  the current token with `reuse_detected_at` and `revoked_at`.
- The worker endpoint requires `CALENDAR_SYNC_WORKER_SECRET`, falling back to
  `FLIGHT_REFRESH_CRON_SECRET` only for local/deployment convenience.
- Worker job claims use the `claim_calendar_sync_job` Postgres function, which
  updates one eligible job with `FOR UPDATE SKIP LOCKED` semantics.
- Provider execution remains gated until the worker is connected to decrypted
  token rows and real adapter execution.

Calendar event mapping:

| Wayline field | Google Calendar | Microsoft Graph |
| --- | --- | --- |
| `title` | `summary` | `subject` |
| `location` | `location` | `location.displayName` |
| `notes` / generated source note | `description` | `body.content` |
| `startAt` | `start.dateTime` | `start.dateTime` |
| `endAt` | `end.dateTime` | `end.dateTime` |
| `timeZone` | `start.timeZone`, `end.timeZone` | `start.timeZone`, `end.timeZone` |
| `sourceId` / `sourceType` | `extendedProperties.private` | open extension payload |

Wayline identity metadata:

| Field | Purpose |
| --- | --- |
| `waylineTripId` | Scopes external events to a Wayline trip. |
| `waylineSegmentId` | Deterministic external lookup key for the Wayline segment. |
| `waylineSyncVersion` | Last Wayline content version written to the provider. |
| `waylineSource` | Identifies Wayline-owned metadata. |
| `waylineUpdatedAt` | Timestamp used for conflict review and stale-write decisions. |

Google Calendar stores these values in `extendedProperties.private` and can
resolve events by `waylineTripId` + `waylineSegmentId`. Outlook stores the same
Wayline values in an open extension payload, while lookup-by-extension remains
optional until Graph extension querying is wired.

Calendar update rules:

- Create one provider event per Wayline segment.
- Persist `connection_id`, `provider_calendar_id`, `provider_event_id`,
-  `provider_event_etag`, `source_type`, `source_id`, `wayline_sync_version`,
  and `wayline_updated_at`.
- Update the same provider event when the Wayline segment changes.
- Delete the matching provider event only for synced segments and only when the
  user has calendar sync enabled.
- Mark local sync rows `pending`, `stale`, or `error` when provider calls cannot
  complete.
- Mark a local row stale when provider metadata is missing, the provider event
  disappeared, or the provider event changed after the last Wayline sync.
- Keep two-way edits out of scope until one-way create/update/delete is stable.

## Cleanup priority

1. Keep `page.tsx` files thin and route-specific.
2. Keep reusable feature UI in `components/`.
3. Keep mutations in API routes or server actions.
4. Keep action loading/success/error/timeout behavior in
   `hooks/use-wayline-action.ts`.
5. Avoid duplicate scratch files or alternate component copies inside app and
   route-adjacent component folders.

## Historical target structure

The section below is the original target plan. It remains useful for context,
but the implemented tree above is the current source of truth.

## Target structure

```txt
app/
  (dashboard)/
    layout.tsx
    dashboard/
      page.tsx
      trips/
        page.tsx
        [tripId]/
          layout.tsx
          page.tsx
          timeline/page.tsx
          map/page.tsx
          budget/page.tsx
          sharing/page.tsx
      imports/page.tsx
      admin/page.tsx
  (auth)/
    layout.tsx
    login/page.tsx
    signup/page.tsx
components/
  dashboard/
    dashboard-shell.tsx
    dashboard-sidebar.tsx
    dashboard-topbar.tsx
    dashboard-tabs.tsx
    dashboard-kpis.tsx
  trip/
    trip-shell.tsx
    trip-header.tsx
    trip-tabs.tsx
    trip-overview.tsx
    trip-timeline.tsx
    trip-map.tsx
    trip-budget.tsx
    trip-sharing.tsx
    trip-activity.tsx
  imports/
    import-queue.tsx
    import-sources-panel.tsx
    unfiled-items-list.tsx
  admin/
    backend-tools-panel.tsx
    api-debug-panel.tsx
lib/
  trips.ts
  itinerary.ts
  imports.ts
  permissions.ts
  dashboard-state.ts
hooks/
  useDashboardTabs.ts
  useTripWorkspace.ts
  useImportSources.ts
  useUnfiledItems.ts
  useTripPresence.ts
app/api/
  trips/route.ts
  trips/[tripId]/route.ts
  trips/[tripId]/share/route.ts
  itinerary/route.ts
  itinerary/reorder/route.ts
  itinerary/flight-status/route.ts
  import-sources/route.ts
  unfiled-items/route.ts
  unfiled-items/[itemId]/route.ts
  admin/
    sync/route.ts
    jobs/route.ts
```

## File-by-file refactor

### 1) `app/(dashboard)/layout.tsx`
- Keep the dashboard chrome here.
- Render `DashboardShell` once.
- Add route-aware navigation.
- Hide auth-only or backend-only actions from this layout.

### 2) `app/(dashboard)/dashboard/page.tsx`
- Convert the current all-in-one dashboard into a summary page.
- Show metrics, recent trips, active imports, and quick links only.
- Remove heavy edit forms and operational panels from this page.

### 3) `app/(dashboard)/dashboard/trips/page.tsx`
- Move trip CRUD here.
- Keep create/edit trip form.
- Keep trip list, search, filtering, and selection.
- This page becomes the main trip database.

### 4) `app/(dashboard)/dashboard/trips/[tripId]/layout.tsx`
- Add a trip workspace layout.
- Load selected trip data once.
- Provide trip context to child pages.
- Keep header and tabs consistent across all trip subpages.

### 5) `app/(dashboard)/dashboard/trips/[tripId]/page.tsx`
- Make this the overview route.
- Show trip summary, important dates, budget snapshot, and next actions.
- Avoid showing full backend import mechanics here.

### 6) `app/(dashboard)/dashboard/trips/[tripId]/timeline/page.tsx`
- Move itinerary editing here.
- Keep drag reorder, item editing, flight refresh, and day grouping.
- Hide API debug output.

### 7) `app/(dashboard)/dashboard/trips/[tripId]/map/page.tsx`
- Put map visualization and pin editing here.
- Show linked itinerary items, comments, and route context.
- Keep map controls user-friendly and not admin-heavy.

### 8) `app/(dashboard)/dashboard/trips/[tripId]/budget/page.tsx`
- Add budget totals, category breakdowns, receipt links, and overspend alerts.
- This should be traveler-facing.
- Hide raw financial backend plumbing.

### 9) `app/(dashboard)/dashboard/trips/[tripId]/sharing/page.tsx`
- Put collaborator permissions, invites, and share controls here.
- Show active members and access levels.
- Keep backend permission internals out of the UI.

### 10) `app/(dashboard)/dashboard/imports/page.tsx`
- Move import sources and unfiled items here.
- Show source connection cards and review queue.
- Keep this page operational but still user-facing.
- Collapse parser details behind expandable rows.

### 11) `app/(dashboard)/dashboard/admin/page.tsx`
- Move flight refresh jobs, sync health, parser logs, and integration diagnostics here.
- Hide this route behind admin permissions.
- This is where backend-only controls belong.

## Component migration

### Replace current monolith pieces
- `TripDashboard` -> split into `DashboardSummaryPage`, `TripListPage`, `TripWorkspacePage`, `ImportsPage`, `AdminPage`.
- `TripList` -> move to `components/dashboard/trip-list.tsx`.
- `SelectedTripPreview` -> split into `TripOverview`, `TripTimeline`, `TripMap`, `TripBudget`, `TripSharing`.
- `ImportQueue` -> split into `ImportSourcesPanel` and `UnfiledItemsList`.

### New shared components
- `DashboardSidebar` with route-aware links.
- `DashboardTopbar` with breadcrumbs and search.
- `DashboardTabs` with route links, not local state.
- `TripShell` with header and tabs.
- `TripPresenceBadge` for collaboration status.

## Backend split

### Keep in public app routes
- Trip CRUD.
- Timeline edits.
- Map pin edits.
- Budget summaries.
- Sharing and invites.
- Import review and promotion.

### Move behind admin/internal routes
- Sync health.
- Flight-status refresh internals.
- Parse confidence debugging.
- Source connector diagnostics.
- Raw provider responses.
- Background job controls.

## Menu tab wiring
- Use `next/link` for tabs that represent pages.
- Use `usePathname()` only to highlight active state.
- Remove tab-local state for route-based navigation.
- Add `aria-current="page"` on the active tab link.

## Data flow
- Fetch trip lists in `dashboard/trips/page.tsx`.
- Fetch a single trip in `trip/[tripId]/layout.tsx` or `page.tsx`.
- Fetch itinerary, map pins, budget, and sharing data in feature pages.
- Fetch imports only in `imports/page.tsx`.
- Fetch sync/admin info only in `admin/page.tsx`.

## Build order
1. Add route groups and layouts.
2. Split dashboard summary from trip workspace.
3. Convert tabs to route links.
4. Move imports into a separate page.
5. Create admin-only backend page.
6. Break trip workspace into overview, timeline, map, budget, and sharing pages.
7. Clean up shared components and hooks.
