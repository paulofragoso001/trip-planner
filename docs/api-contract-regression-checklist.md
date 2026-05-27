# API Contract Regression Checklist

This checklist validates the final decommissioning of the legacy compatibility layer for trip-data dashboard endpoints. The expected final state is one canonical API contract:

```json
{
  "data": {},
  "error": null
}
```

Failures must use:

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

## Migration KPI

- Legacy exceptions remaining: `0`
- `X-Api-Envelope` emitters remaining across migrated dashboard APIs: `0`
- Compatibility top-level fields emitted by migrated dashboard APIs: `0`
- Required PR gate: `Dashboard smoke`

## Endpoint Parity Matrix

| Route | Method | Expected success shape | Legacy fields allowed | `X-Api-Envelope` allowed |
| --- | --- | --- | --- | --- |
| `/api/itinerary` | `GET` | `{ data: { itinerary }, error: null }` | no | no |
| `/api/itinerary` | `POST` | `{ data: { item }, error: null }` | no | no |
| `/api/trip-segments` | `GET` | `{ data: { segments }, error: null }` | no | no |
| `/api/import-sources` | `GET` | `{ data: { sources }, error: null }` | no | no |
| `/api/import-sources` | `PATCH` | `{ data: { source }, error: null }` | no | no |
| `/api/unfiled-items` | `GET` | `{ data: { items }, error: null }` | no | no |
| `/api/unfiled-items` | `POST` | `{ data: { item }, error: null }` | no | no |
| `/api/unfiled-items/[id]` | `PATCH` | `{ data: { item }, error: null }` | no | no |
| `/api/itinerary/flight-status` | `POST` | `{ data: { ok, item, alert, provider }, error: null }` | no | no |

## Contract Checks

- [ ] Success responses contain exactly the canonical envelope at the top level: `data` and `error`.
- [ ] `error` is `null` on every successful response.
- [ ] Failure responses contain `data: null`.
- [ ] Failure responses contain `error.code` and `error.message`.
- [ ] Validation failures return `validation_error`.
- [ ] Auth failures return `unauthorized`.
- [ ] Upstream integration failures use `bad_gateway` or another stable machine-readable code.
- [ ] No migrated route returns a bare array body.
- [ ] No migrated route returns a bare item object body.
- [ ] No migrated route emits top-level compatibility fields such as `item`, `items`, `source`, `sources`, `segments`, or `itinerary` outside `data`.
- [ ] No migrated route emits `X-Api-Envelope`.

## Consumer Checks

- [ ] Timeline reads use `data.itinerary`.
- [ ] Trip preview segment reads use `data.segments`.
- [ ] Itinerary creation reads `data.item`.
- [ ] Import source reads use `data.sources`.
- [ ] Import source updates use `data.source`.
- [ ] Unfiled item reads use `data.items`.
- [ ] Unfiled item creates and updates use `data.item`.
- [ ] Flight status refresh reads `data.item`, `data.alert`, `data.provider`, and `data.ok`.
- [ ] Dashboard mocks use canonical-only response bodies.
- [ ] Dashboard consumers do not require legacy top-level fields to render.

## Route Handler Checks

- [ ] Route Handlers validate query parameters before service calls.
- [ ] Route Handlers validate request bodies before service calls.
- [ ] Route Handlers perform authentication before privileged data access.
- [ ] Route Handlers call server-only service modules for business logic.
- [ ] Supabase service-role or admin access stays in server-only modules.
- [ ] External integration clients stay server-only.
- [ ] Route files remain thin: parse, validate, auth, call service, return envelope.

## Observability Checks

- [ ] API error logs include route name and stable error code.
- [ ] API error logs redact secrets, tokens, credential-bearing URLs, and raw payloads.
- [ ] Panel error reports do not include sensitive user or trip data.
- [ ] Integration errors do not leak provider-specific response bodies to clients.
- [ ] Metrics or logs can distinguish validation, auth, internal, and upstream failures.

## CI And Release Checks

- [ ] `./node_modules/.bin/tsc --noEmit` passes.
- [ ] `npx playwright test tests/playwright/dashboard.smoke.spec.ts` passes.
- [ ] Dashboard smoke asserts absence of `X-Api-Envelope` on migrated dashboard APIs.
- [ ] Dashboard smoke exercises the itinerary POST mutation and verifies `data.item`.
- [ ] Required PR check `Dashboard smoke` remains enabled in branch protection.
- [ ] Post-deploy dashboard smoke still validates the deployed route or expected auth redirect.

## Sign-Off

The compatibility layer is fully decommissioned when:

- [ ] `docs/api-contract-transition.md` lists no current legacy exceptions.
- [ ] Exception count is `0`.
- [ ] The verification dashboard reports zero legacy exceptions and zero envelope headers.
- [ ] No source reference to `X-Api-Envelope` exists in migrated dashboard API routes.
- [ ] Contract, consumer, route handler, observability, and CI checks above are complete.
