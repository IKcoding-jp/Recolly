# PR-B2: パスワードリセット機能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** パスワードを忘れたユーザーが自力で再設定できる機能を実装し、LoginPage の 401 エラー時の導線を強化する（#107 + #112 を同時クローズ）。

**Architecture:** バックエンドは既存の Devise `recoverable` モジュールと PR-B1 で整えた SES 基盤を活用し、`DeviseMailer` サブクラスで `FRONTEND_URL` を注入、`PasswordsController#update` を追加する。フロントエンドは `/password/new`（メアド入力）と `/password/edit`（新パスワード入力）の 2 ページを新規追加し、`LoginPage` に「パスワードをお忘れですか？」の常時リンクと 401 時の強調バナー（パスワードリセット誘導 + Google ログイン誘導）を追加する。

**Tech Stack:** Rails 8 (Devise 4.x), React 19 + TypeScript + Vite, RSpec + rspec-rails, Vitest + React Testing Library, AWS SES (multipart HTML + text)

**Spec:** `docs/superpowers/specs/2026-04-10-pr-b2-password-reset-feature-design.md`

---

## File Structure

### バックエンド（新規 / 修正）
- **新規** `backend/app/mailers/devise_mailer.rb` — `Devise::Mailer` サブクラス。`reset_password_instructions` を override し `@frontend_url` をセット
- **新規** `backend/app/views/devise/mailer/reset_password_instructions.html.erb` — 日本語 HTML メールテンプレート
- **新規** `backend/app/views/devise/mailer/reset_password_instructions.text.erb` — 日本語 text メールテンプレート
- **新規** `backend/spec/mailers/devise_mailer_spec.rb` — メール本文・リンク URL の検証
- **修正** `backend/app/controllers/api/v1/passwords_controller.rb` — `update` アクション追加
- **修正** `backend/config/initializers/devise.rb` — `config.mailer = 'DeviseMailer'` 追加
- **追記** `backend/spec/requests/api/v1/passwords_spec.rb` — `PUT /api/v1/password` のテスト追加

### フロントエンド（新規 / 修正）
- **新規** `frontend/src/pages/PasswordNewPage/PasswordNewPage.tsx`
- **新規** `frontend/src/pages/PasswordNewPage/PasswordNewPage.test.tsx`
- **新規** `frontend/src/pages/PasswordEditPage/PasswordEditPage.tsx`
- **新規** `frontend/src/pages/PasswordEditPage/PasswordEditPage.test.tsx`
- **修正** `frontend/src/pages/LoginPage/LoginPage.tsx`
- **追記** `frontend/src/pages/LoginPage/LoginPage.test.tsx`
- **追記** `frontend/src/lib/api.ts` — `updatePassword` 関数追加
- **修正** `frontend/src/App.tsx` — `/password/new`, `/password/edit` のルート追加
- **追記** `frontend/src/styles/tokens.css` — `--color-success`, `--color-warning-bg`, `--color-warning-text` 追加
- **追記** `frontend/src/styles/authForm.module.css` — `.success`, `.warningBanner` クラス追加

### ドキュメント
- **新規** `docs/setup/frontend-url-env.md` — 本番 `FRONTEND_URL` 設定手順

---

## 実装コマンドの基本

バックエンドのテスト実行は Docker 経由：
```bash
docker compose exec backend bundle exec rspec <path>
docker compose exec backend bundle exec rubocop <path>
```

フロントエンドのテスト実行も Docker 経由：
```bash
docker compose exec frontend npm test -- --run <path>
docker compose exec frontend npm run lint
```

Docker が起動していない場合は `docker compose up -d` で起動。backend コンテナが落ちた場合は `docker compose run --rm backend rm -f tmp/pids/server.pid && docker compose up -d backend`。

---

## Task 1: DeviseMailer サブクラスとメールテンプレートを作成

**目的:** リセットメール送信時に `FRONTEND_URL` をテンプレートに渡し、日本語の HTML + text メールを multipart で送信できるようにする。

**Files:**
- Create: `backend/app/mailers/devise_mailer.rb`
- Create: `backend/app/views/devise/mailer/reset_password_instructions.html.erb`
- Create: `backend/app/views/devise/mailer/reset_password_instructions.text.erb`
- Create: `backend/spec/mailers/devise_mailer_spec.rb`

- [ ] **Step 1: 失敗するテストを書く** — `backend/spec/mailers/devise_mailer_spec.rb`

```ruby
# frozen_string_literal: true

require 'rails_helper'

RSpec.describe DeviseMailer, type: :mailer do
  describe '#reset_password_instructions' do
    let(:user) { User.create!(username: 'testuser', email: 'test@example.com', password: 'password123') }
    let(:token) { 'dummy-reset-token-abcdef' }

    # `FRONTEND_URL` を明示的にセットして URL の組み立てを検証する
    around do |example|
      original = ENV['FRONTEND_URL']
      ENV['FRONTEND_URL'] = 'https://recolly.net'
      example.run
      ENV['FRONTEND_URL'] = original
    end

    subject(:mail) { described_class.reset_password_instructions(user, token) }

    it '送信元が noreply@recolly.net' do
      expect(mail.from).to eq(['noreply@recolly.net'])
    end

    it '件名が日本語' do
      expect(mail.subject).to eq('【Recolly】パスワードリセットのご案内')
    end

    it 'HTML パートと text パートの両方を含む multipart メール' do
      expect(mail).to be_multipart
      expect(mail.html_part).to be_present
      expect(mail.text_part).to be_present
    end

    it 'HTML 本文にユーザー名を含む' do
      expect(mail.html_part.body.encoded).to include('testuser')
    end

    it 'HTML 本文にフロントエンド URL のリセットリンクを含む' do
      expect(mail.html_part.body.encoded)
        .to include("https://recolly.net/password/edit?reset_password_token=#{token}")
    end

    it 'text 本文にフロントエンド URL のリセットリンクを含む' do
      expect(mail.text_part.body.encoded)
        .to include("https://recolly.net/password/edit?reset_password_token=#{token}")
    end

    it 'FRONTEND_URL が未設定のときは localhost:5173 にフォールバックする' do
      ENV['FRONTEND_URL'] = nil
      expect(mail.html_part.body.encoded)
        .to include("http://localhost:5173/password/edit?reset_password_token=#{token}")
    end
  end
end
```

- [ ] **Step 2: テストを実行して失敗を確認**

```bash
docker compose exec backend bundle exec rspec spec/mailers/devise_mailer_spec.rb
```

期待: `uninitialized constant DeviseMailer` で全テスト失敗

- [ ] **Step 3: DeviseMailer サブクラスを実装** — `backend/app/mailers/devise_mailer.rb`

```ruby
# frozen_string_literal: true

# Devise のデフォルトメーラーを拡張し、フロントエンド URL をテンプレートに渡す。
# API モードでは routes ヘルパーがバックエンドのホストを返してしまうため、
# パスワードリセットリンクを組み立てる際に明示的にフロントエンド URL を注入する。
class DeviseMailer < Devise::Mailer
  default from: 'noreply@recolly.net'

  def reset_password_instructions(record, token, opts = {})
    @frontend_url = ENV.fetch('FRONTEND_URL', 'http://localhost:5173')
    super
  end
end
```

- [ ] **Step 4: HTML メールテンプレートを実装** — `backend/app/views/devise/mailer/reset_password_instructions.html.erb`

```erb
<p><%= @resource.username %> さん、こんにちは。</p>

<p>Recolly のパスワードリセットのリクエストを受け付けました。<br>
下のリンクから新しいパスワードを設定してください。</p>

<p>
  <a href="<%= "#{@frontend_url}/password/edit?reset_password_token=#{@token}" %>">
    パスワードを変更する
  </a>
</p>

<p>このリンクは 6 時間有効です。</p>

<p>このリクエストに心当たりがない場合は、このメールを無視してください。<br>
パスワードは変更されません。</p>

<p>— Recolly</p>
```

- [ ] **Step 5: text メールテンプレートを実装** — `backend/app/views/devise/mailer/reset_password_instructions.text.erb`

```erb
<%= @resource.username %> さん、こんにちは。

Recolly のパスワードリセットのリクエストを受け付けました。
下の URL から新しいパスワードを設定してください。

<%= "#{@frontend_url}/password/edit?reset_password_token=#{@token}" %>

このリンクは 6 時間有効です。

このリクエストに心当たりがない場合は、このメールを無視してください。
パスワードは変更されません。

— Recolly
```

- [ ] **Step 6: 件名の i18n 設定を確認 / 追加**

Devise は `devise.mailer.reset_password_instructions.subject` を i18n キーで解決する。日本語件名を出すため、`backend/config/locales/devise.en.yml` の隣に `devise.ja.yml` がないことを確認し、件名をテンプレート側で直接指定する方針に切り替える。

DeviseMailer で `subject` を明示的に渡すように修正：

```ruby
# backend/app/mailers/devise_mailer.rb（修正版）
class DeviseMailer < Devise::Mailer
  default from: 'noreply@recolly.net'

  def reset_password_instructions(record, token, opts = {})
    @frontend_url = ENV.fetch('FRONTEND_URL', 'http://localhost:5173')
    opts[:subject] = '【Recolly】パスワードリセットのご案内'
    super
  end
end
```

- [ ] **Step 7: テストを実行してパスを確認**

```bash
docker compose exec backend bundle exec rspec spec/mailers/devise_mailer_spec.rb
```

期待: 全 7 テストがパス

- [ ] **Step 8: RuboCop を実行して静的解析パス**

```bash
docker compose exec backend bundle exec rubocop app/mailers/devise_mailer.rb spec/mailers/devise_mailer_spec.rb
```

期待: no offenses

- [ ] **Step 9: コミット**

```bash
git add backend/app/mailers/devise_mailer.rb \
        backend/app/views/devise/mailer/ \
        backend/spec/mailers/devise_mailer_spec.rb
git commit -m "feat(backend): DeviseMailer サブクラスと日本語メールテンプレートを追加

パスワードリセットメールに FRONTEND_URL ベースのリンクを
埋め込むため DeviseMailer を継承。HTML と text の multipart
で日本語本文を送信する。

Refs: #107"
```

---

## Task 2: devise.rb で DeviseMailer を使うように設定

**目的:** Devise が `Devise::Mailer` ではなく `DeviseMailer` サブクラスを使うように切り替える。

**Files:**
- Modify: `backend/config/initializers/devise.rb`

- [ ] **Step 1: 既存の passwords_spec.rb を実行してベースラインを取る**

```bash
docker compose exec backend bundle exec rspec spec/requests/api/v1/passwords_spec.rb
```

期待: 既存の 3 テスト（create 正常系 2 + 異常系 1）が全てパス

- [ ] **Step 2: devise.rb に mailer 設定を追加** — `backend/config/initializers/devise.rb:8` の直後

既存ファイルの `config.mailer_sender = 'noreply@recolly.net'` の下に追加：

```ruby
  # カスタムメーラーを使用（フロントエンド URL をテンプレートに注入するため）
  config.mailer = 'DeviseMailer'
```

- [ ] **Step 3: passwords_spec.rb と devise_mailer_spec.rb を実行**

```bash
docker compose exec backend bundle exec rspec spec/requests/api/v1/passwords_spec.rb spec/mailers/devise_mailer_spec.rb
```

期待: 両方のファイルが全てパス。`POST /api/v1/password` のリクエストスペックで送信元アドレス `noreply@recolly.net` の検証が依然として通ることを確認する。

- [ ] **Step 4: コミット**

```bash
git add backend/config/initializers/devise.rb
git commit -m "feat(backend): Devise の mailer を DeviseMailer に切り替え

config.mailer = 'DeviseMailer' を設定してパスワードリセット
メールがカスタムテンプレートで送信されるようにする。

Refs: #107"
```

---

## Task 3: PasswordsController#update の正常系を TDD で実装

**目的:** 有効なトークンで新パスワードを設定できるエンドポイント（`PUT /api/v1/password`）を追加する。

**Files:**
- Modify: `backend/app/controllers/api/v1/passwords_controller.rb`
- Test: `backend/spec/requests/api/v1/passwords_spec.rb`

- [ ] **Step 1: 失敗するテストを書く** — 既存の `backend/spec/requests/api/v1/passwords_spec.rb` の `describe 'POST /api/v1/password...' do ... end` の **後**に追記：

```ruby
  describe 'PUT /api/v1/password（新パスワード設定）' do
    let(:raw_token) { user.send_reset_password_instructions }

    context '正常系' do
      it '有効なトークンでパスワード更新に成功する（200）' do
        put user_password_path,
            params: {
              user: {
                reset_password_token: raw_token,
                password: 'newpassword123',
                password_confirmation: 'newpassword123'
              }
            },
            as: :json

        expect(response).to have_http_status(:ok)
        expect(response.parsed_body['message']).to eq('パスワードを更新しました')
      end

      it '更新後の新パスワードでログインできる' do
        put user_password_path,
            params: {
              user: {
                reset_password_token: raw_token,
                password: 'newpassword123',
                password_confirmation: 'newpassword123'
              }
            },
            as: :json

        user.reload
        expect(user.valid_password?('newpassword123')).to be true
        expect(user.valid_password?('password123')).to be false
      end
    end
  end
```

- [ ] **Step 2: テストを実行して失敗を確認**

```bash
docker compose exec backend bundle exec rspec spec/requests/api/v1/passwords_spec.rb -e "PUT /api/v1/password"
```

期待: 両テストが失敗。正確には、Devise デフォルトの `update` はリダイレクトを試みて `navigational_formats = []` で 406 または 422 を返すため、JSON レスポンスが想定と異なる。

- [ ] **Step 3: `update` アクションを実装** — `backend/app/controllers/api/v1/passwords_controller.rb` を以下に置換：

```ruby
# frozen_string_literal: true

module Api
  module V1
    class PasswordsController < Devise::PasswordsController
      respond_to :json

      # POST /api/v1/password — パスワードリセットメール送信
      def create
        self.resource = resource_class.send_reset_password_instructions(resource_params)

        # セキュリティ上、登録有無に関わらず同じレスポンスを返す
        render json: { message: 'パスワードリセットの手順をメールで送信しました' }, status: :ok
      end

      # PUT /api/v1/password — リセットトークンによる新パスワード設定
      def update
        self.resource = resource_class.reset_password_by_token(resource_params)

        if resource.errors.empty?
          render json: { message: 'パスワードを更新しました' }, status: :ok
        else
          render json: {
            error: 'password_reset_failed',
            errors: resource.errors.full_messages
          }, status: :unprocessable_entity
        end
      end
    end
  end
end
```

- [ ] **Step 4: テストを実行してパスを確認**

```bash
docker compose exec backend bundle exec rspec spec/requests/api/v1/passwords_spec.rb
```

期待: 全テスト（既存 3 + 新規 2）がパス

- [ ] **Step 5: RuboCop を実行**

```bash
docker compose exec backend bundle exec rubocop app/controllers/api/v1/passwords_controller.rb
```

期待: no offenses

- [ ] **Step 6: コミット**

```bash
git add backend/app/controllers/api/v1/passwords_controller.rb \
        backend/spec/requests/api/v1/passwords_spec.rb
git commit -m "feat(backend): PasswordsController#update を実装

PUT /api/v1/password で reset_password_token による
新パスワード設定を受け付ける。成功時は 200、失敗時は
422 で password_reset_failed エラーを返す。

Refs: #107"
```

---

## Task 4: PasswordsController#update の異常系テストを追加

**目的:** 無効トークン・期限切れ・パスワード要件違反の各ケースで 422 が返ることを確認する。

**Files:**
- Test: `backend/spec/requests/api/v1/passwords_spec.rb`

- [ ] **Step 1: 異常系テストを追記** — `context '正常系' do ... end` の後に：

```ruby
    context '異常系' do
      it '無効なトークンで 422' do
        put user_password_path,
            params: {
              user: {
                reset_password_token: 'invalid-token',
                password: 'newpassword123',
                password_confirmation: 'newpassword123'
              }
            },
            as: :json

        expect(response).to have_http_status(:unprocessable_entity)
        expect(response.parsed_body['error']).to eq('password_reset_failed')
      end

      it '期限切れのトークンで 422' do
        token = user.send_reset_password_instructions

        # Devise の reset_password_within は 6 時間。7 時間進めれば確実に期限切れ
        travel_to(7.hours.from_now) do
          put user_password_path,
              params: {
                user: {
                  reset_password_token: token,
                  password: 'newpassword123',
                  password_confirmation: 'newpassword123'
                }
              },
              as: :json

          expect(response).to have_http_status(:unprocessable_entity)
          expect(response.parsed_body['error']).to eq('password_reset_failed')
        end
      end

      it 'パスワードが短すぎる場合 422' do
        token = user.send_reset_password_instructions

        put user_password_path,
            params: {
              user: {
                reset_password_token: token,
                password: 'short',
                password_confirmation: 'short'
              }
            },
            as: :json

        expect(response).to have_http_status(:unprocessable_entity)
        expect(response.parsed_body['error']).to eq('password_reset_failed')
      end

      it 'パスワードと確認が不一致の場合 422' do
        token = user.send_reset_password_instructions

        put user_password_path,
            params: {
              user: {
                reset_password_token: token,
                password: 'newpassword123',
                password_confirmation: 'different123'
              }
            },
            as: :json

        expect(response).to have_http_status(:unprocessable_entity)
        expect(response.parsed_body['error']).to eq('password_reset_failed')
      end
    end
```

- [ ] **Step 2: rails_helper.rb に `ActiveSupport::Testing::TimeHelpers` が入っていることを確認**

```bash
docker compose exec backend grep -r "TimeHelpers" spec/
```

もし見つからない場合は、`backend/spec/rails_helper.rb` の `RSpec.configure do |config|` ブロックに以下を追加：

```ruby
  config.include ActiveSupport::Testing::TimeHelpers
```

- [ ] **Step 3: テストを実行してパスを確認**

```bash
docker compose exec backend bundle exec rspec spec/requests/api/v1/passwords_spec.rb
```

期待: 全テスト（既存 3 + 正常系 2 + 異常系 4 = 9）がパス

- [ ] **Step 4: コミット**

```bash
git add backend/spec/requests/api/v1/passwords_spec.rb backend/spec/rails_helper.rb
git commit -m "test(backend): PasswordsController#update の異常系テストを追加

無効トークン・期限切れ・パスワード要件違反・確認不一致の
4 ケースで 422 password_reset_failed が返ることを検証。

Refs: #107"
```

---

## Task 5: tokens.css に成功・警告色を追加

**目的:** パスワードリセット成功メッセージと 401 時の警告バナー用のカラートークンを追加する。ハードコード禁止の原則を守るためトークンを先に用意する。

**Files:**
- Modify: `frontend/src/styles/tokens.css`

- [ ] **Step 1: tokens.css にトークンを追加** — `--color-error: #c0392b;` の下に追加（L15 付近）：

```css
  --color-error: #c0392b;
  --color-success: #2e7d32;
  --color-warning-bg: #fff8e1;
  --color-warning-text: #8a6d00;
```

**色の選定理由:**
- `--color-success #2e7d32`: Material Design の `green 800`。`--color-error` と視覚的に対比しやすい落ち着いた緑
- `--color-warning-bg #fff8e1`: Material Design の `amber 50`。背景として使える薄い黄
- `--color-warning-text #8a6d00`: `amber 50` 背景との WCAG AA コントラスト比（4.5:1 以上）を確保する濃い amber

- [ ] **Step 2: ESLint / Prettier を実行**

```bash
docker compose exec frontend npm run lint -- src/styles/tokens.css || true
```

CSS は ESLint 対象外の可能性が高い。エラーがなければ OK。

- [ ] **Step 3: コミット**

```bash
git add frontend/src/styles/tokens.css
git commit -m "feat(frontend): tokens.css に success と warning の色トークンを追加

パスワードリセット機能の成功メッセージと 401 時の警告バナー
用にカラートークンを追加。ハードコード禁止の原則を守るため
先にトークンとして定義する。

Refs: #107, #112"
```

---

## Task 6: authForm.module.css に .success / .warningBanner クラスを追加

**目的:** パスワードリセット成功メッセージと 401 時のバナー用の CSS クラスを用意する。

**Files:**
- Modify: `frontend/src/styles/authForm.module.css`

- [ ] **Step 1: authForm.module.css にクラスを追加** — `.error` クラス（L22）の直後に追加：

```css
.success {
  color: var(--color-success);
  font-family: var(--font-body);
  font-size: var(--font-size-meta);
  padding: var(--spacing-sm) var(--spacing-md);
  background-color: var(--color-bg-white);
  border: var(--border-width-thin) var(--border-style) var(--color-success);
  border-radius: var(--radius-sm);
  margin-top: var(--spacing-md);
}

.warningBanner {
  color: var(--color-warning-text);
  background-color: var(--color-warning-bg);
  border: var(--border-width-thin) var(--border-style) var(--color-warning-text);
  border-radius: var(--radius-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  font-family: var(--font-body);
  font-size: var(--font-size-meta);
  margin-top: var(--spacing-md);
}

.warningBanner p {
  margin: var(--spacing-xs) 0;
}

.warningBanner a {
  color: var(--color-warning-text);
  text-decoration: underline;
}
```

- [ ] **Step 2: 他の CSS ファイルが `.success` / `.warningBanner` を使っていないことを確認**

```bash
docker compose exec frontend grep -r "warningBanner" src/styles/
```

期待: authForm.module.css 以外にヒットなし

- [ ] **Step 3: コミット**

```bash
git add frontend/src/styles/authForm.module.css
git commit -m "feat(frontend): authForm.module.css に .success と .warningBanner を追加

パスワードリセット成功メッセージと 401 時の警告バナー用の
スタイルを追加。全て tokens.css のトークン参照のみで構成。

Refs: #107, #112"
```

---

## Task 7: api.ts に updatePassword 関数を追加

**目的:** フロントエンドから `PUT /api/v1/password` を呼び出すための API クライアント関数を追加する。

**Files:**
- Modify: `frontend/src/lib/api.ts`

**補足:** `requestPasswordReset` 相当の関数は既に `authApi.resetPassword(email)` として存在するため、`updatePassword` のみ追加する。

- [ ] **Step 1: `authApi` オブジェクトに関数を追加** — `frontend/src/lib/api.ts` の `authApi` の `resetPassword` の直後に追加：

```ts
  updatePassword(
    resetPasswordToken: string,
    password: string,
    passwordConfirmation: string,
  ): Promise<{ message: string }> {
    return request<{ message: string }>('/password', {
      method: 'PUT',
      body: JSON.stringify({
        user: {
          reset_password_token: resetPasswordToken,
          password,
          password_confirmation: passwordConfirmation,
        },
      }),
    })
  },
```

- [ ] **Step 2: ESLint / Prettier を実行**

```bash
docker compose exec frontend npm run lint -- src/lib/api.ts
```

期待: エラーなし

- [ ] **Step 3: コミット**

```bash
git add frontend/src/lib/api.ts
git commit -m "feat(frontend): api.ts に updatePassword 関数を追加

PUT /api/v1/password を呼び出すフロントエンド API クライアント
関数。reset_password_token と新パスワードを送信する。

Refs: #107"
```

---

## Task 8: PasswordNewPage（メアド入力ページ）を TDD で実装

**目的:** `/password/new` でメアドを入力し、リセットメール送信をリクエストするページを実装する。

**Files:**
- Create: `frontend/src/pages/PasswordNewPage/PasswordNewPage.tsx`
- Create: `frontend/src/pages/PasswordNewPage/PasswordNewPage.test.tsx`

- [ ] **Step 1: 失敗するテストを書く** — `frontend/src/pages/PasswordNewPage/PasswordNewPage.test.tsx`

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { PasswordNewPage } from './PasswordNewPage'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

beforeEach(() => {
  mockFetch.mockReset()
})

function renderPasswordNewPage() {
  return render(
    <BrowserRouter>
      <PasswordNewPage />
    </BrowserRouter>,
  )
}

describe('PasswordNewPage', () => {
  it('メールアドレス入力フォームが表示される', () => {
    renderPasswordNewPage()
    expect(screen.getByLabelText('メールアドレス')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'リセットメールを送信' }),
    ).toBeInTheDocument()
  })

  it('「ログインに戻る」リンクが表示される', () => {
    renderPasswordNewPage()
    expect(screen.getByText('ログインに戻る')).toHaveAttribute('href', '/login')
  })

  it('送信成功時に成功メッセージが表示されフォームが非表示になる', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ message: 'パスワードリセットの手順をメールで送信しました' }),
    })

    renderPasswordNewPage()
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('メールアドレス'), 'test@example.com')
    await user.click(screen.getByRole('button', { name: 'リセットメールを送信' }))

    expect(
      await screen.findByText(/メールをお送りしました/),
    ).toBeInTheDocument()
    // フォームが非表示になっていることを確認
    expect(
      screen.queryByRole('button', { name: 'リセットメールを送信' }),
    ).not.toBeInTheDocument()
  })

  it('API がエラーを返したらエラーメッセージが表示される', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'サーバーエラーが発生しました' }),
    })

    renderPasswordNewPage()
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('メールアドレス'), 'test@example.com')
    await user.click(screen.getByRole('button', { name: 'リセットメールを送信' }))

    expect(
      await screen.findByText('サーバーエラーが発生しました'),
    ).toBeInTheDocument()
  })

  it('POST /api/v1/password が正しいボディで呼ばれる', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ message: 'ok' }),
    })

    renderPasswordNewPage()
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('メールアドレス'), 'test@example.com')
    await user.click(screen.getByRole('button', { name: 'リセットメールを送信' }))

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/password',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ user: { email: 'test@example.com' } }),
      }),
    )
  })
})
```

- [ ] **Step 2: テストを実行して失敗を確認**

```bash
docker compose exec frontend npm test -- --run src/pages/PasswordNewPage/
```

期待: `Cannot find module './PasswordNewPage'` で全テスト失敗

- [ ] **Step 3: PasswordNewPage コンポーネントを実装** — `frontend/src/pages/PasswordNewPage/PasswordNewPage.tsx`

```tsx
import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ApiError, authApi } from '../../lib/api'
import { Typography } from '../../components/ui/Typography/Typography'
import { Button } from '../../components/ui/Button/Button'
import { Divider } from '../../components/ui/Divider/Divider'
import { FormInput } from '../../components/ui/FormInput/FormInput'
import styles from '../../styles/authForm.module.css'

export function PasswordNewPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      await authApi.resetPassword(email)
      setSubmitted(true)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('送信に失敗しました')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <Typography variant="h2">パスワードをリセット</Typography>
        <Divider />
        {submitted ? (
          <p className={styles.success}>
            パスワードリセットの手順をメールをお送りしました。
            <br />
            メールをご確認ください。
          </p>
        ) : (
          <form className={styles.form} onSubmit={handleSubmit}>
            <FormInput
              label="メールアドレス"
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
            {error && <p className={styles.error}>{error}</p>}
            <Button variant="primary" type="submit" disabled={isSubmitting}>
              {isSubmitting ? '送信中...' : 'リセットメールを送信'}
            </Button>
          </form>
        )}
        <div className={styles.link}>
          <Link to="/login">ログインに戻る</Link>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: テストを実行してパスを確認**

```bash
docker compose exec frontend npm test -- --run src/pages/PasswordNewPage/
```

期待: 全 5 テストがパス

- [ ] **Step 5: ESLint / Prettier を実行**

```bash
docker compose exec frontend npm run lint -- src/pages/PasswordNewPage/
```

期待: エラーなし

- [ ] **Step 6: コミット**

```bash
git add frontend/src/pages/PasswordNewPage/
git commit -m "feat(frontend): PasswordNewPage を追加

/password/new でメアドを入力しパスワードリセットメール送信を
リクエストするページを実装。送信後は成功メッセージを表示し
フォームを非表示にする。

Refs: #107"
```

---

## Task 9: PasswordEditPage（新パスワード入力ページ）を TDD で実装

**目的:** `/password/edit?reset_password_token=xxx` で新パスワードを入力し、リセットトークンで更新するページを実装する。

**Files:**
- Create: `frontend/src/pages/PasswordEditPage/PasswordEditPage.tsx`
- Create: `frontend/src/pages/PasswordEditPage/PasswordEditPage.test.tsx`

- [ ] **Step 1: 失敗するテストを書く** — `frontend/src/pages/PasswordEditPage/PasswordEditPage.test.tsx`

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { PasswordEditPage } from './PasswordEditPage'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

beforeEach(() => {
  mockFetch.mockReset()
})

function renderWithToken(token: string | null) {
  const search = token ? `?reset_password_token=${token}` : ''
  return render(
    <MemoryRouter initialEntries={[`/password/edit${search}`]}>
      <Routes>
        <Route path="/password/edit" element={<PasswordEditPage />} />
        <Route path="/password/new" element={<div>PasswordNewPage</div>} />
        <Route path="/login" element={<div>LoginPage</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('PasswordEditPage', () => {
  it('トークンなしでアクセスすると /password/new にリダイレクト', () => {
    renderWithToken(null)
    expect(screen.getByText('PasswordNewPage')).toBeInTheDocument()
  })

  it('トークン付きでアクセスするとフォームが表示される', () => {
    renderWithToken('valid-token')
    expect(screen.getByLabelText('新しいパスワード')).toBeInTheDocument()
    expect(screen.getByLabelText('新しいパスワード（確認）')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'パスワードを更新' })).toBeInTheDocument()
  })

  it('パスワードが 6 文字未満なら送信ボタンが disabled', async () => {
    renderWithToken('valid-token')
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('新しいパスワード'), 'short')
    await user.type(screen.getByLabelText('新しいパスワード（確認）'), 'short')

    expect(screen.getByRole('button', { name: 'パスワードを更新' })).toBeDisabled()
  })

  it('パスワードと確認が不一致なら送信ボタンが disabled', async () => {
    renderWithToken('valid-token')
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('新しいパスワード'), 'newpassword123')
    await user.type(screen.getByLabelText('新しいパスワード（確認）'), 'different123')

    expect(screen.getByRole('button', { name: 'パスワードを更新' })).toBeDisabled()
  })

  it('バリデーション通過後に送信ボタンが enabled', async () => {
    renderWithToken('valid-token')
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('新しいパスワード'), 'newpassword123')
    await user.type(screen.getByLabelText('新しいパスワード（確認）'), 'newpassword123')

    expect(screen.getByRole('button', { name: 'パスワードを更新' })).not.toBeDisabled()
  })

  it('送信成功時に /login に遷移する', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ message: 'パスワードを更新しました' }),
    })

    renderWithToken('valid-token')
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('新しいパスワード'), 'newpassword123')
    await user.type(screen.getByLabelText('新しいパスワード（確認）'), 'newpassword123')
    await user.click(screen.getByRole('button', { name: 'パスワードを更新' }))

    expect(await screen.findByText('LoginPage')).toBeInTheDocument()
  })

  it('PUT /api/v1/password が正しいボディで呼ばれる', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ message: 'ok' }),
    })

    renderWithToken('valid-token')
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('新しいパスワード'), 'newpassword123')
    await user.type(screen.getByLabelText('新しいパスワード（確認）'), 'newpassword123')
    await user.click(screen.getByRole('button', { name: 'パスワードを更新' }))

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/password',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({
          user: {
            reset_password_token: 'valid-token',
            password: 'newpassword123',
            password_confirmation: 'newpassword123',
          },
        }),
      }),
    )
  })

  it('password_reset_failed エラー時に再申請リンクが表示される', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 422,
      json: () =>
        Promise.resolve({
          error: 'password_reset_failed',
          errors: ['Reset password token is invalid'],
        }),
    })

    renderWithToken('invalid-token')
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('新しいパスワード'), 'newpassword123')
    await user.type(screen.getByLabelText('新しいパスワード（確認）'), 'newpassword123')
    await user.click(screen.getByRole('button', { name: 'パスワードを更新' }))

    expect(
      await screen.findByText(/リンクが無効または期限切れ/),
    ).toBeInTheDocument()
    expect(screen.getByText('パスワードリセットを再申請')).toHaveAttribute(
      'href',
      '/password/new',
    )
  })
})
```

- [ ] **Step 2: テストを実行して失敗を確認**

```bash
docker compose exec frontend npm test -- --run src/pages/PasswordEditPage/
```

期待: 全テストが失敗（モジュール未定義）

- [ ] **Step 3: PasswordEditPage を実装** — `frontend/src/pages/PasswordEditPage/PasswordEditPage.tsx`

```tsx
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { ApiError, authApi } from '../../lib/api'
import { Typography } from '../../components/ui/Typography/Typography'
import { Button } from '../../components/ui/Button/Button'
import { Divider } from '../../components/ui/Divider/Divider'
import { FormInput } from '../../components/ui/FormInput/FormInput'
import styles from '../../styles/authForm.module.css'

const MIN_PASSWORD_LENGTH = 6

export function PasswordEditPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('reset_password_token')
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [error, setError] = useState('')
  const [tokenInvalid, setTokenInvalid] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // トークンなしでアクセスされた場合は /password/new にリダイレクト
  if (!token) {
    return <Navigate to="/password/new" replace />
  }

  const isValid =
    password.length >= MIN_PASSWORD_LENGTH && password === passwordConfirmation

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setTokenInvalid(false)
    setIsSubmitting(true)

    try {
      await authApi.updatePassword(token, password, passwordConfirmation)
      navigate('/login', {
        state: { message: 'パスワードを更新しました。新しいパスワードでログインしてください。' },
      })
    } catch (err) {
      if (err instanceof ApiError && err.code === 'password_reset_failed') {
        setTokenInvalid(true)
      } else if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('パスワードの更新に失敗しました')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <Typography variant="h2">新しいパスワードを設定</Typography>
        <Divider />
        <form className={styles.form} onSubmit={handleSubmit}>
          <FormInput
            label="新しいパスワード"
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={MIN_PASSWORD_LENGTH}
            autoComplete="new-password"
          />
          <FormInput
            label="新しいパスワード（確認）"
            id="passwordConfirmation"
            type="password"
            value={passwordConfirmation}
            onChange={(e) => setPasswordConfirmation(e.target.value)}
            required
            minLength={MIN_PASSWORD_LENGTH}
            autoComplete="new-password"
          />
          {tokenInvalid && (
            <div className={styles.warningBanner}>
              <p>リンクが無効または期限切れです。再度リセットを申請してください。</p>
              <p>
                <Link to="/password/new">パスワードリセットを再申請</Link>
              </p>
            </div>
          )}
          {error && <p className={styles.error}>{error}</p>}
          <Button variant="primary" type="submit" disabled={!isValid || isSubmitting}>
            {isSubmitting ? '更新中...' : 'パスワードを更新'}
          </Button>
        </form>
      </div>
    </div>
  )
}
```

**注意:** テストの「トークンなしで /password/new にリダイレクト」は React Router の `<Navigate>` + `<MemoryRouter>` で検証する。`useEffect` での navigate だと `/login` route も必要になるため、早期 return の `<Navigate>` パターンを採用した。

- [ ] **Step 4: テストを実行してパスを確認**

```bash
docker compose exec frontend npm test -- --run src/pages/PasswordEditPage/
```

期待: 全 8 テストがパス

- [ ] **Step 5: ESLint を実行**

```bash
docker compose exec frontend npm run lint -- src/pages/PasswordEditPage/
```

期待: エラーなし

- [ ] **Step 6: コミット**

```bash
git add frontend/src/pages/PasswordEditPage/
git commit -m "feat(frontend): PasswordEditPage を追加

/password/edit?reset_password_token=xxx で新パスワードを
入力して更新するページ。6 文字以上 + 一致確認のクライアント
バリデーション、トークン無効時の再申請リンク表示、成功時の
/login 遷移を実装。

Refs: #107"
```

---

## Task 10: LoginPage を拡張（常時リンク + 401 バナー + 成功メッセージ受信）

**目的:** LoginPage に「パスワードをお忘れですか？」の常時リンクを追加し、401 エラー時にはパスワードリセットと Google ログインへの誘導バナーを表示する。また `/password/edit` からの遷移時に成功メッセージを表示する。

**Files:**
- Modify: `frontend/src/pages/LoginPage/LoginPage.tsx`
- Modify: `frontend/src/pages/LoginPage/LoginPage.test.tsx`

- [ ] **Step 1: 失敗するテストを追記** — `LoginPage.test.tsx` の `describe('LoginPage', () => {` 内の既存テストの末尾に追加：

```tsx
  it('「パスワードをお忘れですか？」リンクが常時表示される', async () => {
    renderLoginPage()
    expect(await screen.findByText('パスワードをお忘れですか？')).toHaveAttribute(
      'href',
      '/password/new',
    )
  })

  it('401 エラー時に警告バナー（パスワードリセット誘導 + Google 誘導）が表示される', async () => {
    renderLoginPage()
    const user = userEvent.setup()

    // ログイン API 失敗（401）
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: 'メールアドレスまたはパスワードが正しくありません' }),
    })

    await user.type(await screen.findByLabelText('メールアドレス'), 'test@example.com')
    await user.type(screen.getByLabelText('パスワード'), 'wrong')
    await user.click(screen.getByRole('button', { name: 'ログイン' }))

    // エラーメッセージと共に警告バナーが表示される
    expect(
      await screen.findByText(/もしかして Google で登録/),
    ).toBeInTheDocument()
    expect(screen.getByText('こちらから再設定')).toHaveAttribute('href', '/password/new')
  })

  it('401 以外のエラー時は警告バナーが表示されない', async () => {
    renderLoginPage()
    const user = userEvent.setup()

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'サーバーエラー' }),
    })

    await user.type(await screen.findByLabelText('メールアドレス'), 'test@example.com')
    await user.type(screen.getByLabelText('パスワード'), 'wrong')
    await user.click(screen.getByRole('button', { name: 'ログイン' }))

    expect(await screen.findByText('サーバーエラー')).toBeInTheDocument()
    expect(screen.queryByText(/もしかして Google で登録/)).not.toBeInTheDocument()
  })
```

**補足:** `location.state.message` を受け取るテストは `MemoryRouter` + `initialEntries` で state を渡せないため、別途 `LoginPage` 内部の state 反映テストとして書く必要がある。簡易的に上の 3 テストで最低限の要件をカバーし、成功メッセージ表示は手動 / E2E 確認で担保する。

- [ ] **Step 2: テストを実行して失敗を確認**

```bash
docker compose exec frontend npm test -- --run src/pages/LoginPage/
```

期待: 新規 3 テストが失敗、既存 5 テストはパス

- [ ] **Step 3: LoginPage を修正** — `frontend/src/pages/LoginPage/LoginPage.tsx` を以下に置換：

```tsx
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/useAuth'
import { ApiError } from '../../lib/api'
import { Typography } from '../../components/ui/Typography/Typography'
import { Button } from '../../components/ui/Button/Button'
import { Divider } from '../../components/ui/Divider/Divider'
import { OAuthButtons } from '../../components/OAuthButtons/OAuthButtons'
import { FormInput } from '../../components/ui/FormInput/FormInput'
import styles from '../../styles/authForm.module.css'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isUnauthorized, setIsUnauthorized] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // location.state から OAuth エラーや成功メッセージを受け取る
  useEffect(() => {
    const state = location.state as { error?: string; message?: string } | null
    if (state?.error) {
      setError(state.error)
    }
    if (state?.message) {
      setSuccessMessage(state.message)
    }
    // リロード時に再表示されないよう state をクリア
    if (state) {
      window.history.replaceState({}, '')
    }
  }, [location.state])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setIsUnauthorized(false)
    setSuccessMessage('')
    setIsSubmitting(true)

    try {
      await login(email, password)
      navigate('/dashboard')
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
        // 401 のときだけ警告バナーを表示
        if (err.status === 401) {
          setIsUnauthorized(true)
        }
      } else {
        setError('ログインに失敗しました')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <Typography variant="h2">ログイン</Typography>
        <Divider />
        {successMessage && <p className={styles.success}>{successMessage}</p>}
        <form className={styles.form} onSubmit={handleSubmit}>
          <FormInput
            label="メールアドレス"
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <FormInput
            label="パスワード"
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          {error && <p className={styles.error}>{error}</p>}
          {isUnauthorized && (
            <div className={styles.warningBanner}>
              <p>もしかして Google で登録していませんか？下の「Google でログイン」からお試しください。</p>
              <p>
                パスワードを忘れた方は <Link to="/password/new">こちらから再設定</Link> できます。
              </p>
            </div>
          )}
          <Button variant="primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'ログイン中...' : 'ログイン'}
          </Button>
        </form>
        <OAuthButtons />
        <div className={styles.link}>
          <Link to="/password/new">パスワードをお忘れですか？</Link>
        </div>
        <div className={styles.link}>
          <Link to="/signup">アカウントを作成</Link>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: テストを実行してパスを確認**

```bash
docker compose exec frontend npm test -- --run src/pages/LoginPage/
```

期待: 全 8 テスト（既存 5 + 新規 3）がパス

- [ ] **Step 5: ESLint を実行**

```bash
docker compose exec frontend npm run lint -- src/pages/LoginPage/
```

期待: エラーなし

- [ ] **Step 6: コミット**

```bash
git add frontend/src/pages/LoginPage/
git commit -m "feat(frontend): LoginPage に 401 時バナーとパスワードリセット導線を追加

- 「パスワードをお忘れですか？」リンクを常時表示
- 401 エラー時に警告バナー（Google 誘導 + パスワードリセット誘導）を表示
- location.state 経由で成功メッセージを受け取って表示
  （/password/edit からの遷移時に使用）

Refs: #107, #112"
```

---

## Task 11: App.tsx に /password/new と /password/edit のルートを追加

**目的:** 新規ページを React Router のルートに登録する。

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: App.tsx を修正** — import 追加と Route 追加：

`import { SignUpPage } from './pages/SignUpPage/SignUpPage'` の下に追加：

```tsx
import { PasswordNewPage } from './pages/PasswordNewPage/PasswordNewPage'
import { PasswordEditPage } from './pages/PasswordEditPage/PasswordEditPage'
```

`<Route path="/signup" element={<SignUpPage />} />` の下に追加：

```tsx
          <Route path="/password/new" element={<PasswordNewPage />} />
          <Route path="/password/edit" element={<PasswordEditPage />} />
```

- [ ] **Step 2: 全フロントエンドテストを実行**

```bash
docker compose exec frontend npm test -- --run
```

期待: 全テストがパス（App.tsx に追加したルートが既存テストを壊していないことを確認）

- [ ] **Step 3: ESLint を実行**

```bash
docker compose exec frontend npm run lint -- src/App.tsx
```

期待: エラーなし

- [ ] **Step 4: コミット**

```bash
git add frontend/src/App.tsx
git commit -m "feat(frontend): /password/new と /password/edit のルートを追加

App.tsx に PasswordNewPage と PasswordEditPage のルートを
登録する。どちらも未認証でアクセス可能なページ。

Refs: #107"
```

---

## Task 12: 本番 FRONTEND_URL 設定手順ドキュメントを追加

**目的:** 本番環境（EC2）で `FRONTEND_URL` 環境変数を設定する手順を `docs/setup/` に追記する。既存の deploy スクリプトが自動更新されないため、IK が手動で同期する必要があることを明記する。

**Files:**
- Create: `docs/setup/frontend-url-env.md`

- [ ] **Step 1: 既存の docs/setup/ ディレクトリを確認**

```bash
ls docs/setup/ 2>/dev/null || echo "setup ディレクトリなし"
```

存在しなければ作成する（`docs/setup/ses-setup.md` が PR-B1 で作られた想定）。

- [ ] **Step 2: frontend-url-env.md を作成** — `docs/setup/frontend-url-env.md`

```markdown
# FRONTEND_URL 環境変数の設定

## 目的

バックエンド（Rails）がパスワードリセットメール本文に「新パスワード設定ページの URL」を埋め込む際、フロントエンド（React）のホスト URL を知る必要がある。API モードでは Rails の routes ヘルパーがバックエンド自身のホストを返すため、フロントエンド URL を環境変数として明示的に渡す必要がある。

## 環境別の設定値

| 環境 | 値 |
|---|---|
| ローカル開発 | `http://localhost:5173`（`docker-compose.yml` で設定済み） |
| 本番 (EC2) | `https://recolly.net` |

## ローカル開発

`docker-compose.yml` の backend サービスで既に設定済み。追加作業不要。

```yaml
services:
  backend:
    environment:
      FRONTEND_URL: http://localhost:5173
```

## 本番（EC2）

EC2 の Rails プロセス起動時に `FRONTEND_URL=https://recolly.net` が設定される必要がある。

### 手順

1. SSM Session Manager で EC2 に接続
2. `/opt/recolly/deploy.sh` または systemd unit file を確認し、Rails の環境変数定義を修正：
   ```bash
   export FRONTEND_URL=https://recolly.net
   ```
3. Rails プロセスを再起動してエクスポートした環境変数を反映
4. `rails console` から動作確認：
   ```ruby
   ENV['FRONTEND_URL']
   # => "https://recolly.net"
   User.find_by(email: '<検証済みアドレス>').send_reset_password_instructions
   # 受信したメールのリンクが https://recolly.net/password/edit?... で始まることを確認
   ```

### 注意

- **`deploy.sh` の変更は手動同期が必要**（CI から自動更新されない）。ローカルリポジトリと EC2 上のファイルで差分が出やすいので、変更時は必ず EC2 側も更新すること
- `FRONTEND_URL` が未設定のままパスワードリセットを実行すると、フォールバック値 `http://localhost:5173` のリンクが送信されてしまう。本番環境では必ず設定すること
- 環境変数が設定されていない場合の挙動は `DeviseMailer#reset_password_instructions` の `ENV.fetch('FRONTEND_URL', 'http://localhost:5173')` にフォールバックロジックを実装済み

## 関連

- `backend/app/mailers/devise_mailer.rb`: 環境変数を読む箇所
- spec: `docs/superpowers/specs/2026-04-10-pr-b2-password-reset-feature-design.md`
- 前提: PR-B1 (#108) の SES 基盤構築
```

- [ ] **Step 3: コミット**

```bash
git add docs/setup/frontend-url-env.md
git commit -m "docs(setup): 本番 FRONTEND_URL 設定手順を追加

パスワードリセット機能で必須となる環境変数の設定手順を
運用ドキュメントに追記。deploy.sh の手動同期が必要な点も
明記する。

Refs: #107"
```

---

## Task 13: Playwright MCP でローカル動作確認

**目的:** 全ての変更を通しで動作確認する。ローカル環境で `letter_opener_web` を使ってメールを確認し、`/password/new` → メール → `/password/edit` → `/login` のフローを検証する。

**Files:** 変更なし（確認のみ）

**前提:** Docker コンテナ（backend + frontend + db + redis）が起動している。

- [ ] **Step 1: 動作確認用ユーザーが存在するか確認**

```bash
docker compose exec backend bundle exec rails console
```

Rails console で：
```ruby
User.find_by(email: 'test@example.com')
# なければ作成
User.create!(username: 'testuser', email: 'test@example.com', password: 'password123')
exit
```

- [ ] **Step 2: Playwright MCP で `/login` にアクセス**

Playwright MCP の `browser_navigate` で `http://localhost:5173/login` を開く。

期待:
- 「パスワードをお忘れですか？」リンクが表示される
- 「アカウントを作成」リンクが表示される

- [ ] **Step 3: 間違ったパスワードでログイン試行 → 401 バナー確認**

フォームに `test@example.com` と `wrong` を入力してログイン。

期待:
- エラーメッセージ「メールアドレスまたはパスワードが正しくありません」
- 警告バナー: 「もしかして Google で登録していませんか？」「パスワードを忘れた方は こちらから再設定 できます」

- [ ] **Step 4: 「パスワードをお忘れですか？」から `/password/new` に遷移**

常時リンクをクリック。期待: `/password/new` に遷移、メールアドレス入力フォームが表示される。

- [ ] **Step 5: メアドを入力してリセットメール送信**

`test@example.com` を入力して送信。期待:
- 成功メッセージ「パスワードリセットの手順をメールをお送りしました」
- フォームが非表示になる

- [ ] **Step 6: letter_opener_web でメール確認**

Playwright で `http://localhost:3000/letter_opener` を開く。期待:
- 受信トレイに「【Recolly】パスワードリセットのご案内」が届いている
- HTML 本文に「testuser さん、こんにちは。」と「パスワードを変更する」リンクが含まれる
- リンクの URL が `http://localhost:5173/password/edit?reset_password_token=...` の形式

- [ ] **Step 7: メール内リンクをクリックして `/password/edit` へ遷移**

期待: 新パスワード入力フォームが表示される（URL にトークンパラメータ付き）。

- [ ] **Step 8: バリデーションテスト**

- 短いパスワード `short` を入力 → 送信ボタン disabled
- 確認と不一致の `short123` / `differ123` → disabled
- 有効な `newpass123` / `newpass123` → enabled

- [ ] **Step 9: 新パスワードで更新 → `/login` 遷移 → 成功メッセージ表示**

`newpass123` / `newpass123` を入力して送信。期待:
- `/login` に遷移
- 成功メッセージ「パスワードを更新しました。新しいパスワードでログインしてください。」

- [ ] **Step 10: 新パスワードでログイン確認**

`test@example.com` / `newpass123` でログイン。期待: `/dashboard` に遷移。

- [ ] **Step 11: 無効トークンの挙動確認**

`/password/edit?reset_password_token=invalid` を開き、`validpass123` を入力して送信。期待:
- 警告バナー「リンクが無効または期限切れです」
- 「パスワードリセットを再申請」リンクが `/password/new` に向く

- [ ] **Step 12: トークンなしアクセスのリダイレクト確認**

`/password/edit` にトークンなしでアクセス。期待: `/password/new` に即リダイレクト。

- [ ] **Step 13: 最終動作確認の結果をコミット**

動作確認では新規コード変更は発生しない想定。もし問題が見つかって修正が必要になったら、該当の Task に戻って修正し、再度このタスクを実行する。

全て通過したら、Rails console で作成したテストユーザーの状態を元に戻す（必要なら）：
```bash
docker compose exec backend bundle exec rails console
# User.find_by(email: 'test@example.com').update!(password: 'password123')
```

---

## Self-Review チェック

プラン全体を spec と照らし合わせた結果：

| Spec 要件 | 対応 Task |
|---|---|
| BE: `PUT /api/v1/password` 実装 | Task 3, 4 |
| BE: カスタム DeviseMailer でフロントエンド URL 注入 | Task 1, 2 |
| BE: 日本語 multipart メールテンプレート | Task 1 |
| FE: `/password/new` ページ | Task 8, 11 |
| FE: `/password/edit` ページ | Task 9, 11 |
| FE: LoginPage 常時「パスワードをお忘れですか？」リンク | Task 10 |
| FE: LoginPage 401 時の Google 誘導バナー | Task 10 |
| FE: LoginPage 401 時のパスワードリセット誘導バナー | Task 10 |
| FE: `/password/edit` からの成功メッセージ表示 | Task 10 |
| FE: 成功・警告用のカラートークン追加 | Task 5, 6 |
| FE: tokens.css のみ使用、ハードコード禁止 | Task 5, 6 で担保 |
| FE: updatePassword API クライアント | Task 7 |
| FE: 6 文字以上 + 一致確認バリデーション | Task 9 |
| BE テスト: passwords_spec の PUT 追加 | Task 3, 4 |
| BE テスト: devise_mailer_spec 新規 | Task 1 |
| FE テスト: 3 ページ分のテスト | Task 8, 9, 10 |
| ドキュメント: FRONTEND_URL 本番手順 | Task 12 |
| 動作確認: 通しで動くこと | Task 13 |

**カバレッジ: OK。spec の全要件が Task にマッピングされている。**

**Placeholder scan: OK。TBD / TODO は残っていない。各ステップに完全なコードを記載済み。**

**Type / 命名整合性: OK。`updatePassword` / `resetPassword` / `password_reset_failed` / `reset_password_token` は全 Task で一貫。**

---

## 実装順序の依存

```
Task 1 (DeviseMailer + spec)
  → Task 2 (devise.rb で DeviseMailer 指定)
    → Task 3 (PasswordsController#update 正常系)
      → Task 4 (update 異常系テスト)

Task 5 (tokens.css)
  → Task 6 (authForm.module.css)
    → Task 8 (PasswordNewPage)
    → Task 9 (PasswordEditPage)
    → Task 10 (LoginPage 拡張)

Task 7 (api.ts updatePassword) → Task 9 (PasswordEditPage が使う)

Task 11 (App.tsx ルート追加) ← Task 8, 9 が完了してから

Task 12 (docs) は独立。いつでも可能

Task 13 (E2E 動作確認) ← 全 Task 完了後
```

**推奨実行順:** 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13

---

## 想定作業時間（参考）

本セクションはあえて省略する（プロジェクトルール: 時間予測を書かない）。
