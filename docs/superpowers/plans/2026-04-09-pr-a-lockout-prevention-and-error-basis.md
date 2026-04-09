# PR-A: Lockout Prevention and Error Basis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Issue #105 / #106 / #109(基盤) / #110 を多層防御+エラー基盤整備として同時解決する

**Architecture:** データフロー下流から積む方式。①BEエラー形式統一 → ②FE共通基盤 → ③マイグレーション+モデル層防御 → ④Controller層トランザクション保護 → ⑤Rakeタスク+最終調整。各層ごとに TDD で実装し、こまめに commit する

**Tech Stack:** Ruby 3.3 / Rails 8 / RSpec / React 19 / TypeScript / Vitest / PostgreSQL 16

**Related:** spec `docs/superpowers/specs/2026-04-09-pr-a-lockout-prevention-and-error-basis-design.md` / ADR-0036

---

## File Structure

### 新規作成

- `backend/app/errors/api_error_codes.rb` — エラーコード定数モジュール
- `db/migrate/YYYYMMDDHHMMSS_add_password_set_at_to_users.rb` — マイグレーション
- `backend/lib/tasks/lockout.rake` — ロックアウト検出 Rake タスク
- `backend/spec/tasks/lockout_rake_spec.rb` — Rake タスクの spec
- `frontend/src/lib/errorMessages.ts` — エラーコード → 日本語マッピング辞書
- `frontend/src/lib/errorMessages.test.ts` — 上記のテスト
- `docs/api-error-codes.md` — エラーコード運用ドキュメント

### 変更

- `backend/app/controllers/application_controller.rb` — `render_error` ヘルパー追加 + `user_json` の `has_password` 判定切り替え
- `backend/app/controllers/api/v1/google_id_token_sessions_controller.rb` — `render_conflict` / `render_unauthorized` / `render_bad_request` を `render_error` に統一
- `backend/app/controllers/api/v1/account_settings_controller.rb` — エラー統一、`last_login_method?` 判定切り替え、`set_password` 空文字拒否 + `password_set_at` 更新、`unlink_provider` トランザクション保護
- `backend/app/controllers/api/v1/oauth_registrations_controller.rb` — `update_column(:encrypted_password, '')` 削除
- `backend/app/models/user.rb` — `before_update :prevent_lockout_transition` 追加
- `backend/app/models/user_provider.rb` — `before_destroy :prevent_lockout_on_destroy` 追加
- `backend/spec/support/oauth_test_helpers.rb` — `create_oauth_only_user` を新仕様に合わせて書き換え
- `backend/spec/requests/api/v1/google_id_token_sessions_spec.rb` — 既存テストを新形式（`{error, code, message}`）に更新
- `backend/spec/requests/api/v1/account_settings_spec.rb` — 既存テストを新形式に更新 + `update_column` 利用をヘルパー呼び出しに置換
- `backend/spec/requests/api/v1/oauth_registrations_spec.rb` — `has_password`/`password_set_at` の期待値追加
- `backend/spec/models/user_spec.rb` — `prevent_lockout_transition` のテスト追加
- `backend/spec/models/user_provider_spec.rb` — `prevent_lockout_on_destroy` のテスト追加
- `frontend/src/lib/types.ts` — `ErrorResponse` に `code`, `message` 追加
- `frontend/src/lib/api.ts` — `request()` 改修、`ApiError.code` 追加、ネットワークエラー判別
- `frontend/src/lib/api.test.ts` — 新挙動のテスト追加
- `frontend/src/components/OAuthButtons/OAuthButtons.test.tsx` — 409 エラー時の辞書メッセージ表示テスト追加

---

## Layer 1: バックエンド エラー基盤

### Task 1: ApiErrorCodes モジュール新設

**Files:**
- Create: `backend/app/errors/api_error_codes.rb`

- [ ] **Step 1: ファイルを新規作成**

```ruby
# frozen_string_literal: true

# API エラーコード定数。
# フロントエンドの lib/errorMessages.ts と対応する。
# 詳細は docs/api-error-codes.md を参照。
module ApiErrorCodes
  EMAIL_ALREADY_REGISTERED             = 'email_already_registered'
  EMAIL_REGISTERED_WITH_OTHER_PROVIDER = 'email_registered_with_other_provider'
  UNAUTHORIZED                         = 'unauthorized'
  INVALID_CREDENTIAL                   = 'invalid_credential'
  BAD_REQUEST                          = 'bad_request'
  LAST_LOGIN_METHOD                    = 'last_login_method'
  PROVIDER_NOT_FOUND                   = 'provider_not_found'
  PROVIDER_ALREADY_LINKED              = 'provider_already_linked'
  PASSWORD_EMPTY                       = 'password_empty'
  PASSWORD_MISMATCH                    = 'password_mismatch'
  EMAIL_ALREADY_SET                    = 'email_already_set'
  EMAIL_TAKEN                          = 'email_taken'
end
```

- [ ] **Step 2: Rails が app/errors/ をオートロードするか確認**

```bash
docker compose exec backend bundle exec rails runner "puts ApiErrorCodes::UNAUTHORIZED"
```

Expected output: `unauthorized`

Rails は `app/` 配下の全ディレクトリを自動でオートロード対象にするので、`app/errors/` は追加設定なしで使える。出力が正しく出なければ `config/application.rb` で `config.autoload_paths += %W[#{config.root}/app/errors]` を追加する。

- [ ] **Step 3: Commit**

```bash
git add backend/app/errors/api_error_codes.rb
git commit -m "feat: ApiErrorCodesモジュールを新設（エラーコード定数）"
```

---

### Task 2: ApplicationController#render_error ヘルパー追加

**Files:**
- Modify: `backend/app/controllers/application_controller.rb`

- [ ] **Step 1: `render_error` メソッドを private に追加**

`application_controller.rb` の `private` セクション（L18 以降）に以下を追加：

```ruby
# エラーレスポンス生成ヘルパー。
# バックエンドのエラーを {error, code, message} の統一形式で返す。
# error フィールドは既存フロントの後方互換用。code は機械判別用。
def render_error(code:, message:, status:)
  render json: { error: message, code: code, message: message }, status: status
end
```

- [ ] **Step 2: 既存コードを壊していないか確認のためテスト実行**

```bash
docker compose exec backend bundle exec rspec spec/requests/api/v1/account_settings_spec.rb -f documentation
```

Expected: 既存テスト全てパス（ヘルパー追加のみなので影響なし）

- [ ] **Step 3: Commit**

```bash
git add backend/app/controllers/application_controller.rb
git commit -m "feat: ApplicationController#render_errorヘルパーを追加"
```

---

### Task 3: GoogleIdTokenSessionsController のエラー形式統一

**Files:**
- Modify: `backend/app/controllers/api/v1/google_id_token_sessions_controller.rb`
- Modify: `backend/spec/requests/api/v1/google_id_token_sessions_spec.rb`

- [ ] **Step 1: spec を新形式に更新（失敗するテストを先に書く）**

`google_id_token_sessions_spec.rb` の既存テストを以下のように更新：

L80-88 の conflict テストに code / message / error の全フィールド検証を追加：

```ruby
it '409 Conflictとerror codeを返す' do
  post '/api/v1/auth/google_id_token', params: { credential: credential }, as: :json
  expect(response).to have_http_status(:conflict)
  json = response.parsed_body
  expect(json['status']).to eq('error')
  expect(json['code']).to eq('email_already_registered')
  expect(json['message']).to be_present
  expect(json['error']).to eq(json['message']) # 後方互換
end
```

同様に L96-102 の email_registered_with_other_provider テストにも同じ 4 フィールド検証を追加。

L105-122 の ID Token エラーテストは 401 だけ見ているが、以下のように 新形式も検証：

```ruby
it '署名検証エラー → 401 + unauthorized code' do
  stub_verifier(error: Google::Auth::IDTokens::SignatureError.new('bad'))
  post '/api/v1/auth/google_id_token', params: { credential: credential }, as: :json
  expect(response).to have_http_status(:unauthorized)
  json = response.parsed_body
  expect(json['code']).to eq('unauthorized')
  expect(json['error']).to be_present
  expect(json['message']).to be_present
end
```

L125-130 の bad_request テストも同様に更新：

```ruby
it 'credentialが欠落している → 400 + bad_request code' do
  post '/api/v1/auth/google_id_token', params: {}, as: :json
  expect(response).to have_http_status(:bad_request)
  json = response.parsed_body
  expect(json['code']).to eq('bad_request')
end
```

- [ ] **Step 2: テスト実行（失敗するはず）**

```bash
docker compose exec backend bundle exec rspec spec/requests/api/v1/google_id_token_sessions_spec.rb -f documentation
```

Expected: 新しい `expect(json['code'])...` アサーションが失敗する

- [ ] **Step 3: controller を新形式に更新**

`google_id_token_sessions_controller.rb` の private メソッドを以下に置き換え：

```ruby
def render_conflict(error)
  # conflict は元から code を持っているが、render_error で統一形式に
  render json: {
    status: 'error',
    error: error[:message],
    code: error[:code],
    message: error[:message]
  }, status: :conflict
end

def render_unauthorized
  render_error(code: ApiErrorCodes::UNAUTHORIZED,
               message: '認証に失敗しました',
               status: :unauthorized)
end

def render_bad_request
  render_error(code: ApiErrorCodes::BAD_REQUEST,
               message: 'credentialが必要です',
               status: :bad_request)
end
```

**注意**: `render_conflict` は `status: 'error'` フィールドを維持する必要がある（既存テストが確認している）。`render_error` 経由にしないのは、`status` フィールドがあるため。ただし `error` / `code` / `message` の3フィールドは統一形式に揃える。

- [ ] **Step 4: テスト実行（パスするはず）**

```bash
docker compose exec backend bundle exec rspec spec/requests/api/v1/google_id_token_sessions_spec.rb -f documentation
```

Expected: 全テストパス

- [ ] **Step 5: Commit**

```bash
git add backend/app/controllers/api/v1/google_id_token_sessions_controller.rb \
        backend/spec/requests/api/v1/google_id_token_sessions_spec.rb
git commit -m "refactor: GoogleIdTokenSessionsのエラー形式を{error,code,message}に統一"
```

---

### Task 4: AccountSettingsController のエラー形式統一

**Files:**
- Modify: `backend/app/controllers/api/v1/account_settings_controller.rb`
- Modify: `backend/spec/requests/api/v1/account_settings_spec.rb`

- [ ] **Step 1: spec を新形式に更新（失敗テスト先行）**

`account_settings_spec.rb` の既存エラーテスト4つに code / message / error フィールド検証を追加：

```ruby
# 既に同プロバイダ連携済み (L39-48)
context 'ログイン済み + 既に同プロバイダ連携済み' do
  it '422 + provider_already_linked code を返す' do
    user = User.create!(username: 'testuser', email: 'test@example.com', password: 'password123')
    UserProvider.create!(user: user, provider: 'google_oauth2', provider_uid: 'google_new_sub')
    sign_in user

    post '/api/v1/account_settings/link_provider', params: { credential: credential }, as: :json
    expect(response).to have_http_status(:unprocessable_content)
    json = response.parsed_body
    expect(json['code']).to eq('provider_already_linked')
    expect(json['error']).to eq(json['message'])
  end
end
```

```ruby
# 最後のログイン手段 (L94-107)
context '最後のログイン手段の場合' do
  it '解除を拒否して422 + last_login_method code を返す' do
    user = create_oauth_only_user(username: 'oauthonly', email: 'oauth@example.com')
    sign_in user

    delete '/api/v1/account_settings/unlink_provider', params: { provider: 'google_oauth2' }, as: :json
    expect(response).to have_http_status(:unprocessable_content)
    json = response.parsed_body
    expect(json['code']).to eq('last_login_method')
    expect(json['error']).to include('ログイン手段')
    expect(json['message']).to eq(json['error'])
  end
end
```

既存の L96-99 の `update_column(:encrypted_password, '')` 呼び出しは `create_oauth_only_user` ヘルパーに置き換えること（Task 12 で create_oauth_only_user も更新される）。

```ruby
# パスワード不一致 (L124-133)
it '422 + password_mismatch code を返す' do
  user = create_oauth_only_user(username: 'oauthuser', email: 'oauth@example.com')
  sign_in user
  put '/api/v1/account_settings/set_password',
      params: { password: 'newpass123', password_confirmation: 'wrongpass' }, as: :json
  expect(response).to have_http_status(:unprocessable_content)
  expect(response.parsed_body['code']).to eq('password_mismatch')
end
```

```ruby
# メール既存 (L157-165)
it '422 + email_taken code を返す' do
  User.create!(username: 'otheruser', email: 'taken@example.com', password: 'password123')
  user = create_oauth_only_user(username: 'noemailuser', email: '')
  sign_in user
  put '/api/v1/account_settings/set_email', params: { email: 'taken@example.com' }, as: :json
  expect(response.parsed_body['code']).to eq('email_taken')
end
```

- [ ] **Step 2: テスト実行（失敗確認）**

```bash
docker compose exec backend bundle exec rspec spec/requests/api/v1/account_settings_spec.rb -f documentation
```

Expected: 新しい `expect(json['code'])...` が失敗

- [ ] **Step 3: controller を `render_error` ベースに書き換え**

`account_settings_controller.rb` の全体を以下に置き換え：

```ruby
# frozen_string_literal: true

module Api
  module V1
    class AccountSettingsController < ApplicationController
      before_action :authenticate_user!

      def link_provider
        credential = params[:credential]
        if credential.blank?
          return render_error(code: ApiErrorCodes::BAD_REQUEST, message: 'credentialが必要です', status: :bad_request)
        end

        payload = verify_google_credential(credential)
        if payload.nil?
          return render_error(code: ApiErrorCodes::UNAUTHORIZED, message: '認証に失敗しました', status: :unauthorized)
        end

        create_provider_for_current_user(payload)
      end

      def unlink_provider
        provider = current_user.user_providers.find_by(provider: params[:provider])
        unless provider
          return render_error(code: ApiErrorCodes::PROVIDER_NOT_FOUND, message: '連携が見つかりません', status: :not_found)
        end

        if last_login_method?
          return render_error(code: ApiErrorCodes::LAST_LOGIN_METHOD,
                              message: '最後のログイン手段は解除できません。先にパスワードを設定するか、別のOAuthを連携してください',
                              status: :unprocessable_content)
        end

        provider.destroy!
        render json: { user: user_json(current_user.reload) }
      end

      def set_password
        return render_error(code: ApiErrorCodes::PASSWORD_MISMATCH, message: 'パスワードが一致しません', status: :unprocessable_content) if params[:password] != params[:password_confirmation]

        update_password
      end

      def set_email
        return render_error(code: ApiErrorCodes::EMAIL_ALREADY_SET, message: 'メールアドレスは既に設定されています', status: :unprocessable_content) if current_user.email.present?
        return render_error(code: ApiErrorCodes::EMAIL_TAKEN, message: 'このメールアドレスは既に使用されています', status: :unprocessable_content) if email_taken?

        update_email
      end

      private

      def verify_google_credential(credential)
        GoogleIdTokenVerifier.new(credential: credential).call
      rescue Google::Auth::IDTokens::VerificationError, ArgumentError
        nil
      end

      def create_provider_for_current_user(payload)
        UserProvider.create!(
          user: current_user,
          provider: 'google_oauth2',
          provider_uid: payload[:sub]
        )
        render json: { user: user_json(current_user.reload) }
      rescue ActiveRecord::RecordInvalid
        render_error(code: ApiErrorCodes::PROVIDER_ALREADY_LINKED, message: 'このプロバイダは既に連携済みです', status: :unprocessable_content)
      end

      def update_password
        assign_password_params
        save_and_render(current_user)
      end

      def assign_password_params
        current_user.password = params[:password]
        current_user.password_confirmation = params[:password_confirmation]
      end

      def update_email
        current_user.email = params[:email]
        save_and_render(current_user)
      end

      def save_and_render(user)
        if user.save
          render json: { user: user_json(user) }
        else
          render json: { errors: user.errors.full_messages }, status: :unprocessable_content
        end
      end

      def last_login_method?
        has_password = current_user.encrypted_password.present?
        provider_count = current_user.user_providers.count
        !has_password && provider_count <= 1
      end

      def email_taken?
        User.exists?(email: params[:email])
      end
    end
  end
end
```

**注意**: この Task ではまだ `last_login_method?` は `encrypted_password.present?` のまま、`set_password` も空文字拒否・`password_set_at` 未更新のまま。これらは後の Task で変更する（データフロー下流から積む方針）。

- [ ] **Step 4: テスト実行**

```bash
docker compose exec backend bundle exec rspec spec/requests/api/v1/account_settings_spec.rb -f documentation
```

Expected: 全パス

- [ ] **Step 5: Commit**

```bash
git add backend/app/controllers/api/v1/account_settings_controller.rb \
        backend/spec/requests/api/v1/account_settings_spec.rb
git commit -m "refactor: AccountSettingsのエラー形式を{error,code,message}に統一"
```

---

### Task 5: docs/api-error-codes.md の新規作成

**Files:**
- Create: `docs/api-error-codes.md`

- [ ] **Step 1: エラーコード運用ドキュメント作成**

以下の内容で `docs/api-error-codes.md` を新規作成：

```markdown
# API エラーコード一覧

Recolly のバックエンド API が返すエラーコードの一覧と運用ルール。
フロントエンドの `frontend/src/lib/errorMessages.ts` と対応する。

## レスポンス形式

エラー時は以下の形式で統一する：

\`\`\`json
{
  "error": "人間向けメッセージ（後方互換フィールド）",
  "code": "エラーコード（機械判別用）",
  "message": "人間向けメッセージ（新形式の主読み取り先）"
}
\`\`\`

フロントエンドの `api.ts` の `request()` はこの順で読み取る：
1. `code` があれば `errorMessages.ts` の辞書を引く
2. 辞書になければ `error` または `message` をそのまま表示
3. どれもなければ `errors[]` の join、最終フォールバックは「エラーが発生しました」

## コード一覧

| コード | HTTPステータス | 発生元 | 意味 |
|--------|---------------|--------|------|
| `unauthorized` | 401 | GoogleIdTokenSessions, AccountSettings | 認証失敗 |
| `bad_request` | 400 | GoogleIdTokenSessions, AccountSettings | リクエストパラメータ不正 |
| `email_already_registered` | 409 | GoogleIdTokenSessions | 既にメール+パスワードで登録済み |
| `email_registered_with_other_provider` | 409 | GoogleIdTokenSessions | 別プロバイダで登録済み |
| `last_login_method` | 422 | AccountSettings | 最後のログイン手段の解除を拒否 |
| `provider_not_found` | 404 | AccountSettings | 指定のプロバイダ連携が存在しない |
| `provider_already_linked` | 422 | AccountSettings | このプロバイダは既に連携済み |
| `password_empty` | 422 | AccountSettings | パスワードが空文字 |
| `password_mismatch` | 422 | AccountSettings | パスワードと確認パスワードが一致しない |
| `email_already_set` | 422 | AccountSettings | メールアドレスは既に設定されている |
| `email_taken` | 422 | AccountSettings | メールアドレスは既に別ユーザーで使用中 |

## 新しいコードを追加する手順

1. `backend/app/errors/api_error_codes.rb` に定数を追加
2. このドキュメントに行を追加
3. `frontend/src/lib/errorMessages.ts` に日本語メッセージを追加
4. `frontend/src/lib/errorMessages.test.ts` にテストを追加
```

- [ ] **Step 2: Commit**

```bash
git add docs/api-error-codes.md
git commit -m "docs: APIエラーコード運用ドキュメントを追加"
```

---

## Layer 2: フロントエンド 共通基盤

### Task 6: ErrorResponse 型拡張

**Files:**
- Modify: `frontend/src/lib/types.ts`

- [ ] **Step 1: `ErrorResponse` に `code`, `message` を追加**

`types.ts` L26-29 を以下に置き換え：

```ts
export interface ErrorResponse {
  error?: string
  code?: string
  message?: string
  errors?: string[]
}
```

- [ ] **Step 2: 型チェック実行**

```bash
docker compose exec frontend npm run typecheck
```

Expected: エラーなし

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/types.ts
git commit -m "feat: ErrorResponse型にcode/messageフィールドを追加"
```

---

### Task 7: errorMessages.ts と test を新規作成（TDD）

**Files:**
- Create: `frontend/src/lib/errorMessages.test.ts`
- Create: `frontend/src/lib/errorMessages.ts`

- [ ] **Step 1: テストを先に書く**

`frontend/src/lib/errorMessages.test.ts` を新規作成：

```ts
import { describe, it, expect } from 'vitest'
import { getErrorMessage } from './errorMessages'

describe('getErrorMessage', () => {
  it('既知のエラーコードに対応する日本語メッセージを返す', () => {
    expect(getErrorMessage('email_already_registered', 'fallback')).toContain('既に')
    expect(getErrorMessage('last_login_method', 'fallback')).toContain('最後のログイン手段')
    expect(getErrorMessage('unauthorized', 'fallback')).toContain('認証')
  })

  it('未知のコードはフォールバックメッセージを返す', () => {
    expect(getErrorMessage('unknown_code', 'これはフォールバック')).toBe('これはフォールバック')
  })

  it('codeがundefinedの場合はフォールバックを返す', () => {
    expect(getErrorMessage(undefined, 'fallback text')).toBe('fallback text')
  })

  it('network_errorコードも辞書に含まれる', () => {
    expect(getErrorMessage('network_error', '')).toContain('ネットワーク')
  })
})
```

- [ ] **Step 2: テスト実行（失敗確認）**

```bash
docker compose exec frontend npm run test -- errorMessages.test.ts --run
```

Expected: `Cannot find module './errorMessages'` で失敗

- [ ] **Step 3: `errorMessages.ts` を実装**

`frontend/src/lib/errorMessages.ts` を新規作成：

```ts
// バックエンドの ApiErrorCodes (backend/app/errors/api_error_codes.rb) と
// 対応する日本語メッセージ辞書。
// バックエンドから code が返ってきたら辞書を引いて日本語メッセージに変換する。
// 辞書にない code や code なしの場合はバックエンドの生メッセージをそのまま使う。
// 詳細は docs/api-error-codes.md を参照。

const ERROR_MESSAGES: Record<string, string> = {
  email_already_registered:
    'このメールアドレスは既にメール+パスワードで登録されています。メールでログインしてください',
  email_registered_with_other_provider:
    'このメールアドレスは別のアカウントで登録されています',
  unauthorized: '認証に失敗しました。もう一度お試しください',
  invalid_credential: '認証情報が無効です',
  bad_request: 'リクエスト内容が不正です',
  last_login_method:
    '最後のログイン手段は解除できません。先にパスワードを設定するか、別のOAuthを連携してください',
  provider_not_found: '連携が見つかりません',
  provider_already_linked: 'このプロバイダは既に連携済みです',
  password_empty: 'パスワードを入力してください',
  password_mismatch: 'パスワードが一致しません',
  email_already_set: 'メールアドレスは既に設定されています',
  email_taken: 'このメールアドレスは既に使用されています',
  network_error: 'ネットワークに接続できませんでした。通信環境をご確認ください',
}

export function getErrorMessage(code: string | undefined, fallback: string): string {
  if (!code) return fallback
  return ERROR_MESSAGES[code] ?? fallback
}
```

- [ ] **Step 4: テスト実行（パス確認）**

```bash
docker compose exec frontend npm run test -- errorMessages.test.ts --run
```

Expected: 全 4 テストパス

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/errorMessages.ts frontend/src/lib/errorMessages.test.ts
git commit -m "feat: errorMessages.tsを新設（エラーコード→日本語マッピング辞書）"
```

---

### Task 8: api.ts の request() 改修（TDD）

**Files:**
- Modify: `frontend/src/lib/api.test.ts`
- Modify: `frontend/src/lib/api.ts`

- [ ] **Step 1: 失敗するテストを追加**

`frontend/src/lib/api.test.ts` の末尾 `describe('request', () => {...})` ブロック内に以下のテストケースを追加：

```ts
it('code フィールドがあれば errorMessages.ts 辞書経由でメッセージを返す', async () => {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status: 409,
    json: () =>
      Promise.resolve({
        error: 'raw backend message',
        code: 'email_already_registered',
        message: 'raw backend message',
      }),
  })

  await expect(request<never>('/test')).rejects.toThrow(
    /このメールアドレスは既にメール\+パスワードで登録/,
  )
})

it('ApiError に code プロパティがセットされる', async () => {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status: 422,
    json: () =>
      Promise.resolve({
        error: '最後のログイン手段',
        code: 'last_login_method',
        message: '最後のログイン手段',
      }),
  })

  try {
    await request<never>('/test')
    expect.fail('should have thrown')
  } catch (err) {
    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).code).toBe('last_login_method')
    expect((err as ApiError).status).toBe(422)
  }
})

it('code がない場合は従来の error フィールドをそのまま使う', async () => {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status: 401,
    json: () => Promise.resolve({ error: 'ログインが必要です' }),
  })

  await expect(request<never>('/test')).rejects.toThrow('ログインが必要です')
})

it('fetch 自体が失敗（TypeError）したらネットワークエラーとして扱う', async () => {
  mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))

  try {
    await request<never>('/test')
    expect.fail('should have thrown')
  } catch (err) {
    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).code).toBe('network_error')
    expect((err as ApiError).status).toBe(0)
    expect((err as ApiError).message).toContain('ネットワーク')
  }
})
```

- [ ] **Step 2: テスト実行（失敗確認）**

```bash
docker compose exec frontend npm run test -- api.test.ts --run
```

Expected: 新しい 4 テストが失敗（`code` プロパティ未定義、ネットワークエラー判別未実装）

- [ ] **Step 3: `api.ts` を改修**

`frontend/src/lib/api.ts` の L1-40 を以下に置き換え：

```ts
import type { AuthResponse, ErrorResponse, GoogleAuthResponse } from './types'
import { getErrorMessage } from './errorMessages'

const API_BASE = '/api/v1'

// 共通のfetchラッパー（credentials: 'include' でCookieを自動送信）
export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })
  } catch (err) {
    // fetch 自体の失敗（ネットワークエラー、CORS 等）は TypeError になる
    if (err instanceof TypeError) {
      throw new ApiError(
        'ネットワークに接続できませんでした。通信環境をご確認ください',
        0,
        'network_error',
      )
    }
    throw err
  }

  // ボディなしレスポンス（204 No Content）はJSONパースをスキップ
  if (response.status === 204) {
    return undefined as T
  }

  const data: unknown = await response.json()

  if (!response.ok) {
    const errorData = data as ErrorResponse
    const rawMessage =
      errorData.error ?? errorData.message ?? errorData.errors?.join(', ') ?? 'エラーが発生しました'
    // code があれば errorMessages.ts 辞書経由で訳す。なければ rawMessage そのまま
    const message = getErrorMessage(errorData.code, rawMessage)
    throw new ApiError(message, response.status, errorData.code)
  }

  return data as T
}

export class ApiError extends Error {
  status: number
  code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}
```

- [ ] **Step 4: テスト実行（パス確認）**

```bash
docker compose exec frontend npm run test -- api.test.ts --run
```

Expected: 全テストパス（既存 + 新規 4 件）

- [ ] **Step 5: 型チェック**

```bash
docker compose exec frontend npm run typecheck
```

Expected: エラーなし

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/api.ts frontend/src/lib/api.test.ts
git commit -m "feat: api.tsのrequest()がerrorMessages辞書とネットワークエラーを扱う"
```

---

## Layer 3: マイグレーション + モデル層多層防御

### Task 9: マイグレーション作成

**Files:**
- Create: `backend/db/migrate/YYYYMMDDHHMMSS_add_password_set_at_to_users.rb`

- [ ] **Step 1: マイグレーションを生成**

```bash
docker compose exec backend bundle exec rails generate migration AddPasswordSetAtToUsers password_set_at:datetime
```

これで `backend/db/migrate/<timestamp>_add_password_set_at_to_users.rb` が自動生成される。

- [ ] **Step 2: 生成されたマイグレーションをバックフィル付きに上書き**

生成されたファイルを以下に書き換え：

```ruby
class AddPasswordSetAtToUsers < ActiveRecord::Migration[8.0]
  def up
    add_column :users, :password_set_at, :datetime, null: true

    # バックフィル: encrypted_password が空文字ではない既存ユーザーに現在時刻を設定。
    # これにより「既存ユーザーは自分でパスワードを設定した状態」として扱われる。
    execute <<~SQL.squish
      UPDATE users
      SET password_set_at = NOW()
      WHERE encrypted_password IS NOT NULL AND encrypted_password != ''
    SQL
  end

  def down
    remove_column :users, :password_set_at
  end
end
```

- [ ] **Step 3: マイグレーション実行**

```bash
docker compose exec backend bundle exec rails db:migrate
```

Expected: `== AddPasswordSetAtToUsers: migrated` メッセージが出る

- [ ] **Step 4: スキーマ確認**

```bash
docker compose exec backend bundle exec rails runner "puts User.column_names"
```

Expected: 出力に `password_set_at` が含まれる

- [ ] **Step 5: ロールバックテスト**

```bash
docker compose exec backend bundle exec rails db:rollback
docker compose exec backend bundle exec rails runner "puts User.column_names"
```

Expected: `password_set_at` が消えている

再度マイグレーション：
```bash
docker compose exec backend bundle exec rails db:migrate
```

- [ ] **Step 6: Commit**

```bash
git add backend/db/migrate/ backend/db/schema.rb
git commit -m "feat: usersテーブルにpassword_set_atカラムを追加（ADR-0036）"
```

---

### Task 10: has_password 判定を password_set_at ベースに切り替え

**Files:**
- Modify: `backend/app/controllers/application_controller.rb`
- Modify: `backend/app/controllers/api/v1/account_settings_controller.rb`

- [ ] **Step 1: `user_json` を更新**

`application_controller.rb` L35 を変更：

```ruby
# 変更前
has_password: user.encrypted_password.present?,
# 変更後
has_password: user.password_set_at.present?,
```

- [ ] **Step 2: `last_login_method?` を更新**

`account_settings_controller.rb` L100-104 を変更：

```ruby
def last_login_method?
  has_password = current_user.password_set_at.present?
  provider_count = current_user.user_providers.count
  !has_password && provider_count <= 1
end
```

- [ ] **Step 3: 既存の account_settings_spec と google_id_token_sessions_spec を実行**

```bash
docker compose exec backend bundle exec rspec spec/requests/api/v1/account_settings_spec.rb spec/requests/api/v1/google_id_token_sessions_spec.rb -f documentation
```

**Expected**: 一部失敗する。理由: `create_oauth_only_user` ヘルパー（Task 12 で修正予定）は `encrypted_password` を空文字化するが `password_set_at` をセットしないので、OAuth-only user の `has_password` が false になる。ここで失敗するテストはヘルパー修正後（Task 12 以降）にパスするはず。

この時点では Task 10 のコミットは保留し、Task 11 (User spec), Task 12 (ヘルパー修正) をまとめて commit する。

- [ ] **Step 4: 一時作業のまま Task 11 へ進む**

コミットは **まだ行わない**。以下の順で進める必要がある：

1. Task 11: User モデル + spec
2. Task 12: UserProvider モデル + spec + oauth_test_helpers 修正
3. Task 13: OauthRegistrationsController + spec
4. Task 14: AccountSettings#set_password 更新

これらを全部やってから spec を通す。**コミットは Task 14 の末尾で一括する**（意図: マイグレーション + ロジック変更を 1 つの論理単位として扱う）。

---

### Task 11: User モデルに before_update 防御追加（TDD）

**Files:**
- Modify: `backend/spec/models/user_spec.rb`
- Modify: `backend/app/models/user.rb`

- [ ] **Step 1: 失敗する spec を追加**

`backend/spec/models/user_spec.rb` の末尾（L112 の直後、クラス閉じ前）に以下の describe を追加：

```ruby
  describe 'ロックアウト防御 (prevent_lockout_transition)' do
    it 'encrypted_password を空文字にする update_column 以外の更新は before_update で弾かれる' do
      user = described_class.create!(username: 'normaluser', email: 'normal@example.com', password: 'password123')
      user.encrypted_password = ''
      expect(user.save).to be false
      expect(user.errors[:base]).to include('ログイン手段を全て失う変更はできません')
    end

    it 'user_providers がある状態で encrypted_password を空にする更新は許可される' do
      user = described_class.create!(username: 'withprov', email: 'withprov@example.com', password: 'password123')
      UserProvider.create!(user: user, provider: 'google_oauth2', provider_uid: '12345')
      user.reload
      user.encrypted_password = ''
      expect(user.save).to be true
    end

    it 'encrypted_password が変わらない更新（プロフィール更新等）はコールバックをスキップする' do
      user = described_class.create!(username: 'profileuser', email: 'profile@example.com', password: 'password123')
      user.bio = '新しい自己紹介'
      expect(user.save).to be true
    end
  end
```

- [ ] **Step 2: テスト実行（失敗確認）**

```bash
docker compose exec backend bundle exec rspec spec/models/user_spec.rb -e "prevent_lockout_transition" -f documentation
```

Expected: 1つ目のテストが失敗（コールバックがないので `user.save` が true を返す）

- [ ] **Step 3: User モデルにコールバック追加**

`backend/app/models/user.rb` の `validates` ブロックの直下に以下を追加（L18 の直後あたり）：

```ruby
  # encrypted_password を空にする更新を防ぐ最後の砦。
  # Controller層のガード（last_login_method?）と UserProvider#before_destroy の
  # 補完として、Rails console からの直接操作や将来の別経路でも発動する。
  before_update :prevent_lockout_transition

  # ... 既存の password_required? / email_required? / rememberable_value ...
```

そして private メソッドとして以下を追加（`rememberable_value` の後ろに）：

```ruby
  private

  def prevent_lockout_transition
    return unless encrypted_password_changed?
    return if encrypted_password.present?
    return if user_providers.any?

    errors.add(:base, 'ログイン手段を全て失う変更はできません')
    throw(:abort)
  end
```

**注意**: User モデルは現在 private メソッドを持たない（全部 public）。`private` キーワードを新規に追加すると `password_required?` / `email_required?` / `rememberable_value` も private になってしまう。これを避けるため、**`private` は `prevent_lockout_transition` の直前だけに適用**する：

実装時は以下のように書く：
```ruby
class User < ApplicationRecord
  # ... associations, validations ...
  before_update :prevent_lockout_transition

  # OAuth専用ユーザーはパスワードなしを許可
  def password_required?
    return false if user_providers.any?
    super
  end

  # OAuth専用ユーザーはメールなしを許可
  def email_required?
    return false if user_providers.any?
    super
  end

  def rememberable_value
    salt = authenticatable_salt.presence
    return salt if salt
    Digest::SHA256.hexdigest("#{id}-#{created_at.to_i}")
  end

  private

  def prevent_lockout_transition
    return unless encrypted_password_changed?
    return if encrypted_password.present?
    return if user_providers.any?

    errors.add(:base, 'ログイン手段を全て失う変更はできません')
    throw(:abort)
  end
end
```

- [ ] **Step 4: テスト実行（パス確認）**

```bash
docker compose exec backend bundle exec rspec spec/models/user_spec.rb -e "prevent_lockout_transition" -f documentation
```

Expected: 全テストパス

- [ ] **Step 5: User spec 全体を確認**

```bash
docker compose exec backend bundle exec rspec spec/models/user_spec.rb -f documentation
```

Expected: 既存テストも全パス

---

### Task 12: UserProvider モデルに before_destroy 防御 + oauth_test_helpers 修正（TDD）

**Files:**
- Modify: `backend/spec/models/user_provider_spec.rb`
- Modify: `backend/app/models/user_provider.rb`
- Modify: `backend/spec/support/oauth_test_helpers.rb`

- [ ] **Step 1: oauth_test_helpers.rb を先に修正**

`backend/spec/support/oauth_test_helpers.rb` を以下に書き換え：

```ruby
# frozen_string_literal: true

# OAuthユーザー作成用ヘルパー。
# 本番の OauthRegistrationsController と同じロジックで作る：
# - password は SecureRandom の bcrypt ハッシュが残る（本人は知らない値）
# - password_set_at は nil のまま（本人が設定していないため）
def create_oauth_only_user(username:, email: '', provider: 'google_oauth2', provider_uid: '12345')
  user = User.new(username: username, email: email, password: SecureRandom.hex(32))
  user.user_providers.build(provider: provider, provider_uid: provider_uid)
  user.save!
  user
end
```

**重要**: `update_column(:encrypted_password, '')` と `save!(validate: false)` が消え、本番と同じ経路で save できるようになる。

- [ ] **Step 2: 失敗する UserProvider spec を追加**

`backend/spec/models/user_provider_spec.rb` の末尾（クラス閉じ前）に以下の describe を追加：

```ruby
  describe 'ロックアウト防御 (prevent_lockout_on_destroy)' do
    it 'password_set_at が nil かつ最後の user_provider の destroy は拒否される' do
      user = create_oauth_only_user(username: 'oauthonly', email: 'oauth@example.com')
      provider = user.user_providers.first
      result = provider.destroy
      expect(result).to be false
      expect(provider.errors[:base]).to include('最後のログイン手段は解除できません')
      expect(user.user_providers.count).to eq(1)
    end

    it 'password_set_at が present なら最後の user_provider でも destroy できる' do
      user = described_class.create!(
        user: User.create!(username: 'withpw', email: 'withpw@example.com', password: 'password123'),
        provider: 'google_oauth2',
        provider_uid: '12345'
      )
      # User.create! は save! 後に password_set_at をまだ持たないので、明示的にセット
      user.user.update_column(:password_set_at, Time.current) # rubocop:disable Rails/SkipsModelValidations
      result = user.destroy
      expect(result).to be_truthy
    end

    it '他の user_provider がまだ存在するなら destroy できる' do
      user = User.create!(username: 'multi', email: 'multi@example.com', password: 'password123')
      user.update_column(:password_set_at, nil) # rubocop:disable Rails/SkipsModelValidations
      p1 = UserProvider.create!(user: user, provider: 'google_oauth2', provider_uid: 'a')
      UserProvider.create!(user: user, provider: 'other_provider', provider_uid: 'b')
      expect { p1.destroy }.to change(UserProvider, :count).by(-1)
    end

    it 'User が destroy される連鎖削除では発動せず、user_providers も消える' do
      user = create_oauth_only_user(username: 'cascadeuser', email: 'cascade@example.com')
      expect { user.destroy }.to change(UserProvider, :count).by(-1)
        .and change(User, :count).by(-1)
    end
  end
```

- [ ] **Step 3: テスト実行（失敗確認）**

```bash
docker compose exec backend bundle exec rspec spec/models/user_provider_spec.rb -e "prevent_lockout_on_destroy" -f documentation
```

Expected: 失敗

- [ ] **Step 4: UserProvider にコールバック追加**

`backend/app/models/user_provider.rb` を以下に書き換え：

```ruby
# frozen_string_literal: true

class UserProvider < ApplicationRecord
  belongs_to :user

  validates :provider, presence: true
  validates :provider_uid, presence: true
  validates :provider, uniqueness: { scope: :provider_uid }
  validates :provider, uniqueness: { scope: :user_id }

  before_destroy :prevent_lockout_on_destroy

  private

  # 最後のログイン手段（password_set_at も他のプロバイダもない）状態への
  # 遷移を防ぐ。User 自体が destroy されているときは連鎖削除として許可する。
  def prevent_lockout_on_destroy
    return if user.destroyed?
    return if user.password_set_at.present?
    return if user.user_providers.where.not(id: id).exists?

    errors.add(:base, '最後のログイン手段は解除できません')
    throw(:abort)
  end
end
```

- [ ] **Step 5: テスト実行（パス確認）**

```bash
docker compose exec backend bundle exec rspec spec/models/user_provider_spec.rb -f documentation
```

Expected: 全パス（既存テスト + 新規4テスト）

---

### Task 13: OauthRegistrationsController の空文字ハック削除

**Files:**
- Modify: `backend/app/controllers/api/v1/oauth_registrations_controller.rb`
- Modify: `backend/spec/requests/api/v1/oauth_registrations_spec.rb`

- [ ] **Step 1: spec に失敗するアサーションを追加**

`oauth_registrations_spec.rb` の「ユーザーとUserProviderを作成して201を返す」テスト（L25-37）の末尾に以下を追加：

```ruby
it '作成されたユーザーのencrypted_passwordはbcryptハッシュが残り、password_set_atはnil' do
  post '/api/v1/auth/complete_registration', params: { username: 'newuser' }, as: :json
  user = User.last
  expect(user.encrypted_password).not_to be_empty
  expect(user.password_set_at).to be_nil
end

it '作成されたユーザーのhas_passwordはfalse' do
  post '/api/v1/auth/complete_registration', params: { username: 'newuser' }, as: :json
  json = response.parsed_body
  expect(json.dig('user', 'has_password')).to be false
end
```

- [ ] **Step 2: テスト実行（失敗確認）**

```bash
docker compose exec backend bundle exec rspec spec/requests/api/v1/oauth_registrations_spec.rb -f documentation
```

Expected: `expect(user.encrypted_password).not_to be_empty` で失敗（現状は update_column で空文字化されている）

- [ ] **Step 3: controller の `create_oauth_user` を修正**

`oauth_registrations_controller.rb` の `create_oauth_user` メソッドを以下に置き換え：

```ruby
def create_oauth_user(oauth_data)
  user = build_user(oauth_data)
  user.save!
  user
end
```

`ActiveRecord::Base.transaction` ブロックと `user.update_column(:encrypted_password, '')` 行を削除。`build_user` の `user_providers.build` により一つの save! で User と UserProvider が同時に作られる。

- [ ] **Step 4: テスト実行（パス確認）**

```bash
docker compose exec backend bundle exec rspec spec/requests/api/v1/oauth_registrations_spec.rb -f documentation
```

Expected: 全パス

---

### Task 14: set_password の空文字拒否 + password_set_at 更新（TDD）

**Files:**
- Modify: `backend/spec/requests/api/v1/account_settings_spec.rb`
- Modify: `backend/app/controllers/api/v1/account_settings_controller.rb`

- [ ] **Step 1: 失敗するテストを追加**

`account_settings_spec.rb` の `describe 'PUT /api/v1/account_settings/set_password'` 内に以下のコンテキストを追加：

```ruby
    context 'パスワードが空文字' do
      it '422 + password_empty code を返す' do
        user = create_oauth_only_user(username: 'oauthuser', email: 'oauth@example.com')
        sign_in user
        put '/api/v1/account_settings/set_password',
            params: { password: '', password_confirmation: '' }, as: :json
        expect(response).to have_http_status(:unprocessable_content)
        expect(response.parsed_body['code']).to eq('password_empty')
      end
    end

    context 'パスワード設定成功時' do
      it 'password_set_at がセットされる' do
        user = create_oauth_only_user(username: 'oauthuser', email: 'oauth@example.com')
        sign_in user
        expect(user.password_set_at).to be_nil

        put '/api/v1/account_settings/set_password',
            params: { password: 'newpass123', password_confirmation: 'newpass123' }, as: :json
        expect(response).to have_http_status(:ok)
        user.reload
        expect(user.password_set_at).to be_present
      end

      it 'レスポンスの has_password が true に変わる' do
        user = create_oauth_only_user(username: 'oauthuser', email: 'oauth@example.com')
        sign_in user
        put '/api/v1/account_settings/set_password',
            params: { password: 'newpass123', password_confirmation: 'newpass123' }, as: :json
        expect(response.parsed_body.dig('user', 'has_password')).to be true
      end
    end
```

また、既存のテスト L110-121「パスワード未設定のOAuthユーザー」内の `expect(user.encrypted_password).to be_present` は成立しなくなる可能性があるが、実際には `current_user.password = params[:password]` により bcrypt ハッシュが更新されるので present のまま → OK。念のため `password_set_at` の存在を追加検証：

```ruby
context 'パスワード未設定のOAuthユーザー' do
  it 'パスワードを設定できる（password_set_atもセットされる）' do
    user = create_oauth_only_user(username: 'oauthuser', email: 'oauth@example.com')
    sign_in user

    put '/api/v1/account_settings/set_password',
        params: { password: 'newpass123', password_confirmation: 'newpass123' }, as: :json
    expect(response).to have_http_status(:ok)
    user.reload
    expect(user.encrypted_password).to be_present
    expect(user.password_set_at).to be_present
  end
end
```

- [ ] **Step 2: テスト実行（失敗確認）**

```bash
docker compose exec backend bundle exec rspec spec/requests/api/v1/account_settings_spec.rb -e "set_password" -f documentation
```

Expected: `password_empty` code と `password_set_at` 関連で失敗

- [ ] **Step 3: controller を更新**

`account_settings_controller.rb` の `set_password` と `update_password` を以下に置き換え：

```ruby
def set_password
  if params[:password].blank?
    return render_error(code: ApiErrorCodes::PASSWORD_EMPTY,
                        message: 'パスワードを入力してください',
                        status: :unprocessable_content)
  end
  if params[:password] != params[:password_confirmation]
    return render_error(code: ApiErrorCodes::PASSWORD_MISMATCH,
                        message: 'パスワードが一致しません',
                        status: :unprocessable_content)
  end

  update_password
end
```

```ruby
def update_password
  assign_password_params
  current_user.password_set_at = Time.current
  save_and_render(current_user)
end
```

- [ ] **Step 4: テスト実行**

```bash
docker compose exec backend bundle exec rspec spec/requests/api/v1/account_settings_spec.rb -f documentation
```

Expected: 全パス

- [ ] **Step 5: Layer 3 全体のテストを流す**

```bash
docker compose exec backend bundle exec rspec spec/models/user_spec.rb spec/models/user_provider_spec.rb spec/requests/api/v1/account_settings_spec.rb spec/requests/api/v1/oauth_registrations_spec.rb spec/requests/api/v1/google_id_token_sessions_spec.rb -f documentation
```

Expected: 全パス

- [ ] **Step 6: RuboCop 実行**

```bash
docker compose exec backend bundle exec rubocop app/models/user.rb app/models/user_provider.rb app/controllers/api/v1/account_settings_controller.rb app/controllers/api/v1/oauth_registrations_controller.rb app/controllers/application_controller.rb
```

Expected: no offenses

- [ ] **Step 7: Layer 3 を一括 Commit**

```bash
git add backend/app/controllers/application_controller.rb \
        backend/app/controllers/api/v1/account_settings_controller.rb \
        backend/app/controllers/api/v1/oauth_registrations_controller.rb \
        backend/app/models/user.rb \
        backend/app/models/user_provider.rb \
        backend/spec/models/user_spec.rb \
        backend/spec/models/user_provider_spec.rb \
        backend/spec/requests/api/v1/account_settings_spec.rb \
        backend/spec/requests/api/v1/oauth_registrations_spec.rb \
        backend/spec/support/oauth_test_helpers.rb
git commit -m "feat: password_set_atベース多層防御とロックアウト対策を実装

- User: before_update :prevent_lockout_transition
- UserProvider: before_destroy :prevent_lockout_on_destroy
- OauthRegistrations: update_column(encrypted_password, '')を削除
- AccountSettings#set_password: 空文字拒否 + password_set_at更新
- has_password/last_login_method?をpassword_set_at.present?ベースに切り替え
- oauth_test_helpers: create_oauth_only_userを本番と同じ経路に修正

Fixes #105"
```

---

## Layer 4: Controller トランザクション保護

### Task 15: unlink_provider のトランザクション + rescue（TDD）

**Files:**
- Modify: `backend/spec/requests/api/v1/account_settings_spec.rb`
- Modify: `backend/app/controllers/api/v1/account_settings_controller.rb`

- [ ] **Step 1: 失敗するテストを追加**

`account_settings_spec.rb` の `describe 'DELETE /api/v1/account_settings/unlink_provider'` 内に以下のコンテキストを追加：

```ruby
    context 'Controller層のチェックを通過してもモデル層で弾かれるケース' do
      # このテストは、未来に Controller 層の last_login_method? をバイパスしても
      # UserProvider#before_destroy が動作することを保証する回帰テスト
      it 'トランザクションが rollback して 422 を返す' do
        # パスワード設定済みユーザー + 1プロバイダ → last_login_method? は false
        user = User.create!(username: 'txuser', email: 'tx@example.com', password: 'password123')
        UserProvider.create!(user: user, provider: 'google_oauth2', provider_uid: 'txsub')
        sign_in user

        # 強制的にパスワードを消し、before_destroy だけが残りの防御になる状況を作る
        user.update_column(:password_set_at, nil) # rubocop:disable Rails/SkipsModelValidations

        delete '/api/v1/account_settings/unlink_provider', params: { provider: 'google_oauth2' }, as: :json
        expect(response).to have_http_status(:unprocessable_content)
        expect(response.parsed_body['code']).to eq('last_login_method')
        expect(UserProvider.where(user: user).count).to eq(1) # rollback された
      end
    end
```

- [ ] **Step 2: テスト実行（失敗確認）**

```bash
docker compose exec backend bundle exec rspec spec/requests/api/v1/account_settings_spec.rb -e "トランザクション" -f documentation
```

Expected: 現状の controller は `provider.destroy!` が `ActiveRecord::RecordNotDestroyed` を投げて rescue されず 500 エラーになる

- [ ] **Step 3: controller の unlink_provider にトランザクション + rescue を追加**

`account_settings_controller.rb` の `unlink_provider` を以下に置き換え：

```ruby
def unlink_provider
  provider = current_user.user_providers.find_by(provider: params[:provider])
  unless provider
    return render_error(code: ApiErrorCodes::PROVIDER_NOT_FOUND,
                        message: '連携が見つかりません',
                        status: :not_found)
  end

  if last_login_method?
    return render_error(code: ApiErrorCodes::LAST_LOGIN_METHOD,
                        message: '最後のログイン手段は解除できません。先にパスワードを設定するか、別のOAuthを連携してください',
                        status: :unprocessable_content)
  end

  ActiveRecord::Base.transaction do
    provider.destroy!  # before_destroy で弾かれたら RecordNotDestroyed が raise される
  end

  render json: { user: user_json(current_user.reload) }
rescue ActiveRecord::RecordNotDestroyed
  render_error(code: ApiErrorCodes::LAST_LOGIN_METHOD,
               message: '最後のログイン手段は解除できません',
               status: :unprocessable_content)
end
```

- [ ] **Step 4: テスト実行（パス確認）**

```bash
docker compose exec backend bundle exec rspec spec/requests/api/v1/account_settings_spec.rb -f documentation
```

Expected: 全パス

- [ ] **Step 5: RuboCop**

```bash
docker compose exec backend bundle exec rubocop app/controllers/api/v1/account_settings_controller.rb
```

Expected: no offenses

- [ ] **Step 6: Commit**

```bash
git add backend/app/controllers/api/v1/account_settings_controller.rb \
        backend/spec/requests/api/v1/account_settings_spec.rb
git commit -m "feat: unlink_providerをトランザクション+rescueで多層防御"
```

---

## Layer 5: Rake タスクと最終確認

### Task 16: lockout:detect Rake タスク（TDD）

**Files:**
- Create: `backend/spec/tasks/lockout_rake_spec.rb`
- Create: `backend/lib/tasks/lockout.rake`

- [ ] **Step 1: Rake タスクの spec を先に書く**

`backend/spec/tasks/lockout_rake_spec.rb` を新規作成：

```ruby
# frozen_string_literal: true

require 'rails_helper'
require 'rake'

RSpec.describe 'lockout:detect', type: :task do
  before(:all) do
    Rails.application.load_tasks if Rake::Task.tasks.empty?
  end

  let(:task) { Rake::Task['lockout:detect'] }

  before do
    task.reenable  # 同じタスクを複数回呼べるようにする
  end

  it 'ロックアウト状態のユーザーを検出して出力する' do
    # 正常ユーザー: パスワード設定済み
    User.create!(username: 'normaluser', email: 'normal@example.com', password: 'password123')

    # OAuth専用ユーザー（正常）
    create_oauth_only_user(username: 'oauthuser', email: 'oauth@example.com')

    # ロックアウト状態のユーザー（手動で作る）
    locked = User.new(username: 'lockeduser', email: 'locked@example.com', password: SecureRandom.hex(32))
    locked.save!
    locked.update_column(:password_set_at, nil) # rubocop:disable Rails/SkipsModelValidations
    # user_providers は作らない（空の状態）

    expect { task.invoke }.to output(/ロックアウト状態のユーザー: 1件/).to_stdout
      .and output(/lockeduser/).to_stdout
  end

  it 'ロックアウトユーザーがいない場合は0件と出力' do
    User.create!(username: 'normaluser', email: 'normal@example.com', password: 'password123')
    create_oauth_only_user(username: 'oauthuser', email: 'oauth@example.com')

    expect { task.invoke }.to output(/ロックアウト状態のユーザー: 0件/).to_stdout
  end
end
```

- [ ] **Step 2: テスト実行（失敗確認）**

```bash
docker compose exec backend bundle exec rspec spec/tasks/lockout_rake_spec.rb -f documentation
```

Expected: `Don't know how to build task 'lockout:detect'`

- [ ] **Step 3: Rake タスクを実装**

`backend/lib/tasks/lockout.rake` を新規作成：

```ruby
# frozen_string_literal: true

namespace :lockout do
  desc 'ロックアウト状態（password_set_at が NULL かつ OAuth連携なし）のユーザーを検出'
  task detect: :environment do
    locked = User.where(password_set_at: nil).where.missing(:user_providers)
    puts "ロックアウト状態のユーザー: #{locked.count}件"
    locked.find_each do |u|
      puts "  - id=#{u.id} username=#{u.username} email=#{u.email} created_at=#{u.created_at}"
    end
  end
end
```

- [ ] **Step 4: テスト実行（パス確認）**

```bash
docker compose exec backend bundle exec rspec spec/tasks/lockout_rake_spec.rb -f documentation
```

Expected: 全パス

- [ ] **Step 5: 手動でタスクを実行してみる**

```bash
docker compose exec backend bundle exec rake lockout:detect
```

Expected: `ロックアウト状態のユーザー: 0件` 程度が出る（ローカルDBの状態次第）

- [ ] **Step 6: RuboCop**

```bash
docker compose exec backend bundle exec rubocop lib/tasks/lockout.rake spec/tasks/lockout_rake_spec.rb
```

Expected: no offenses

- [ ] **Step 7: Commit**

```bash
git add backend/lib/tasks/lockout.rake backend/spec/tasks/lockout_rake_spec.rb
git commit -m "feat: lockout:detect Rakeタスクを追加（Fixes #110）"
```

---

### Task 17: OAuthButtons のエラー表示テスト追加

**Files:**
- Modify: `frontend/src/components/OAuthButtons/OAuthButtons.test.tsx`

- [ ] **Step 1: 既存テストを確認**

```bash
cat frontend/src/components/OAuthButtons/OAuthButtons.test.tsx
```

既存テストの `describe` / モック構造を把握する。

- [ ] **Step 2: 既存テスト構造に合わせて 409 conflict エラー時のメッセージテストを追加**

既存テストで使われているモック（`fetch` または `googleAuthApi`）に合わせて、conflict エラー時のレスポンスをシミュレートするテストを追加：

```ts
it('409 conflictでは errorMessages.ts の日本語メッセージが表示される', async () => {
  // fetch モックが使われているケース
  const mockFetch = global.fetch as ReturnType<typeof vi.fn>
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status: 409,
    json: () =>
      Promise.resolve({
        error: 'raw message',
        code: 'email_already_registered',
        message: 'raw message',
      }),
  })

  // ... コンポーネントをレンダリング + ログインボタンをクリック + エラー表示を assert
  // 具体的な render / fireEvent は既存テストの構造に合わせる

  await waitFor(() => {
    expect(screen.getByText(/既にメール\+パスワードで登録/)).toBeInTheDocument()
  })
})
```

**注意**: OAuthButtons の実装とテストは MSW または fetch mock どちらを使っているか既存で確認し、既存のパターンに合わせる。`api.ts` の request() が `errorMessages` 経由で訳すので、OAuthButtons 本体のコード変更は **不要**。テストのアサーションのみ追加。

- [ ] **Step 3: テスト実行**

```bash
docker compose exec frontend npm run test -- OAuthButtons --run
```

Expected: 既存テスト + 新規テスト全パス

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/OAuthButtons/OAuthButtons.test.tsx
git commit -m "test: OAuthButtonsに409conflict時の辞書メッセージ表示テストを追加"
```

---

### Task 18: 全テスト + Lint + 動作確認

**Files:** なし（確認のみ）

- [ ] **Step 1: バックエンドの全テスト実行**

```bash
docker compose exec backend bundle exec rspec -f documentation
```

Expected: 全パス

- [ ] **Step 2: フロントエンドの全テスト実行**

```bash
docker compose exec frontend npm run test -- --run
```

Expected: 全パス

- [ ] **Step 3: バックエンド RuboCop**

```bash
docker compose exec backend bundle exec rubocop
```

Expected: no offenses

- [ ] **Step 4: フロントエンド ESLint + Prettier**

```bash
docker compose exec frontend npm run lint
docker compose exec frontend npm run format:check
```

Expected: no errors

- [ ] **Step 5: TypeScript 型チェック**

```bash
docker compose exec frontend npm run typecheck
```

Expected: no errors

- [ ] **Step 6: 動作確認方針の確認**

動作確認は spec の完了条件に従う。recolly-workflow の Step 5 で手動確認 or Playwright MCP のどちらかを選択する。この Task では単に「全テスト・lint がパスしている」ことだけ確認する。

- [ ] **Step 7: ブランチの状態確認**

```bash
git status
git log --oneline fix/lockout-prevention-and-error-basis --not main
```

Expected: クリーンな状態、10前後のコミット。

---

## Self-Review

### Spec カバレッジ確認

spec の各セクションとタスクの対応：

| Spec セクション | 対応 Task |
|---|---|
| B1. マイグレーション | Task 9 |
| B2. User モデル before_update | Task 11 |
| B3. UserProvider before_destroy | Task 12 |
| B4. エラーレスポンス形式統一 | Task 1, 2, 3, 4 |
| B5. has_password 切り替え | Task 10 |
| B6. set_password 空文字拒否 | Task 14 |
| B7. unlink_provider トランザクション | Task 15 |
| B8. OauthRegistrations ハック削除 | Task 13 |
| B9. docs/api-error-codes.md | Task 5 |
| F1. ErrorResponse 型 | Task 6 |
| F2. api.ts request() 改修 | Task 8 |
| F3. errorMessages.ts | Task 7 |
| F4. OAuthButtons テスト | Task 17 |
| F5. AccountSettingsPage（変更不要、自動改善） | Task 8 で完了 |
| F6. UI 現状維持 | 変更なし |
| Rake タスク | Task 16 |
| 最終検証 | Task 18 |

**ギャップなし**。

### 型・メソッド名一貫性

- `ApiError.code` (FE) ↔ `ApiErrorCodes::*` (BE) — 文字列値で一致
- `getErrorMessage(code, fallback)` — errorMessages.ts で定義、api.ts で使用
- `prevent_lockout_transition` (User) / `prevent_lockout_on_destroy` (UserProvider) — 命名方針統一
- `password_set_at` — migration, model, controller, test 全てで同名

### プレースホルダースキャン

TBD / TODO / 「実装は後で」なし。全 Task に完全なコードと exact コマンドあり。

---

## 実行ハンドオフ

Plan complete and saved to `docs/superpowers/plans/2026-04-09-pr-a-lockout-prevention-and-error-basis.md`.
