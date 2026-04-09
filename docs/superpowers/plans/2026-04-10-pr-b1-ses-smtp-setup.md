# PR-B1: AWS SES による本番メール送信基盤の導入 — 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** AWS SES を本番メール送信基盤として構築し、`terraform apply` と IK の手動検証作業のみで開発用メール送信が動作する状態にする。

**Architecture:** Terraform で SES ドメイン identity + DKIM/SPF/DMARC DNS レコード + EC2 インスタンスロールへの SES 権限を定義。Rails 側は `aws-sdk-rails` gem を追加し、`production.rb` の `delivery_method` を `:ses_v2` に切り替える。認証は EC2 インスタンスロールで行うため SMTP クレデンシャルは不要。

**Tech Stack:** Terraform (`aws_ses_domain_identity`, `aws_ses_domain_dkim`, `aws_route53_record`, `aws_iam_policy`), Rails 8 + Devise, `aws-sdk-rails` gem, RSpec, lefthook (pre-commit)

**Related spec:** `docs/superpowers/specs/2026-04-10-pr-b1-ses-smtp-setup-design.md`

**Related issue:** [#108](https://github.com/IKcoding-jp/Recolly/issues/108)

---

## File Structure

### Files to Create

| ファイル | 責務 |
|---|---|
| `infra/ses.tf` | SES ドメイン identity と DKIM トークン生成リソースの定義 |
| `docs/adr/0037-ses-api方式でメール送信.md` | SES API 方式を選んだ意思決定の記録（SMTP 方式との比較） |
| `docs/setup/ses-setup.md` | IK の手動作業手順書（terraform apply → DKIM 検証 → メアド検証 → 動作確認） |
| `docs/learning/spf-dkim-dmarc-basics.md` | 初学者向け SPF/DKIM/DMARC の解説（learning-note） |
| `backend/spec/config/devise_config_spec.rb` | `Devise.mailer_sender` の回帰テスト |

### Files to Modify

| ファイル | 変更内容 |
|---|---|
| `infra/route53.tf` | DKIM CNAME × 3 / SPF TXT / DMARC TXT レコードを追加 |
| `infra/iam.tf` | EC2 インスタンスロールに SES 送信権限ポリシーを追加 |
| `backend/Gemfile` | production group に `aws-sdk-rails` を追加 |
| `backend/config/environments/production.rb` | `delivery_method = :ses_v2`、`raise_delivery_errors = true`、`protocol: 'https'` を有効化 |
| `backend/config/initializers/devise.rb` | `mailer_sender` の `recolly.com` → `recolly.net` 修正 |
| `backend/spec/requests/api/v1/passwords_spec.rb` | `from` が `noreply@recolly.net` になっていることの assertion を追加 |
| `docs/superpowers/specs/2026-04-10-pr-b1-ses-smtp-setup-design.md` | Terraform リソース名を v2 → v1 に修正（`aws_sesv2_email_identity` → `aws_ses_domain_identity` + `aws_ses_domain_dkim`） |

---

## 実装前の前提確認

**開発環境が起動していること**:

```bash
docker compose ps
```

`backend`、`db`、`redis` が全て `running` であることを確認。

**現在のブランチ**: `feat/pr-b1-ses-smtp-setup`（既に作成・チェックアウト済み）

---

## Task 1: スペックのリソース名修正（v2 → v1）

ブレインストーミング中のスペックでは `aws_sesv2_email_identity` を想定していたが、context7 ドキュメント確認の結果、SES v1 Terraform リソース（`aws_ses_domain_identity` + `aws_ses_domain_dkim`）の方が公式サンプルが明確で `dkim_tokens` に直接アクセスできるため、そちらを採用する。SES サービス自体は同一で、Rails 側の SES v2 API 送信には影響しない。

**Files:**
- Modify: `docs/superpowers/specs/2026-04-10-pr-b1-ses-smtp-setup-design.md`

- [ ] **Step 1: スペックの「コンポーネント設計」セクションの Terraform 実装イメージを修正**

`aws_sesv2_email_identity` を `aws_ses_domain_identity` + `aws_ses_domain_dkim` に置き換える。該当箇所:

**Before:**
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
```

**After:**
```hcl
# infra/ses.tf（新規）
resource "aws_ses_domain_identity" "recolly_net" {
  domain = var.domain_name  # "recolly.net"
}

resource "aws_ses_domain_dkim" "recolly_net" {
  domain = aws_ses_domain_identity.recolly_net.domain
}

# infra/route53.tf（追記）
resource "aws_route53_record" "ses_dkim" {
  count   = 3
  zone_id = var.route53_zone_id
  name    = "${aws_ses_domain_dkim.recolly_net.dkim_tokens[count.index]}._domainkey.${var.domain_name}"
  type    = "CNAME"
  ttl     = 600
  records = ["${aws_ses_domain_dkim.recolly_net.dkim_tokens[count.index]}.dkim.amazonses.com"]
}
```

- [ ] **Step 2: スペックの「コンポーネント設計」表の `infra/ses.tf` 行を修正**

**Before:**
```
| `infra/ses.tf` | `aws_sesv2_email_identity` リソースで `recolly.net` をドメイン identity として登録 | **新規** |
```

**After:**
```
| `infra/ses.tf` | `aws_ses_domain_identity` と `aws_ses_domain_dkim` リソースで `recolly.net` をドメイン検証・DKIM トークン発行 | **新規** |
```

- [ ] **Step 3: スペックの「完了条件 > コード」のチェックリスト項目を修正**

**Before:**
```
- [ ] `infra/ses.tf` が新規作成され、`aws_sesv2_email_identity` リソースが定義されている
```

**After:**
```
- [ ] `infra/ses.tf` が新規作成され、`aws_ses_domain_identity` と `aws_ses_domain_dkim` リソースが定義されている
```

- [ ] **Step 4: コミット**

```bash
git add docs/superpowers/specs/2026-04-10-pr-b1-ses-smtp-setup-design.md
git commit -m "docs: スペックの Terraform リソース名を SES v1 API に修正

context7 で AWS provider v5 の公式ドキュメントを確認した結果、
aws_ses_domain_identity + aws_ses_domain_dkim (v1) の方が
公式サンプルが明確で .dkim_tokens[count.index] に直接アクセスできる。
SES サービス自体は同一で、Rails 側の SES v2 API 送信には影響なし。

Refs #108"
```

---

## Task 2: 既存 mailer 関連テストの影響範囲を確認

`mailer_sender` を `recolly.com` → `recolly.net` に変更するため、既存テストで `recolly.com` をハードコードしている箇所がないか事前確認する。リスク整理 #5 の対応。

**Files:** なし（調査のみ）

- [ ] **Step 1: `recolly.com` を参照している全ファイルを grep**

Run: `Grep tool with pattern "recolly\.com" in backend/`

Expected: 結果を確認し、`devise.rb`（修正対象）以外に参照がないことを確認。参照があれば Task 3 / Task 4 で併せて修正する。

- [ ] **Step 2: `mailer_sender` / `ActionMailer::Base.deliveries` を参照している全テストファイルを grep**

Run: `Grep tool with pattern "mailer_sender|ActionMailer::Base\.deliveries" in backend/spec/`

Expected: 結果を確認し、`from` の assertion がすでにある場合は Task 4 で重複しないようにする。

- [ ] **Step 3: 結果をメモ**

調査結果をプラン内に追記するか、次のタスクで参照できるよう記憶しておく。この Step ではコミットしない。

---

## Task 3: devise.rb の `mailer_sender` を修正 + 回帰テスト追加

TDD: まず失敗するテストを書き、`mailer_sender` の現在値 (`recolly.com`) を検出する。その後 `recolly.net` に修正して通す。

**Files:**
- Create: `backend/spec/config/devise_config_spec.rb`
- Modify: `backend/config/initializers/devise.rb:8`

- [ ] **Step 1: 失敗するテストを書く**

Create `backend/spec/config/devise_config_spec.rb`:

```ruby
# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Devise configuration' do
  describe 'mailer_sender' do
    # 回帰防止: 本番ドメイン recolly.net を使うこと。
    # 過去に recolly.com と誤記されていて SES 検証ドメインと不一致になるバグがあった。
    it 'is noreply@recolly.net' do
      expect(Devise.mailer_sender).to eq('noreply@recolly.net')
    end
  end
end
```

- [ ] **Step 2: テストを実行して失敗することを確認**

Run:
```bash
docker compose exec backend bundle exec rspec spec/config/devise_config_spec.rb
```

Expected: FAIL
```
expected: "noreply@recolly.net"
     got: "noreply@recolly.com"
```

失敗理由: `devise.rb` がまだ `recolly.com` のままだから。これが Step 1 のテストが期待する失敗。

- [ ] **Step 3: devise.rb を修正**

Modify `backend/config/initializers/devise.rb` line 8:

**Before:**
```ruby
  # メーラーの送信元アドレス
  config.mailer_sender = 'noreply@recolly.com'
```

**After:**
```ruby
  # メーラーの送信元アドレス（SES の検証ドメイン recolly.net と一致させる必要あり）
  config.mailer_sender = 'noreply@recolly.net'
```

- [ ] **Step 4: テストが通ることを確認**

Run:
```bash
docker compose exec backend bundle exec rspec spec/config/devise_config_spec.rb
```

Expected: PASS (1 example, 0 failures)

- [ ] **Step 5: RuboCop チェック**

Run:
```bash
docker compose exec backend bundle exec rubocop config/initializers/devise.rb spec/config/devise_config_spec.rb
```

Expected: `no offenses detected`

- [ ] **Step 6: コミット**

```bash
git add backend/config/initializers/devise.rb backend/spec/config/devise_config_spec.rb
git commit -m "fix: devise の mailer_sender を recolly.net に修正 + 回帰テスト追加

SES 検証ドメインは recolly.net なので送信元も .net に揃える必要がある。
現状は .com になっており、本番で SES がメール送信を拒否する状態。

Refs #108"
```

pre-commit hook（lefthook）で rubocop が再度走るので、Step 5 を通過していれば問題なくコミットできる。

---

## Task 4: passwords_spec.rb に `from` assertion を追加

`POST /api/v1/password` が成功したときに `ActionMailer::Base.deliveries.last.from` が `noreply@recolly.net` になっていることを検証する統合テストを追加する。Task 3 で devise.rb が修正済みのため、assertion は即 pass する想定。

**Files:**
- Modify: `backend/spec/requests/api/v1/passwords_spec.rb`

- [ ] **Step 1: 既存テストに from assertion を追加**

Modify `backend/spec/requests/api/v1/passwords_spec.rb`:

既存の「登録済みemailでリセットメール送信成功（200）」context に `from` の検証を追加する。

**Before:**
```ruby
  describe 'POST /api/v1/password（パスワードリセットリクエスト）' do
    context '正常系' do
      it '登録済みemailでリセットメール送信成功（200）' do
        post user_password_path,
             params: { user: { email: 'test@example.com' } },
             as: :json
        expect(response).to have_http_status(:ok)
      end
    end
```

**After:**
```ruby
  describe 'POST /api/v1/password（パスワードリセットリクエスト）' do
    context '正常系' do
      it '登録済みemailでリセットメール送信成功（200）' do
        post user_password_path,
             params: { user: { email: 'test@example.com' } },
             as: :json
        expect(response).to have_http_status(:ok)
      end

      it '送信元アドレスが noreply@recolly.net である' do
        # SES の検証ドメインと一致させるため。回帰防止として明示的に検証する。
        expect {
          post user_password_path,
               params: { user: { email: 'test@example.com' } },
               as: :json
        }.to change { ActionMailer::Base.deliveries.size }.by(1)

        expect(ActionMailer::Base.deliveries.last.from).to eq(['noreply@recolly.net'])
      end
    end
```

- [ ] **Step 2: テスト環境のメール配信をクリアする設定を確認**

Run:
```bash
docker compose exec backend bundle exec rails runner 'p ActionMailer::Base.delivery_method'
```

Expected: `:test`

これは既存の test.rb で設定されているはず。`:test` であれば `ActionMailer::Base.deliveries` が使える。

- [ ] **Step 3: テストが通ることを確認**

Run:
```bash
docker compose exec backend bundle exec rspec spec/requests/api/v1/passwords_spec.rb
```

Expected: PASS (3 examples, 0 failures — 既存 2 件 + 新規 1 件)

もし失敗したら、rails_helper.rb で `ActionMailer::Base.deliveries.clear` を each example 前に呼ぶ設定が足りない可能性を調査する。

- [ ] **Step 4: RuboCop チェック**

Run:
```bash
docker compose exec backend bundle exec rubocop spec/requests/api/v1/passwords_spec.rb
```

Expected: `no offenses detected`

- [ ] **Step 5: コミット**

```bash
git add backend/spec/requests/api/v1/passwords_spec.rb
git commit -m "test: passwords_spec に送信元アドレスの検証を追加

mailer_sender が意図通り noreply@recolly.net になっていることを
統合テストで検証する。誤って .com に戻される回帰を防ぐ。

Refs #108"
```

---

## Task 5: Gemfile に aws-sdk-rails gem を追加

production group に `aws-sdk-rails` を追加し、`bundle install` で Gemfile.lock を更新する。

**Files:**
- Modify: `backend/Gemfile`

- [ ] **Step 1: Gemfile に production group を新規追加**

現状の Gemfile には `group :production do` ブロックがない。末尾に追加する。

Modify `backend/Gemfile` 末尾（L79 の `end` の後）:

**Before (L78-L79):**
```ruby
  # 開発環境でメールをブラウザでプレビュー（パスワードリセット用）
  gem 'letter_opener_web'
end
```

**After (L78-L85):**
```ruby
  # 開発環境でメールをブラウザでプレビュー（パスワードリセット用）
  gem 'letter_opener_web'
end

group :production do
  # AWS SES 経由でメール送信するための Rails 統合（ADR-0037）
  # ActionMailer の delivery_method = :ses_v2 を提供する
  gem 'aws-sdk-rails'
end
```

- [ ] **Step 2: `bundle install` で Gemfile.lock を更新**

Run:
```bash
docker compose exec backend bundle install
```

Expected: `Bundle complete!` メッセージ。Gemfile.lock に `aws-sdk-rails` とその依存（`aws-sdk-ses`, `aws-sdk-sesv2`, `mail` 関連）が追加される。

**Note**: `aws-sdk-rails` はインストールされても development / test 環境では読み込まれない（production group なので）。そのため RSpec を実行しても本 gem には触れない。

- [ ] **Step 3: 既存の全 RSpec テストが壊れていないことを確認**

Run:
```bash
docker compose exec backend bundle exec rspec
```

Expected: 全テスト pass（production group の gem 追加は他環境に影響しないため）

- [ ] **Step 4: Gemfile.lock の差分を確認**

Run:
```bash
git diff backend/Gemfile.lock | head -40
```

Expected: `aws-sdk-rails`、`aws-sdk-ses`、`aws-sdk-sesv2` などの追加が見える。

- [ ] **Step 5: コミット**

```bash
git add backend/Gemfile backend/Gemfile.lock
git commit -m "feat: aws-sdk-rails gem を production group に追加

本番環境で AWS SES 経由のメール送信を有効化するため、
aws-sdk-rails gem を導入する。:ses_v2 delivery method を提供する。

production group 限定のため development / test 環境には影響しない。

Refs #108"
```

---

## Task 6: production.rb で SES delivery method を有効化

`production.rb` の SMTP 関連コメントアウト部分を整理し、`:ses_v2` delivery method を有効化する。`raise_delivery_errors = true` と `protocol: 'https'` も併せて設定する。

**Files:**
- Modify: `backend/config/environments/production.rb:50-64`

- [ ] **Step 1: production.rb の action_mailer 関連ブロックを修正**

Modify `backend/config/environments/production.rb` L50-L64:

**Before:**
```ruby
  # Ignore bad email addresses and do not raise email delivery errors.
  # Set this to true and configure the email server for immediate delivery to raise delivery errors.
  # config.action_mailer.raise_delivery_errors = false

  # Set host to be used by links generated in mailer templates.
  config.action_mailer.default_url_options = { host: 'recolly.net' }

  # Specify outgoing SMTP server. Remember to add smtp/* credentials via bin/rails credentials:edit.
  # config.action_mailer.smtp_settings = {
  #   user_name: Rails.application.credentials.dig(:smtp, :user_name),
  #   password: Rails.application.credentials.dig(:smtp, :password),
  #   address: "smtp.example.com",
  #   port: 587,
  #   authentication: :plain
  # }
```

**After:**
```ruby
  # AWS SES 経由でメール送信（ADR-0037）
  # aws-sdk-rails gem が提供する :ses_v2 delivery method を使用。
  # 認証は EC2 インスタンスロール（iam.tf）で自動取得されるため credentials 不要。
  config.action_mailer.delivery_method = :ses_v2
  config.action_mailer.raise_delivery_errors = true
  config.action_mailer.perform_deliveries = true

  # メーラーテンプレート内のリンクで使用されるホスト（HTTPSリンクを生成）
  config.action_mailer.default_url_options = { host: 'recolly.net', protocol: 'https' }
```

- [ ] **Step 2: production.rb の構文エラーがないことを確認**

Run:
```bash
docker compose exec backend ruby -c config/environments/production.rb
```

Expected: `Syntax OK`

- [ ] **Step 3: 既存の全テストが壊れていないことを確認**

Run:
```bash
docker compose exec backend bundle exec rspec
```

Expected: 全テスト pass（test.rb の設定には影響しないため）

- [ ] **Step 4: RuboCop チェック**

Run:
```bash
docker compose exec backend bundle exec rubocop config/environments/production.rb
```

Expected: `no offenses detected`

- [ ] **Step 5: コミット**

```bash
git add backend/config/environments/production.rb
git commit -m "feat: production で AWS SES delivery method を有効化

production.rb の action_mailer 設定を SES v2 に切り替える。

変更点:
- delivery_method = :ses_v2 を有効化
- raise_delivery_errors = true で本番での静かな失敗を防ぐ
- protocol: 'https' を追加してリセットリンクを HTTPS で生成
- 旧 SMTP 設定のコメントアウト部分を削除

EC2 インスタンスロール認証のため認証情報は不要。

Refs #108"
```

---

## Task 7: infra/ses.tf を新規作成

SES ドメイン identity と DKIM トークン生成リソースを定義する。

**Files:**
- Create: `infra/ses.tf`

- [ ] **Step 1: infra/ses.tf を作成**

Create `infra/ses.tf`:

```hcl
# infra/ses.tf

# === AWS SES: 本番メール送信基盤（ADR-0037, Issue #108） ===

# recolly.net を SES の送信元ドメインとして登録する。
# Route53 に DKIM 検証レコードを追加すると AWS が自動的に検証を完了する。
resource "aws_ses_domain_identity" "recolly_net" {
  domain = var.domain_name
}

# SES に DKIM トークンを生成させる。
# このトークンを使って Route53 に CNAME レコードを 3 つ登録する（route53.tf 参照）。
# DKIM 検証が完了すると recolly.net から送信されるメールに DKIM 署名が付く。
resource "aws_ses_domain_dkim" "recolly_net" {
  domain = aws_ses_domain_identity.recolly_net.domain
}
```

- [ ] **Step 2: terraform fmt でフォーマット**

Run:
```bash
cd infra && terraform fmt ses.tf && cd ..
```

Expected: 差分なし、または 1 行のファイル名のみ出力（フォーマット差分）。

- [ ] **Step 3: terraform validate で構文検証**

Run:
```bash
cd infra && terraform validate && cd ..
```

Expected: `Success! The configuration is valid.`

**Note**: `terraform validate` は `terraform init` 済みの状態で動作する。initialized されていない場合は `terraform init` を先に実行する必要がある。本番 state を触らないよう `-backend=false` オプションで init してもよいが、通常 infra/ ディレクトリは既に init 済みなので不要。

- [ ] **Step 4: コミット**

```bash
git add infra/ses.tf
git commit -m "feat(infra): SES ドメイン identity と DKIM リソースを追加

aws_ses_domain_identity で recolly.net を SES に登録し、
aws_ses_domain_dkim で DKIM トークンを生成する。

Route53 DNS レコードは次の route53.tf の変更で追加する。

Refs #108"
```

---

## Task 8: infra/route53.tf に DKIM / SPF / DMARC レコードを追加

DKIM CNAME × 3、SPF TXT、DMARC TXT の 5 レコードを追加する。

**Files:**
- Modify: `infra/route53.tf`

- [ ] **Step 1: route53.tf に SES 関連レコードを追加**

Modify `infra/route53.tf`（既存 L24 の `www` リソースの後に追加）:

**After existing content, append:**
```hcl

# === SES DKIM 検証レコード（ADR-0037, Issue #108） ===

# SES が生成した 3 つの DKIM トークンを CNAME で Route53 に登録する。
# これにより AWS SES が受信側メールサーバー（Gmail 等）から DKIM 署名検証を
# 受けられるようになる。登録から数分で AWS が自動的に検証完了する。
resource "aws_route53_record" "ses_dkim" {
  count   = 3
  zone_id = var.route53_zone_id
  name    = "${aws_ses_domain_dkim.recolly_net.dkim_tokens[count.index]}._domainkey.${var.domain_name}"
  type    = "CNAME"
  ttl     = 600
  records = ["${aws_ses_domain_dkim.recolly_net.dkim_tokens[count.index]}.dkim.amazonses.com"]
}

# === SPF レコード ===

# recolly.net から SES 経由でメール送信することを DNS で宣言する。
# 受信側メールサーバーはこのレコードを見て「送信元が正規のサーバーか」を判定する。
# 既存の TXT レコードと衝突する場合は手動でマージする必要がある（運用手順書参照）。
resource "aws_route53_record" "ses_spf" {
  zone_id = var.route53_zone_id
  name    = var.domain_name
  type    = "TXT"
  ttl     = 600
  records = ["v=spf1 include:amazonses.com ~all"]
}

# === DMARC レコード（初期: p=none モニタリングのみ） ===

# SPF / DKIM 検証に失敗したメールをどう扱うかを宣言する。
# p=none = モニタリングのみ（失敗しても受信拒否しない、設定ミスの影響を最小化）
# 運用が安定したら p=quarantine → p=reject に段階的に強化する。
# rua はレポート受信用エイリアス（実装は別 Issue）。
resource "aws_route53_record" "ses_dmarc" {
  zone_id = var.route53_zone_id
  name    = "_dmarc.${var.domain_name}"
  type    = "TXT"
  ttl     = 600
  records = ["v=DMARC1; p=none; rua=mailto:dmarc-reports@${var.domain_name}"]
}
```

- [ ] **Step 2: terraform fmt**

Run:
```bash
cd infra && terraform fmt route53.tf && cd ..
```

Expected: 差分なし、またはフォーマット修正のみ。

- [ ] **Step 3: terraform validate**

Run:
```bash
cd infra && terraform validate && cd ..
```

Expected: `Success! The configuration is valid.`

- [ ] **Step 4: コミット**

```bash
git add infra/route53.tf
git commit -m "feat(infra): SES の DKIM / SPF / DMARC 用 DNS レコードを追加

DKIM: SES が生成した 3 トークンを CNAME 登録 (for_each count=3)
SPF: amazonses.com からの送信を許可する TXT レコード
DMARC: 初期は p=none (モニタリングのみ) で運用開始

既存 TXT レコードとの衝突は運用手順書（docs/setup/ses-setup.md）で
apply 前に確認する手順を案内する。

Refs #108"
```

---

## Task 9: infra/iam.tf に SES 送信権限を追加

既存 EC2 インスタンスロール (`${var.project_name}-ec2-role`) に、`ses:SendEmail` と `ses:SendRawEmail` の最小権限ポリシーを追加する。既存の `ec2_ssm` / `ec2_s3_images` と同じパターンを踏襲する。

**Files:**
- Modify: `infra/iam.tf`

- [ ] **Step 1: iam.tf の EC2 S3 images ポリシーの直後に SES ポリシーを追加**

Modify `infra/iam.tf`（L73 の `ec2_s3_images` attachment の後に追加）:

**After the existing `aws_iam_role_policy_attachment "ec2_s3_images"` block, append:**

```hcl

# EC2がSES経由でメール送信する権限（ADR-0037, Issue #108）
# Resource を recolly.net の identity に限定（最小権限原則）
data "aws_iam_policy_document" "ec2_ses" {
  statement {
    actions = [
      "ses:SendEmail",
      "ses:SendRawEmail",
    ]
    resources = [
      "arn:aws:ses:${var.aws_region}:*:identity/${var.domain_name}",
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
```

- [ ] **Step 2: terraform fmt**

Run:
```bash
cd infra && terraform fmt iam.tf && cd ..
```

Expected: 差分なし、またはフォーマット修正のみ。

- [ ] **Step 3: terraform validate**

Run:
```bash
cd infra && terraform validate && cd ..
```

Expected: `Success! The configuration is valid.`

- [ ] **Step 4: コミット**

```bash
git add infra/iam.tf
git commit -m "feat(infra): EC2 ロールに SES 送信権限を追加

EC2 インスタンスロール (recolly-ec2-role) に ses:SendEmail と
ses:SendRawEmail の最小権限ポリシーを追加する。

Resource は recolly.net の identity に限定することで、
万が一ロールが漏洩しても他ドメイン経由のスパム送信はできない。

既存の ec2_ssm / ec2_s3_images と同じパターン。

Refs #108"
```

---

## Task 10: ADR 0037 を作成

SES API 方式を選んだ理由と代替案（SMTP 方式）を記録する。

**Files:**
- Create: `docs/adr/0037-ses-api方式でメール送信.md`

- [ ] **Step 1: ADR 0037 を作成**

Create `docs/adr/0037-ses-api方式でメール送信.md`:

```markdown
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

- `backend/Gemfile` の production group に `gem 'aws-sdk-rails'` を追加
- `backend/config/environments/production.rb` で `config.action_mailer.delivery_method = :ses_v2`
- 認証は EC2 インスタンスロール（`infra/iam.tf` で定義する IAM ポリシー）で自動取得
- Terraform で `aws_ses_domain_identity` + `aws_ses_domain_dkim` を定義し、Route53 に DKIM / SPF / DMARC レコードを追加

## 選択肢の比較

### 選択肢 A: SES API 方式（aws-sdk-rails の :ses_v2）【採用】

**長所**:
- **認証情報の管理が不要**: EC2 インスタンスロールで自動認証される。SMTP 認証情報を SSM Parameter Store に保存したりローテーションする必要がない
- **セキュリティが良い**: 認証情報そのものが存在しないため漏洩リスクがない
- **インフラ構成がシンプル**: SSM Parameter、SMTP IAM ユーザー、credential ローテーション運用が不要
- **Recolly の構成に最適**: EC2 から送信する前提のため、インスタンスロール方式の恩恵を最大化できる
- **スループット**: SES API は SMTP より高スループット（将来の規模拡大時も対応可）

**短所**:
- **gem の追加が必要**: `aws-sdk-rails` gem を導入する必要がある
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

- `aws-sdk-rails` gem への依存が増える（ただし production group 限定で dev/test には影響しない）
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
```

- [ ] **Step 2: コミット**

```bash
git add docs/adr/0037-ses-api方式でメール送信.md
git commit -m "docs(adr): 0037 本番メール送信に SES API 方式を採用

aws-sdk-rails gem 経由の SES v2 API を採用した判断を記録。

選択肢:
- A: SES API (採用) - IAMロールで認証、クレデンシャル管理不要
- B: SMTP - Rails標準、SMTP credentialの管理コスト
- C: SendGrid等 - 既存AWSインフラとの親和性で劣る

Refs #108"
```

---

## Task 11: 運用手順書 `docs/setup/ses-setup.md` を作成

IK の手動作業手順（terraform apply → DKIM 検証 → メアド verify → 動作確認）を書く。

**Files:**
- Create: `docs/setup/ses-setup.md`

- [ ] **Step 1: docs/setup/ ディレクトリの存在確認**

Run: `Glob tool with pattern "docs/setup/*"` to check if directory exists.

If exists, skip to Step 2. If not, it will be created automatically when writing the file.

- [ ] **Step 2: 運用手順書を作成**

Create `docs/setup/ses-setup.md`:

```markdown
# AWS SES 本番セットアップ手順（Issue #108 / PR-B1）

本書は PR-B1 マージ後に IK が実行する手動セットアップ手順です。

## 前提

- PR-B1 がマージ済み、`main` ブランチに以下が含まれている:
  - `infra/ses.tf`（新規）
  - `infra/route53.tf`（DKIM/SPF/DMARC レコード追加）
  - `infra/iam.tf`（SES 送信権限追加）
  - Rails 側の `aws-sdk-rails` gem、`production.rb`、`devise.rb` 変更
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
```

- [ ] **Step 3: コミット**

```bash
git add docs/setup/ses-setup.md
git commit -m "docs(setup): SES 本番セットアップ手順書を追加

PR-B1 マージ後に IK が実行する手動作業手順を記載:
- 既存 TXT レコード衝突チェック
- terraform plan / apply
- DKIM 検証完了の待機
- テスト受信者メアドの SES 検証
- Rails デプロイ
- rails console からの動作確認

Refs #108"
```

---

## Task 12: 学習ノート `docs/learning/spf-dkim-dmarc-basics.md` を作成

初学者向けに SPF / DKIM / DMARC の仕組みと必要性を解説する。

**Files:**
- Create: `docs/learning/spf-dkim-dmarc-basics.md`

- [ ] **Step 1: docs/learning/ ディレクトリの存在確認**

Run: `Glob tool with pattern "docs/learning/*.md"` to check existing learning notes.

- [ ] **Step 2: 学習ノートを作成**

Create `docs/learning/spf-dkim-dmarc-basics.md`:

```markdown
# SPF / DKIM / DMARC — メール認証の 3 つの仕組み

- **作成日**: 2026-04-10
- **関連 PR**: PR-B1 (#108)
- **関連 ADR**: ADR-0037（SES API 方式でメール送信）

## なぜ学ぶのか

PR-B1 で AWS SES を使って本番メール送信を有効化する作業の中で、
「DKIM トークンを DNS に登録する」「SPF レコードを書く」「DMARC ポリシーを設定する」といった作業が出てきました。これらは現代のメール配信で **必須の設定** で、設定しないと送ったメールが迷惑メールフォルダに入ったり、そもそも届かなかったりします。

この 3 つの仕組みを理解することで、メール送信がなぜこんなに複雑なのか、なぜ「ただメールを送る」だけでこんなに DNS 設定が必要なのかが分かります。

## 全体像：なぜメール認証が必要か

### メール送信の歴史的問題

電子メール（SMTP）は 1980 年代に設計されたプロトコルで、当時はインターネット上にスパムがほとんどなく「送信元が本物かどうか」を検証する仕組みが組み込まれていませんでした。

結果として、現代では:

- 誰でも `noreply@microsoft.com` を送信元アドレスに指定してメールを送れる
- スパマーが銀行や大企業を装って詐欺メールを送れる（**フィッシング**）
- スパムが爆発的に増加する

### 対策として生まれた 3 つの仕組み

これらを解決するために **段階的に** 生まれた 3 つの仕組みが SPF、DKIM、DMARC です。3 つは **補完関係** にあり、組み合わせることで初めて効果を発揮します。

| 仕組み | 登場年 | 何を解決するか |
|---|---|---|
| **SPF** | 2003 | 送信 IP が正規かチェック |
| **DKIM** | 2007 | メール内容が改ざんされていないかチェック |
| **DMARC** | 2012 | SPF / DKIM が失敗した場合にどう扱うか指定 |

## 1. SPF (Sender Policy Framework)

### 喩え

「この会社のロゴ入り封筒は、この郵便局からしか出せない」という公示を役場に掲示するイメージ。

### 仕組み

- ドメイン所有者（Recolly）が「自分のドメイン `recolly.net` からメールを送る権限がある IP / サーバーは **これこれ** です」という情報を DNS の TXT レコードに書いて公開します
- 受信側メールサーバー（Gmail 等）はメールを受け取ったら:
  1. 送信者アドレスのドメイン（`noreply@recolly.net`）を見る
  2. そのドメインの DNS TXT レコードを引いて SPF を読む
  3. 実際に接続してきたメールサーバーの IP が SPF に書かれたリストに含まれるかチェック
  4. 含まれなければ「SPF 失敗」と判定

### Recolly の SPF レコード

```
v=spf1 include:amazonses.com ~all
```

意味:
- `v=spf1`: バージョン識別子（SPF v1）
- `include:amazonses.com`: 「amazonses.com の SPF レコードを引用する」→ AWS SES の IP プール全てが許可される
- `~all`: その他の IP から来たメールは **soft fail**（疑わしいが即拒否はしない）

### なぜ `~all` で `-all` じゃないのか

- `-all` = **hard fail**（即拒否）
- `~all` = **soft fail**（疑わしいが拒否はしない）
- 初期は `~all` で始めて、設定ミスがないか確認してから `-all` に厳格化するのが一般的

### 制約

- **TXT レコードは 1 ドメインに 1 つしか持てない**: 既に `recolly.net` に SPF TXT がある場合はマージが必要
- **include の 10 回制限**: SPF の include チェーンは 10 回までしか辿れない

## 2. DKIM (DomainKeys Identified Mail)

### 喩え

封筒に本物の社印を押す。受信側は社印を見て本物かどうか確認する。社印は偽造不可能な特殊なもの。

### 仕組み

- **公開鍵暗号** を使います
  - ドメイン所有者は **秘密鍵** を保持し、メール送信時に秘密鍵でメール本文に電子署名を付けます
  - 対応する **公開鍵** を DNS の CNAME / TXT レコードに公開しておきます
- 受信側は:
  1. メールのヘッダから DKIM 署名を取り出す
  2. ドメインの DNS から公開鍵を取得する
  3. 公開鍵で署名を検証する
  4. 検証成功なら「このメールは本当に `recolly.net` から送られた、かつ内容が改ざんされていない」と判定

### AWS SES の DKIM（Easy DKIM）

AWS SES には **Easy DKIM** という仕組みがあり、秘密鍵は AWS 側で自動生成・管理されます。ドメイン所有者は **3 つのトークン** を DNS に CNAME で登録するだけで完了します。

```
<token1>._domainkey.recolly.net  CNAME  <token1>.dkim.amazonses.com
<token2>._domainkey.recolly.net  CNAME  <token2>.dkim.amazonses.com
<token3>._domainkey.recolly.net  CNAME  <token3>.dkim.amazonses.com
```

この 3 つのトークンは Terraform の `aws_ses_domain_dkim` リソースが自動生成します。

### なぜ 3 つなのか

- **キーローテーションの容易化**: AWS SES は内部的に鍵を定期的にローテーションするため、旧鍵と新鍵の両方を有効にしておく期間が必要
- **セキュリティ強化**: 複数の DKIM 鍵を使うことで、万が一 1 つの鍵が侵害されても他が有効

## 3. DMARC (Domain-based Message Authentication)

### 喩え

「社印がないうちの会社の封筒は、受け取らずに返送してください」という配送指示を郵便局に出すイメージ。

### 仕組み

- **SPF や DKIM の検証に失敗したメールをどう扱うか** をドメイン所有者が決める仕組み
- 受信側はドメインの DMARC レコードを読んで、その指示に従う

### 3 つのポリシー

| ポリシー | 意味 | 使いどころ |
|---|---|---|
| `p=none` | SPF/DKIM が失敗しても通常通り配送する。ただしレポートだけは送り返す | **初期導入時** — 設定ミスの影響を最小化 |
| `p=quarantine` | SPF/DKIM が失敗したメールを迷惑メールフォルダに入れる | **運用安定後** |
| `p=reject` | SPF/DKIM が失敗したメールを即拒否する（受信トレイにも迷惑メールフォルダにも入らない） | **完全運用** — なりすまし対策 |

### Recolly の DMARC レコード

```
v=DMARC1; p=none; rua=mailto:dmarc-reports@recolly.net
```

意味:
- `v=DMARC1`: バージョン識別子
- `p=none`: 初期は **モニタリングのみ**（失敗しても拒否しない）
- `rua=mailto:...`: 受信側は DMARC レポート（どのくらい失敗したか）をこのアドレスに送る

### なぜ最初は `p=none` なのか

いきなり `p=reject` にすると、SPF や DKIM の設定を 1 箇所でも間違えた瞬間、**全てのメールが届かなくなる** リスクがあります。

- `p=none` で数週間運用 → レポートを見て SPF/DKIM が意図通り動いているか確認
- 問題がなければ `p=quarantine` に昇格 → 迷惑メールフォルダ行きになる程度で即拒否されない
- さらに問題がなければ `p=reject` に昇格

この **段階的強化** がメール認証の定石です。

## 3 つの関係性

```
  受信側メールサーバー（Gmail 等）
         │
         ▼
  [1] SPF チェック → 送信 IP が SPF レコードに含まれるか？
         │
         ▼
  [2] DKIM チェック → メール本文の署名が公開鍵で検証できるか？
         │
         ▼
  [3] DMARC ポリシーに従って処理を決定
         │
     ┌───┼──────────────┐
     ▼   ▼              ▼
  p=none  p=quarantine  p=reject
  配送    迷惑メール行き  即拒否
```

**ポイント**:

- SPF と DKIM は **検証の仕組み**
- DMARC は **失敗した場合の扱いを決める仕組み**
- 3 つセットで初めて意味を持つ

## まとめ

- **SPF**: 送信 IP の検証（「この郵便局から出していい」を DNS で公示）
- **DKIM**: メール内容の改ざん防止（「本物の社印」を公開鍵暗号で実現）
- **DMARC**: 検証失敗時の扱いを指定（`p=none` → `p=quarantine` → `p=reject` と段階的強化）
- Recolly では初期は `p=none` で運用開始し、安定後に段階的に強化する

## 面接で聞かれたら

「メール送信の信頼性を担保するために、SPF・DKIM・DMARC という 3 つの仕組みをセットで設定しました。SPF は送信 IP を DNS で宣言する仕組み、DKIM は公開鍵暗号でメール内容に署名する仕組み、DMARC は SPF/DKIM が失敗したときにどう扱うかを指定する仕組みです。初期導入時は DMARC を `p=none` にしてモニタリングし、設定ミスがないか確認してから段階的に `p=quarantine` → `p=reject` へ強化しました」

## 参考リンク

- [AWS SES Easy DKIM 公式ドキュメント](https://docs.aws.amazon.com/ses/latest/dg/send-email-authentication-dkim-easy.html)
- [DMARC.org — DMARC Overview](https://dmarc.org/overview/)
- [Google Postmaster Tools — Email Sender Guidelines](https://support.google.com/mail/answer/81126)
```

- [ ] **Step 3: コミット**

```bash
git add docs/learning/spf-dkim-dmarc-basics.md
git commit -m "docs(learning): SPF/DKIM/DMARC の学習ノートを追加

PR-B1 で導入した 3 つのメール認証技術について、
初学者向けに仕組みと段階的強化の定石を解説。

Refs #108"
```

---

## Task 13: 最終検証

全体を通してテストと lint が通ることを確認し、プラン実装完了を宣言する。

**Files:** なし（検証のみ）

- [ ] **Step 1: 全 RSpec テストを実行**

Run:
```bash
docker compose exec backend bundle exec rspec
```

Expected: 全テスト pass。Task 3 / Task 4 で追加したテストも含まれる。

もし失敗したら、該当タスクに戻って修正する。

- [ ] **Step 2: Backend RuboCop の全体チェック**

Run:
```bash
docker compose exec backend bundle exec rubocop
```

Expected: `no offenses detected`

- [ ] **Step 3: Terraform fmt の全体チェック**

Run:
```bash
cd infra && terraform fmt -check -recursive && cd ..
```

Expected: 終了コード 0（差分なし）

差分があれば該当ファイルで `terraform fmt` を実行して修正し、コミット。

- [ ] **Step 4: Terraform validate の最終確認**

Run:
```bash
cd infra && terraform validate && cd ..
```

Expected: `Success! The configuration is valid.`

- [ ] **Step 5: git log を確認して全コミットが入っていることを確認**

Run:
```bash
git log --oneline feat/pr-b1-ses-smtp-setup ^main
```

Expected: 13 タスク分のコミット（Task 2 はコミットなしなので 12 コミット前後）

- [ ] **Step 6: git status で未ステージの変更がないことを確認**

Run:
```bash
git status
```

Expected: `nothing to commit, working tree clean`

- [ ] **Step 7: 完了報告**

Task 13 Step 1〜6 が全てパスしたら、プラン実装完了。

次のステップ:

1. 動作確認（Step 5: ワークフローの Step 5）— Playwright は UI 変更がないため不要。手動動作確認（PR-B1 マージ後に IK が terraform apply + rails console から send_reset_password_instructions）に委ねる
2. ブランチ完了 + PR 作成（Step 6: `superpowers:finishing-a-development-branch` スキル発動）

---

## Self-Review（プラン作成者による事後確認）

プラン完成後、以下をチェック済み:

**1. Spec coverage**: スペックの全ての変更項目がタスクでカバーされている
- [x] `infra/ses.tf` 新規 → Task 7
- [x] `infra/route53.tf` DKIM/SPF/DMARC → Task 8
- [x] `infra/iam.tf` SES 権限 → Task 9
- [x] `backend/Gemfile` aws-sdk-rails → Task 5
- [x] `backend/config/environments/production.rb` → Task 6
- [x] `backend/config/initializers/devise.rb` → Task 3
- [x] `backend/spec/config/devise_config_spec.rb` → Task 3
- [x] `backend/spec/requests/api/v1/passwords_spec.rb` → Task 4
- [x] `docs/adr/0037-ses-api方式でメール送信.md` → Task 10
- [x] `docs/setup/ses-setup.md` → Task 11
- [x] `docs/learning/spf-dkim-dmarc-basics.md` → Task 12

**2. Placeholder scan**: TBD / TODO / fill in later などはなし。全てのコードブロックに具体実装を記載。

**3. Type consistency**:
- Terraform リソース名は `aws_ses_domain_identity.recolly_net` / `aws_ses_domain_dkim.recolly_net` で統一
- Rails delivery method は `:ses_v2` で統一
- 送信元は `noreply@recolly.net` で統一
- DMARC ポリシーは `p=none` で統一

**4. Risk #1 対応**: 既存 TXT レコードの衝突チェックは Task 2（pre-implementation 確認）と Task 11（運用手順書の Step 0）の両方で対応済み。

**5. Risk #5 対応**: `mailer_sender` 変更の影響範囲調査は Task 2 で実施。
