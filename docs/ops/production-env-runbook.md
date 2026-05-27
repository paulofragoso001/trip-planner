# Production Env Runbook

Run this check before production deploys:

```bash
npm run preflight:prod-env
npm run audit:compliance
```

In GitHub Actions, run the `production-env-preflight` workflow against the
protected `production` environment before release.

The preflight fails when:

- `ALLOW_LOCAL_DASHBOARD_BYPASS` is `true` or `1`.
- `ALLOW_TEST_DASHBOARD_BYPASS` is `true` or `1`.
- required Supabase, calendar, maps, worker, and email env vars are missing.
- production app and OAuth callback URLs are not HTTPS.
- Google or Microsoft callback URLs do not match the production app origin and
  callback paths.
- a known server secret value is duplicated into a `NEXT_PUBLIC_*` env var.

The compliance audit fails when:

- a browser-exposed `NEXT_PUBLIC_*` env var appears to contain a server secret.
- a known server secret value is duplicated into a `NEXT_PUBLIC_*` env var.
- a public table created in local migrations does not enable RLS.
- a public table has RLS but no policy and is not explicitly service-only.
- a non-allowlisted policy uses broad `USING (true)` or `WITH CHECK (true)`.
- Privacy Policy or Terms content is missing required trust sections or has not
  been reviewed within `LEGAL_MAX_AGE_DAYS` days. The default is 180 days.

Required production env vars:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
- `NEXT_PUBLIC_APP_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CALENDAR_TOKEN_ENCRYPTION_KEY`
- `CALENDAR_SYNC_WORKER_SECRET`
- `GOOGLE_CALENDAR_CLIENT_ID`
- `GOOGLE_CALENDAR_CLIENT_SECRET`
- `GOOGLE_CALENDAR_REDIRECT_URI`
- `MICROSOFT_CALENDAR_CLIENT_ID`
- `MICROSOFT_CALENDAR_CLIENT_SECRET`
- `MICROSOFT_CALENDAR_REDIRECT_URI`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`

Server-only values must never use the `NEXT_PUBLIC_` prefix. Keep service-role
keys, token encryption keys, and OAuth client secrets only in protected hosting
or CI secret storage.

Required production URL shape:

- `NEXT_PUBLIC_APP_URL=https://your-production-domain`
- `GOOGLE_CALENDAR_REDIRECT_URI=https://your-production-domain/api/calendar/oauth/google/callback`
- `MICROSOFT_CALENDAR_REDIRECT_URI=https://your-production-domain/api/calendar/oauth/outlook/callback`

Register those exact HTTPS callback URLs in the Google Cloud OAuth client and
Microsoft Entra app registration before release.

Deployment separation:

- Use separate Supabase projects for local/staging and production when possible.
- Production should use the production Supabase URL and publishable key only.
- Production service-role keys belong only in protected hosting/CI secrets.
- Keep Vercel production, preview, and development environment variables
  separate. Do not reuse production service-role or OAuth secrets in preview
  unless the preview environment is intentionally protected.

Runtime health:

- `GET /api/health` checks production env validation and Supabase reachability.
- The response also includes flight-refresh queue health as an optional
  dependency signal. A missing Redis worker dependency is reported but does not
  by itself make the core app unhealthy.
