# infra/s3.tf

resource "aws_s3_bucket" "frontend" {
  bucket = "${var.project_name}-frontend-${var.aws_region}"

  tags = { Name = "${var.project_name}-frontend" }
}

# パブリックアクセスをブロック（CloudFront経由のみ）
resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# CloudFrontからのアクセスを許可するバケットポリシー
resource "aws_s3_bucket_policy" "frontend" {
  bucket = aws_s3_bucket.frontend.id
  policy = data.aws_iam_policy_document.s3_frontend.json
}

data "aws_iam_policy_document" "s3_frontend" {
  statement {
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.frontend.arn}/*"]

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.main.arn]
    }
  }
}
