# ADR-0037: 本番メール送信に AWS SES API 方式を採用

- **日付**: 2026-04-10
- **ステータス**: Accepted
- **関連**: Issue #108, PR-B1 (feat/pr-b1-ses-smtp-setup), spec `2026-04-10-pr-b1-ses-smtp-setup-design.md`
- **関連 ADR**: ADR-0012（本番インフラ AWS 構成）、ADR-0007（Devise 認証）

## 背景

Recolly はパスワードリセット等のトランザクショナルメール送信機能を必要としているが、`backend/config/environments/production.rb` の `action_mailer.smtp_settings` が完全にコメントアウトされており、本番環境でメール送信が動作しない。

PR #104 の動作確認中、オーナーアカウントがロックアウトされた際にパスワードリセットメールで自力復旧する手段が使えず、Rails console から直接パスワードを書き換える必要があった。実ユーザーが同じ状況になったら復旧不可能になる。

本 ADR では、本番メール送信基盤として AWS SES を採用し、その送信方式（SMTP or SES API）の判断を記録する。

## 決定

**AWS SES を `aws-sdk-rails` gem 経由の SES v2 API 方式で使用する。**

具体的には:

- `backend/Gemfile` の production group に `gem 'aws-sdk-rails', '~> 5'` と `gem 'aws-actionmailer-ses', '~> 1'` を追加
- `backend/config/environments/production.rb` で `config.action_mailer.delivery_method = :ses_v2` + `ses_v2_settings = { region: 'ap-northeast-1' }`
- 認証は EC2 インスタンスロール（`infra/iam.tf` で定義する IAM ポリシー）で自動取得
- Terraform で `aws_ses_domain_identity` + `aws_ses_domain_dkim` を定義し、Route53 に DKIM / SPF / DMARC レコードを追加

### `aws-sdk-rails 5.x` の gem 構造（重要）

`aws-sdk-rails 5.x` は 4.x から大きく構造が変わっており、機能別に gem が分離されている：

- `aws-sdk-rails` 本体 — Railtie / ロガー統合など基盤機能のみ
- `aws-actionmailer-ses` — ActionMailer の `:ses` / `:ses_v2` delivery method 提供（SES v1 API 用 `aws-sdk-ses` と v2 API 用 `aws-sdk-sesv2` を自動依存）
- `aws-activejob-sqs` — ActiveJob の SQS アダプタ
- `aws-actionmailbox-ses` — ActionMailbox の SES ingress

**罠**: `aws-sdk-rails` 本体 + `aws-sdk-sesv2` だけ入れても `:ses_v2` delivery method は登録されない。`aws-actionmailer-ses` gem が必須。本 PR の初回実装時にこれを見落とし、ホットフィックスで追加した（PR #116 相当）。

## 選択肢の比較

### 選択肢 A: SES API 方式（aws-sdk-rails の :ses_v2）【採用】

**長所**:

- **認証情報の管理が不要**: EC2 インスタンスロールで自動認証される。SMTP 認証情報を SSM Parameter Store に保存したりローテーションする必要がない
- **セキュリティが良い**: 認証情報そのものが存在しないため漏洩リスクがない
- **インフラ構成がシンプル**: SSM Parameter、SMTP IAM ユーザー、credential ローテーション運用が不要
- **Recolly の構成に最適**: EC2 から送信する前提のため、インスタンスロール方式の恩恵を最大化できる
- **スループット**: SES API は SMTP より高スループット（将来の規模拡大時も対応可）

**短所**:

- **gem の追加が必要**: `aws-sdk-rails` と `aws-actionmailer-ses` gem を導入する必要がある（aws-sdk-rails 5.x は機能別に gem を分離しているため）
- **SES 以外への移行コスト**: 将来 SendGrid などへ移行する場合、delivery_method の変更が必要

### 選択肢 B: SMTP 方式（標準 Action Mailer SMTP）

**長所**:

- **Rails 標準機能のみ**: 追加の gem なしで動く
- **他 SMTP サーバーへの移行が容易**: SendGrid や Mailgun に変えたい場合、`smtp_settings` の値を変えるだけ
- **ローカル開発との対称性**: `letter_opener_web` も SMTP 的な仕組みと捉えられる（厳密には違うが）

**短所**:

- **SMTP 専用の IAM ユーザーとクレデンシャル管理が必要**: SES SMTP は IAM User の access key から専用のパスワードを導出する仕組みで、その値を SSM Parameter Store に保存する必要がある
- **クレデンシャルローテーションの運用コスト**: 定期的にローテーションする運用を考慮する必要がある
- **漏洩リスク**: クレデンシャルが存在する分、漏洩時の被害が発生し得る

### 選択肢 C: 他の外部サービス（SendGrid / Mailgun）

**長所**:

- 設定が簡単、管理画面が整っている
- メールテンプレート UI が用意されている

**短所**:

- Recolly の既存 AWS インフラ（Route53, EC2, IAM）との統合コストがかかる
- 無料枠が狭い（SendGrid は 100 通/日）
- 運用ベンダーが増える

## 採用理由

**選択肢 A（SES API 方式）を採用**：

1. **認証情報管理ゼロのセキュリティ優位性** — EC2 インスタンスロールで完結するため、クレデンシャルのライフサイクル管理という運用負担が丸ごとなくなる
2. **既存 AWS インフラとの親和性** — すでに Route53 / EC2 / IAM を Terraform で管理しているため、SES を追加するコストが最小
3. **Recolly のリソース制約** — 個人開発で運用コストを最小化したい。SMTP クレデンシャルのローテーション運用は将来の負担になる
4. **十分に成熟した gem** — `aws-sdk-rails` は AWS 公式 gem で、Action Mailer との統合がシームレス

選択肢 B は Rails 標準機能のみで完結するメリットがあるが、クレデンシャル管理の運用負担が選択肢 A の「gem 追加」よりも大きいと判断した。選択肢 C は既存 AWS インフラとの親和性で劣る。

## 影響

### ポジティブ

- 本番でパスワードリセットメールが届くようになる
- 将来のメール通知機能（新規ディスカッションコメント、おすすめ更新等）の基盤が整う
- クレデンシャル管理の運用負担が発生しない

### ネガティブ

- `aws-sdk-rails` / `aws-actionmailer-ses` gem への依存が増える（ただし production group 限定で dev/test には影響しない）
- 将来 SES 以外に移行する際、delivery_method の切り替えが必要（ただしそのとき考えればよい）

### スコープ外（別 ADR / Issue で対応）

- SES サンドボックス解除申請（別 Issue）
- バウンス / complaint 通知処理（SNS + SQS）（別 Issue）
- メール本文の日本語化（PR-B2 #107）
- DMARC ポリシーの強化（`p=none` → `p=quarantine` → `p=reject`）（運用安定後）

## 参考

- AWS SES v2 公式ドキュメント: <https://docs.aws.amazon.com/ses/latest/dg/send-email-api.html>
- aws-sdk-rails GitHub: <https://github.com/aws/aws-sdk-rails>
- Terraform AWS Provider `aws_ses_domain_identity`: <https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/ses_domain_identity>
