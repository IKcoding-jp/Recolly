# 本番環境S3画像アップロード対応 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 本番環境で画像アップロード機能が動作するよう、S3バケット・IAM権限・SSMパラメータ・デプロイスクリプトを整備する

**Architecture:** Terraformで画像用S3バケットを作成し、CORS設定を追加。EC2ロールにS3操作権限を付与し、SSMに環境変数を登録。デプロイスクリプトで環境変数をDockerコンテナに渡す。アプリコードの変更は不要。

**Tech Stack:** Terraform (HCL), Bash, AWS S3, IAM, SSM Parameter Store

---

### Task 1: S3画像用バケットの作成 + CORS設定

**Files:**
- Modify: `infra/s3.tf` (末尾に追加)

- [ ] **Step 1: 画像用S3バケットリソースを追加**

`infra/s3.tf` の末尾に以下を追加:

```hcl
# === 画像アップロード用S3バケット ===

resource "aws_s3_bucket" "images" {
  bucket = "${var.project_name}-images-${var.aws_region}"

  tags = { Name = "${var.project_name}-images" }
}

# パブリックアクセスをブロック（署名付きURLでのみアクセス）
resource "aws_s3_bucket_public_access_block" "images" {
  bucket = aws_s3_bucket.images.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# CORS設定（ブラウザから署名付きURLでS3に直接アップロードするために必要）
resource "aws_s3_bucket_cors_configuration" "images" {
  bucket = aws_s3_bucket.images.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["PUT", "GET"]
    allowed_origins = ["https://${aws_cloudfront_distribution.main.domain_name}"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3600
  }
}
```

- [ ] **Step 2: terraform fmtで整形確認**

Run: `cd infra && terraform fmt s3.tf`
Expected: ファイル名が出力されるか、変更なしの場合は何も出力されない

- [ ] **Step 3: terraform validateで構文確認**

Run: `cd infra && terraform validate`
Expected: `Success! The configuration is valid.`

- [ ] **Step 4: コミット**

```bash
git add infra/s3.tf
git commit -m "infra: 画像アップロード用S3バケットを追加（CORS設定付き）"
```

---

### Task 2: EC2ロールにS3操作権限を追加

**Files:**
- Modify: `infra/iam.tf` (EC2セクションの末尾、L55の `aws_iam_instance_profile` の後に追加)

- [ ] **Step 1: S3操作用のIAMポリシーを追加**

`infra/iam.tf` の L55（`aws_iam_instance_profile` リソース）の後に以下を追加:

```hcl

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
```

- [ ] **Step 2: terraform fmtで整形確認**

Run: `cd infra && terraform fmt iam.tf`
Expected: ファイル名が出力されるか、変更なしの場合は何も出力されない

- [ ] **Step 3: terraform validateで構文確認**

Run: `cd infra && terraform validate`
Expected: `Success! The configuration is valid.`

- [ ] **Step 4: コミット**

```bash
git add infra/iam.tf
git commit -m "infra: EC2ロールにS3画像バケット操作権限を追加"
```

---

### Task 3: SSM Parameter Storeに環境変数を追加

**Files:**
- Modify: `infra/ssm.tf` (末尾に追加)

- [ ] **Step 1: S3関連の環境変数パラメータを追加**

`infra/ssm.tf` の末尾に以下を追加:

```hcl

# === S3画像アップロード用 ===

resource "aws_ssm_parameter" "aws_access_key_id" {
  name  = "/${var.project_name}/${var.environment}/AWS_ACCESS_KEY_ID"
  type  = "SecureString"
  value = "placeholder"

  lifecycle { ignore_changes = [value] }
}

resource "aws_ssm_parameter" "aws_secret_access_key" {
  name  = "/${var.project_name}/${var.environment}/AWS_SECRET_ACCESS_KEY"
  type  = "SecureString"
  value = "placeholder"

  lifecycle { ignore_changes = [value] }
}

resource "aws_ssm_parameter" "aws_region" {
  name  = "/${var.project_name}/${var.environment}/AWS_REGION"
  type  = "String"
  value = var.aws_region
}

resource "aws_ssm_parameter" "s3_bucket_name" {
  name  = "/${var.project_name}/${var.environment}/S3_BUCKET_NAME"
  type  = "String"
  value = aws_s3_bucket.images.id
}
```

- [ ] **Step 2: terraform fmtで整形確認**

Run: `cd infra && terraform fmt ssm.tf`
Expected: ファイル名が出力されるか、変更なしの場合は何も出力されない

- [ ] **Step 3: terraform validateで構文確認**

Run: `cd infra && terraform validate`
Expected: `Success! The configuration is valid.`

- [ ] **Step 4: コミット**

```bash
git add infra/ssm.tf
git commit -m "infra: S3画像アップロード用の環境変数をSSMに追加"
```

---

### Task 4: デプロイスクリプトにS3環境変数を追加

**Files:**
- Modify: `infra/scripts/deploy.sh`

- [ ] **Step 1: 環境変数の取得処理を追加**

`infra/scripts/deploy.sh` のL46（`SOLID_QUEUE_IN_PUMA=...`行）の後に以下を追加:

```bash
# S3画像アップロード用
AWS_ACCESS_KEY_ID_VAL=$(get_param "AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY_VAL=$(get_param "AWS_SECRET_ACCESS_KEY")
AWS_REGION_VAL=$(get_param "AWS_REGION")
S3_BUCKET_NAME=$(get_param "S3_BUCKET_NAME")
```

注: `AWS_ACCESS_KEY_ID` と `AWS_SECRET_ACCESS_KEY` は変数名に `_VAL` を付ける。理由: シェル上で `AWS_ACCESS_KEY_ID` という環境変数名を設定すると、`aws` CLI自体の認証に影響してしまうため。

- [ ] **Step 2: docker run（コンテナ起動）に環境変数を追加**

`infra/scripts/deploy.sh` のdocker run -d コマンド内の `-e SOLID_QUEUE_IN_PUMA="$SOLID_QUEUE_IN_PUMA"` 行の後に以下の4行を追加:

```bash
  -e AWS_ACCESS_KEY_ID="$AWS_ACCESS_KEY_ID_VAL" \
  -e AWS_SECRET_ACCESS_KEY="$AWS_SECRET_ACCESS_KEY_VAL" \
  -e AWS_REGION="$AWS_REGION_VAL" \
  -e S3_BUCKET_NAME="$S3_BUCKET_NAME" \
```

- [ ] **Step 3: bashの構文チェック**

Run: `bash -n infra/scripts/deploy.sh`
Expected: 出力なし（構文エラーがなければ何も表示されない）

- [ ] **Step 4: コミット**

```bash
git add infra/scripts/deploy.sh
git commit -m "infra: デプロイスクリプトにS3環境変数の取得・受け渡しを追加"
```

---

### Task 5: outputsにバケット名を追加

**Files:**
- Modify: `infra/outputs.tf` (末尾に追加)

- [ ] **Step 1: 画像バケット名のoutputを追加**

`infra/outputs.tf` の末尾に以下を追加:

```hcl

output "s3_images_bucket_name" {
  description = "画像アップロード用S3バケット名"
  value       = aws_s3_bucket.images.id
}
```

- [ ] **Step 2: terraform validateで構文確認**

Run: `cd infra && terraform validate`
Expected: `Success! The configuration is valid.`

- [ ] **Step 3: コミット**

```bash
git add infra/outputs.tf
git commit -m "infra: 画像バケット名をoutputsに追加"
```

---

### Task 6: デプロイ後の手動作業（IKさんが実施）

この作業はコード変更ではなく、AWS環境への反映作業です。

- [ ] **Step 1: terraform applyでインフラ変更を反映**

```bash
cd infra
terraform plan    # 変更内容を事前確認
terraform apply   # 変更を適用
```

Expected: S3バケット作成、IAMポリシー追加、SSMパラメータ4つ作成

- [ ] **Step 2: AWS CLIでアクセスキーの実際の値をSSMに設定**

```bash
aws ssm put-parameter \
  --name "/recolly/production/AWS_ACCESS_KEY_ID" \
  --type "SecureString" \
  --value "実際のアクセスキーID" \
  --overwrite \
  --region ap-northeast-1

aws ssm put-parameter \
  --name "/recolly/production/AWS_SECRET_ACCESS_KEY" \
  --type "SecureString" \
  --value "実際のシークレットアクセスキー" \
  --overwrite \
  --region ap-northeast-1
```

- [ ] **Step 3: 再デプロイ**

GitHub Actionsまたは手動でデプロイを実行し、新しい環境変数が反映されたコンテナを起動する。

- [ ] **Step 4: 動作確認**

本番環境で以下を確認:
1. 手動登録から画像をアップロードできる
2. アップロードした画像が正しく表示される
3. 画像を削除できる
