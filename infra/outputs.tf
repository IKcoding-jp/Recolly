# infra/outputs.tf

output "cloudfront_url" {
  description = "CloudFront URL（フロントエンド + API）"
  value       = "https://${aws_cloudfront_distribution.main.domain_name}"
}

output "ec2_public_ip" {
  description = "EC2のElastic IP（SSH接続用）"
  value       = aws_eip.api.public_ip
}

output "rds_endpoint" {
  description = "RDSエンドポイント"
  value       = aws_db_instance.main.endpoint
}

output "ecr_repository_url" {
  description = "ECRリポジトリURL"
  value       = aws_ecr_repository.backend.repository_url
}

output "github_actions_role_arn" {
  description = "GitHub Actions用IAMロールARN"
  value       = aws_iam_role.github_actions.arn
}

output "s3_bucket_name" {
  description = "フロントエンド用S3バケット名"
  value       = aws_s3_bucket.frontend.id
}

output "cloudfront_distribution_id" {
  description = "CloudFrontディストリビューションID（キャッシュクリア用）"
  value       = aws_cloudfront_distribution.main.id
}

output "s3_images_bucket_name" {
  description = "画像アップロード用S3バケット名"
  value       = aws_s3_bucket.images.id
}
