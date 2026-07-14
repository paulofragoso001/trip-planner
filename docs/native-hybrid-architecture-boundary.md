# Almidy Native Hybrid Architecture Boundary

Status: enforced by `NativeWebRoutePolicy` in `ios/App/App/MainViewController.swift`.

## Ownership

### Native iOS

- MapKit globe and map interaction
- Wallet sheet and wallet state
- Trips and trip selection
- Search and autocomplete
- Create, edit, and delete trip flows
- Account surface and authentication
- Native screenshot picker
- Native EventKit bridge

### Controlled WebView

- Help and support content
- Reservation import and review
- Unfinished secondary account content
- Unfinished secondary settings content
- Other routes explicitly added to the allowlist

Controlled WebView routes must be opened through `presentNativeWebFeature(route:title:)`. The route is rejected unless `NativeWebRoutePolicy.owner(for:)` returns `.controlledWebView`.

### Web/API

- Supabase auth and persistent data
- Vercel API routes
- Shared trip and import persistence
- Desktop and broader product surfaces

## Route policy

Native-owned dashboard, trips, search, globe, wallet, account-root, settings-root, plan, and map routes cannot load inside the controlled WebView. Secondary WebView routes are limited to imports, help, account subroutes, settings subroutes, and approved account fragments.

Every native navigation action must identify one owner before it presents a screen. No new duplicate dashboard, trips, search, or authentication implementation should be added while this boundary is active.
