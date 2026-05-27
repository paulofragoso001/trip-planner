# Manual Acceptance Checklist

Last updated: May 26, 2026

Run this checklist against the production-like environment after deploy and before launch sign-off.

## Account and Workspace

- [ ] Sign up with a new user.
- [ ] Log out and log back in.
- [ ] Confirm `/dashboard` is not accessible while logged out.
- [ ] Open `/privacy` and `/terms`.
- [ ] Open `/dashboard/account` and confirm the account deletion request path is visible.

## Trip Workspace

- [ ] Create a trip.
- [ ] Edit the trip name, destination, and dates.
- [ ] Add an itinerary item.
- [ ] Edit the itinerary item.
- [ ] Delete the itinerary item.
- [ ] Add or edit a map pin and confirm it persists after refresh.
- [ ] Delete the trip or confirm the delete flow is intentionally disabled for launch.

## Budget

- [ ] Add an expense.
- [ ] Confirm category totals update.
- [ ] Edit or delete the expense if those controls are enabled.

## Calendar Sync

- [ ] Connect Google Calendar.
- [ ] Confirm the connection returns to the original timeline route.
- [ ] Sync the trip.
- [ ] Confirm calendar sync jobs complete.
- [ ] Confirm expected events appear in Google Calendar.
- [ ] Disconnect Google Calendar.

## Imports

- [ ] Connect or toggle an import source.
- [ ] Create an unfiled item.
- [ ] Promote the unfiled item into an itinerary segment.
- [ ] Confirm the item leaves the review queue or changes to a reviewed/promoted status.

## Sharing and Authorization

- [ ] Invite another user to a trip.
- [ ] Confirm the invite email is sent.
- [ ] Confirm the invited user can access only the shared trip.
- [ ] Confirm a different non-collaborator user cannot open the private trip URL.
- [ ] Confirm protected API routes return `401` or `403` for users without access.

## Observability

- [ ] Open `/dashboard/admin`.
- [ ] Confirm OAuth, import, API, and calendar worker panels load.
- [ ] Confirm recent sync or import failures appear with useful operator detail.
