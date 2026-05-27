variable "grafana_url" {
  description = "Base URL for the Grafana instance, for example https://grafana.example.com."
  type        = string
}

variable "grafana_admin_auth" {
  description = "Grafana admin or provisioning token used by Terraform to create the service account."
  sensitive   = true
  type        = string
}

variable "folder_title" {
  default     = "Flight Ops"
  description = "Human-readable Grafana folder title for flight operations alerting."
  type        = string
}

variable "folder_uid" {
  default     = "flight-ops"
  description = "Stable Grafana folder UID used by the Wayline alert control panel."
  type        = string
}

variable "service_account_name" {
  default     = "flight-ops-control-panel"
  description = "Grafana service account name used by the Next.js alert-rule proxy."
  type        = string
}

variable "service_account_role" {
  default     = "Editor"
  description = "Grafana org role inherited by the service account. Tighten with RBAC if available."
  type        = string

  validation {
    condition     = contains(["Viewer", "Editor", "Admin"], var.service_account_role)
    error_message = "service_account_role must be Viewer, Editor, or Admin."
  }
}

variable "service_account_token_name" {
  default     = "flight-ops-control-panel-token"
  description = "Grafana service account token name for Wayline API automation."
  type        = string
}

variable "aws_region" {
  default     = "us-east-1"
  description = "AWS region for optional Lambda-based token rotation."
  type        = string
}

variable "enable_token_rotation" {
  default     = false
  description = "When true, provisions a Lambda and EventBridge schedule to rotate the Grafana service account token."
  type        = bool
}

variable "rotation_schedule_expression" {
  default     = "rate(30 days)"
  description = "EventBridge schedule expression for Grafana token rotation."
  type        = string
}

variable "runtime_token_secret_arn" {
  default     = ""
  description = "Secrets Manager secret ARN that stores the runtime GRAFANA_SERVICE_ACCOUNT_TOKEN consumed by Next.js."
  type        = string
}

variable "provisioning_token_secret_arn" {
  default     = ""
  description = "Secrets Manager secret ARN containing a Grafana provisioning/admin bearer token for creating new service account tokens."
  type        = string
}
