# Almidy Domain Connection Runbook

Goal: make `https://almidy.app` the canonical production domain for the Almidy app while keeping the current Vercel URL available during transition.

## Verified State

- Vercel project: `trip-planner`
- Project id: `prj_ftS5XyaBIFY2CG1Xbv1sOY5XLNGh`
- Current Vercel production alias: `https://trip-planner-swart-sigma.vercel.app`
- Target domain: `almidy.app`
- `almidy.app` and `www.almidy.app` are attached to the canonical `trip-planner` project.
- `NEXT_PUBLIC_APP_URL=https://almidy.app` is set in Vercel Production.
- `almidy.app` is a third-party domain using Wix nameservers:
  - `ns14.wixdns.net`
  - `ns15.wixdns.net`
- Vercel reports both domains as configured correctly.
- `https://almidy.app` returns HTTP 200 from Vercel.

## DNS Records

Keep DNS hosted at Wix unless the owner explicitly chooses to move the whole zone to Vercel DNS.

- Apex `almidy.app`
  - `A @ 216.198.79.1`
  - Vercel also recommends `A @ 64.29.17.1` as a paired external record.
- `www.almidy.app`
  - `CNAME www 70c5cefe6f1e75a2.vercel-dns-017.com.`

## Validation Commands

```bash
npx vercel domains verify almidy.app
npx vercel domains verify www.almidy.app
npx vercel env ls
curl -I https://almidy.app
curl -I https://www.almidy.app
```

## Follow-Up Checks

- Redeploy production after the Almidy rename is committed so `NEXT_PUBLIC_APP_URL` is baked into the built client bundle.
- Confirm invite/share emails generate `almidy.app` URLs after the redeploy.
- Confirm `https://www.almidy.app` serves the app or redirects to `https://almidy.app`, depending on the chosen canonical host policy.
- Update OAuth authorized domains/origins to include `almidy.app`.
- Update Resend sender domain from `onboarding@resend.dev` to an authenticated Almidy sender.
- Update external docs, app store metadata, and analytics dashboards.

## Do Not Do Yet

- Do not delete or disconnect the existing Vercel production alias until `almidy.app` has been verified in production after redeploy.
- Do not connect `almidy.app` to a duplicate Vercel project.
- Do not replace existing persistence keys, provider IDs, or calendar metadata names without a migration.
