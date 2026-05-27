# Flight Ops Grafana Control Panel Runbook

This runbook covers the production rollout for the Flight Ops Grafana control panel stack.

Runtime shape:

```text
React UI -> Next.js API routes -> Grafana service account auth
```

Grafana bearer tokens must stay server-side. OAuth refresh, when enabled, is also handled by the backend.

## 1. Preconditions

- Grafana workspace exists and alerting is enabled.
- A dedicated Flight Ops service account exists or will be created by Terraform.
- Next.js deployment has server-only secret support.
- AWS Secrets Manager access is available if Lambda token rotation is enabled.
- Terraform has access to both Grafana and AWS providers.
- The Flight Ops panel is deployed separately from broad trip-planning rollout risk.

## 2. Secrets

Required runtime secrets:

```bash
GRAFANA_URL=https://grafana.example.com
GRAFANA_SERVICE_ACCOUNT_TOKEN=...
GRAFANA_PROMETHEUS_DATASOURCE_UID=prometheus
```

Optional OAuth refresh secrets:

```bash
GRAFANA_TOKEN_URL=...
GRAFANA_REFRESH_TOKEN=...
GRAFANA_CLIENT_ID=...
GRAFANA_CLIENT_SECRET=...
```

Rotation secrets:

- Runtime token secret: consumed by the Next.js app as `GRAFANA_SERVICE_ACCOUNT_TOKEN`.
- Provisioning token secret: used by Lambda to create and delete Grafana service account tokens.

Never expose Grafana bearer tokens through `NEXT_PUBLIC_*` variables or client-side storage.

## 3. Terraform Apply Order

1. Apply the base Grafana folder, service account, and token resources.
2. Store the service account token in the runtime secret manager.
3. Deploy the Next.js app using that server-only secret.
4. Verify rule fetch and dry-run from `/flight-ops`.
5. Enable Lambda token rotation:

```hcl
enable_token_rotation         = true
runtime_token_secret_arn      = "arn:aws:secretsmanager:..."
provisioning_token_secret_arn = "arn:aws:secretsmanager:..."
```

6. Remove legacy Grafana API key resources after the service-account path is verified.

## 4. Permissions

- Use a dedicated service account for this control panel.
- Prefer folder/rule scoped edit permissions where available.
- Avoid org admin for routine alert-rule editing.
- Do not share the Flight Ops service account with unrelated services.
- Use Grafana Enterprise RBAC if available to tighten alerting scope further.

## 5. App Deployment Checks

- `/api/grafana/alert-rules` is reachable from the browser and proxies through Next.js.
- The browser does not call `GRAFANA_URL` directly.
- `/api/auth/refresh` returns `501` when OAuth refresh env vars are intentionally absent.
- The control panel uses `useAuthedGrafanaFetch` and retries once after a `401`.
- Duplicate rule writes return `429` with `Retry-After`.

## 6. Smoke Tests

Manual checks:

```bash
curl -i https://app.example.com/api/grafana/alert-rules
curl -i -X POST https://app.example.com/api/auth/refresh
```

Expected local/dev behavior:

- `/api/grafana/alert-rules` returns safe defaults when Grafana secrets are missing.
- `/api/auth/refresh` returns `501` when OAuth refresh is not configured.

Promotion smoke suite:

- Load `/flight-ops` and confirm queue cards render.
- Open the Grafana control panel and verify rule fetch succeeds.
- Dry-run a threshold change and inspect the generated Grafana payload.
- Save a staging threshold change and confirm Grafana accepts it.
- Simulate `401` and verify one refresh plus one retry.
- Simulate `429` and verify the UI surfaces rate-limit messaging.
- Trigger a test alert and confirm webhook/contact-point delivery.

Cypress coverage:

```bash
npx cypress run --browser chrome --spec cypress/e2e/grafana-oauth-refresh.cy.ts
```

## 7. Runtime Monitoring

Monitor:

- Grafana API latency and error rate.
- Next.js route logs for repeated `401`, `403`, `409`, and `429`.
- Token-rotation Lambda success/failure.
- Secrets Manager secret versions after rotation.
- Alert webhook delivery failures.
- Operator save/delete audit records.

Alert on:

- Repeated Grafana auth failures.
- Repeated conflicts for the same rule UID.
- Token rotation failure.
- No successful rule fetches for a sustained window.

## 8. Rollback

If rule writes fail:

1. Set the control panel to read-only operationally.
2. Disable token rotation if it is suspected.
3. Restore the previous runtime secret version in Secrets Manager.
4. Re-issue a fresh service account token if needed.
5. Temporarily restore an old API-key path only as an emergency fallback if still retained.

If the app fails after rotation:

1. Confirm the runtime secret contains `GRAFANA_SERVICE_ACCOUNT_TOKEN`.
2. Restart any runtime that snapshots environment variables at boot.
3. Restore the last known good secret version.
4. Manually create a replacement Grafana service account token.

## 9. Success Criteria

- `/flight-ops` renders without exposing Grafana credentials.
- Grafana rules can be created, updated, paused, and deleted through the control panel.
- OAuth refresh recovers expired app sessions when configured.
- Lambda token rotation completes and the app works with the rotated token.
- Operators can change Flight Ops thresholds without editing YAML.
- Alert webhook/contact-point delivery is verified.

## 10. Go-Live Checklist

- [ ] Server-only `GRAFANA_SERVICE_ACCOUNT_TOKEN` is present.
- [ ] `GRAFANA_URL` is present.
- [ ] `GRAFANA_PROMETHEUS_DATASOURCE_UID` is correct.
- [ ] OAuth refresh secrets are configured only where needed.
- [ ] Terraform apply completed successfully.
- [ ] Token rotation is enabled and tested, if in scope for launch.
- [ ] Smoke tests passed.
- [ ] A staging alert fired and delivered to the intended contact point.
- [ ] Rollback secret version is recorded.
- [ ] Old API keys are removed or explicitly marked as emergency-only.
