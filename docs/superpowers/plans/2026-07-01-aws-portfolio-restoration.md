# Recolly AWSインフラ復元 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 停止中のRecollyを、既存Terraformコードで再構築し、`https://recolly.net` に常時アクセス可能な状態に戻す。

**Architecture:** `infra/` のTerraformコードをそのまま`terraform apply`して EC2 + RDS + S3 + CloudFront + ECR + ACM を再作成。バックエンドをECR経由でEC2にデプロイし、フロントエンドをS3+CloudFrontにデプロイする。最後にAWS Budgetsでコスト監視を追加する。

**Tech Stack:** Terraform (~> 5.0 AWS provider) / Docker / AWS CLI / GitHub Actions (`gh` CLI)

## Global Constraints

- 新機能追加・UIデザイン変更は行わない（[仕様書](../specs/2026-07-01-aws-portfolio-restoration-design.md)のスコープ外）
- RDSは `deletion_protection = false` / `skip_final_snapshot = true` を採用する（既にinfra/rds.tfに反映済み）
- Route 53ホストゾーン（`recolly.net`、Zone ID: `Z0652107PC71F5FLQ8Q4`）はそのまま流用する
- 秘密情報（APIキー・パスワード等）はコミットしない。`.gitignore`済みの`terraform.tfvars`・SSM Parameter Store・GitHub Secretsのみに保存する
- 各タスクの実行前に、実際にAWSリソースを作成・変更するコマンドは内容を明示してから実行する（課金・削除を伴うため）

---

### Task 1: rds.tfの変更を確定コミット

**Files:**
- Modify: `infra/rds.tf`（既存の未コミット変更を確定）

**Interfaces:**
- Produces: RDS再作成時に `deletion_protection=false` が適用される状態

- [ ] **Step 1: 現在の差分を確認**

Run: `git diff infra/rds.tf`
Expected: `deletion_protection`, `skip_final_snapshot`, `final_snapshot_identifier` 関連の差分が表示される

- [ ] **Step 2: コミット**

```bash
git add infra/rds.tf
git commit -m "$(cat <<'EOF'
fix: RDSの削除保護を無効化（ポートフォリオ用途のため）

本番データではなくポートフォリオ用途のため、誤操作時の復旧より
畳みやすさを優先する。
EOF
)"
```

Expected: コミットが作成される（`git log -1 --oneline` で確認）

---

### Task 2: terraform.tfvarsの再構成とバリデーション

**Files:**
- Modify: `infra/terraform.tfvars`（gitignore対象、コミットしない）

**Interfaces:**
- Consumes: `infra/variables.tf` で定義された変数（`db_password`, `allowed_ssh_cidr`, `route53_zone_id` の3つはデフォルト値なしのため必須）
- Produces: `terraform plan`/`apply` が実行可能な状態

- [ ] **Step 1: 現在のグローバルIPを確認**

Run: `curl -s https://checkip.amazonaws.com`
Expected: IPv4アドレスが1行返る（例: `203.0.113.10`）。この値を `allowed_ssh_cidr` に `/32` を付けて使う

- [ ] **Step 2: DBパスワードを新規生成**

Run: `openssl rand -base64 24`
Expected: ランダムな24バイトのBase64文字列が出力される

- [ ] **Step 3: terraform.tfvarsに値を記述**

`infra/terraform.tfvars` の内容（Step 1, 2の値を埋める。他の変数はvariables.tfのデフォルトを使うため記載不要）:

```hcl
# infra/terraform.tfvars
db_password      = "<Step2で生成した値>"
allowed_ssh_cidr = "<Step1のIP>/32"
route53_zone_id  = "Z0652107PC71F5FLQ8Q4"
```

- [ ] **Step 4: Terraform初期化**

Run: `cd infra && terraform init`
Expected: `Terraform has been successfully initialized!`（S3バックエンド`recolly-terraform-state`に接続）

- [ ] **Step 5: 構文バリデーション**

Run: `cd infra && terraform validate`
Expected: `Success! The configuration is valid.`

---

### Task 3: terraform planで差分確認

**Files:**
- なし（読み取りのみ）

**Interfaces:**
- Consumes: Task 2で初期化されたTerraform環境
- Produces: 作成予定リソースの一覧（Task 4で使用）

- [ ] **Step 1: プラン実行**

Run: `cd infra && terraform plan -out=tfplan`
Expected: `Plan: N to add, 0 to change, 0 to destroy` という形式の出力（Nはリソース数、EC2/RDS/S3/CloudFront/ECR/ACM/SSM/IAM関連が含まれる）

- [ ] **Step 2: 破壊的変更がないことを確認**

Run: `terraform show -json tfplan | grep -o '"action":\[[^]]*\]' | sort -u`
Expected: `"action":["create"]` のみが含まれる（`"delete"`や`"replace"`系が含まれていないこと）。既存のRoute53ホストゾーン・S3バケット（`recolly-dev-images`, `recolly-terraform-state`）に対する削除アクションが出ていないか目視確認する

---

### Task 4: terraform applyでインフラ作成

**Files:**
- なし（AWSリソース作成）

**Interfaces:**
- Consumes: Task 3の`tfplan`
- Produces: `terraform output` で取得できる各種ID（Task 5〜8で使用）

- [ ] **Step 1: 適用**

Run: `cd infra && terraform apply tfplan`
Expected: `Apply complete! Resources: N added, 0 changed, 0 destroyed.`

- [ ] **Step 2: outputsを保存**

Run: `cd infra && terraform output -json > /tmp/recolly-tf-outputs.json && cat /tmp/recolly-tf-outputs.json`
Expected: `ec2_public_ip`, `rds_endpoint`, `ecr_repository_url`, `s3_bucket_name`, `cloudfront_distribution_id`, `github_actions_role_arn`, `s3_images_bucket_name` が含まれるJSON

- [ ] **Step 3: EC2が起動していることを確認**

Run: `aws ec2 describe-instances --filters "Name=tag:Name,Values=recolly-api" --query "Reservations[].Instances[].State.Name" --output text`
Expected: `running`

---

### Task 5: SSM Parameter Storeに実際の値を投入

**Files:**
- なし（SSM Parameter Store更新。値はローカルの`.env`から転記する。ターミナルに値を表示しないこと）

**Interfaces:**
- Consumes: Task 4で作成されたRDSエンドポイント（`rds_endpoint`）、ローカル`.env`の各APIキー、`backend/config/master.key`の値
- Produces: `deploy.sh`が参照する全SSMパラメータの実値

- [ ] **Step 1: DATABASE_URLを設定**

`rds_endpoint`（例: `recolly-db.xxxxx.ap-northeast-1.rds.amazonaws.com:5432`）と Task 2 で生成したDBパスワードを使い、値を直接ターミナルに出さずファイル経由で投入する:

```bash
RDS_ENDPOINT=$(cd infra && terraform output -raw rds_endpoint)
DB_PASSWORD="<Task2で生成したパスワード>"
aws ssm put-parameter \
  --name "/recolly/production/DATABASE_URL" \
  --value "postgres://recolly:${DB_PASSWORD}@${RDS_ENDPOINT}/recolly_production" \
  --type SecureString --overwrite
```

Expected: `{"Version": 2, "Tier": "Standard"}`（Version番号は環境により変わる）

- [ ] **Step 2: RAILS_MASTER_KEYを設定**

```bash
aws ssm put-parameter \
  --name "/recolly/production/RAILS_MASTER_KEY" \
  --value "$(cat backend/config/master.key)" \
  --type SecureString --overwrite
```

Expected: `{"Version": 2, "Tier": "Standard"}`

- [ ] **Step 3: SECRET_KEY_BASEを設定**

```bash
aws ssm put-parameter \
  --name "/recolly/production/SECRET_KEY_BASE" \
  --value "$(openssl rand -hex 64)" \
  --type SecureString --overwrite
```

Expected: `{"Version": 2, "Tier": "Standard"}`

- [ ] **Step 4: 外部APIキー群をローカル.envから転記**

ローカル`.env`の値（TMDB / Google Books / IGDB / Google OAuth / Anthropic）をそれぞれ確認しながら、以下を1つずつ実行する（`<...>`部分をローカル`.env`の実際の値に置き換える。値をチャットや別ファイルに書き出さないこと）:

```bash
for name in TMDB_API_KEY GOOGLE_BOOKS_API_KEY IGDB_CLIENT_ID IGDB_CLIENT_SECRET GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET ANTHROPIC_API_KEY; do
  aws ssm put-parameter --name "/recolly/production/${name}" --value "<.envの値>" --type SecureString --overwrite
done
```

Expected: 各コマンドで `{"Version": 2, "Tier": "Standard"}` が返る

- [ ] **Step 5: 全パラメータが揃っていることを確認**

Run: `aws ssm describe-parameters --parameter-filters "Key=Name,Option=BeginsWith,Values=/recolly/production" --query "Parameters[].Name" --output table`
Expected: `RAILS_ENV`, `DATABASE_URL`, `SECRET_KEY_BASE`, `RAILS_MASTER_KEY`, `TMDB_API_KEY`, `GOOGLE_BOOKS_API_KEY`, `IGDB_CLIENT_ID`, `IGDB_CLIENT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ANTHROPIC_API_KEY`, `FRONTEND_URL`, `S3_BUCKET_NAME` の13件が表示される

---

### Task 6: バックエンドの初回デプロイ

**Files:**
- なし（Docker build & EC2上での実行）

**Interfaces:**
- Consumes: Task 4の`ecr_repository_url`、Task 5で投入したSSMパラメータ、`backend/Dockerfile.production`、`infra/scripts/deploy.sh`
- Produces: EC2上で起動中のRailsコンテナ（ポート80）

- [ ] **Step 1: deploy.shをEC2に同期**

（[[recolly_project_deploy_script]]の既知の落とし穴：EC2上のdeploy.shはGitHub更新で自動反映されないため、S3経由で手動同期する。
EC2のIAMロールは`recolly-images-${var.aws_region}`バケットのみアクセス権を持つため、既存の`recolly-dev-images`ではなく、Terraformが今回新規作成した画像用バケット（`s3_images_bucket_name`）を使う）

```bash
IMAGES_BUCKET=$(cd infra && terraform output -raw s3_images_bucket_name)
aws s3 cp infra/scripts/deploy.sh s3://${IMAGES_BUCKET}/tmp/deploy.sh
EC2_IP=$(cd infra && terraform output -raw ec2_public_ip)
ssh -i ~/.ssh/recolly-ec2 ec2-user@${EC2_IP} \
  "aws s3 cp s3://${IMAGES_BUCKET}/tmp/deploy.sh /home/ec2-user/deploy.sh && \
   sed -i 's/\r//g' /home/ec2-user/deploy.sh && \
   chmod +x /home/ec2-user/deploy.sh"
```

Expected: エラーなく完了する

- [ ] **Step 2: Dockerイメージをbuild & ECRへpush**

```bash
ECR_URL=$(cd infra && terraform output -raw ecr_repository_url)
aws ecr get-login-password --region ap-northeast-1 | docker login --username AWS --password-stdin "${ECR_URL%%/*}"
docker build -f backend/Dockerfile.production -t ${ECR_URL}:initial backend/
docker push ${ECR_URL}:initial
```

Expected: `initial: digest: sha256:... size: ...` が出力される

- [ ] **Step 3: EC2上でdeploy.shを実行**

```bash
EC2_IP=$(cd infra && terraform output -raw ec2_public_ip)
ECR_URL=$(cd infra && terraform output -raw ecr_repository_url)
ssh -i ~/.ssh/recolly-ec2 ec2-user@${EC2_IP} \
  "bash /home/ec2-user/deploy.sh ${ECR_URL%/*} initial"
```

Expected: 最後に `デプロイ完了（ヘルスチェックOK）` と表示される

- [ ] **Step 4: EC2側で直接ヘルスチェック**

Run: `ssh -i ~/.ssh/recolly-ec2 ec2-user@${EC2_IP} "curl -sf http://localhost/api/v1/health"`
Expected: `200`系のJSONレスポンス（例: `{"status":"ok"}`）

---

### Task 7: フロントエンドのデプロイ

**Files:**
- Create: `frontend/dist/`（ビルド成果物、コミット対象外）

**Interfaces:**
- Consumes: Task 4の`s3_bucket_name`, `cloudfront_distribution_id`
- Produces: CloudFront経由で配信される最新フロントエンド

- [ ] **Step 1: ビルド**

```bash
cd frontend
VITE_GOOGLE_CLIENT_ID="<.envの値>" npx vite build
```

Expected: `dist/` ディレクトリが生成される。`✓ built in Xs` と表示される

- [ ] **Step 2: S3へ同期**

```bash
S3_BUCKET=$(cd ../infra && terraform output -raw s3_bucket_name)
aws s3 sync dist/ s3://${S3_BUCKET} --delete
```

Expected: アップロードされたファイル一覧が表示される

- [ ] **Step 3: CloudFrontキャッシュを無効化**

```bash
CF_ID=$(cd ../infra && terraform output -raw cloudfront_distribution_id)
aws cloudfront create-invalidation --distribution-id ${CF_ID} --paths "/*"
```

Expected: `"Status": "InProgress"` を含むJSONが返る

---

### Task 8: GitHub Actions Secretsの更新

**Files:**
- なし（GitHub Secrets更新。`gh` CLIを使用）

**Interfaces:**
- Consumes: Task 4のTerraform outputs
- Produces: 今後の`git push`によるCD（`.github/workflows/cd.yml`）が新しいリソースに対して正しく動作する状態

- [ ] **Step 1: 現在のSecrets一覧を確認**

Run: `gh secret list --repo IKcoding-jp/recolly`
Expected: `AWS_ROLE_ARN`, `S3_BUCKET_NAME`, `CLOUDFRONT_DISTRIBUTION_ID`, `EC2_INSTANCE_ID`, `VITE_GOOGLE_CLIENT_ID` が一覧に含まれる

- [ ] **Step 2: 再作成されたリソースのIDでSecretsを更新**

```bash
cd infra
gh secret set AWS_ROLE_ARN --repo IKcoding-jp/recolly --body "$(terraform output -raw github_actions_role_arn)"
gh secret set S3_BUCKET_NAME --repo IKcoding-jp/recolly --body "$(terraform output -raw s3_bucket_name)"
gh secret set CLOUDFRONT_DISTRIBUTION_ID --repo IKcoding-jp/recolly --body "$(terraform output -raw cloudfront_distribution_id)"
EC2_INSTANCE_ID=$(aws ec2 describe-instances --filters "Name=tag:Name,Values=recolly-api" --query "Reservations[0].Instances[0].InstanceId" --output text)
gh secret set EC2_INSTANCE_ID --repo IKcoding-jp/recolly --body "${EC2_INSTANCE_ID}"
```

Expected: 各コマンドで `✓ Set Secret ... for IKcoding-jp/recolly` と表示される

---

### Task 9: AWS Budgetsで月額コストアラートを設定

**Files:**
- なし（AWS Budgets設定。コンソールまたはCLIで作成）

**Interfaces:**
- Consumes: なし
- Produces: 月額コストが閾値を超えたときのメール通知、「Explore AWS: Set up a cost budget using AWS Budgets」クレジット$20の解放

- [ ] **Step 1: 予算定義ファイルを作成**

`/tmp/recolly-budget.json`:

```json
{
  "BudgetName": "recolly-monthly-cost",
  "BudgetLimit": { "Amount": "10", "Unit": "USD" },
  "TimeUnit": "MONTHLY",
  "BudgetType": "COST"
}
```

- [ ] **Step 2: 通知定義ファイルを作成**

`/tmp/recolly-notifications.json`（通知先メールアドレスは実際のものに置き換える）:

```json
[
  {
    "Notification": {
      "NotificationType": "ACTUAL",
      "ComparisonOperator": "GREATER_THAN",
      "Threshold": 80,
      "ThresholdType": "PERCENTAGE"
    },
    "Subscribers": [
      { "SubscriptionType": "EMAIL", "Address": "kensaku.ikeda04@gmail.com" }
    ]
  }
]
```

- [ ] **Step 3: 予算を作成**

```bash
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
aws budgets create-budget \
  --account-id ${ACCOUNT_ID} \
  --budget file:///tmp/recolly-budget.json \
  --notifications-with-subscribers file:///tmp/recolly-notifications.json
```

Expected: エラーなく完了（レスポンスは空）

- [ ] **Step 4: 作成された予算を確認**

Run: `aws budgets describe-budgets --account-id ${ACCOUNT_ID} --query "Budgets[].BudgetName" --output table`
Expected: `recolly-monthly-cost` が表示される

- [ ] **Step 5: クレジット解放を確認**

AWSコンソール → 請求とコスト管理 → クレジット で「Explore AWS: Set up a cost budget using AWS Budgets」のステータスが完了扱いになっているか、翌日以降に確認する（即時反映されない場合がある旨をユーザーに伝える）

---

### Task 10: エンドツーエンド動作確認

**Files:**
- なし

**Interfaces:**
- Consumes: Task 6, 7の成果物
- Produces: 「復元完了」の確認結果

- [ ] **Step 1: フロントエンドの疎通確認**

Run: `curl -sI https://recolly.net`
Expected: `HTTP/2 200`

- [ ] **Step 2: バックエンドAPIの疎通確認**

Run: `curl -sf https://recolly.net/api/v1/health`
Expected: `200`系のJSONレスポンス

- [ ] **Step 3: ブラウザで実際にログイン〜作品検索まで確認**

`https://recolly.net` にアクセスし、ログイン（メール or Google OAuth）→ 作品検索 → 記録作成、が一通り動くことを目視確認する

- [ ] **Step 4: コスト状況の最終確認**

Run: `aws ce get-cost-and-usage --time-period Start=2026-07-01,End=2026-07-02 --granularity DAILY --metrics "UnblendedCost" --output json`
Expected: `UnblendedCost` がクレジットで相殺されほぼ$0であることを確認
