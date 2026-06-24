# Grafana Flight Ops Service Account

This module provisions the Grafana resources Almidy needs for server-mediated alert-rule automation.

## What It Creates

- A stable `flight-ops` Grafana folder.
- A `flight-ops-control-panel` service account.
- A service account token for the Next.js Grafana proxy.

## Inputs

```hcl
grafana_url        = "https://grafana.example.com"
grafana_admin_auth = "admin-or-provisioning-token"
```

`grafana_admin_auth` is only for Terraform provisioning. Store it securely and avoid committing it.

## Apply

```bash
terraform init
terraform plan
terraform apply
```

After apply, store the sensitive token output in your secret manager as:

```bash
GRAFANA_SERVICE_ACCOUNT_TOKEN=...
GRAFANA_URL=https://grafana.example.com
GRAFANA_PROMETHEUS_DATASOURCE_UID=prometheus
```

## Runtime Flow

The React control panel calls Almidy only:

```text
React UI -> /api/grafana/alert-rules -> Grafana Provisioning API
```

The browser never receives Grafana credentials. The Next.js route sends the service account token in the `Authorization: Bearer ...` header.

## Migration Checklist

1. Create this service account and token in staging.
2. Store the token as `GRAFANA_SERVICE_ACCOUNT_TOKEN`.
3. Confirm `GET /api/grafana/alert-rules` loads managed rules.
4. Dry-run a rule payload from the Flight Ops command center.
5. Create or update a staging rule.
6. Confirm Grafana alert evaluation and webhook delivery.
7. Rotate and remove any old Grafana API keys after verification.

## Optional Lambda Token Rotation

Set `enable_token_rotation = true` to provision an EventBridge-triggered Lambda that rotates the service account token and writes the new token into Secrets Manager.

Required variables:

```hcl
enable_token_rotation          = true
runtime_token_secret_arn       = "arn:aws:secretsmanager:..."
provisioning_token_secret_arn  = "arn:aws:secretsmanager:..."
rotation_schedule_expression   = "rate(30 days)"
```

The runtime secret is the value your Next.js deployment reads for `GRAFANA_SERVICE_ACCOUNT_TOKEN`. The provisioning secret should contain a Grafana token with enough permission to create and delete service account tokens. The Lambda writes a JSON payload shaped like:

```json
{
  "GRAFANA_SERVICE_ACCOUNT_TOKEN": "...",
  "grafana_service_account_id": "1",
  "grafana_token_id": 2,
  "rotated_at": 1778180000,
  "token_name": "flight-ops-control-panel-token-1778180000"
}
```

After rotation, restart or reload any runtime that snapshots environment variables at boot. If your platform reads directly from Secrets Manager at request time, no app restart is required.

## Permission Notes

The default role is `Editor` because Grafana-managed alert provisioning writes generally need edit-level access. If your Grafana edition supports narrower RBAC for alerting resources and folders, tighten the role after the staging write path is verified.
