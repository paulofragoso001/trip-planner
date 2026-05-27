# Wayline Next.js Auth App

This is a Next.js App Router scaffold for Wayline with:

- Supabase Auth
- Cookie-based SSR helpers via `@supabase/ssr`
- Tailwind CSS
- Login page at `/login`
- Signup page at `/signup`
- Email confirmation callback at `/auth/callback`
- Protected dashboard at `/dashboard`
- Supabase `trips` table migration with row-level security
- Auth-protected CRUD API routes for trips
- Responsive dashboard UI for creating, editing, refreshing, and deleting trips

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Fill `.env.local` with values from your Supabase project:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-or-anon-key
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-google-maps-browser-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
RESEND_API_KEY=your-resend-server-api-key
RESEND_FROM_EMAIL="Wayline <updates@your-verified-domain.com>"
CIRIUM_APP_ID=your-cirium-app-id
CIRIUM_APP_KEY=your-cirium-app-key
SUPABASE_SERVICE_ROLE_KEY=your-server-only-service-role-key
FLIGHT_REFRESH_CRON_SECRET=your-random-cron-secret
REDIS_URL=redis://localhost:6379
FLIGHT_REFRESH_CONCURRENCY=5
FLIGHT_REFRESH_LOCK_TTL_MS=120000
FLIGHT_REFRESH_JOB_TTL_SECONDS=3600
FLIGHT_REFRESH_MONITOR_LOCK_TTL_MS=45000
FLIGHT_REFRESH_MONITOR_INTERVAL_MS=30000
```

The Google Maps key should be a browser key with Maps JavaScript API and Places
API enabled. Restrict it in Google Cloud Console with:

- Application restriction: Websites / HTTP referrers.
- Website referrers: production domain, preview/staging domain, and localhost
  only if that key is also used for local development.
- API restrictions: Maps JavaScript API and Places API.

Confirm the Google Cloud project has billing enabled, budget alerts configured,
and quota limits reviewed before using the production key.
Cirium and Supabase service-role credentials must stay server-only and must not use
the `NEXT_PUBLIC_` prefix.

Resend production email requires a verified sending domain and a server-only
`RESEND_API_KEY`. Set `RESEND_FROM_EMAIL` to an address on that verified domain;
do not use the Resend onboarding sender outside local testing. Trip sharing
invites are emailed after collaborator/invite rows are saved. Calendar sync
failures create dashboard notifications for the affected user so worker errors
are visible without blocking retries.

Production startup validates the auth/security-critical env boundary. Production
will fail fast if dashboard bypass flags are enabled, required Supabase/calendar
secrets are missing, or a known server secret value is exposed through a
`NEXT_PUBLIC_*` variable.

Before production deploys, run `npm run preflight:prod-env`. See
`docs/ops/production-env-runbook.md` for the full checklist.

## Protected Write-Path Tests

The Playwright imports write-path spec uses `x-cypress-dashboard` to exercise
authenticated dashboard writes without a browser login. This bypass is ignored
unless `ALLOW_TEST_DASHBOARD_BYPASS=true` is set, and it is never active in
production. It only runs assertions when `SUPABASE_SERVICE_ROLE_KEY` is present
in the test process and the backend preflight returns `200`; otherwise it skips
with a clear reason.

Keep `SUPABASE_SERVICE_ROLE_KEY` in protected CI secrets or a local test-only
environment. Do not expose it through `NEXT_PUBLIC_*` variables or browser code.
The dashboard smoke workflow injects it only into the dedicated imports write
job, not the general dashboard smoke job.

To verify import parse audit-table and view isolation against Supabase RLS, run:

```bash
npm run audit:import-parse-rls
```

The audit creates temporary users and a uniquely tagged parse event, checks anon,
different-user, and owner visibility for the base table and import parse views,
then deletes its fixtures.

For local Playwright dashboard routes, run with:

```bash
ALLOW_TEST_DASHBOARD_BYPASS=true npx playwright test tests/playwright/dashboard.smoke.spec.ts --workers=1
```

Run the trip database migration in Supabase SQL editor or through the Supabase CLI:

```bash
supabase/migrations/001_create_trips.sql
```

## Trip API

- `GET /api/trips` lists the signed-in user's trips.
- `POST /api/trips` creates a trip.
- `GET /api/trips/:id` reads one trip.
- `PATCH /api/trips/:id` updates one trip.
- `DELETE /api/trips/:id` deletes one trip.

The `trips` table is protected with RLS policies, so each user only sees and changes records where `user_id` matches their Supabase auth user.

## Itinerary Maps

Trip itinerary JSON items can include coordinates using any of these shapes:

```json
{
  "title": "Hotel check-in",
  "date": "2026-05-10",
  "time": "15:00",
  "latitude": 35.6812,
  "longitude": 139.7671
}
```

```json
{
  "name": "Dinner reservation",
  "location": {
    "lat": 35.6655,
    "lng": 139.7707
  }
}
```

Items with valid coordinates are plotted as numbered Google Maps markers and connected with a route line.

Supabase’s current Next.js guidance recommends `@supabase/ssr`, a browser client, a server client, and a proxy to refresh cookie sessions.

## Flight Truth Worker

`GET` or `POST /api/jobs/refresh-flight-statuses` refreshes near-term,
unresolved flight itinerary items from Cirium and stores normalized truth back
onto `itinerary_items`. It also records changed status, gate, terminal, and
schedule values in `flight_truth_events`.

Call it from a scheduler with either header:

```bash
Authorization: Bearer $FLIGHT_REFRESH_CRON_SECRET
```

or:

```bash
x-cron-secret: $FLIGHT_REFRESH_CRON_SECRET
```

Optional query param: `limit=40`. The route uses the Supabase service role on
the server, scans only active near-term flights, and never exposes Cirium keys
to the browser.

## Durable Flight Refresh Queue

For targeted refreshes, `POST /api/jobs/flight-refresh` enqueues a single
BullMQ job. It uses the same cron secret headers as the polling worker and
requires:

```json
{
  "tripId": "trip-id",
  "itemId": "itinerary-item-id",
  "carrier": "AA",
  "flightNumber": "100",
  "year": 2026,
  "month": 5,
  "day": 7,
  "userId": "owner-user-id"
}
```

The queue layer lives in `lib/flight-refresh-queue.ts`, Redis connection setup
lives in `lib/redis.ts`, and the standalone processor lives in
`workers/flight-refresh.worker.ts`. The worker uses a Redis `SET ... NX PX`
lock per trip item so two workers do not refresh the same flight at once.

Install the worker dependencies in production or CI before enabling this path:

```bash
npm install bullmq ioredis
```

`workers/monitor.worker.ts` monitors the `flight-refresh` queue from a
long-lived Node worker process. It uses a Redis `SET ... NX PX` leader lock,
writes health snapshots to `monitor:health:flight-refresh`, and records repeated
failures in `monitor:dead-letter`.

`GET /api/health` reads that health snapshot, or performs one on-demand check,
and returns `200` for healthy or `503` for degraded/unhealthy. Do not call
`startFlightRefreshMonitor()` from a serverless route handler; keep the timer in
the separate worker process.

`GET /api/metrics` exposes Prometheus text metrics for the flight refresh
process, including job totals, job duration buckets, queue depth gauges, stalled
job counts, retry counts, and queue health. If the web app and worker run as
separate processes, scrape both processes independently or forward worker
metrics to a shared scrape target; process-local counters will not magically
merge across runtimes.
