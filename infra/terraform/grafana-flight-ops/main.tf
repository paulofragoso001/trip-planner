terraform {
  required_version = ">= 1.6.0"

  required_providers {
    grafana = {
      source  = "grafana/grafana"
      version = ">= 3.0.0"
    }
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = ">= 2.4.0"
    }
  }
}

provider "grafana" {
  url  = var.grafana_url
  auth = var.grafana_admin_auth
}

provider "aws" {
  region = var.aws_region
}

resource "grafana_folder" "flight_ops" {
  title = var.folder_title
  uid   = var.folder_uid
}

resource "grafana_service_account" "flight_ops" {
  name = var.service_account_name
  role = var.service_account_role
}

resource "grafana_service_account_token" "flight_ops" {
  name               = var.service_account_token_name
  service_account_id = grafana_service_account.flight_ops.id
}
