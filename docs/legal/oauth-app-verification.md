# OAuth App Verification

Last updated: May 26, 2026

Wayline currently uses OAuth for Google Calendar and Microsoft Calendar connection flows. Before opening Google Calendar sync beyond internal or test users, complete the provider verification work below.

## Google

Current expected Google scopes:

- `openid`
- `https://www.googleapis.com/auth/userinfo.email`
- `https://www.googleapis.com/auth/userinfo.profile`
- `https://www.googleapis.com/auth/calendar.events`

Verification checklist:

- Configure the OAuth consent screen with the production Wayline app name, support email, developer contact, and authorized domain.
- Publish production Privacy Policy and Terms URLs.
- Register production HTTPS redirect URI: `https://<production-domain>/api/calendar/oauth/google/callback`.
- Keep localhost redirect URI only for local development credentials.
- Add test users while the app is in testing mode.
- Prepare the scope justification for `calendar.events`: Wayline creates, updates, and deletes user-approved trip calendar events.
- If Google marks the scope or app as requiring verification, submit the OAuth verification package before broad public rollout.

## Microsoft

Microsoft Graph calendar sync should use delegated permissions for the signed-in user. Keep the Azure app registration aligned with production callback URLs and only request calendar permissions needed for event create/update/delete.

## Operational Rules

- OAuth client secrets must stay server-side.
- Provider tokens must remain encrypted at rest.
- Callback URLs must be HTTPS in production.
- Monitor OAuth start, success, failure, missing-cookie, state-mismatch, and unsafe-redirect events from the admin observability panel.
