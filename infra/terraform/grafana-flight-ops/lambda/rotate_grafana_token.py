import json
import os
import time
import urllib.error
import urllib.request

import boto3


secrets = boto3.client("secretsmanager")


def lambda_handler(event, context):
    grafana_url = required_env("GRAFANA_URL").rstrip("/")
    service_account_id = required_env("SERVICE_ACCOUNT_ID")
    runtime_secret_id = required_env("RUNTIME_TOKEN_SECRET_ID")
    provisioning_secret_id = required_env("PROVISIONING_TOKEN_SECRET_ID")
    token_name_prefix = os.environ.get("TOKEN_NAME_PREFIX", "flight-ops-control-panel-token")

    provisioning_token = read_secret_value(provisioning_secret_id)
    previous_runtime = read_secret_json(runtime_secret_id)
    token_name = f"{token_name_prefix}-{int(time.time())}"

    created = grafana_request(
        method="POST",
        token=provisioning_token,
        url=f"{grafana_url}/api/serviceaccounts/{service_account_id}/tokens",
        body={"name": token_name},
    )

    new_token = created.get("key")
    if not new_token:
        raise RuntimeError("Grafana did not return a service account token key.")

    new_token_id = created.get("id")
    write_runtime_secret(
        runtime_secret_id,
        {
            "GRAFANA_SERVICE_ACCOUNT_TOKEN": new_token,
            "grafana_service_account_id": service_account_id,
            "grafana_token_id": new_token_id,
            "rotated_at": int(time.time()),
            "token_name": token_name,
        },
    )

    previous_token_id = previous_runtime.get("grafana_token_id")
    if previous_token_id:
        try:
            grafana_request(
                method="DELETE",
                token=provisioning_token,
                url=f"{grafana_url}/api/serviceaccounts/{service_account_id}/tokens/{previous_token_id}",
            )
        except Exception as error:
            print(f"Previous token deletion failed: {error}")

    return {
        "ok": True,
        "new_token_id": new_token_id,
        "previous_token_id": previous_token_id,
        "token_name": token_name,
    }


def grafana_request(method, token, url, body=None):
    data = None
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
    }

    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"

    request = urllib.request.Request(url, data=data, headers=headers, method=method)

    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            payload = response.read().decode("utf-8")
            return json.loads(payload) if payload else {}
    except urllib.error.HTTPError as error:
        message = error.read().decode("utf-8")
        raise RuntimeError(f"Grafana request failed: {error.code} {message}") from error


def read_secret_value(secret_id):
    payload = secrets.get_secret_value(SecretId=secret_id)
    if "SecretString" not in payload:
        raise RuntimeError(f"Secret {secret_id} does not contain SecretString.")

    value = payload["SecretString"]
    try:
        parsed = json.loads(value)
        return parsed.get("token") or parsed.get("GRAFANA_SERVICE_ACCOUNT_TOKEN") or value
    except json.JSONDecodeError:
        return value


def read_secret_json(secret_id):
    payload = secrets.get_secret_value(SecretId=secret_id)
    value = payload.get("SecretString") or "{}"
    try:
        parsed = json.loads(value)
        return parsed if isinstance(parsed, dict) else {}
    except json.JSONDecodeError:
        return {}


def write_runtime_secret(secret_id, value):
    secrets.put_secret_value(
        SecretId=secret_id,
        SecretString=json.dumps(value, separators=(",", ":")),
    )


def required_env(name):
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value
