# API Contract Transition

The canonical API response contract is:

```json
{
  "data": {},
  "error": null
}
```

Failures use the same shape with a stable machine-readable error code:

```json
{
  "data": null,
  "error": {
    "code": "validation_error",
    "message": "Invalid request.",
    "details": {}
  }
}
```

## Migration Policy

- New routes should start on the canonical `{ data, error }` contract.
- Migrated routes may temporarily preserve legacy top-level fields such as `item`, `items`, `source`, or `sources` only while active consumers still depend on them.
- Routes that still need legacy bodies must be listed below before compatibility fields or headers are emitted.
- Consumers should be updated to read canonical data first, then legacy fields during migration.
- Once all consumers are updated, switch the response body to the canonical shape and remove legacy top-level fields and header-only envelope markers.
- Do not add legacy compatibility fields to new routes.

## Current Legacy Exceptions

None.

Exception count: 0.

## Compatibility Burn-Down

| Route | Owner | Canonical consumer complete | Legacy fields still emitted | `X-Api-Envelope` still present | Target removal |
| --- | --- | --- | --- | --- | --- |
| None | Dashboard API | yes | no | no | done |

## Consumer Migration Checklist

- Prefer `payload.data.<field>` for canonical responses.
- Do not fall back to legacy top-level fields unless a new temporary exception is documented above.
- Use `error.code` for control flow and `error.message` for user-facing fallback text.
- Remove fallback branches when the route's legacy exception is removed from this document.

## Consumer Convergence Status

- Dashboard timeline/import consumers read canonical fields first through `lib/api/client.ts`.
- Trip preview consumers read canonical fields first for itinerary and trip-segment data.
- Smoke tests assert converged dashboard APIs do not emit `X-Api-Envelope`.
- Legacy compatibility fields and headers are fully removed from the migrated dashboard API surface.

## Server Boundaries

- Route Handlers should stay thin: validate, authenticate, call a server-only service, return an envelope.
- Supabase service-role/admin clients and privileged data-access modules must import `server-only`.
- Validation happens before downstream database or integration work.
- Error logs must use sanitized structured context and stable error codes.
