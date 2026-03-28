# infra/ssm.tf
# パラメータの「キー」のみ作成。値はterraform apply後にAWS CLIで設定する。

resource "aws_ssm_parameter" "rails_env" {
  name  = "/${var.project_name}/${var.environment}/RAILS_ENV"
  type  = "String"
  value = "production"
}

resource "aws_ssm_parameter" "database_url" {
  name  = "/${var.project_name}/${var.environment}/DATABASE_URL"
  type  = "SecureString"
  value = "placeholder"

  lifecycle { ignore_changes = [value] }
}

resource "aws_ssm_parameter" "secret_key_base" {
  name  = "/${var.project_name}/${var.environment}/SECRET_KEY_BASE"
  type  = "SecureString"
  value = "placeholder"

  lifecycle { ignore_changes = [value] }
}

resource "aws_ssm_parameter" "rails_master_key" {
  name  = "/${var.project_name}/${var.environment}/RAILS_MASTER_KEY"
  type  = "SecureString"
  value = "placeholder"

  lifecycle { ignore_changes = [value] }
}

resource "aws_ssm_parameter" "tmdb_api_key" {
  name  = "/${var.project_name}/${var.environment}/TMDB_API_KEY"
  type  = "SecureString"
  value = "placeholder"

  lifecycle { ignore_changes = [value] }
}

resource "aws_ssm_parameter" "google_books_api_key" {
  name  = "/${var.project_name}/${var.environment}/GOOGLE_BOOKS_API_KEY"
  type  = "SecureString"
  value = "placeholder"

  lifecycle { ignore_changes = [value] }
}

resource "aws_ssm_parameter" "igdb_client_id" {
  name  = "/${var.project_name}/${var.environment}/IGDB_CLIENT_ID"
  type  = "SecureString"
  value = "placeholder"

  lifecycle { ignore_changes = [value] }
}

resource "aws_ssm_parameter" "igdb_client_secret" {
  name  = "/${var.project_name}/${var.environment}/IGDB_CLIENT_SECRET"
  type  = "SecureString"
  value = "placeholder"

  lifecycle { ignore_changes = [value] }
}

resource "aws_ssm_parameter" "google_client_id" {
  name  = "/${var.project_name}/${var.environment}/GOOGLE_CLIENT_ID"
  type  = "SecureString"
  value = "placeholder"

  lifecycle { ignore_changes = [value] }
}

resource "aws_ssm_parameter" "google_client_secret" {
  name  = "/${var.project_name}/${var.environment}/GOOGLE_CLIENT_SECRET"
  type  = "SecureString"
  value = "placeholder"

  lifecycle { ignore_changes = [value] }
}

resource "aws_ssm_parameter" "frontend_url" {
  name  = "/${var.project_name}/${var.environment}/FRONTEND_URL"
  type  = "String"
  value = "https://${aws_cloudfront_distribution.main.domain_name}"
}

# === S3画像アップロード用 ===
# 認証はEC2のIAMロールで行うため、アクセスキーのSSMパラメータは不要
# バケット名のみDockerコンテナに渡す

resource "aws_ssm_parameter" "s3_bucket_name" {
  name  = "/${var.project_name}/${var.environment}/S3_BUCKET_NAME"
  type  = "String"
  value = aws_s3_bucket.images.id
}
