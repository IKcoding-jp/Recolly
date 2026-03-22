# Recolly デプロイ 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recolly MVP を AWS 上にデプロイし、GitHub Actions で自動デプロイできる状態にする

**Architecture:** CloudFront をリバースプロキシとして使い、S3（React SPA）と EC2（Docker → Rails API）→ RDS（PostgreSQL）の構成を Terraform で構築する。CI/CD は GitHub Actions の OIDC 認証で AWS にデプロイする。

**Tech Stack:** Terraform, AWS (VPC, EC2, RDS, S3, CloudFront, ECR, SSM, IAM), Docker, GitHub Actions

**Spec:** `docs/superpowers/specs/2026-03-22-deployment-design.md`

---

## ファイル構成

### 新規作成

| ファイル | 責務 |
|---------|------|
| `infra/main.tf` | Terraformプロバイダ設定、tfstateバックエンド |
| `infra/variables.tf` | 変数定義（リージョン、インスタンスサイズ等） |
| `infra/outputs.tf` | 出力値（CloudFront URL、EC2 IP等） |
| `infra/vpc.tf` | VPC、サブネット、インターネットゲートウェイ、ルートテーブル |
| `infra/security_groups.tf` | EC2・RDS用セキュリティグループ |
| `infra/ec2.tf` | EC2インスタンス、キーペア、Elastic IP |
| `infra/rds.tf` | RDS PostgreSQL、サブネットグループ |
| `infra/s3.tf` | S3バケット（フロントエンド用） |
| `infra/cloudfront.tf` | CloudFrontディストリビューション（2オリジン） |
| `infra/ecr.tf` | ECRリポジトリ |
| `infra/iam.tf` | IAMロール・ポリシー（EC2用、GitHub Actions OIDC用） |
| `infra/ssm.tf` | SSM Parameter Store パラメータ定義 |
| `infra/scripts/bootstrap.sh` | tfstate用S3バケット作成スクリプト |
| `infra/scripts/user_data.sh` | EC2初期化スクリプト（Docker/AWS CLI インストール） |
| `infra/scripts/deploy.sh` | EC2上のデプロイスクリプト（イメージpull、マイグレーション、コンテナ再起動） |
| `backend/Dockerfile.production` | 本番用マルチステージDockerfile |
| `.github/workflows/cd.yml` | CDワークフロー（フロントエンド + バックエンド自動デプロイ） |

### 変更

| ファイル | 変更内容 |
|---------|---------|
| `backend/config/environments/production.rb` | Solid Cache/Queue → memory_store/async |
| `backend/config/puma.rb` | SOLID_QUEUE_IN_PUMA の行を確認（環境変数未設定なら影響なし） |
| `.gitignore` | Terraform関連エントリ追加 |

---

## Task 0: 前提条件の確認・準備（手動）

このタスクはIKさんが手動で実行します。

- [ ] **Step 1: AWSアカウントを作成する**

https://aws.amazon.com/ からアカウント作成。クレジットカード登録が必要（無料枠内なら課金なし）。

- [ ] **Step 2: IAMユーザーを作成する**

AWSコンソール → IAM → ユーザー作成。`AdministratorAccess` ポリシーをアタッチ。アクセスキーID + シークレットアクセスキーを発行（CLI用）。

⚠️ ルートアカウントでの作業は避け、IAMユーザーを使うこと。

- [ ] **Step 3: AWS CLIをインストール・設定する**

```bash
# Windows: https://awscli.amazonaws.com/AWSCLIV2.msi をダウンロード・実行
aws configure
# AWS Access Key ID: (Step 2で取得)
# AWS Secret Access Key: (Step 2で取得)
# Default region name: ap-northeast-1
# Default output format: json
```

- [ ] **Step 4: Terraformをインストールする**

https://developer.hashicorp.com/terraform/downloads からダウンロード。
PATHを通して `terraform -v` で確認。

- [ ] **Step 5: SSHキーペアを生成する**

```bash
ssh-keygen -t ed25519 -f ~/.ssh/recolly-ec2 -C "recolly-ec2"
```

EC2への接続に使用する。

---

## Task 1: Terraform初期設定 + tfstateバックエンド

**Files:**
- Create: `infra/scripts/bootstrap.sh`
- Create: `infra/main.tf`
- Create: `infra/variables.tf`
- Modify: `.gitignore`

- [ ] **Step 1: .gitignoreにTerraformエントリを追加する**

`.gitignore` の末尾に以下を追加:

```gitignore
# Terraform
infra/.terraform/
infra/*.tfstate
infra/*.tfstate.backup
infra/*.tfvars
```

- [ ] **Step 2: tfstate用S3バケット作成スクリプトを書く**

```bash
# infra/scripts/bootstrap.sh
#!/bin/bash
# tfstate保管用のS3バケットを作成するブートストラップスクリプト
# このバケットはTerraform管理外（1回だけ手動実行）

set -euo pipefail

AWS_REGION="ap-northeast-1"
BUCKET_NAME="recolly-terraform-state"

echo "tfstate用S3バケットを作成中..."
aws s3api create-bucket \
  --bucket "$BUCKET_NAME" \
  --region "$AWS_REGION" \
  --create-bucket-configuration LocationConstraint="$AWS_REGION"

# バージョニング有効化（tfstateの履歴を保持）
aws s3api put-bucket-versioning \
  --bucket "$BUCKET_NAME" \
  --versioning-configuration Status=Enabled

# パブリックアクセスをブロック
aws s3api put-public-access-block \
  --bucket "$BUCKET_NAME" \
  --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

echo "完了: s3://$BUCKET_NAME"
```

- [ ] **Step 3: variables.tfを書く**

```hcl
# infra/variables.tf

variable "aws_region" {
  description = "AWSリージョン"
  type        = string
  default     = "ap-northeast-1"
}

variable "project_name" {
  description = "プロジェクト名（リソースの命名に使用）"
  type        = string
  default     = "recolly"
}

variable "environment" {
  description = "環境名"
  type        = string
  default     = "production"
}

variable "db_username" {
  description = "RDSのマスターユーザー名"
  type        = string
  default     = "recolly"
}

variable "db_password" {
  description = "RDSのマスターパスワード"
  type        = string
  sensitive   = true
}

variable "ssh_public_key_path" {
  description = "EC2用SSHキーのパス"
  type        = string
  default     = "~/.ssh/recolly-ec2.pub"
}

variable "allowed_ssh_cidr" {
  description = "SSH接続を許可するCIDR（自分のIPアドレス/32）"
  type        = string
}

variable "github_org" {
  description = "GitHubオーガニゼーション名（OIDC用）"
  type        = string
  default     = "IKcoding-jp"
}

variable "github_repo" {
  description = "GitHubリポジトリ名（OIDC用）"
  type        = string
  default     = "recolly"
}
```

- [ ] **Step 4: main.tfを書く**

```hcl
# infra/main.tf

terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket = "recolly-terraform-state"
    key    = "production/terraform.tfstate"
    region = "ap-northeast-1"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}
```

- [ ] **Step 5: infra/.keepファイルを削除する**

```bash
rm infra/.keep
```

- [ ] **Step 6: ブートストラップスクリプトを実行する**

```bash
cd infra/scripts && bash bootstrap.sh
```

期待結果: `完了: s3://recolly-terraform-state` と表示される。

- [ ] **Step 7: terraform initを実行する**

```bash
cd infra && terraform init
```

期待結果: `Terraform has been successfully initialized!` と表示される。

- [ ] **Step 8: コミットする**

```bash
git add infra/main.tf infra/variables.tf infra/scripts/bootstrap.sh .gitignore
git commit -m "chore: Terraform初期設定（プロバイダ、変数定義、tfstateバックエンド）"
```

---

## Task 2: VPC + ネットワーク構成

**Files:**
- Create: `infra/vpc.tf`
- Create: `infra/security_groups.tf`

- [ ] **Step 1: vpc.tfを書く**

```hcl
# infra/vpc.tf

# VPC
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = { Name = "${var.project_name}-vpc" }
}

# パブリックサブネット（EC2用）
resource "aws_subnet" "public" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = "${var.aws_region}a"
  map_public_ip_on_launch = true

  tags = { Name = "${var.project_name}-public-subnet" }
}

# プライベートサブネット（RDS用、AZ-a）
resource "aws_subnet" "private_a" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.10.0/24"
  availability_zone = "${var.aws_region}a"

  tags = { Name = "${var.project_name}-private-subnet-a" }
}

# プライベートサブネット（RDS用、AZ-c）
resource "aws_subnet" "private_c" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.11.0/24"
  availability_zone = "${var.aws_region}c"

  tags = { Name = "${var.project_name}-private-subnet-c" }
}

# インターネットゲートウェイ
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = { Name = "${var.project_name}-igw" }
}

# パブリックルートテーブル
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = { Name = "${var.project_name}-public-rt" }
}

# パブリックサブネットにルートテーブルを関連付け
resource "aws_route_table_association" "public" {
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.public.id
}

# RDS用サブネットグループ
resource "aws_db_subnet_group" "main" {
  name       = "${var.project_name}-db-subnet-group"
  subnet_ids = [aws_subnet.private_a.id, aws_subnet.private_c.id]

  tags = { Name = "${var.project_name}-db-subnet-group" }
}
```

- [ ] **Step 2: security_groups.tfを書く**

```hcl
# infra/security_groups.tf

# CloudFrontマネージドプレフィックスリストのデータソース
data "aws_ec2_managed_prefix_list" "cloudfront" {
  name = "com.amazonaws.global.cloudfront.origin-facing"
}

# EC2用セキュリティグループ
resource "aws_security_group" "ec2" {
  name        = "${var.project_name}-ec2-sg"
  description = "EC2 security group for Rails API"
  vpc_id      = aws_vpc.main.id

  # CloudFrontからのHTTPアクセスのみ許可
  ingress {
    description     = "HTTP from CloudFront"
    from_port       = 80
    to_port         = 80
    protocol        = "tcp"
    prefix_list_ids = [data.aws_ec2_managed_prefix_list.cloudfront.id]
  }

  # SSHは管理者IPのみ
  ingress {
    description = "SSH from admin"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.allowed_ssh_cidr]
  }

  # アウトバウンドは全許可
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${var.project_name}-ec2-sg" }
}

# RDS用セキュリティグループ
resource "aws_security_group" "rds" {
  name        = "${var.project_name}-rds-sg"
  description = "RDS security group - EC2 only"
  vpc_id      = aws_vpc.main.id

  # EC2からのPostgreSQLアクセスのみ許可
  ingress {
    description     = "PostgreSQL from EC2"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ec2.id]
  }

  tags = { Name = "${var.project_name}-rds-sg" }
}
```

- [ ] **Step 3: terraform planで確認する**

```bash
cd infra && terraform plan -var="db_password=dummy" -var="allowed_ssh_cidr=0.0.0.0/32"
```

期待結果: VPC、サブネット×3、IGW、ルートテーブル、セキュリティグループ×2 の作成プランが表示される。エラーなし。

- [ ] **Step 4: コミットする**

```bash
git add infra/vpc.tf infra/security_groups.tf
git commit -m "infra: VPC、サブネット、セキュリティグループのTerraformコードを追加"
```

---

## Task 3: ECR + IAMロール

**Files:**
- Create: `infra/ecr.tf`
- Create: `infra/iam.tf`

- [ ] **Step 1: ecr.tfを書く**

```hcl
# infra/ecr.tf

resource "aws_ecr_repository" "backend" {
  name                 = "${var.project_name}-backend"
  image_tag_mutability = "MUTABLE"
  force_delete         = true

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = { Name = "${var.project_name}-backend-ecr" }
}

# 古いイメージを自動削除（無料枠500MB対策）
resource "aws_ecr_lifecycle_policy" "backend" {
  repository = aws_ecr_repository.backend.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "最新3つのイメージのみ保持"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 3
      }
      action = { type = "expire" }
    }]
  })
}
```

- [ ] **Step 2: iam.tfを書く（EC2用IAMロール）**

```hcl
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

# EC2インスタンスプロファイル
resource "aws_iam_instance_profile" "ec2" {
  name = "${var.project_name}-ec2-instance-profile"
  role = aws_iam_role.ec2.name
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
      values   = ["repo:${var.github_org}/${var.github_repo}:ref:refs/heads/main"]
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
    actions   = ["s3:PutObject", "s3:DeleteObject", "s3:ListBucket", "s3:GetObject"]
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
}

resource "aws_iam_policy" "github_actions" {
  name   = "${var.project_name}-github-actions-policy"
  policy = data.aws_iam_policy_document.github_actions.json
}

resource "aws_iam_role_policy_attachment" "github_actions" {
  role       = aws_iam_role.github_actions.name
  policy_arn = aws_iam_policy.github_actions.arn
}
```

- [ ] **Step 3: terraform planで確認する**

```bash
cd infra && terraform plan -var="db_password=dummy" -var="allowed_ssh_cidr=0.0.0.0/32"
```

期待結果: ECRリポジトリ、IAMロール×2、ポリシー、OIDCプロバイダの作成プランが追加される。エラーなし。

- [ ] **Step 4: コミットする**

```bash
git add infra/ecr.tf infra/iam.tf
git commit -m "infra: ECRリポジトリとIAMロール（EC2用・GitHub Actions OIDC用）を追加"
```

---

## Task 4: EC2インスタンス + 初期化スクリプト

**Files:**
- Create: `infra/ec2.tf`
- Create: `infra/scripts/user_data.sh`

- [ ] **Step 1: EC2初期化スクリプトを書く**

```bash
#!/bin/bash
# infra/scripts/user_data.sh
# EC2起動時に自動実行されるスクリプト

set -euo pipefail

# Docker インストール
yum update -y
yum install -y docker
systemctl start docker
systemctl enable docker

# ec2-userにDockerグループを追加
usermod -aG docker ec2-user

# AWS CLI v2（Amazon Linux 2023にはプリインストール済み）
# ECRログインヘルパーの準備のみ
```

- [ ] **Step 2: ec2.tfを書く**

```hcl
# infra/ec2.tf

# Amazon Linux 2023の最新AMI
data "aws_ami" "amazon_linux" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# SSHキーペア
resource "aws_key_pair" "main" {
  key_name   = "${var.project_name}-key"
  public_key = file(var.ssh_public_key_path)
}

# EC2インスタンス
resource "aws_instance" "api" {
  ami                    = data.aws_ami.amazon_linux.id
  instance_type          = "t2.micro"
  subnet_id              = aws_subnet.public.id
  vpc_security_group_ids = [aws_security_group.ec2.id]
  key_name               = aws_key_pair.main.key_name
  iam_instance_profile   = aws_iam_instance_profile.ec2.name
  user_data              = file("${path.module}/scripts/user_data.sh")

  root_block_device {
    volume_size = 20
    volume_type = "gp3"
  }

  tags = { Name = "${var.project_name}-api" }
}

# Elastic IP（固定IPアドレス）
resource "aws_eip" "api" {
  instance = aws_instance.api.id
  domain   = "vpc"

  tags = { Name = "${var.project_name}-api-eip" }
}
```

- [ ] **Step 3: terraform planで確認する**

```bash
cd infra && terraform plan -var="db_password=dummy" -var="allowed_ssh_cidr=0.0.0.0/32"
```

期待結果: EC2インスタンス、キーペア、EIPの作成プランが追加される。エラーなし。

- [ ] **Step 4: コミットする**

```bash
git add infra/ec2.tf infra/scripts/user_data.sh
git commit -m "infra: EC2インスタンス（t2.micro）と初期化スクリプトを追加"
```

---

## Task 5: RDS（PostgreSQL）

**Files:**
- Create: `infra/rds.tf`

- [ ] **Step 1: rds.tfを書く**

```hcl
# infra/rds.tf

resource "aws_db_instance" "main" {
  identifier     = "${var.project_name}-db"
  engine         = "postgres"
  engine_version = "16"
  instance_class = "db.t3.micro"

  allocated_storage     = 20
  max_allocated_storage = 50
  storage_type          = "gp3"

  db_name  = "recolly_production"
  username = var.db_username
  password = var.db_password

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]

  # シングルAZ（無料枠対応）
  multi_az = false

  # バックアップ設定
  backup_retention_period = 7
  backup_window           = "03:00-04:00"

  # メンテナンスウィンドウ
  maintenance_window = "sun:04:00-sun:05:00"

  # 削除保護（誤削除防止）
  deletion_protection = true
  skip_final_snapshot = false
  final_snapshot_identifier = "${var.project_name}-db-final-snapshot"

  # パフォーマンスインサイト（無料枠内）
  performance_insights_enabled = true

  tags = { Name = "${var.project_name}-db" }
}
```

- [ ] **Step 2: terraform planで確認する**

```bash
cd infra && terraform plan -var="db_password=dummy" -var="allowed_ssh_cidr=0.0.0.0/32"
```

期待結果: RDSインスタンスの作成プランが追加される。エラーなし。

- [ ] **Step 3: コミットする**

```bash
git add infra/rds.tf
git commit -m "infra: RDS PostgreSQL 16（db.t3.micro、シングルAZ）を追加"
```

---

## Task 6: S3 + CloudFront

**Files:**
- Create: `infra/s3.tf`
- Create: `infra/cloudfront.tf`

- [ ] **Step 1: s3.tfを書く**

```hcl
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
```

- [ ] **Step 2: cloudfront.tfを書く**

```hcl
# infra/cloudfront.tf

# S3オリジン用のOAC（Origin Access Control）
resource "aws_cloudfront_origin_access_control" "s3" {
  name                              = "${var.project_name}-s3-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "main" {
  enabled             = true
  default_root_object = "index.html"
  price_class         = "PriceClass_200"

  # オリジン1: S3（フロントエンド）
  origin {
    domain_name              = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_id                = "s3-frontend"
    origin_access_control_id = aws_cloudfront_origin_access_control.s3.id
  }

  # オリジン2: EC2（Rails API）
  origin {
    domain_name = aws_eip.api.public_ip
    origin_id   = "ec2-api"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "http-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  # デフォルト: S3からフロントエンドを配信
  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "s3-frontend"
    viewer_protocol_policy = "redirect-to-https"

    forwarded_values {
      query_string = false
      cookies { forward = "none" }
    }

    min_ttl     = 0
    default_ttl = 86400
    max_ttl     = 31536000
  }

  # /api/* はEC2に転送
  ordered_cache_behavior {
    path_pattern           = "/api/*"
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "ec2-api"
    viewer_protocol_policy = "redirect-to-https"

    # APIはキャッシュしない
    forwarded_values {
      query_string = true
      headers      = ["Authorization", "Origin", "Accept"]
      cookies { forward = "all" }
    }

    min_ttl     = 0
    default_ttl = 0
    max_ttl     = 0
  }

  # SPAルーティング対応: 404 → index.htmlにフォールバック
  custom_error_response {
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }

  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }

  restrictions {
    geo_restriction { restriction_type = "none" }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = { Name = "${var.project_name}-cdn" }
}
```

- [ ] **Step 3: terraform planで確認する**

```bash
cd infra && terraform plan -var="db_password=dummy" -var="allowed_ssh_cidr=0.0.0.0/32"
```

期待結果: S3バケット、CloudFrontディストリビューション、OACの作成プランが追加される。エラーなし。

- [ ] **Step 4: コミットする**

```bash
git add infra/s3.tf infra/cloudfront.tf
git commit -m "infra: S3バケット + CloudFront（リバースプロキシ、SPAフォールバック）を追加"
```

---

## Task 7: SSM Parameter Store + outputs

**Files:**
- Create: `infra/ssm.tf`
- Create: `infra/outputs.tf`

- [ ] **Step 1: ssm.tfを書く**

```hcl
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

resource "aws_ssm_parameter" "frontend_url" {
  name  = "/${var.project_name}/${var.environment}/FRONTEND_URL"
  type  = "String"
  value = "https://${aws_cloudfront_distribution.main.domain_name}"
}
```

- [ ] **Step 2: outputs.tfを書く**

```hcl
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
```

- [ ] **Step 3: terraform planで確認する**

```bash
cd infra && terraform plan -var="db_password=dummy" -var="allowed_ssh_cidr=0.0.0.0/32"
```

期待結果: SSMパラメータ×9、全outputが表示される。エラーなし。

- [ ] **Step 4: コミットする**

```bash
git add infra/ssm.tf infra/outputs.tf
git commit -m "infra: SSM Parameter Store（環境変数管理）とoutputsを追加"
```

---

## Task 8: Rails本番設定の変更

**Files:**
- Modify: `backend/config/environments/production.rb:43-48`
- Check: `backend/config/puma.rb:38`（変更不要を確認）

- [ ] **Step 1: production.rbのSolid Cache/Queueをmemory_store/asyncに変更する**

`backend/config/environments/production.rb` の43〜48行目を以下に変更:

```ruby
  # MVPではmemory_storeを使用（将来ElastiCacheに移行可能）
  config.cache_store = :memory_store

  # MVPではasyncアダプタを使用（Solid Queueの専用DBテーブル不要）
  config.active_job.queue_adapter = :async
```

`config.solid_queue.connects_to` の行は削除する。

- [ ] **Step 2: puma.rbを確認する（変更不要）**

`backend/config/puma.rb:38` の `plugin :solid_queue if ENV["SOLID_QUEUE_IN_PUMA"]` は環境変数 `SOLID_QUEUE_IN_PUMA` が未設定なら発動しない。本番で設定しないため変更不要。

- [ ] **Step 3: テストを実行する**

```bash
docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec
```

期待結果: 全テストパス（production.rbの変更がテストに影響しないことを確認）。

- [ ] **Step 4: コミットする**

```bash
git add backend/config/environments/production.rb
git commit -m "fix: 本番環境のキャッシュ/ジョブ設定をmemory_store/asyncに変更"
```

---

## Task 9: 本番用Dockerfile

**Files:**
- Create: `backend/Dockerfile.production`

- [ ] **Step 1: 本番用Dockerfileを書く**

```dockerfile
# backend/Dockerfile.production

# === ビルドステージ ===
FROM ruby:3.3-slim AS builder

RUN apt-get update -qq && \
    apt-get install -y build-essential libpq-dev libyaml-dev && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY Gemfile Gemfile.lock ./
RUN bundle config set --local without 'development test' && \
    bundle install --jobs 4

COPY . .

# === ランタイムステージ ===
FROM ruby:3.3-slim

RUN apt-get update -qq && \
    apt-get install -y libpq-dev libyaml-dev curl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ビルドステージからgemとアプリケーションコードをコピー
COPY --from=builder /usr/local/bundle /usr/local/bundle
COPY --from=builder /app /app

EXPOSE 3000

# ヘルスチェック
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD curl -f http://localhost:3000/api/v1/health || exit 1

CMD ["bin/rails", "server", "-b", "0.0.0.0"]
```

- [ ] **Step 2: ローカルでビルドを確認する**

```bash
cd backend && docker build -f Dockerfile.production -t recolly-backend-prod .
```

期待結果: ビルドが成功し、イメージが作成される。

- [ ] **Step 3: コミットする**

```bash
git add backend/Dockerfile.production
git commit -m "infra: 本番用マルチステージDockerfileを追加"
```

---

## Task 10: EC2デプロイスクリプト

**Files:**
- Create: `infra/scripts/deploy.sh`

- [ ] **Step 1: デプロイスクリプトを書く**

```bash
#!/bin/bash
# infra/scripts/deploy.sh
# EC2上で実行されるデプロイスクリプト
# GitHub Actionsから SSH 経由で呼び出される

set -euo pipefail

AWS_REGION="ap-northeast-1"
ECR_REGISTRY="$1"
IMAGE_TAG="$2"
APP_NAME="recolly"
CONTAINER_NAME="${APP_NAME}-api"
ENV_PREFIX="/${APP_NAME}/production"

echo "=== デプロイ開始: ${IMAGE_TAG} ==="

# ECRにログイン
aws ecr get-login-password --region "$AWS_REGION" | \
  docker login --username AWS --password-stdin "$ECR_REGISTRY"

# 新しいイメージをpull
docker pull "${ECR_REGISTRY}/${APP_NAME}-backend:${IMAGE_TAG}"

# SSM Parameter Storeから環境変数を取得
get_param() {
  aws ssm get-parameter \
    --name "${ENV_PREFIX}/$1" \
    --with-decryption \
    --query "Parameter.Value" \
    --output text \
    --region "$AWS_REGION"
}

DATABASE_URL=$(get_param "DATABASE_URL")
SECRET_KEY_BASE=$(get_param "SECRET_KEY_BASE")
RAILS_MASTER_KEY=$(get_param "RAILS_MASTER_KEY")
RAILS_ENV=$(get_param "RAILS_ENV")
TMDB_API_KEY=$(get_param "TMDB_API_KEY")
GOOGLE_BOOKS_API_KEY=$(get_param "GOOGLE_BOOKS_API_KEY")
IGDB_CLIENT_ID=$(get_param "IGDB_CLIENT_ID")
IGDB_CLIENT_SECRET=$(get_param "IGDB_CLIENT_SECRET")
FRONTEND_URL=$(get_param "FRONTEND_URL")

# DBマイグレーション実行（コンテナ再起動の前に実行）
echo "=== DBマイグレーション実行 ==="
docker run --rm \
  -e DATABASE_URL="$DATABASE_URL" \
  -e SECRET_KEY_BASE="$SECRET_KEY_BASE" \
  -e RAILS_MASTER_KEY="$RAILS_MASTER_KEY" \
  -e RAILS_ENV="$RAILS_ENV" \
  "${ECR_REGISTRY}/${APP_NAME}-backend:${IMAGE_TAG}" \
  bin/rails db:migrate

# 既存コンテナを停止・削除
docker stop "$CONTAINER_NAME" 2>/dev/null || true
docker rm "$CONTAINER_NAME" 2>/dev/null || true

# 新しいコンテナを起動
echo "=== コンテナ起動 ==="
docker run -d \
  --name "$CONTAINER_NAME" \
  --restart unless-stopped \
  -p 80:3000 \
  -e DATABASE_URL="$DATABASE_URL" \
  -e SECRET_KEY_BASE="$SECRET_KEY_BASE" \
  -e RAILS_MASTER_KEY="$RAILS_MASTER_KEY" \
  -e RAILS_ENV="$RAILS_ENV" \
  -e TMDB_API_KEY="$TMDB_API_KEY" \
  -e GOOGLE_BOOKS_API_KEY="$GOOGLE_BOOKS_API_KEY" \
  -e IGDB_CLIENT_ID="$IGDB_CLIENT_ID" \
  -e IGDB_CLIENT_SECRET="$IGDB_CLIENT_SECRET" \
  -e FRONTEND_URL="$FRONTEND_URL" \
  -e RAILS_LOG_TO_STDOUT=1 \
  "${ECR_REGISTRY}/${APP_NAME}-backend:${IMAGE_TAG}"

# ヘルスチェック
echo "=== ヘルスチェック ==="
for i in $(seq 1 30); do
  if curl -sf http://localhost/api/v1/health > /dev/null 2>&1; then
    echo "デプロイ完了（ヘルスチェックOK）"
    exit 0
  fi
  sleep 2
done

echo "ヘルスチェック失敗"
exit 1
```

- [ ] **Step 2: コミットする**

```bash
git add infra/scripts/deploy.sh
git commit -m "infra: EC2デプロイスクリプト（SSMから環境変数取得、マイグレーション、コンテナ起動）"
```

---

## Task 11: GitHub Actions CDワークフロー

**Files:**
- Create: `.github/workflows/cd.yml`

- [ ] **Step 1: CDワークフローを書く**

```yaml
# .github/workflows/cd.yml
name: CD

on:
  push:
    branches: [main]

permissions:
  id-token: write
  contents: read

env:
  AWS_REGION: ap-northeast-1

jobs:
  deploy-frontend:
    name: Deploy Frontend
    runs-on: ubuntu-latest
    # CIジョブが存在する場合はスキップ（PRマージ時はCIが先に通っている）
    defaults:
      run:
        working-directory: frontend
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json

      - run: npm ci

      - run: npm run build

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Deploy to S3
        run: aws s3 sync dist/ s3://${{ secrets.S3_BUCKET_NAME }} --delete

      - name: Invalidate CloudFront cache
        run: |
          aws cloudfront create-invalidation \
            --distribution-id ${{ secrets.CLOUDFRONT_DISTRIBUTION_ID }} \
            --paths "/*"

  deploy-backend:
    name: Deploy Backend
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Login to ECR
        id: ecr-login
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build and push Docker image
        env:
          ECR_REGISTRY: ${{ steps.ecr-login.outputs.registry }}
          IMAGE_TAG: ${{ github.sha }}
        run: |
          docker build -f backend/Dockerfile.production -t $ECR_REGISTRY/recolly-backend:$IMAGE_TAG backend/
          docker push $ECR_REGISTRY/recolly-backend:$IMAGE_TAG

      - name: Deploy to EC2
        env:
          ECR_REGISTRY: ${{ steps.ecr-login.outputs.registry }}
          IMAGE_TAG: ${{ github.sha }}
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.EC2_HOST }}
          username: ec2-user
          key: ${{ secrets.EC2_SSH_KEY }}
          script: |
            bash /home/ec2-user/deploy.sh ${{ env.ECR_REGISTRY }} ${{ env.IMAGE_TAG }}
```

- [ ] **Step 2: コミットする**

```bash
git add .github/workflows/cd.yml
git commit -m "ci: CDワークフロー（フロントエンドS3 + バックエンドEC2への自動デプロイ）"
```

---

## Task 12: terraform apply + 初回デプロイ

このタスクではインフラを実際にAWS上に構築し、初回デプロイを実行する。

- [ ] **Step 1: terraform.tfvarsを作成する**

```bash
# infra/terraform.tfvars（.gitignore対象）
cat > infra/terraform.tfvars << 'EOF'
db_password     = "(安全なパスワードを生成して入力)"
allowed_ssh_cidr = "(自分のIPアドレス)/32"
EOF
```

自分のIPアドレス確認: `curl -s ifconfig.me`

- [ ] **Step 2: terraform applyを実行する**

```bash
cd infra && terraform apply
```

期待結果: 全リソースが作成される。outputにCloudFront URL、EC2 IP等が表示される。
注意: RDSの作成には10〜15分かかる。

- [ ] **Step 3: terraform outputの値を記録する**

```bash
terraform output
```

以下の値をメモする:
- `cloudfront_url` → RecollyのURL
- `ec2_public_ip` → SSH接続先
- `ecr_repository_url` → Dockerイメージのpush先
- `github_actions_role_arn` → GitHub Secretsに設定
- `s3_bucket_name` → GitHub Secretsに設定
- `cloudfront_distribution_id` → GitHub Secretsに設定
- `rds_endpoint` → DATABASE_URLの構築に使用

- [ ] **Step 4: SSM Parameter Storeに本番値を設定する**

```bash
# SECRET_KEY_BASE生成
docker compose run --rm backend bin/rails secret

# 各パラメータを設定
aws ssm put-parameter --name "/recolly/production/SECRET_KEY_BASE" --type SecureString --value "(生成した値)" --overwrite
aws ssm put-parameter --name "/recolly/production/DATABASE_URL" --type SecureString --value "postgresql://recolly:(db_password)@(rds_endpoint)/recolly_production" --overwrite
aws ssm put-parameter --name "/recolly/production/RAILS_MASTER_KEY" --type SecureString --value "(backend/config/master.keyの値)" --overwrite
aws ssm put-parameter --name "/recolly/production/TMDB_API_KEY" --type SecureString --value "(.envの値)" --overwrite
aws ssm put-parameter --name "/recolly/production/GOOGLE_BOOKS_API_KEY" --type SecureString --value "(.envの値)" --overwrite
aws ssm put-parameter --name "/recolly/production/IGDB_CLIENT_ID" --type SecureString --value "(.envの値)" --overwrite
aws ssm put-parameter --name "/recolly/production/IGDB_CLIENT_SECRET" --type SecureString --value "(.envの値)" --overwrite
```

- [ ] **Step 5: EC2にSSH接続してデプロイスクリプトを配置する**

```bash
EC2_IP=$(terraform output -raw ec2_public_ip)
scp -i ~/.ssh/recolly-ec2 infra/scripts/deploy.sh ec2-user@$EC2_IP:/home/ec2-user/deploy.sh
ssh -i ~/.ssh/recolly-ec2 ec2-user@$EC2_IP "chmod +x /home/ec2-user/deploy.sh"
```

- [ ] **Step 6: GitHub Secretsを設定する**

GitHubリポジトリ → Settings → Secrets and variables → Actions に以下を追加:

| Secret名 | 値 |
|----------|-----|
| `AWS_ROLE_ARN` | `terraform output -raw github_actions_role_arn` の値 |
| `EC2_HOST` | `terraform output -raw ec2_public_ip` の値 |
| `EC2_SSH_KEY` | `~/.ssh/recolly-ec2` の内容（秘密鍵） |
| `S3_BUCKET_NAME` | `terraform output -raw s3_bucket_name` の値 |
| `CLOUDFRONT_DISTRIBUTION_ID` | `terraform output -raw cloudfront_distribution_id` の値 |

- [ ] **Step 7: 初回デプロイを実行する（手動）**

```bash
# バックエンド: Dockerイメージのビルド・push
ECR_URL=$(terraform output -raw ecr_repository_url)
aws ecr get-login-password --region ap-northeast-1 | docker login --username AWS --password-stdin $(echo $ECR_URL | cut -d/ -f1)
cd ../backend
docker build -f Dockerfile.production -t $ECR_URL:initial .
docker push $ECR_URL:initial

# EC2上でデプロイスクリプト実行
EC2_IP=$(cd ../infra && terraform output -raw ec2_public_ip)
ssh -i ~/.ssh/recolly-ec2 ec2-user@$EC2_IP "bash /home/ec2-user/deploy.sh $(echo $ECR_URL | cut -d/ -f1) initial"

# フロントエンド: ビルド・S3アップロード
cd ../frontend
npm run build
S3_BUCKET=$(cd ../infra && terraform output -raw s3_bucket_name)
aws s3 sync dist/ s3://$S3_BUCKET --delete

# CloudFrontキャッシュクリア
CF_ID=$(cd ../infra && terraform output -raw cloudfront_distribution_id)
aws cloudfront create-invalidation --distribution-id $CF_ID --paths "/*"
```

- [ ] **Step 8: 動作確認する**

```bash
SITE_URL=$(cd infra && terraform output -raw cloudfront_url)
echo "サイトURL: $SITE_URL"

# APIヘルスチェック（CloudFront → EC2）
curl -s "$SITE_URL/api/v1/health"

# フロントエンドが表示されるか（CloudFront → S3）
curl -s -o /dev/null -w "%{http_code}" "$SITE_URL"
```

期待結果:
- `/api/v1/health` → 200レスポンス
- `/` → 200レスポンス（React SPAのindex.html）

- [ ] **Step 9: コミットする（.gitignore以外の変更がある場合）**

```bash
git status
# 変更がある場合のみコミット
```
