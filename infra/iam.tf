# infra/iam.tf

# === EC2用IAMロール ===

# EC2がIAMロールを引き受けるための信頼ポリシー
data "aws_iam_policy_document" "ec2_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "ec2" {
  name               = "${var.project_name}-ec2-role"
  assume_role_policy = data.aws_iam_policy_document.ec2_assume_role.json
}

# EC2がSSM Parameter Storeから値を取得する権限
data "aws_iam_policy_document" "ec2_ssm" {
  statement {
    actions   = ["ssm:GetParameter", "ssm:GetParameters", "ssm:GetParametersByPath"]
    resources = ["arn:aws:ssm:${var.aws_region}:*:parameter/${var.project_name}/${var.environment}/*"]
  }
}

resource "aws_iam_policy" "ec2_ssm" {
  name   = "${var.project_name}-ec2-ssm-policy"
  policy = data.aws_iam_policy_document.ec2_ssm.json
}

resource "aws_iam_role_policy_attachment" "ec2_ssm" {
  role       = aws_iam_role.ec2.name
  policy_arn = aws_iam_policy.ec2_ssm.arn
}

# EC2がECRからイメージをpullする権限
resource "aws_iam_role_policy_attachment" "ec2_ecr" {
  role       = aws_iam_role.ec2.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
}

# EC2がSSMエージェントとして動作する権限
resource "aws_iam_role_policy_attachment" "ec2_ssm_managed" {
  role       = aws_iam_role.ec2.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

# EC2インスタンスプロファイル
resource "aws_iam_instance_profile" "ec2" {
  name = "${var.project_name}-ec2-instance-profile"
  role = aws_iam_role.ec2.name
}

# EC2がS3画像バケットを操作する権限（署名付きURL発行 + 画像削除）
data "aws_iam_policy_document" "ec2_s3_images" {
  statement {
    actions   = ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"]
    resources = ["${aws_s3_bucket.images.arn}/*"]
  }
}

resource "aws_iam_policy" "ec2_s3_images" {
  name   = "${var.project_name}-ec2-s3-images-policy"
  policy = data.aws_iam_policy_document.ec2_s3_images.json
}

resource "aws_iam_role_policy_attachment" "ec2_s3_images" {
  role       = aws_iam_role.ec2.name
  policy_arn = aws_iam_policy.ec2_s3_images.arn
}

# EC2がSES経由でメール送信する権限（ADR-0037, Issue #108 / #118）
#
# Resource が "identity/*" と広く見えるが、以下の理由で実質的な権限拡大は最小:
# - EC2 インスタンスロール自体は EC2 インスタンスからのみ assume 可能
# - このアカウントで verify されたドメインは recolly.net のみ
# - 検証済みメールアドレスは SES console で明示的に追加したものに限る
# - SES サンドボックスモードが送信先を検証済みアドレスに制限する
#
# なぜ identity/recolly.net だけでは不十分か:
# SES v2 の SendEmail API は raw MIME content を渡すとき、内部的に
# ses:SendRawEmail 権限を要求する。サンドボックスモードでは送信元 identity
# (recolly.net) だけでなく、受信者として verify した email identity にも
# 権限が必要となる (例: identity/your-verified@gmail.com)。
# 個別メアドごとにポリシー追加するのは現実的でないため、同一アカウント内の
# SES identity 全体に許可する形に広げる。
data "aws_iam_policy_document" "ec2_ses" {
  statement {
    actions = [
      "ses:SendEmail",
      "ses:SendRawEmail",
    ]
    resources = [
      "arn:aws:ses:${var.aws_region}:*:identity/*",
    ]
  }
}

resource "aws_iam_policy" "ec2_ses" {
  name   = "${var.project_name}-ec2-ses-policy"
  policy = data.aws_iam_policy_document.ec2_ses.json
}

resource "aws_iam_role_policy_attachment" "ec2_ses" {
  role       = aws_iam_role.ec2.name
  policy_arn = aws_iam_policy.ec2_ses.arn
}

# === GitHub Actions OIDC ===

# OIDCプロバイダ（GitHubとAWSの信頼関係）
resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["ffffffffffffffffffffffffffffffffffffffff"]
}

# GitHub Actionsが引き受けるIAMロール
data "aws_iam_policy_document" "github_actions_assume_role" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_org}/${var.github_repo}:*"]
    }
  }
}

resource "aws_iam_role" "github_actions" {
  name               = "${var.project_name}-github-actions-role"
  assume_role_policy = data.aws_iam_policy_document.github_actions_assume_role.json
}

# GitHub Actionsに必要な権限
data "aws_iam_policy_document" "github_actions" {
  # ECRへのpush権限
  statement {
    actions = [
      "ecr:GetAuthorizationToken",
      "ecr:BatchCheckLayerAvailability",
      "ecr:GetDownloadUrlForLayer",
      "ecr:BatchGetImage",
      "ecr:PutImage",
      "ecr:InitiateLayerUpload",
      "ecr:UploadLayerPart",
      "ecr:CompleteLayerUpload",
    ]
    resources = ["*"]
  }

  # S3へのアップロード権限
  statement {
    actions = ["s3:PutObject", "s3:DeleteObject", "s3:ListBucket", "s3:GetObject"]
    resources = [
      "arn:aws:s3:::${var.project_name}-frontend-*",
      "arn:aws:s3:::${var.project_name}-frontend-*/*",
    ]
  }

  # CloudFrontキャッシュクリア権限
  statement {
    actions   = ["cloudfront:CreateInvalidation"]
    resources = ["*"]
  }

  # SSM Run Command権限（EC2へのデプロイ用）
  statement {
    actions   = ["ssm:SendCommand", "ssm:GetCommandInvocation"]
    resources = ["*"]
  }
}

resource "aws_iam_policy" "github_actions" {
  name   = "${var.project_name}-github-actions-policy"
  policy = data.aws_iam_policy_document.github_actions.json
}

resource "aws_iam_role_policy_attachment" "github_actions" {
  role       = aws_iam_role.github_actions.name
  policy_arn = aws_iam_policy.github_actions.arn
}
