output "flight_ops_folder_uid" {
  description = "Grafana folder UID to use as the alert-rule folderUid."
  value       = grafana_folder.flight_ops.uid
}

output "flight_ops_service_account_id" {
  description = "Grafana service account ID used by the Wayline control panel."
  value       = grafana_service_account.flight_ops.id
}

output "flight_ops_service_account_token" {
  description = "Store this in your secret manager as GRAFANA_SERVICE_ACCOUNT_TOKEN."
  sensitive   = true
  value       = grafana_service_account_token.flight_ops.key
}

output "token_rotation_lambda_name" {
  description = "Lambda function name for Grafana token rotation when enabled."
  value       = length(aws_lambda_function.token_rotation) > 0 ? aws_lambda_function.token_rotation[0].function_name : null
}
