# AWS SES 本番セットアップ手順（Issue #108 / PR-B1）

本書は PR-B1 マージ後に IK が実行する手動セットアップ手順です。

## 前提

- PR-B1 がマージ済み、`main` ブランチに以下が含まれている:
  - `infra/ses.tf`（新規）
  - `infra/route53.tf`（DKIM/SPF/DMARC レコード追加）
  - `infra/iam.tf`（SES 送信権限追加）
  - Rails 側の `aws-sdk-rails` / `aws-sdk-sesv2` gem、`production.rb`、`devise.rb` 変更
- `infra/` ディレクトリで `terraform init` 済み
- AWS SSO またはアクセスキーでのログインが有効

## Step 0: 事前確認 — 既存 TXT レコードの衝突チェック

SPF / DMARC の TXT レコードを追加する前に、既存の TXT レコードと衝突しないか確認します。

### AWS Console で確認

1. AWS Console → Route 53 → ホストゾーン → `recolly.net` を選択
2. 以下の名前の TXT レコードが **既に存在するか** 確認:
   - `recolly.net` (type TXT) — SPF 用
   - `_dmarc.recolly.net` (type TXT) — DMARC 用

### 衝突していた場合の対応

- **既存の SPF**: `v=spf1 include:amazonses.com ~all` の `include:amazonses.com` 部分を既存の値にマージしてから terraform コードを調整
- **既存の DMARC**: どちらかを優先する判断が必要。既存値と Terraform の値を比較して、厳しい方を採用

衝突がなければそのまま Step 1 に進む。

## Step 1: Terraform plan で差分を確認

```bash
cd infra/
terraform plan
```

**期待する差分**:

- `aws_ses_domain_identity.recolly_net` を **追加**
- `aws_ses_domain_dkim.recolly_net` を **追加**
- `aws_route53_record.ses_dkim[0..2]` を **追加** (3 件)
- `aws_route53_record.ses_spf` を **追加**
- `aws_route53_record.ses_dmarc` を **追加**
- `aws_iam_policy.ec2_ses` を **追加**
- `aws_iam_role_policy_attachment.ec2_ses` を **追加**
- `data.aws_iam_policy_document.ec2_ses` を **読み取り**

既存リソースの変更 / 削除がないことを確認。もし変更 / 削除が入っている場合は、Step 0 に戻って調査してください。

## Step 2: Terraform apply を実行

```bash
cd infra/
terraform apply
```

確認プロンプトで `yes` と入力して実行。

**期待する出力**: `Apply complete! Resources: 8 added, 0 changed, 0 destroyed.`

## Step 3: DKIM 検証完了を待つ

1. AWS Console → SES (Simple Email Service) → リージョン **ap-northeast-1** を選択
2. 左メニュー「Verified identities」を開く
3. `recolly.net` という名前のドメイン identity が表示されていることを確認
4. クリックして詳細を開き、**"Identity status"** が `Verified` に変わるまで待つ

**所要時間**: 通常数分（Route53 と SES が同一 AWS アカウント内で連携するため高速）

**30 分経過しても `Pending` のまま**の場合:

- Route53 の DKIM CNAME レコードが正しく登録されているか確認
- `dig TXT recolly.net` で SPF TXT が見えるか確認
- AWS サポートケースを作成

## Step 4: テスト受信者メアドを SES に登録（サンドボックス対応）

SES は初期状態で「サンドボックスモード」です。このモードでは **検証済みアドレスにしかメールを送れません**。動作確認用に IK の個人メアドを検証します。

1. AWS Console → SES → Verified identities → **Create identity**
2. **Identity type** で `Email address` を選択
3. Email address に IK の個人メアドを入力（例: `your-personal-email@gmail.com`）
4. **Create identity** をクリック
5. 入力したメアドの受信箱に AWS からの検証メールが届くので、本文中のリンクをクリック
6. SES Console に戻り、該当メアドの Identity status が `Verified` になっていることを確認

**注**: ドメイン検証が完了していれば `noreply@recolly.net` は個別検証不要。送信時は自動的に使えます。

## Step 5: Rails の本番デプロイ

`main` ブランチにマージ済みであれば、GitHub Actions の既存デプロイフローで自動デプロイされます。

手動でデプロイする場合:

```bash
# GitHub Actions の Deploy workflow を手動トリガー
gh workflow run deploy.yml
```

デプロイ完了後、EC2 内の Rails アプリが `delivery_method = :ses_v2` で起動していることを確認。

## Step 6: 動作確認（rails console からテストメール送信）

1. AWS Console → EC2 → Instance connect → Session Manager で EC2 に接続
2. Docker コンテナ内の Rails console を起動:

   ```bash
   cd /path/to/recolly/backend
   docker compose exec backend bundle exec rails console
   ```

3. rails console でパスワードリセットメールを送信:

   ```ruby
   User.find_by(email: 'your-personal-email@gmail.com').send_reset_password_instructions
   ```

   `your-personal-email@gmail.com` は Step 4 で検証したメアドに置き換え。

4. **期待結果**: IK の受信箱にパスワードリセットメールが届く。差出人は `noreply@recolly.net`

### メールが届かない場合のチェックポイント

- **迷惑メールフォルダ** を確認
- CloudWatch Logs で SES の送信ログを確認
- Rails のログで `Aws::SESV2::Errors::*` が出ていないか確認
- EC2 インスタンスロールに SES 権限が付与されているか AWS Console で確認

## 完了後のスコープ外タスク（別 Issue 化）

- **SES サンドボックス解除申請** — 任意のアドレスに送れるようにする。所要時間は AWS 審査次第（数日〜数週間）
- **バウンス / complaint 通知の SNS + SQS 処理** — 配信失敗を監視するため
- **DMARC ポリシーの強化** — 運用安定後に `p=quarantine` → `p=reject`
