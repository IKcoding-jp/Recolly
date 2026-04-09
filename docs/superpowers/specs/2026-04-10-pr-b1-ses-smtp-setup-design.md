# PR-B1: AWS SES による本番メール送信基盤の導入

- **日付**: 2026-04-10
- **担当**: IK
- **対応 Issue**: [#108](https://github.com/IKcoding-jp/Recolly/issues/108)
- **関連 PR**: PR-B2 (#107 パスワードリセット機能) の前提
- **ステータス**: Design

## 背景

Recolly はパスワードリセット等のトランザクショナルメール送信機能を必要としているが、本番環境（`backend/config/environments/production.rb`）の `action_mailer.smtp_settings` は完全にコメントアウトされており、メール送信が動作しない。

PR #104（Google Identity Services 移行）の動作確認中にオーナーアカウントがロックアウトされた際、パスワードリセットメールで自力復旧する手段が使えず、Rails console から直接パスワードを書き換えて復旧する必要があった。実ユーザーが同様の状況になったら詰む状態。

本 PR（PR-B1）では AWS SES を本番メール送信基盤として構築する。続く PR-B2 (#107) でパスワードリセット機能本体を実装する。

## スコープ

**Level B: 開発用メール送信までを完了条件とする。**

- ✅ Terraform コード + Rails config のコミット
- ✅ `terraform apply` 実行（PR マージ後、IK が手動）
- ✅ DKIM 自動検証完了
- ✅ SES サンドボックス内で IK の個人メアドを検証し、そこ宛にメールが届く状態まで確認
- ❌ SES サンドボックス解除申請の承認（別 Issue で対応）
- ❌ バウンス / complaint 通知処理（別 Issue で対応）
- ❌ パスワードリセット UI / 新規エンドポイント（PR-B2 で対応）

## 技術判断サマリ

| # | 判断事項 | 選択 | 理由 |
|---|---|---|---|
| 1 | 完了レベル | **Level B**（開発用メール送信まで） | サンドボックス解除の AWS 審査待ちで PR がブロックされるのを回避。解除は別 Issue で並行対応 |
| 2 | 送信方式 | **SES API 方式**（`aws-sdk-rails` gem） | IAM ロール認証で認証情報管理が不要。セキュリティ面で優位。EC2 から送信する Recolly の構成に最適 |
| 3 | 検証ドメイン形式 | **ルートドメイン** `recolly.net` | Recolly は現段階で小規模なためサブドメイン分離の必要性は低い。シンプルさ優先 |
| 4 | 送信元アドレス | `noreply@recolly.net` | Devise 標準。現状 `devise.rb` で `.com` になっている誤りを `.net` に修正 |
| 5 | `mailer_sender` の環境変数化 | **しない** | ドメインは本番固定。YAGNI。将来マルチテナント化時に再検討 |
| 6 | DMARC ポリシー | `p=none`（モニタリングのみ） | 初期導入で設定ミスの影響を最小化。運用安定後に段階的に強化 |
| 7 | バウンス通知処理 | **本 PR では対応しない** | スコープ過大化を回避。フォローアップ Issue で対応 |

## 全体アーキテクチャ

```
[ Rails (EC2) ]
      │
      │  ActionMailer.deliver_now
      │  delivery_method = :ses_v2
      │
      ▼
[ aws-sdk-rails gem ]
      │
      │  EC2 インスタンスロールで認証
      │  SendEmail API 呼び出し
      │
      ▼
[ AWS SES (ap-northeast-1) ]
      │
      │  ドメイン検証済みの recolly.net から送信
      │  DKIM 署名を付与
      │
      ▼
[ 受信者のメールサーバー (Gmail 等) ]
      │
      │  DKIM 検証 → SPF 検証 → DMARC 評価
      │
      ▼
[ 受信者の受信トレイ ]
```

## コンポーネント設計

### Terraform（インフラ）

| ファイル | 変更内容 | 新規/修正 |
|---|---|---|
| `infra/ses.tf` | `aws_sesv2_email_identity` リソースで `recolly.net` をドメイン identity として登録 | **新規** |
| `infra/route53.tf` | DKIM CNAME × 3 / SPF TXT / DMARC TXT を `recolly.net` に追加 | **追記** |
| `infra/iam.tf` | EC2 インスタンスロールに `ses:SendEmail` / `ses:SendRawEmail` 最小権限ポリシーを追加 | **追記** |

#### Terraform 実装イメージ

```hcl
# infra/ses.tf（新規）
resource "aws_sesv2_email_identity" "recolly_net" {
  email_identity = var.domain_name  # "recolly.net"
}

# infra/route53.tf（追記）
resource "aws_route53_record" "ses_dkim" {
  count   = 3
  zone_id = var.route53_zone_id
  name    = "${aws_sesv2_email_identity.recolly_net.dkim_signing_attributes[0].tokens[count.index]}._domainkey.recolly.net"
  type    = "CNAME"
  ttl     = 600
  records = ["${aws_sesv2_email_identity.recolly_net.dkim_signing_attributes[0].tokens[count.index]}.dkim.amazonses.com"]
}

resource "aws_route53_record" "ses_spf" {
  zone_id = var.route53_zone_id
  name    = var.domain_name
  type    = "TXT"
  ttl     = 600
  records = ["v=spf1 include:amazonses.com ~all"]
}

resource "aws_route53_record" "ses_dmarc" {
  zone_id = var.route53_zone_id
  name    = "_dmarc.${var.domain_name}"
  type    = "TXT"
  ttl     = 600
  records = ["v=DMARC1; p=none; rua=mailto:dmarc-reports@${var.domain_name}"]
}

# infra/iam.tf（追記イメージ — 既存の EC2 policy document に statement を追加）
data "aws_iam_policy_document" "ec2_ses" {
  statement {
    effect = "Allow"
    actions = [
      "ses:SendEmail",
      "ses:SendRawEmail"
    ]
    resources = [
      "arn:aws:ses:${var.aws_region}:*:identity/${var.domain_name}"
    ]
  }
}
```

（上記は構造理解用の擬似コード。実際の実装コードはプラン段階で確定する。）

### Rails（バックエンド）

| ファイル | 変更内容 | 新規/修正 |
|---|---|---|
| `backend/Gemfile` | production group に `gem 'aws-sdk-rails', '~> 4.0'` を追加 | **追記** |
| `backend/config/environments/production.rb` | `delivery_method = :ses_v2` / `raise_delivery_errors = true` / `perform_deliveries = true` を有効化。`default_url_options` に `protocol: 'https'` を追加 | **修正** |
| `backend/config/initializers/devise.rb` | `mailer_sender` を `'noreply@recolly.com'` → `'noreply@recolly.net'` に修正（誤記バグ） | **修正** |

#### production.rb 変更イメージ

```ruby
# 変更前（全てコメントアウト）
# config.action_mailer.raise_delivery_errors = false
# config.action_mailer.smtp_settings = { ... }

# 変更後
config.action_mailer.delivery_method = :ses_v2
config.action_mailer.raise_delivery_errors = true
config.action_mailer.perform_deliveries = true

config.action_mailer.default_url_options = { host: 'recolly.net', protocol: 'https' }
```

**ポイント**:
- `:ses_v2` は `aws-sdk-rails` gem が提供する組み込みデリバリメソッド（SES v2 API 経由）
- `raise_delivery_errors = true` で本番でメール送信が静かに失敗するのを防ぐ
- `protocol: 'https'` を追加することでリセットリンクの URL が `https://recolly.net/...` になる

#### 開発環境 / テスト環境は変更なし

- `development.rb`: `letter_opener_web` 継続使用
- `test.rb`: `:test` delivery_method 継続使用
- `aws-sdk-rails` gem は production group に限定 → ローカル開発には影響なし

### ドキュメント

| ファイル | 内容 | 新規/修正 |
|---|---|---|
| `docs/adr/0037-ses-api方式でメール送信.md` | 送信方式に SES API（`aws-sdk-rails`）を選んだ理由と代替案（SMTP 方式）の記録 | **新規** |
| `docs/setup/ses-setup.md` | IK の手動手順（terraform apply → DKIM 検証待ち → IK のメアド verify → 動作確認） | **新規** |
| `docs/learning/` 配下 | SPF / DKIM / DMARC の初学者向け解説（learning-note スキル発動予定） | **新規** |

## DNS レコード設計（5 件）

| # | レコード | 名前 | タイプ | 値 | 目的 |
|---|---|---|---|---|---|
| 1 | DKIM #1 | `<selector1>._domainkey.recolly.net` | CNAME | `<selector1>.dkim.amazonses.com` | DKIM 署名検証鍵 1 |
| 2 | DKIM #2 | `<selector2>._domainkey.recolly.net` | CNAME | `<selector2>.dkim.amazonses.com` | DKIM 署名検証鍵 2 |
| 3 | DKIM #3 | `<selector3>._domainkey.recolly.net` | CNAME | `<selector3>.dkim.amazonses.com` | DKIM 署名検証鍵 3 |
| 4 | SPF | `recolly.net` | TXT | `"v=spf1 include:amazonses.com ~all"` | SES からの送信を許可 |
| 5 | DMARC | `_dmarc.recolly.net` | TXT | `"v=DMARC1; p=none; rua=mailto:dmarc-reports@recolly.net"` | モニタリング（初期） |

**補足**:

- DKIM セレクタ値 (`<selector1>` など) は Terraform の `aws_sesv2_email_identity` リソース作成時に自動生成されるため、`count = 3` でループ登録する
- SPF TXT は既存レコードとマージが必要になる可能性あり（TXT は 1 ドメインに 1 レコードしか持てない）。`terraform plan` 実行前に Route53 console で既存レコードを確認する手順を運用手順書に含める
- DMARC ポリシーは段階的に強化する想定：`p=none`（初期）→ `p=quarantine`（安定後）→ `p=reject`（完全運用）

## IAM ポリシー（最小権限）

既存の EC2 インスタンスロール（`recolly-ec2-role`）に以下のポリシーを追加：

```json
{
  "Effect": "Allow",
  "Action": [
    "ses:SendEmail",
    "ses:SendRawEmail"
  ],
  "Resource": "arn:aws:ses:ap-northeast-1:*:identity/recolly.net"
}
```

- `Resource` を `recolly.net` の identity に限定（`*` ではない）
- `SendBulkTemplatedEmail` など不要な権限は含めない
- 既存ポリシーの置換ではなく **追加** として実装（既存 EC2 権限を壊さないため）

## 運用手順（IK の手動作業）

PR-B1 マージ後、以下の順で実行。詳細は `docs/setup/ses-setup.md` に記載予定。

```
Step 1: Terraform apply
  cd infra/
  terraform plan     ← 追加される SES / Route53 / IAM を確認
  terraform apply    ← 実行

Step 2: DKIM 検証完了を待つ
  AWS Console → SES → Verified identities → recolly.net
  → Identity status が "Verified" になるまで待機
  （同一 AWS アカウント内で Route53 と SES が連携するため通常数分で完了）

Step 3: テスト受信者アドレスを検証（サンドボックス対応）
  AWS Console → SES → Verified identities → Create identity
  → "Email address" を選択 → IK の個人メアドを入力
  → 受信した検証メールのリンクをクリック

Step 4: Rails デプロイ
  main ブランチマージで既存 GitHub Actions デプロイフローが走る

Step 5: 動作確認
  EC2 に AWS SSM Session Manager で接続 → rails console
  > User.find_by(email: '<IK のメアド>').send_reset_password_instructions
  → IK の受信箱にパスワードリセットメールが届けば成功
```

**Note**: SES v2 ではドメイン検証が完了すると、そのドメインの任意のアドレス (`noreply@recolly.net` 等) が送信元として使えるようになるため、`noreply@recolly.net` 自体を個別に検証する必要はない。

## deploy.sh の変更

**変更なし**。

- SES 認証情報は EC2 インスタンスロールで自動取得される → 新しい環境変数なし
- 既存の Rails デプロイフローが `production.rb` の変更をそのまま反映する

## セキュリティ考慮事項

| リスク | 対策 | 本 PR での対応 |
|---|---|---|
| SES 認証情報の漏洩 | IAM ロール方式で認証情報そのものが存在しない | 対応不要 |
| 他人のメアドへのスパム送信踏み台化 | SES サンドボックスで検証済みアドレスのみ送信可。解除後も rate limit が効く | サンドボックスのまま運用 |
| 送信元偽装（spoofing） | DKIM + SPF + DMARC で受信側が検証 | 本 PR で全て設定 |
| IAM 権限のスコープ過大 | Resource を `recolly.net` の identity に絞る | 最小権限ポリシーを実装 |
| バウンス率高騰による sender reputation 低下 | 理想は SNS + SQS でバウンス通知を受けること | **本 PR では対応しない**。フォローアップ Issue 化 |

## テスト戦略

### バックエンド (RSpec)

| テストファイル | 内容 | 種別 |
|---|---|---|
| `backend/spec/config/devise_config_spec.rb`（新規） | `Devise.mailer_sender == 'noreply@recolly.net'` を assert。`.com` への回帰を防ぐ | 設定テスト |
| `backend/spec/requests/api/v1/passwords_spec.rb`（追記） | `POST /api/v1/password` 成功時、`ActionMailer::Base.deliveries.last.from` が `['noreply@recolly.net']` であることを assert | 統合テスト |

### Terraform

**自動テストは本 PR の範囲外**。現状 Recolly の `infra/` には Terraform 自動テスト基盤が存在しない。代わりに以下で担保：

- `terraform plan` の手動レビュー（運用手順書に記載）
- `terraform apply` 後の AWS Console 目視確認

Terraform CI の整備は別 Issue で対応。

### 本番動作確認（手動）

運用手順書の Step 5（rails console からの `send_reset_password_instructions`）で対応。CI 自動化の対象外。

## 完了条件（Definition of Done）

### コード

- [ ] `infra/ses.tf` が新規作成され、`aws_sesv2_email_identity` リソースが定義されている
- [ ] `infra/route53.tf` に DKIM CNAME × 3 / SPF TXT / DMARC TXT が追加されている
- [ ] `infra/iam.tf` に EC2 インスタンスロール用の `ses:SendEmail` / `ses:SendRawEmail` 最小権限ポリシーが追加されている
- [ ] `backend/Gemfile` の production group に `gem 'aws-sdk-rails', '~> 4.0'` が追加されている
- [ ] `backend/config/environments/production.rb` で `delivery_method = :ses_v2` / `raise_delivery_errors = true` / `protocol: 'https'` が設定されている
- [ ] `backend/config/initializers/devise.rb` の `mailer_sender` が `'noreply@recolly.net'` に修正されている
- [ ] `backend/spec/config/devise_config_spec.rb` で `Devise.mailer_sender` の回帰テストが通る
- [ ] `backend/spec/requests/api/v1/passwords_spec.rb` で `from` の検証が追加されている
- [ ] 既存の mailer 関連テストが全て通る（`mailer_sender` 変更の影響範囲対応済み）

### ドキュメント

- [ ] `docs/adr/0037-ses-api方式でメール送信.md` が新規作成されている
- [ ] `docs/setup/ses-setup.md` に IK の手動手順が書かれている
- [ ] `docs/learning/` 配下に SPF / DKIM / DMARC の学習ノートが作成されている

### CI

- [ ] Backend Lint (RuboCop) パス
- [ ] Backend Test (RSpec) パス
- [ ] Frontend Lint / Test は変更なし
- [ ] Security Scan パス

### 動作確認（手動 / PR マージ後）

- [ ] `terraform plan` で想定通りの差分が確認できる
- [ ] IK の手動作業（terraform apply → DKIM 検証 → メアド verify → rails console 動作確認）で IK の受信箱にメールが届く

## リスク整理

| # | リスク | 発生確率 | 影響 | 対策 |
|---|---|---|---|---|
| 1 | `terraform apply` 実行時に既存の TXT レコード（SPF / DMARC）と衝突 | 中 | 高 | 運用手順書に「apply 前に Route53 console で既存 TXT レコードを確認」を明記 |
| 2 | DKIM 検証が完了しない（DNS 伝播遅延） | 低 | 中 | 同一 AWS アカウントなら通常数分。TTL=600。30 分経過で AWS サポートへ |
| 3 | サンドボックスモードで未検証アドレスに送信しようとして 500 エラー | 中 | 中 | **#107 実装時** に `Aws::SESV2::Errors::MessageRejected` を rescue |
| 4 | `aws-sdk-rails` の gem アップデートで破壊的変更 | 低 | 低 | Gemfile で `~> 4.0` に固定、dependabot で追跡 |
| 5 | `mailer_sender` 変更で既存テストが `from` の assertion で落ちる | 高 | 低 | プラン段階で全 mailer 関連テストを grep し、影響範囲を事前に把握 |
| 6 | `raise_delivery_errors = true` で本番 500 | 低 | 中 | 本 PR 時点ではメール送信を呼ぶ経路がない（#107 未実装）。#107 実装時に rescue 追加 |
| 7 | IAM ポリシー追加時に既存 EC2 インスタンスロールを壊す | 低 | 高 | terraform plan で差分確認、追加 statement として実装 |

**リスク #1 と #5 はプラン段階で具体タスクに落とし込む。**

## スコープ外（明示）

以下は本 PR では対応しない：

- ❌ SES サンドボックス解除申請（Level C） → 別 Issue
- ❌ バウンス / complaint 通知処理（SNS + SQS） → 別 Issue
- ❌ パスワードリセット UI / 新規エンドポイント → PR-B2 (#107)
- ❌ メール本文の日本語化（Devise mailer テンプレート） → PR-B2 (#107)
- ❌ `_dmarc` レポート受信用の SES Receiving / Lambda → 将来
- ❌ Terraform の CI 整備 / tflint → 別 Issue
- ❌ マルチテナント対応の `MAILER_FROM_EMAIL` 環境変数化 → YAGNI
