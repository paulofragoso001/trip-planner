locals {
  rotation_enabled = var.enable_token_rotation && var.runtime_token_secret_arn != "" && var.provisioning_token_secret_arn != ""
}

data "archive_file" "token_rotation" {
  count       = local.rotation_enabled ? 1 : 0
  output_path = "${path.module}/.terraform-build/grafana-token-rotation.zip"
  source_file = "${path.module}/lambda/rotate_grafana_token.py"
  type        = "zip"
}

resource "aws_iam_role" "token_rotation" {
  count = local.rotation_enabled ? 1 : 0
  name  = "${var.service_account_name}-token-rotation"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "token_rotation" {
  count = local.rotation_enabled ? 1 : 0
  name  = "${var.service_account_name}-token-rotation"
  role  = aws_iam_role.token_rotation[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Effect   = "Allow"
        Resource = "*"
      },
      {
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:PutSecretValue"
        ]
        Effect = "Allow"
        Resource = [
          var.runtime_token_secret_arn,
          var.provisioning_token_secret_arn
        ]
      }
    ]
  })
}

resource "aws_lambda_function" "token_rotation" {
  count            = local.rotation_enabled ? 1 : 0
  filename         = data.archive_file.token_rotation[0].output_path
  function_name    = "${var.service_account_name}-token-rotation"
  handler          = "rotate_grafana_token.lambda_handler"
  role             = aws_iam_role.token_rotation[0].arn
  runtime          = "python3.12"
  source_code_hash = data.archive_file.token_rotation[0].output_base64sha256
  timeout          = 30

  environment {
    variables = {
      GRAFANA_URL                  = var.grafana_url
      PROVISIONING_TOKEN_SECRET_ID = var.provisioning_token_secret_arn
      RUNTIME_TOKEN_SECRET_ID      = var.runtime_token_secret_arn
      SERVICE_ACCOUNT_ID          = grafana_service_account.flight_ops.id
      TOKEN_NAME_PREFIX           = var.service_account_token_name
    }
  }
}

resource "aws_cloudwatch_event_rule" "token_rotation" {
  count               = local.rotation_enabled ? 1 : 0
  name                = "${var.service_account_name}-token-rotation"
  schedule_expression = var.rotation_schedule_expression
}

resource "aws_cloudwatch_event_target" "token_rotation" {
  count = local.rotation_enabled ? 1 : 0
  arn   = aws_lambda_function.token_rotation[0].arn
  rule  = aws_cloudwatch_event_rule.token_rotation[0].name
}

resource "aws_lambda_permission" "token_rotation" {
  count         = local.rotation_enabled ? 1 : 0
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.token_rotation[0].function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.token_rotation[0].arn
}
