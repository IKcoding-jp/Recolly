# OAuth認証 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Google OAuth / X (Twitter) OAuth でのログイン・サインアップ、設定画面でのOAuth連携管理を実装する

**Architecture:** OmniAuth + devise のサーバーサイドフローを採用。OAuthコールバックはRails側で処理し、セッション作成後にフロントエンドにリダイレクト。ビジネスロジックはサービスオブジェクトに分離（thin controller原則）。

**Tech Stack:** omniauth, omniauth-google-oauth2, omniauth-twitter2, omniauth-rails_csrf_protection, devise :omniauthable

**Spec:** `docs/superpowers/specs/2026-03-23-oauth-authentication-design.md`
**ADR:** `docs/adr/0013-oauth認証にomniauth-サーバーサイドフローを採用.md`

---

## ファイル構成

### バックエンド — 新規作成

| ファイル | 責務 |
|---------|------|
| `backend/app/models/user_provider.rb` | OAuth連携情報モデル |
| `backend/app/services/oauth/email_conflict_checker.rb` | メール衝突チェック |
| `backend/app/services/oauth/find_or_create_user_service.rb` | OAuthユーザー検索/作成 |
| `backend/app/controllers/api/v1/omniauth_callbacks_controller.rb` | OAuthコールバック処理 |
| `backend/app/controllers/api/v1/oauth_registrations_controller.rb` | OAuth新規登録完了 |
| `backend/app/controllers/api/v1/account_settings_controller.rb` | 連携管理・パスワード設定・メール設定 |
| `backend/app/controllers/api/v1/csrf_tokens_controller.rb` | CSRFトークン取得 |
| `backend/spec/requests/api/v1/csrf_tokens_spec.rb` | CSRFトークンテスト |
| `backend/spec/models/user_provider_spec.rb` | UserProviderモデルテスト |
| `backend/spec/services/oauth/email_conflict_checker_spec.rb` | メール衝突テスト |
| `backend/spec/services/oauth/find_or_create_user_service_spec.rb` | ユーザー検索/作成テスト |
| `backend/spec/requests/api/v1/omniauth_callbacks_spec.rb` | コールバックテスト |
| `backend/spec/requests/api/v1/oauth_registrations_spec.rb` | 登録完了テスト |
| `backend/spec/requests/api/v1/account_settings_spec.rb` | 設定画面テスト |

### バックエンド — 変更

| ファイル | 変更内容 |
|---------|---------|
| `backend/Gemfile` | OmniAuth関連gem追加 |
| `backend/app/models/user.rb` | `:omniauthable` 追加、`password_required?` / `email_required?` オーバーライド、`has_many :user_providers` |
| `backend/config/initializers/devise.rb` | OmniAuthプロバイダ設定追加 |
| `backend/config/routes.rb` | `omniauth_callbacks` 追加、OAuth関連ルート追加 |
| `backend/app/controllers/application_controller.rb` | CSRF対策追加、`user_json` 拡張 |
| `backend/db/schema.rb` | マイグレーションにより自動更新 |

### フロントエンド — 新規作成

| ファイル | 責務 |
|---------|------|
| `frontend/src/components/OAuthButtons/OAuthButtons.tsx` | Google/X OAuthボタン共通コンポーネント |
| `frontend/src/components/OAuthButtons/OAuthButtons.module.css` | OAuthボタンスタイル |
| `frontend/src/components/OAuthButtons/OAuthButtons.test.tsx` | テスト |
| `frontend/src/components/EmailPromptBanner/EmailPromptBanner.tsx` | メール未設定バナー |
| `frontend/src/components/EmailPromptBanner/EmailPromptBanner.module.css` | バナースタイル |
| `frontend/src/components/EmailPromptBanner/EmailPromptBanner.test.tsx` | テスト |
| `frontend/src/pages/AuthCallbackPage/AuthCallbackPage.tsx` | OAuthコールバック受信 |
| `frontend/src/pages/AuthCallbackPage/AuthCallbackPage.test.tsx` | テスト |
| `frontend/src/pages/OauthUsernamePage/OauthUsernamePage.tsx` | ユーザー名入力 |
| `frontend/src/pages/OauthUsernamePage/OauthUsernamePage.module.css` | スタイル |
| `frontend/src/pages/OauthUsernamePage/OauthUsernamePage.test.tsx` | テスト |
| `frontend/src/pages/EmailPromptPage/EmailPromptPage.tsx` | メール設定画面 |
| `frontend/src/pages/EmailPromptPage/EmailPromptPage.module.css` | スタイル |
| `frontend/src/pages/EmailPromptPage/EmailPromptPage.test.tsx` | テスト |
| `frontend/src/pages/AccountSettingsPage/AccountSettingsPage.tsx` | アカウント設定 |
| `frontend/src/pages/AccountSettingsPage/AccountSettingsPage.module.css` | スタイル |
| `frontend/src/pages/AccountSettingsPage/AccountSettingsPage.test.tsx` | テスト |

### フロントエンド — 変更

| ファイル | 変更内容 |
|---------|---------|
| `frontend/src/lib/types.ts` | User型にOAuth関連フィールド追加 |
| `frontend/src/lib/api.ts` | OAuth関連API関数追加、CSRFトークン取得追加 |
| `frontend/src/contexts/AuthContext.tsx` | メール未設定状態の管理 |
| `frontend/src/contexts/authContextValue.ts` | AuthContextValue型拡張 |
| `frontend/src/pages/LoginPage/LoginPage.tsx` | OAuthボタン追加 |
| `frontend/src/pages/SignUpPage/SignUpPage.tsx` | OAuthボタン追加 |
| `frontend/src/App.tsx` | 新規ルート追加 |

---

## Task 1: gem追加とbundle install

**Files:**
- Modify: `backend/Gemfile`

- [ ] **Step 1: Gemfileにomniauth関連gemを追加**

`backend/Gemfile` のdevise行の下に追加:

```ruby
# OAuth認証（ADR-0013）
gem "omniauth"
gem "omniauth-google-oauth2"
gem "omniauth-twitter2"
gem "omniauth-rails_csrf_protection"
```

- [ ] **Step 2: bundle install**

Run: `docker compose run --rm backend bundle install`

- [ ] **Step 3: コミット**

```bash
git add backend/Gemfile backend/Gemfile.lock
git commit -m "chore: OmniAuth関連gemを追加（ADR-0013）"
```

---

## Task 2: UserProvidersテーブルのマイグレーション

**Files:**
- Create: `backend/db/migrate/XXXXXX_create_user_providers.rb`
- Create: `backend/db/migrate/XXXXXX_change_email_unique_index_on_users.rb`

- [ ] **Step 1: UserProvidersテーブルのマイグレーション作成**

Run: `docker compose run --rm backend bin/rails generate migration CreateUserProviders`

生成されたファイルを以下に編集:

```ruby
class CreateUserProviders < ActiveRecord::Migration[8.0]
  def change
    create_table :user_providers do |t|
      t.references :user, null: false, foreign_key: true
      t.string :provider, null: false
      t.string :provider_uid, null: false

      t.timestamps
    end

    add_index :user_providers, %i[provider provider_uid], unique: true
    add_index :user_providers, %i[user_id provider], unique: true
  end
end
```

- [ ] **Step 2: emailユニークインデックスのマイグレーション作成**

Run: `docker compose run --rm backend bin/rails generate migration ChangeEmailUniqueIndexOnUsers`

生成されたファイルを以下に編集:

```ruby
class ChangeEmailUniqueIndexOnUsers < ActiveRecord::Migration[8.0]
  def change
    remove_index :users, :email
    add_index :users, :email, unique: true, where: "email != ''"
  end
end
```

- [ ] **Step 3: マイグレーション実行**

Run: `docker compose run --rm backend bin/rails db:migrate`

- [ ] **Step 4: schema.rbにuser_providersテーブルが追加されたことを確認**

Run: `docker compose run --rm backend bin/rails db:migrate:status`
Expected: 全マイグレーションが `up` 状態

- [ ] **Step 5: コミット**

```bash
git add backend/db/migrate/ backend/db/schema.rb
git commit -m "feat: UserProvidersテーブル作成とemailインデックスの条件付き変更"
```

---

## Task 3: UserProviderモデル

**Files:**
- Create: `backend/app/models/user_provider.rb`
- Create: `backend/spec/models/user_provider_spec.rb`

- [ ] **Step 1: テストを書く**

```ruby
# backend/spec/models/user_provider_spec.rb
# frozen_string_literal: true

require "rails_helper"

RSpec.describe UserProvider, type: :model do
  describe "バリデーション" do
    it "provider, provider_uid, user_idが全て揃っていれば有効" do
      user = User.create!(username: "testuser", email: "test@example.com", password: "password123")
      provider = UserProvider.new(user: user, provider: "google_oauth2", provider_uid: "12345")
      expect(provider).to be_valid
    end

    it "providerが空なら無効" do
      provider = UserProvider.new(provider: nil, provider_uid: "12345")
      expect(provider).not_to be_valid
    end

    it "provider_uidが空なら無効" do
      provider = UserProvider.new(provider: "google_oauth2", provider_uid: nil)
      expect(provider).not_to be_valid
    end
  end

  describe "ユニーク制約" do
    it "同一プロバイダ+UIDの重複を許可しない" do
      user = User.create!(username: "testuser", email: "test@example.com", password: "password123")
      UserProvider.create!(user: user, provider: "google_oauth2", provider_uid: "12345")

      user2 = User.create!(username: "testuser2", email: "test2@example.com", password: "password123")
      duplicate = UserProvider.new(user: user2, provider: "google_oauth2", provider_uid: "12345")
      expect { duplicate.save!(validate: false) }.to raise_error(ActiveRecord::RecordNotUnique)
    end

    it "同一ユーザーで同一プロバイダの重複を許可しない" do
      user = User.create!(username: "testuser", email: "test@example.com", password: "password123")
      UserProvider.create!(user: user, provider: "google_oauth2", provider_uid: "12345")

      duplicate = UserProvider.new(user: user, provider: "google_oauth2", provider_uid: "67890")
      expect { duplicate.save!(validate: false) }.to raise_error(ActiveRecord::RecordNotUnique)
    end

    it "同一ユーザーで異なるプロバイダは許可" do
      user = User.create!(username: "testuser", email: "test@example.com", password: "password123")
      UserProvider.create!(user: user, provider: "google_oauth2", provider_uid: "12345")

      different = UserProvider.new(user: user, provider: "twitter2", provider_uid: "67890")
      expect(different).to be_valid
    end
  end
end
```

- [ ] **Step 2: テスト実行して失敗を確認**

Run: `docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec spec/models/user_provider_spec.rb`
Expected: FAIL（UserProviderクラスが未定義）

- [ ] **Step 3: モデルを実装**

```ruby
# backend/app/models/user_provider.rb
# frozen_string_literal: true

class UserProvider < ApplicationRecord
  belongs_to :user

  validates :provider, presence: true
  validates :provider_uid, presence: true
  validates :provider, uniqueness: { scope: :provider_uid }
  validates :provider, uniqueness: { scope: :user_id }
end
```

- [ ] **Step 4: テスト実行して成功を確認**

Run: `docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec spec/models/user_provider_spec.rb`
Expected: 全テストPASS

- [ ] **Step 5: コミット**

```bash
git add backend/app/models/user_provider.rb backend/spec/models/user_provider_spec.rb
git commit -m "feat: UserProviderモデルを追加"
```

---

## Task 4: Userモデルの変更（:omniauthable、バリデーションオーバーライド）

**Files:**
- Modify: `backend/app/models/user.rb`
- Modify: `backend/spec/models/user_spec.rb`（既存テストがあればそこに追加、なければ新規作成）

- [ ] **Step 1: Userモデルのテストを追加**

既存の `backend/spec/models/user_spec.rb` に以下のdescribeブロックを **追加** する（既存テストは残す）:

```ruby
# backend/spec/models/user_spec.rb に追加
  describe "OAuth対応バリデーション" do
    it "UserProviderがある場合はパスワードなしで有効" do
      user = User.new(username: "oauthuser", email: "oauth@example.com")
      user.save!(validate: false)
      UserProvider.create!(user: user, provider: "google_oauth2", provider_uid: "12345")
      user.reload
      expect(user).to be_valid
    end

    it "UserProviderがなくパスワードもない場合は無効" do
      user = User.new(username: "nopassuser", email: "nopass@example.com")
      expect(user).not_to be_valid
    end

    it "メールアドレスが空でもUserProviderがあれば有効" do
      user = User.new(username: "noemailuser", email: "")
      user.save!(validate: false)
      UserProvider.create!(user: user, provider: "twitter2", provider_uid: "12345")
      user.reload
      expect(user).to be_valid
    end

    it "メールアドレスが空でUserProviderもなければ無効" do
      user = User.new(username: "noemailuser", email: "", password: "password123")
      expect(user).not_to be_valid
    end
  end

  describe "アソシエーション" do
    it "user_providersを持つ" do
      user = User.create!(username: "testuser", email: "test@example.com", password: "password123")
      expect(user).to respond_to(:user_providers)
    end

    it "ユーザー削除時にuser_providersも削除される" do
      user = User.create!(username: "testuser", email: "test@example.com", password: "password123")
      UserProvider.create!(user: user, provider: "google_oauth2", provider_uid: "12345")
      expect { user.destroy }.to change(UserProvider, :count).by(-1)
    end
  end
end
```

- [ ] **Step 2: テスト実行して失敗を確認**

Run: `docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec spec/models/user_spec.rb`
Expected: FAIL

- [ ] **Step 3: Userモデルを変更**

`backend/app/models/user.rb` を以下に変更:

```ruby
class User < ApplicationRecord
  devise :database_authenticatable, :registerable,
         :recoverable, :rememberable, :validatable,
         :omniauthable, omniauth_providers: %i[google_oauth2 twitter2]

  has_many :user_providers, dependent: :destroy
  has_many :records, dependent: :destroy

  validates :username, presence: true, uniqueness: true,
                       length: { minimum: 2, maximum: 30 }

  # OAuth専用ユーザーはパスワードなしを許可
  def password_required?
    return false if user_providers.any?
    super
  end

  # Xでメール未取得のユーザーはメールなしを許可
  def email_required?
    return false if user_providers.any?
    super
  end
end
```

- [ ] **Step 4: テスト実行して成功を確認**

Run: `docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec spec/models/user_spec.rb`
Expected: 全テストPASS

- [ ] **Step 5: 既存テストが壊れていないことを確認**

Run: `docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec`
Expected: 全テストPASS

- [ ] **Step 6: コミット**

```bash
git add backend/app/models/user.rb backend/spec/models/user_spec.rb
git commit -m "feat: Userモデルにomniauthable追加、パスワード/メールバリデーションをオーバーライド"
```

---

## Task 5: Oauth::EmailConflictCheckerサービス

**Files:**
- Create: `backend/app/services/oauth/email_conflict_checker.rb`
- Create: `backend/spec/services/oauth/email_conflict_checker_spec.rb`

- [ ] **Step 1: テストを書く**

```ruby
# backend/spec/services/oauth/email_conflict_checker_spec.rb
# frozen_string_literal: true

require "rails_helper"

RSpec.describe Oauth::EmailConflictChecker do
  describe "#check" do
    it "メールアドレスがnilなら衝突なし" do
      result = described_class.new(email: nil, provider: "google_oauth2").check
      expect(result).to be_nil
    end

    it "メールアドレスが空文字なら衝突なし" do
      result = described_class.new(email: "", provider: "google_oauth2").check
      expect(result).to be_nil
    end

    it "同じメールのユーザーがいなければ衝突なし" do
      result = described_class.new(email: "new@example.com", provider: "google_oauth2").check
      expect(result).to be_nil
    end

    it "同じメール+同じプロバイダのUserProviderがあれば衝突なし（既存ユーザーログイン）" do
      user = User.create!(username: "existing", email: "existing@example.com", password: "password123")
      UserProvider.create!(user: user, provider: "google_oauth2", provider_uid: "12345")

      result = described_class.new(email: "existing@example.com", provider: "google_oauth2").check
      expect(result).to be_nil
    end

    it "メール登録済みユーザーで別プロバイダなら衝突エラー" do
      User.create!(username: "existing", email: "existing@example.com", password: "password123")

      result = described_class.new(email: "existing@example.com", provider: "google_oauth2").check
      expect(result[:code]).to eq("email_already_registered")
      expect(result[:message]).to include("メールアドレスでログイン")
    end

    it "別のOAuthで登録済みならプロバイダ名付きエラー" do
      user = User.create!(username: "existing", email: "existing@example.com", password: "password123")
      UserProvider.create!(user: user, provider: "google_oauth2", provider_uid: "12345")

      result = described_class.new(email: "existing@example.com", provider: "twitter2").check
      expect(result[:code]).to eq("email_registered_with_other_provider")
      expect(result[:message]).to include("Google")
    end
  end
end
```

- [ ] **Step 2: テスト実行して失敗を確認**

Run: `docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec spec/services/oauth/email_conflict_checker_spec.rb`
Expected: FAIL

- [ ] **Step 3: サービスを実装**

```ruby
# backend/app/services/oauth/email_conflict_checker.rb
# frozen_string_literal: true

module Oauth
  class EmailConflictChecker
    PROVIDER_DISPLAY_NAMES = {
      "google_oauth2" => "Google",
      "twitter2" => "X"
    }.freeze

    def initialize(email:, provider:)
      @email = email
      @provider = provider
    end

    def check
      return nil if @email.blank?

      existing_user = User.find_by(email: @email)
      return nil unless existing_user
      return nil if existing_user.user_providers.exists?(provider: @provider)

      existing_provider = existing_user.user_providers.first
      if existing_provider
        display_name = PROVIDER_DISPLAY_NAMES[existing_provider.provider] || existing_provider.provider
        {
          code: "email_registered_with_other_provider",
          message: "このメールアドレスは既に#{display_name}で登録されています"
        }
      else
        {
          code: "email_already_registered",
          message: "このメールアドレスは既に登録されています。メールアドレスでログインしてください"
        }
      end
    end
  end
end
```

- [ ] **Step 4: テスト実行して成功を確認**

Run: `docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec spec/services/oauth/email_conflict_checker_spec.rb`
Expected: 全テストPASS

- [ ] **Step 5: コミット**

```bash
git add backend/app/services/oauth/email_conflict_checker.rb backend/spec/services/oauth/email_conflict_checker_spec.rb
git commit -m "feat: Oauth::EmailConflictCheckerサービスを追加"
```

---

## Task 6: Oauth::FindOrCreateUserServiceサービス

**Files:**
- Create: `backend/app/services/oauth/find_or_create_user_service.rb`
- Create: `backend/spec/services/oauth/find_or_create_user_service_spec.rb`

- [ ] **Step 1: テストを書く**

```ruby
# backend/spec/services/oauth/find_or_create_user_service_spec.rb
# frozen_string_literal: true

require "rails_helper"

RSpec.describe Oauth::FindOrCreateUserService do
  let(:google_auth_data) do
    {
      provider: "google_oauth2",
      uid: "google_12345",
      info: { email: "user@gmail.com", name: "Test User" }
    }
  end

  let(:twitter_auth_data) do
    {
      provider: "twitter2",
      uid: "twitter_67890",
      info: { email: nil, name: "TwitterUser" }
    }
  end

  describe "#call" do
    context "既存ユーザー（UserProvider一致）" do
      it "既存ユーザーを返す" do
        user = User.create!(username: "existing", email: "user@gmail.com", password: "password123")
        UserProvider.create!(user: user, provider: "google_oauth2", provider_uid: "google_12345")

        result = described_class.new(google_auth_data).call
        expect(result[:status]).to eq(:existing_user)
        expect(result[:user]).to eq(user)
      end
    end

    context "メール衝突" do
      it "エラーを返す" do
        User.create!(username: "existing", email: "user@gmail.com", password: "password123")

        result = described_class.new(google_auth_data).call
        expect(result[:status]).to eq(:conflict)
        expect(result[:error][:code]).to eq("email_already_registered")
      end
    end

    context "新規ユーザー（メールあり）" do
      it "new_userステータスとOAuthデータを返す" do
        result = described_class.new(google_auth_data).call
        expect(result[:status]).to eq(:new_user)
        expect(result[:oauth_data][:provider]).to eq("google_oauth2")
        expect(result[:oauth_data][:email]).to eq("user@gmail.com")
      end
    end

    context "新規ユーザー（メールなし・X）" do
      it "new_userステータスを返す（メールなし）" do
        result = described_class.new(twitter_auth_data).call
        expect(result[:status]).to eq(:new_user)
        expect(result[:oauth_data][:email]).to be_nil
      end
    end
  end
end
```

- [ ] **Step 2: テスト実行して失敗を確認**

Run: `docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec spec/services/oauth/find_or_create_user_service_spec.rb`
Expected: FAIL

- [ ] **Step 3: サービスを実装**

```ruby
# backend/app/services/oauth/find_or_create_user_service.rb
# frozen_string_literal: true

module Oauth
  class FindOrCreateUserService
    def initialize(auth_data)
      @provider = auth_data[:provider]
      @uid = auth_data[:uid]
      @email = auth_data.dig(:info, :email)
      @name = auth_data.dig(:info, :name)
    end

    def call
      # 既存のUserProviderで検索
      user_provider = UserProvider.find_by(provider: @provider, provider_uid: @uid)
      return { status: :existing_user, user: user_provider.user } if user_provider

      # メール衝突チェック
      conflict = EmailConflictChecker.new(email: @email, provider: @provider).check
      return { status: :conflict, error: conflict } if conflict

      # 新規ユーザー登録が必要（ユーザー名入力待ち）
      {
        status: :new_user,
        oauth_data: {
          provider: @provider,
          uid: @uid,
          email: @email,
          name: @name
        }
      }
    end
  end
end
```

- [ ] **Step 4: テスト実行して成功を確認**

Run: `docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec spec/services/oauth/find_or_create_user_service_spec.rb`
Expected: 全テストPASS

- [ ] **Step 5: コミット**

```bash
git add backend/app/services/oauth/find_or_create_user_service.rb backend/spec/services/oauth/find_or_create_user_service_spec.rb
git commit -m "feat: Oauth::FindOrCreateUserServiceサービスを追加"
```

---

## Task 7: devise OmniAuth設定 + CSRF対策 + ルーティング

**Files:**
- Modify: `backend/config/initializers/devise.rb`
- Modify: `backend/config/routes.rb`
- Modify: `backend/app/controllers/application_controller.rb`
- Create: `backend/app/controllers/api/v1/csrf_tokens_controller.rb`

- [ ] **Step 1: devise.rbにOmniAuthプロバイダを設定**

`backend/config/initializers/devise.rb` の末尾（`end` の前）に追加:

```ruby
  # OmniAuthプロバイダ設定（ADR-0013）
  config.omniauth :google_oauth2,
                  ENV["GOOGLE_CLIENT_ID"],
                  ENV["GOOGLE_CLIENT_SECRET"],
                  scope: "email,profile"

  config.omniauth :twitter2,
                  ENV["X_CLIENT_ID"],
                  ENV["X_CLIENT_SECRET"],
                  scope: "tweet.read users.read"
```

- [ ] **Step 2: ApplicationControllerにCSRF対策を追加**

`backend/app/controllers/application_controller.rb` に `ActionController::RequestForgeryProtection` をinclude。
**重要:** 既存のAPI（fetch経由のJSON通信）はCSRFトークンを送信しないため、デフォルトではCSRF保護を無効化する。OAuthのPOSTフォーム送信は `omniauth-rails_csrf_protection` gemがgemレベルで保護するため、ApplicationControllerでの保護は不要。CSRFトークン生成機能のみ有効化する:

```ruby
class ApplicationController < ActionController::API
  include ActionController::RequestForgeryProtection
  protect_from_forgery with: :null_session

  # 既存APIはCSRFトークンを送信しないため、デフォルトで検証をスキップ
  # OAuthフォームPOSTはomniauth-rails_csrf_protectionが保護する
  skip_forgery_protection

  # ... 既存のメソッド
end
```

`skip_forgery_protection` により、既存のAPIエンドポイント（fetch経由）はCSRFトークンなしで動作し続ける。`include ActionController::RequestForgeryProtection` は `form_authenticity_token` メソッドを有効化するためにのみ必要（CsrfTokensControllerで使用）。

- [ ] **Step 3: user_jsonメソッドを拡張**

`backend/app/controllers/application_controller.rb` の `user_json` メソッドを変更:

```ruby
  def user_json(user)
    user.as_json(only: %i[id username email avatar_url bio created_at]).merge(
      has_password: user.encrypted_password.present?,
      providers: user.user_providers.pluck(:provider),
      email_missing: user.email.blank?
    )
  end
```

- [ ] **Step 4: CSRFトークンコントローラーを作成**

```ruby
# backend/app/controllers/api/v1/csrf_tokens_controller.rb
# frozen_string_literal: true

module Api
  module V1
    class CsrfTokensController < ApplicationController
      def show
        render json: { token: form_authenticity_token }
      end
    end
  end
end
```

- [ ] **Step 5: ルーティングを更新**

`backend/config/routes.rb` に以下の **差分** を適用する（既存ルートは全て維持）:

**変更1:** 既存の `devise_for` ブロックに `omniauth_callbacks` を追加:

```ruby
# 既存:
controllers: {
  sessions: "api/v1/sessions",
  registrations: "api/v1/registrations",
  passwords: "api/v1/passwords"
}
# ↓ 以下に変更:
controllers: {
  sessions: "api/v1/sessions",
  registrations: "api/v1/registrations",
  passwords: "api/v1/passwords",
  omniauth_callbacks: "api/v1/omniauth_callbacks"
}
```

**変更2:** `namespace :api > namespace :v1` 内に以下を追加（既存の `resource :current_user` 等はそのまま維持）:

```ruby
      get "csrf_token", to: "csrf_tokens#show"

      post "auth/complete_registration", to: "oauth_registrations#create"

      resource :account_settings, only: [] do
        post :link_provider
        delete :unlink_provider
        put :set_password
        put :set_email
      end
```

- [ ] **Step 6: CsrfTokensControllerのテストを書く**

```ruby
# backend/spec/requests/api/v1/csrf_tokens_spec.rb
# frozen_string_literal: true

require "rails_helper"

RSpec.describe "CSRF Tokens", type: :request do
  describe "GET /api/v1/csrf_token" do
    it "CSRFトークンを返す" do
      get "/api/v1/csrf_token"
      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json["token"]).to be_present
    end
  end
end
```

- [ ] **Step 7: テスト実行して成功を確認**

Run: `docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec spec/requests/api/v1/csrf_tokens_spec.rb`
Expected: PASS

- [ ] **Step 8: 既存テストが壊れていないことを確認**

Run: `docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec`
Expected: 全テストPASS

- [ ] **Step 9: コミット**

```bash
git add backend/config/initializers/devise.rb backend/config/routes.rb backend/app/controllers/application_controller.rb backend/app/controllers/api/v1/csrf_tokens_controller.rb backend/spec/requests/api/v1/csrf_tokens_spec.rb
git commit -m "feat: OmniAuth設定、CSRF対策、OAuth関連ルーティングを追加"
```

---

## Task 8: OmniauthCallbacksController

**Files:**
- Create: `backend/app/controllers/api/v1/omniauth_callbacks_controller.rb`
- Create: `backend/spec/requests/api/v1/omniauth_callbacks_spec.rb`
- Create: `backend/spec/support/omniauth.rb`

- [ ] **Step 1: OmniAuthテストヘルパーを設定**

```ruby
# backend/spec/support/omniauth.rb
OmniAuth.config.test_mode = true

# テスト後にモックをリセット
RSpec.configure do |config|
  config.before(:each) do
    OmniAuth.config.mock_auth[:google_oauth2] = nil
    OmniAuth.config.mock_auth[:twitter2] = nil
  end
end

def mock_google_oauth(email: "user@gmail.com", uid: "google_12345", name: "Test User")
  OmniAuth.config.mock_auth[:google_oauth2] = OmniAuth::AuthHash.new(
    provider: "google_oauth2",
    uid: uid,
    info: { email: email, name: name, image: "https://example.com/avatar.jpg" }
  )
end

def mock_twitter_oauth(uid: "twitter_67890", name: "TwitterUser", email: nil)
  OmniAuth.config.mock_auth[:twitter2] = OmniAuth::AuthHash.new(
    provider: "twitter2",
    uid: uid,
    info: { email: email, name: name, image: "https://example.com/avatar.jpg" }
  )
end
```

- [ ] **Step 2: テストを書く**

```ruby
# backend/spec/requests/api/v1/omniauth_callbacks_spec.rb
# frozen_string_literal: true

require "rails_helper"

RSpec.describe "OmniAuth Callbacks", type: :request do
  let(:frontend_url) { ENV.fetch("FRONTEND_URL", "http://localhost:5173") }

  describe "GET /api/v1/auth/google_oauth2/callback" do
    context "新規ユーザー" do
      before { mock_google_oauth }

      it "new_userステータスでフロントにリダイレクト" do
        get "/api/v1/auth/google_oauth2/callback"
        expect(response).to redirect_to("#{frontend_url}/auth/callback?status=new_user")
      end
    end

    context "既存ユーザー（UserProvider一致）" do
      before do
        mock_google_oauth
        user = User.create!(username: "existing", email: "user@gmail.com", password: "password123")
        UserProvider.create!(user: user, provider: "google_oauth2", provider_uid: "google_12345")
      end

      it "successステータスでフロントにリダイレクト" do
        get "/api/v1/auth/google_oauth2/callback"
        expect(response).to redirect_to("#{frontend_url}/auth/callback?status=success")
      end
    end

    context "メール衝突" do
      before do
        mock_google_oauth
        User.create!(username: "existing", email: "user@gmail.com", password: "password123")
      end

      it "errorステータスでフロントにリダイレクト" do
        get "/api/v1/auth/google_oauth2/callback"
        expect(response).to redirect_to(a_string_including("status=error"))
        expect(response).to redirect_to(a_string_including("message=email_already_registered"))
      end
    end

    context "ログイン済みユーザーがOAuth連携追加" do
      before do
        mock_google_oauth(email: "existing@example.com")
        @user = User.create!(username: "existing", email: "existing@example.com", password: "password123")
        sign_in @user
      end

      it "OAuthデータをセッションに保持して設定画面にリダイレクト" do
        get "/api/v1/auth/google_oauth2/callback"
        expect(response).to redirect_to(a_string_including("status=provider_linked"))
      end
    end
  end

  describe "GET /api/v1/auth/twitter2/callback" do
    context "メールなしの新規ユーザー" do
      before { mock_twitter_oauth }

      it "new_userステータスでフロントにリダイレクト" do
        get "/api/v1/auth/twitter2/callback"
        expect(response).to redirect_to("#{frontend_url}/auth/callback?status=new_user")
      end
    end
  end
end
```

- [ ] **Step 3: テスト実行して失敗を確認**

Run: `docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec spec/requests/api/v1/omniauth_callbacks_spec.rb`
Expected: FAIL

- [ ] **Step 4: コントローラーを実装**

```ruby
# backend/app/controllers/api/v1/omniauth_callbacks_controller.rb
# frozen_string_literal: true

module Api
  module V1
    class OmniauthCallbacksController < Devise::OmniauthCallbacksController
      def google_oauth2
        handle_oauth_callback
      end

      def twitter2
        handle_oauth_callback
      end

      def failure
        redirect_to_frontend(status: "error", message: "oauth_failed")
      end

      private

      def handle_oauth_callback
        auth_data = request.env["omniauth.auth"]

        # ログイン済みユーザーの場合はOAuth連携追加フロー
        if user_signed_in?
          handle_link_provider(auth_data)
          return
        end

        result = Oauth::FindOrCreateUserService.new(auth_data).call

        case result[:status]
        when :existing_user
          sign_in(result[:user])
          redirect_to_frontend(status: "success")
        when :new_user
          store_oauth_data_in_session(result[:oauth_data])
          redirect_to_frontend(status: "new_user")
        when :conflict
          redirect_to_frontend(
            status: "error",
            message: result[:error][:code],
            provider: auth_data.provider
          )
        end
      end

      # ログイン済みユーザーがOAuth連携を追加する場合
      # メール衝突チェックをスキップし、直接UserProviderを作成
      def handle_link_provider(auth_data)
        UserProvider.create!(
          user: current_user,
          provider: auth_data.provider,
          provider_uid: auth_data.uid
        )
        redirect_to_frontend(status: "provider_linked")
      rescue ActiveRecord::RecordInvalid
        redirect_to_frontend(status: "error", message: "provider_already_linked")
      end

      def store_oauth_data_in_session(oauth_data)
        session[:oauth_data] = oauth_data.merge(
          expires_at: 15.minutes.from_now.to_i
        )
      end

      def redirect_to_frontend(**params)
        query = params.compact.to_query
        frontend_url = ENV.fetch("FRONTEND_URL", "http://localhost:5173")
        redirect_to "#{frontend_url}/auth/callback?#{query}", allow_other_host: true
      end
    end
  end
end
```

- [ ] **Step 5: テスト実行して成功を確認**

Run: `docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec spec/requests/api/v1/omniauth_callbacks_spec.rb`
Expected: 全テストPASS

- [ ] **Step 6: コミット**

```bash
git add backend/app/controllers/api/v1/omniauth_callbacks_controller.rb backend/spec/requests/api/v1/omniauth_callbacks_spec.rb backend/spec/support/omniauth.rb
git commit -m "feat: OmniauthCallbacksControllerを追加"
```

---

## Task 9: OauthRegistrationsController（OAuth新規登録完了）

**Files:**
- Create: `backend/app/controllers/api/v1/oauth_registrations_controller.rb`
- Create: `backend/spec/requests/api/v1/oauth_registrations_spec.rb`

- [ ] **Step 1: テストを書く**

```ruby
# backend/spec/requests/api/v1/oauth_registrations_spec.rb
# frozen_string_literal: true

require "rails_helper"

RSpec.describe "OAuth Registrations", type: :request do
  describe "POST /api/v1/auth/complete_registration" do
    context "有効なセッションデータがある場合" do
      before do
        # OmniAuthコールバック経由でセッションにデータを保持
        mock_google_oauth
        get "/api/v1/auth/google_oauth2/callback"
      end

      it "ユーザーとUserProviderを作成して201を返す" do
        expect {
          post "/api/v1/auth/complete_registration",
               params: { username: "newuser" },
               as: :json
        }.to change(User, :count).by(1)
          .and change(UserProvider, :count).by(1)

        expect(response).to have_http_status(:created)
        json = JSON.parse(response.body)
        expect(json["user"]["username"]).to eq("newuser")
        expect(json["user"]["email"]).to eq("user@gmail.com")
        expect(json["user"]["email_missing"]).to be false
      end

      it "ユーザー名が重複している場合は422を返す" do
        User.create!(username: "newuser", email: "other@example.com", password: "password123")

        post "/api/v1/auth/complete_registration",
             params: { username: "newuser" },
             as: :json

        expect(response).to have_http_status(:unprocessable_content)
      end

      it "ユーザー名が空の場合は422を返す" do
        post "/api/v1/auth/complete_registration",
             params: { username: "" },
             as: :json

        expect(response).to have_http_status(:unprocessable_content)
      end
    end

    context "メールなし（X経由）の場合" do
      before do
        mock_twitter_oauth
        get "/api/v1/auth/twitter2/callback"
      end

      it "メールなしでユーザーを作成し、email_missingがtrue" do
        post "/api/v1/auth/complete_registration",
             params: { username: "xuser" },
             as: :json

        expect(response).to have_http_status(:created)
        json = JSON.parse(response.body)
        expect(json["user"]["email_missing"]).to be true
      end
    end

    context "セッションデータがない場合" do
      it "401を返す" do
        post "/api/v1/auth/complete_registration",
             params: { username: "newuser" },
             as: :json

        expect(response).to have_http_status(:unauthorized)
      end
    end

    context "セッションデータの有効期限切れ" do
      before do
        mock_google_oauth
        get "/api/v1/auth/google_oauth2/callback"
      end

      it "401を返す" do
        # セッションの有効期限を過去に設定（テスト内で直接操作は難しいため、
        # このテストは実装時にトラベルヘルパーを使用）
        travel 16.minutes do
          post "/api/v1/auth/complete_registration",
               params: { username: "newuser" },
               as: :json

          expect(response).to have_http_status(:unauthorized)
        end
      end
    end
  end
end
```

- [ ] **Step 2: テスト実行して失敗を確認**

Run: `docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec spec/requests/api/v1/oauth_registrations_spec.rb`
Expected: FAIL

- [ ] **Step 3: コントローラーを実装**

```ruby
# backend/app/controllers/api/v1/oauth_registrations_controller.rb
# frozen_string_literal: true

module Api
  module V1
    class OauthRegistrationsController < ApplicationController
      def create
        oauth_data = validate_oauth_session
        return render json: { error: "認証の有効期限が切れました。もう一度お試しください" }, status: :unauthorized unless oauth_data

        user = nil
        ActiveRecord::Base.transaction do
          # UserProviderを先に作成するためにuser.save!前に一時フラグを使用
          # password_required? は user_providers.any? をチェックするため、
          # 先にUserProviderを作成できない（user_idが未確定）。
          # 解決策: 一時的にダミーパスワードでsave後、encrypted_passwordをクリアする
          user = User.new(
            username: params[:username],
            email: oauth_data[:email] || "",
            password: SecureRandom.hex(32)
          )
          user.save!
          user.update_column(:encrypted_password, "")

          UserProvider.create!(
            user: user,
            provider: oauth_data[:provider],
            provider_uid: oauth_data[:uid]
          )
        end

        session.delete(:oauth_data)
        sign_in(user)
        render json: { user: user_json(user.reload) }, status: :created
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_content
      end

      private

      def validate_oauth_session
        data = session[:oauth_data]
        return nil unless data

        if data[:expires_at].to_i < Time.current.to_i
          session.delete(:oauth_data)
          return nil
        end

        data.symbolize_keys
      end
    end
  end
end
```

- [ ] **Step 4: テスト実行して成功を確認**

Run: `docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec spec/requests/api/v1/oauth_registrations_spec.rb`
Expected: 全テストPASS

- [ ] **Step 5: コミット**

```bash
git add backend/app/controllers/api/v1/oauth_registrations_controller.rb backend/spec/requests/api/v1/oauth_registrations_spec.rb
git commit -m "feat: OauthRegistrationsController（OAuth新規登録完了）を追加"
```

---

## Task 10: AccountSettingsController（連携管理・パスワード設定）

**Files:**
- Create: `backend/app/controllers/api/v1/account_settings_controller.rb`
- Create: `backend/spec/requests/api/v1/account_settings_spec.rb`

- [ ] **Step 1: テストを書く**

```ruby
# backend/spec/requests/api/v1/account_settings_spec.rb
# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Account Settings", type: :request do
  describe "DELETE /api/v1/account_settings/unlink_provider" do
    context "複数のログイン手段がある場合" do
      it "OAuth連携を解除できる" do
        user = User.create!(username: "testuser", email: "test@example.com", password: "password123")
        UserProvider.create!(user: user, provider: "google_oauth2", provider_uid: "12345")
        sign_in user

        expect {
          delete "/api/v1/account_settings/unlink_provider",
                 params: { provider: "google_oauth2" },
                 as: :json
        }.to change(UserProvider, :count).by(-1)

        expect(response).to have_http_status(:ok)
      end
    end

    context "最後のログイン手段の場合" do
      it "解除を拒否して422を返す" do
        user = User.new(username: "oauthonly", email: "oauth@example.com")
        user.save!(validate: false)
        user.update_column(:encrypted_password, "")
        UserProvider.create!(user: user, provider: "google_oauth2", provider_uid: "12345")
        sign_in user

        delete "/api/v1/account_settings/unlink_provider",
               params: { provider: "google_oauth2" },
               as: :json

        expect(response).to have_http_status(:unprocessable_content)
        json = JSON.parse(response.body)
        expect(json["error"]).to include("ログイン手段")
      end
    end
  end

  describe "PUT /api/v1/account_settings/set_password" do
    context "パスワード未設定のOAuthユーザー" do
      it "パスワードを設定できる" do
        user = User.new(username: "oauthuser", email: "oauth@example.com")
        user.save!(validate: false)
        user.update_column(:encrypted_password, "")
        UserProvider.create!(user: user, provider: "google_oauth2", provider_uid: "12345")
        sign_in user

        put "/api/v1/account_settings/set_password",
            params: { password: "newpass123", password_confirmation: "newpass123" },
            as: :json

        expect(response).to have_http_status(:ok)
        user.reload
        expect(user.encrypted_password).to be_present
      end
    end

    context "パスワード不一致" do
      it "422を返す" do
        user = User.new(username: "oauthuser", email: "oauth@example.com")
        user.save!(validate: false)
        user.update_column(:encrypted_password, "")
        UserProvider.create!(user: user, provider: "google_oauth2", provider_uid: "12345")
        sign_in user

        put "/api/v1/account_settings/set_password",
            params: { password: "newpass123", password_confirmation: "wrongpass" },
            as: :json

        expect(response).to have_http_status(:unprocessable_content)
      end
    end

    context "未ログイン" do
      it "401を返す" do
        put "/api/v1/account_settings/set_password",
            params: { password: "newpass123", password_confirmation: "newpass123" },
            as: :json

        expect(response).to have_http_status(:unauthorized)
      end
    end
  end

  describe "PUT /api/v1/account_settings/set_email" do
    context "メール未設定ユーザー" do
      it "メールアドレスを設定できる" do
        user = User.new(username: "noemailuser", email: "")
        user.save!(validate: false)
        user.update_column(:encrypted_password, "")
        UserProvider.create!(user: user, provider: "twitter2", provider_uid: "12345")
        sign_in user

        put "/api/v1/account_settings/set_email",
            params: { email: "new@example.com" },
            as: :json

        expect(response).to have_http_status(:ok)
        user.reload
        expect(user.email).to eq("new@example.com")
      end
    end

    context "メールアドレスが既に使用されている場合" do
      it "422を返す" do
        User.create!(username: "otheruser", email: "taken@example.com", password: "password123")

        user = User.new(username: "noemailuser", email: "")
        user.save!(validate: false)
        user.update_column(:encrypted_password, "")
        UserProvider.create!(user: user, provider: "twitter2", provider_uid: "12345")
        sign_in user

        put "/api/v1/account_settings/set_email",
            params: { email: "taken@example.com" },
            as: :json

        expect(response).to have_http_status(:unprocessable_content)
      end
    end

    context "既にメールアドレスが設定されている場合" do
      it "422を返す" do
        user = User.create!(username: "testuser", email: "existing@example.com", password: "password123")
        sign_in user

        put "/api/v1/account_settings/set_email",
            params: { email: "new@example.com" },
            as: :json

        expect(response).to have_http_status(:unprocessable_content)
      end
    end
  end
end
```

- [ ] **Step 2: テスト実行して失敗を確認**

Run: `docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec spec/requests/api/v1/account_settings_spec.rb`
Expected: FAIL

- [ ] **Step 3: コントローラーを実装**

```ruby
# backend/app/controllers/api/v1/account_settings_controller.rb
# frozen_string_literal: true

module Api
  module V1
    class AccountSettingsController < ApplicationController
      before_action :authenticate_user!

      def unlink_provider
        provider = current_user.user_providers.find_by(provider: params[:provider])
        return render json: { error: "連携が見つかりません" }, status: :not_found unless provider

        if last_login_method?
          return render json: { error: "最後のログイン手段は解除できません。先にパスワードを設定するか、別のOAuthを連携してください" }, status: :unprocessable_content
        end

        provider.destroy!
        render json: { user: user_json(current_user.reload) }
      end

      def set_password
        if params[:password] != params[:password_confirmation]
          return render json: { error: "パスワードが一致しません" }, status: :unprocessable_content
        end

        current_user.password = params[:password]
        current_user.password_confirmation = params[:password_confirmation]

        if current_user.save
          render json: { user: user_json(current_user) }
        else
          render json: { errors: current_user.errors.full_messages }, status: :unprocessable_content
        end
      end

      def set_email
        if current_user.email.present?
          return render json: { error: "メールアドレスは既に設定されています" }, status: :unprocessable_content
        end

        existing = User.find_by(email: params[:email])
        if existing
          return render json: { error: "このメールアドレスは既に使用されています" }, status: :unprocessable_content
        end

        current_user.email = params[:email]
        if current_user.save
          render json: { user: user_json(current_user) }
        else
          render json: { errors: current_user.errors.full_messages }, status: :unprocessable_content
        end
      end

      private

      def last_login_method?
        has_password = current_user.encrypted_password.present?
        provider_count = current_user.user_providers.count

        !has_password && provider_count <= 1
      end
    end
  end
end
```

**注記:** OAuth連携追加は `OmniauthCallbacksController#handle_link_provider` で直接処理するため、`AccountSettingsController` に `link_provider` は不要。フロントエンドからはOAuthボタンのPOST（OmniAuthフロー）で連携追加を開始し、`OmniauthCallbacksController` がログイン済みユーザーを検知してUserProviderを直接作成する。

- [ ] **Step 4: テスト実行して成功を確認**

Run: `docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec spec/requests/api/v1/account_settings_spec.rb`
Expected: 全テストPASS

- [ ] **Step 5: 全バックエンドテスト実行**

Run: `docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec`
Expected: 全テストPASS

- [ ] **Step 6: RuboCop実行**

Run: `docker compose run --rm backend bundle exec rubocop`
Expected: 違反なし（あれば修正）

- [ ] **Step 7: コミット**

```bash
git add backend/app/controllers/api/v1/account_settings_controller.rb backend/spec/requests/api/v1/account_settings_spec.rb
git commit -m "feat: AccountSettingsController（OAuth連携管理・パスワード設定）を追加"
```

---

## Task 11: フロントエンド型定義・API層・AuthContext更新

**Files:**
- Modify: `frontend/src/lib/types.ts`
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/contexts/authContextValue.ts`
- Modify: `frontend/src/contexts/AuthContext.tsx`

- [ ] **Step 1: AuthContextValueにsetUserとrefreshUserを追加**

`frontend/src/contexts/authContextValue.ts` の `AuthContextValue` に追加:

```typescript
export interface AuthContextValue {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  signup: (username: string, email: string, password: string, passwordConfirmation: string) => Promise<void>
  logout: () => Promise<void>
  setUser: (user: User | null) => void       // OAuth登録完了後に使用
  refreshUser: () => Promise<void>            // OAuthコールバック後に使用
}
```

`frontend/src/contexts/AuthContext.tsx` に `refreshUser` を実装し、`useMemo` の依存配列と `value` に `setUser` と `refreshUser` を追加:

```typescript
const refreshUser = useCallback(async () => {
  try {
    const data = await authApi.getCurrentUser()
    setUser(data.user)
  } catch {
    setUser(null)
  }
}, [])

// useMemo内のvalueに追加
const value = useMemo(() => ({
  user, isAuthenticated, isLoading,
  login, signup, logout,
  setUser, refreshUser,
}), [user, isAuthenticated, isLoading, login, signup, logout, refreshUser])
```

- [ ] **Step 2: User型にOAuth関連フィールドを追加**

`frontend/src/lib/types.ts` の `User` インターフェースに追加:

```typescript
export interface User {
  id: number
  username: string
  email: string
  avatar_url: string | null
  bio: string | null
  created_at: string
  has_password: boolean
  providers: string[]
  email_missing: boolean
}
```

- [ ] **Step 2: api.tsにOAuth関連APIを追加**

`frontend/src/lib/api.ts` に以下を追加:

```typescript
// 注意: request() は内部で API_BASE ('/api/v1') をプレフィックスするため、
// パスは '/api/v1' なしで指定する

export const csrfApi = {
  getToken(): Promise<{ token: string }> {
    return request('/csrf_token')
  },
}

export const oauthApi = {
  completeRegistration(username: string): Promise<AuthResponse> {
    return request('/auth/complete_registration', {
      method: 'POST',
      body: JSON.stringify({ username }),
    })
  },
}

export const accountApi = {
  setEmail(email: string): Promise<AuthResponse> {
    return request('/account_settings/set_email', {
      method: 'PUT',
      body: JSON.stringify({ email }),
    })
  },
  unlinkProvider(provider: string): Promise<AuthResponse> {
    return request('/account_settings/unlink_provider', {
      method: 'DELETE',
      body: JSON.stringify({ provider }),
    })
  },
  setPassword(password: string, passwordConfirmation: string): Promise<AuthResponse> {
    return request('/account_settings/set_password', {
      method: 'PUT',
      body: JSON.stringify({ password, password_confirmation: passwordConfirmation }),
    })
  },
}
```

- [ ] **Step 3: lint確認**

Run: `docker compose run --rm frontend npm run lint`
Expected: エラーなし

- [ ] **Step 4: 既存テストが壊れていないことを確認**

Run: `docker compose run --rm frontend npm test`
Expected: 全テストPASS

- [ ] **Step 5: コミット**

```bash
git add frontend/src/lib/types.ts frontend/src/lib/api.ts
git commit -m "feat: フロントエンドにOAuth関連の型定義・APIクライアントを追加"
```

---

## Task 12: OAuthButtonsコンポーネント

**Files:**
- Create: `frontend/src/components/OAuthButtons/OAuthButtons.tsx`
- Create: `frontend/src/components/OAuthButtons/OAuthButtons.module.css`
- Create: `frontend/src/components/OAuthButtons/OAuthButtons.test.tsx`

- [ ] **Step 1: テストを書く**

```tsx
// frontend/src/components/OAuthButtons/OAuthButtons.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OAuthButtons } from './OAuthButtons'

vi.mock('../../lib/api', () => ({
  csrfApi: {
    getToken: vi.fn().mockResolvedValue({ token: 'test-csrf-token' }),
  },
}))

describe('OAuthButtons', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GoogleとXのOAuthボタンを表示する', async () => {
    render(<OAuthButtons />)

    await waitFor(() => {
      expect(screen.getByText('Googleでログイン')).toBeInTheDocument()
      expect(screen.getByText('Xでログイン')).toBeInTheDocument()
    })
  })

  it('各ボタンにCSRFトークンが含まれたフォームがある', async () => {
    render(<OAuthButtons />)

    await waitFor(() => {
      const forms = document.querySelectorAll('form')
      expect(forms).toHaveLength(2)
      forms.forEach((form) => {
        const input = form.querySelector('input[name="authenticity_token"]')
        expect(input).toBeInTheDocument()
        expect(input).toHaveValue('test-csrf-token')
      })
    })
  })

  it('区切り線「または」を表示する', async () => {
    render(<OAuthButtons />)

    await waitFor(() => {
      expect(screen.getByText('または')).toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 2: テスト実行して失敗を確認**

Run: `docker compose run --rm frontend npx vitest run src/components/OAuthButtons/OAuthButtons.test.tsx`
Expected: FAIL

- [ ] **Step 3: コンポーネントを実装**

```tsx
// frontend/src/components/OAuthButtons/OAuthButtons.tsx
import { useEffect, useState } from 'react'
import { csrfApi } from '../../lib/api'
import styles from './OAuthButtons.module.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export function OAuthButtons() {
  const [csrfToken, setCsrfToken] = useState('')

  useEffect(() => {
    const fetchToken = async () => {
      try {
        const data = await csrfApi.getToken()
        setCsrfToken(data.token)
      } catch {
        // CSRFトークン取得失敗時はOAuthボタンを無効化
      }
    }
    void fetchToken()
  }, [])

  return (
    <div className={styles.container}>
      <div className={styles.divider}>
        <span className={styles.dividerText}>または</span>
      </div>

      <form method="post" action={`${API_BASE}/api/v1/auth/google_oauth2`}>
        <input type="hidden" name="authenticity_token" value={csrfToken} />
        <button type="submit" className={styles.oauthButton} disabled={!csrfToken}>
          <span className={styles.googleIcon}>G</span>
          Googleでログイン
        </button>
      </form>

      <form method="post" action={`${API_BASE}/api/v1/auth/twitter2`}>
        <input type="hidden" name="authenticity_token" value={csrfToken} />
        <button type="submit" className={`${styles.oauthButton} ${styles.xButton}`} disabled={!csrfToken}>
          <span className={styles.xIcon}>𝕏</span>
          Xでログイン
        </button>
      </form>
    </div>
  )
}
```

```css
/* frontend/src/components/OAuthButtons/OAuthButtons.module.css */
.container {
  margin-top: var(--spacing-lg);
}

.divider {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
}

.divider::before,
.divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--color-border);
}

.dividerText {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.oauthButton {
  width: 100%;
  padding: var(--spacing-sm) var(--spacing-md);
  margin-bottom: var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius);
  background: var(--color-bg);
  color: var(--color-text);
  font-size: var(--font-size-md);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  transition: background 0.2s;
}

.oauthButton:hover:not(:disabled) {
  background: var(--color-bg-hover);
}

.oauthButton:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.xButton {
  background: var(--color-text);
  color: var(--color-bg);
  border-color: var(--color-text);
}

.xButton:hover:not(:disabled) {
  opacity: 0.9;
}

.googleIcon {
  font-size: var(--font-size-lg);
  font-weight: bold;
}

.xIcon {
  font-size: var(--font-size-md);
}
```

- [ ] **Step 4: テスト実行して成功を確認**

Run: `docker compose run --rm frontend npx vitest run src/components/OAuthButtons/OAuthButtons.test.tsx`
Expected: 全テストPASS

- [ ] **Step 5: コミット**

```bash
git add frontend/src/components/OAuthButtons/
git commit -m "feat: OAuthButtonsコンポーネントを追加"
```

---

## Task 13: LoginPage・SignUpPageにOAuthボタン追加

**Files:**
- Modify: `frontend/src/pages/LoginPage/LoginPage.tsx`
- Modify: `frontend/src/pages/SignUpPage/SignUpPage.tsx`
- Modify: 既存テストファイル

- [ ] **Step 1: LoginPageのテストにOAuthボタン表示を追加**

既存テストファイル `frontend/src/pages/LoginPage/LoginPage.test.tsx` に追加（ファイルがない場合は新規作成）:

```tsx
it('OAuthボタンが表示される', async () => {
  render(/* LoginPage with router/auth context */)
  await waitFor(() => {
    expect(screen.getByText('Googleでログイン')).toBeInTheDocument()
    expect(screen.getByText('Xでログイン')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: LoginPageにOAuthButtonsをインポートして追加**

`frontend/src/pages/LoginPage/LoginPage.tsx` のフォームの後に `<OAuthButtons />` を追加:

```tsx
import { OAuthButtons } from '../../components/OAuthButtons/OAuthButtons'

// ... 既存のフォーム部分の後に追加
<OAuthButtons />
```

- [ ] **Step 3: SignUpPageにも同様に追加**

`frontend/src/pages/SignUpPage/SignUpPage.tsx` のフォームの後に `<OAuthButtons />` を追加。

- [ ] **Step 4: テスト実行**

Run: `docker compose run --rm frontend npm test`
Expected: 全テストPASS

- [ ] **Step 5: コミット**

```bash
git add frontend/src/pages/LoginPage/ frontend/src/pages/SignUpPage/
git commit -m "feat: ログイン・サインアップ画面にOAuthボタンを追加"
```

---

## Task 14: AuthCallbackPage

**Files:**
- Create: `frontend/src/pages/AuthCallbackPage/AuthCallbackPage.tsx`
- Create: `frontend/src/pages/AuthCallbackPage/AuthCallbackPage.test.tsx`

- [ ] **Step 1: テストを書く**

```tsx
// frontend/src/pages/AuthCallbackPage/AuthCallbackPage.test.tsx
import { render, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { AuthCallbackPage } from './AuthCallbackPage'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../../contexts/useAuth', () => ({
  useAuth: () => ({
    refreshUser: vi.fn().mockResolvedValue(undefined),
  }),
}))

describe('AuthCallbackPage', () => {
  it('status=successでダッシュボードにリダイレクト', async () => {
    render(
      <MemoryRouter initialEntries={['/auth/callback?status=success']}>
        <AuthCallbackPage />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true })
    })
  })

  it('status=new_userでユーザー名入力画面にリダイレクト', async () => {
    render(
      <MemoryRouter initialEntries={['/auth/callback?status=new_user']}>
        <AuthCallbackPage />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/auth/complete', { replace: true })
    })
  })

  it('status=provider_linkedで設定画面にリダイレクト', async () => {
    render(
      <MemoryRouter initialEntries={['/auth/callback?status=provider_linked']}>
        <AuthCallbackPage />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/settings', expect.objectContaining({ replace: true }))
    })
  })

  it('status=errorでログインページにリダイレクト', async () => {
    render(
      <MemoryRouter initialEntries={['/auth/callback?status=error&message=email_already_registered']}>
        <AuthCallbackPage />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/', expect.objectContaining({ replace: true }))
    })
  })
})
```

- [ ] **Step 2: テスト実行して失敗を確認**

Run: `docker compose run --rm frontend npx vitest run src/pages/AuthCallbackPage/AuthCallbackPage.test.tsx`
Expected: FAIL

- [ ] **Step 3: コンポーネントを実装**

```tsx
// frontend/src/pages/AuthCallbackPage/AuthCallbackPage.tsx
import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../contexts/useAuth'

const ERROR_MESSAGES: Record<string, string> = {
  email_already_registered: 'このメールアドレスは既に登録されています。メールアドレスでログインしてください',
  email_registered_with_other_provider: 'このメールアドレスは既に別のプロバイダで登録されています',
  oauth_failed: 'OAuth認証に失敗しました。もう一度お試しください',
  provider_already_linked: 'このプロバイダは既に連携済みです',
}

export function AuthCallbackPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { refreshUser } = useAuth()

  useEffect(() => {
    const status = searchParams.get('status')
    const message = searchParams.get('message')

    const handleCallback = async () => {
      switch (status) {
        case 'success':
          await refreshUser()
          navigate('/dashboard', { replace: true })
          break
        case 'provider_linked':
          await refreshUser()
          navigate('/settings', { replace: true, state: { message: 'OAuth連携が完了しました' } })
          break
        case 'new_user':
          navigate('/auth/complete', { replace: true })
          break
        case 'error':
        default: {
          const errorMessage = message ? ERROR_MESSAGES[message] || message : 'エラーが発生しました'
          navigate('/', { replace: true, state: { error: errorMessage } })
          break
        }
      }
    }

    void handleCallback()
  }, [searchParams, navigate, refreshUser])

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <p>認証処理中...</p>
    </div>
  )
}
```

- [ ] **Step 4: AuthContextにrefreshUser関数を追加**

`frontend/src/contexts/authContextValue.ts` に `refreshUser` を追加:

```typescript
refreshUser: () => Promise<void>
```

`frontend/src/contexts/AuthContext.tsx` に実装:

```typescript
const refreshUser = useCallback(async () => {
  try {
    const data = await authApi.getCurrentUser()
    setUser(data.user)
  } catch {
    setUser(null)
  }
}, [])
```

- [ ] **Step 5: テスト実行して成功を確認**

Run: `docker compose run --rm frontend npx vitest run src/pages/AuthCallbackPage/AuthCallbackPage.test.tsx`
Expected: 全テストPASS

- [ ] **Step 6: コミット**

```bash
git add frontend/src/pages/AuthCallbackPage/ frontend/src/contexts/
git commit -m "feat: AuthCallbackPage（OAuthコールバック受信）を追加"
```

---

## Task 15: OauthUsernamePage（ユーザー名入力画面）

**Files:**
- Create: `frontend/src/pages/OauthUsernamePage/OauthUsernamePage.tsx`
- Create: `frontend/src/pages/OauthUsernamePage/OauthUsernamePage.module.css`
- Create: `frontend/src/pages/OauthUsernamePage/OauthUsernamePage.test.tsx`

- [ ] **Step 1: テストを書く**

```tsx
// frontend/src/pages/OauthUsernamePage/OauthUsernamePage.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { OauthUsernamePage } from './OauthUsernamePage'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../../lib/api', () => ({
  oauthApi: {
    completeRegistration: vi.fn().mockResolvedValue({
      user: { id: 1, username: 'newuser', email: 'test@example.com', email_missing: false, has_password: false, providers: ['google_oauth2'] },
    }),
  },
}))

vi.mock('../../contexts/useAuth', () => ({
  useAuth: () => ({
    setUser: vi.fn(),
  }),
}))

describe('OauthUsernamePage', () => {
  it('ユーザー名入力フォームを表示する', () => {
    render(
      <MemoryRouter>
        <OauthUsernamePage />
      </MemoryRouter>
    )
    expect(screen.getByLabelText('ユーザー名')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '登録する' })).toBeInTheDocument()
  })

  it('ユーザー名送信後にダッシュボードにリダイレクト（メールあり）', async () => {
    render(
      <MemoryRouter>
        <OauthUsernamePage />
      </MemoryRouter>
    )

    fireEvent.change(screen.getByLabelText('ユーザー名'), { target: { value: 'newuser' } })
    fireEvent.click(screen.getByRole('button', { name: '登録する' }))

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true })
    })
  })

  it('メール未設定の場合はメール設定画面にリダイレクト', async () => {
    const { oauthApi } = await import('../../lib/api')
    vi.mocked(oauthApi.completeRegistration).mockResolvedValueOnce({
      user: { id: 2, username: 'xuser', email: '', email_missing: true, has_password: false, providers: ['twitter2'], avatar_url: null, bio: null, created_at: '2026-01-01' },
    })

    render(
      <MemoryRouter>
        <OauthUsernamePage />
      </MemoryRouter>
    )

    fireEvent.change(screen.getByLabelText('ユーザー名'), { target: { value: 'xuser' } })
    fireEvent.click(screen.getByRole('button', { name: '登録する' }))

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/auth/email-setup', { replace: true })
    })
  })
})
```

- [ ] **Step 2: テスト実行して失敗を確認**

Run: `docker compose run --rm frontend npx vitest run src/pages/OauthUsernamePage/OauthUsernamePage.test.tsx`
Expected: FAIL

- [ ] **Step 3: ページを実装**

```tsx
// frontend/src/pages/OauthUsernamePage/OauthUsernamePage.tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { oauthApi } from '../../lib/api'
import { useAuth } from '../../contexts/useAuth'
import { ApiError } from '../../lib/types'
import styles from './OauthUsernamePage.module.css'

export function OauthUsernamePage() {
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const navigate = useNavigate()
  const { setUser } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const data = await oauthApi.completeRegistration(username)
      setUser(data.user)

      if (data.user.email_missing) {
        navigate('/auth/email-setup', { replace: true })
      } else {
        navigate('/dashboard', { replace: true })
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('エラーが発生しました')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>ユーザー名を設定</h1>
        <p className={styles.subtitle}>Recollyで使うユーザー名を入力してください</p>

        <form onSubmit={(e) => void handleSubmit(e)}>
          <label htmlFor="username" className={styles.label}>ユーザー名</label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className={styles.input}
            minLength={2}
            maxLength={30}
            required
            autoFocus
          />
          {error && <p className={styles.error}>{error}</p>}
          <button type="submit" className={styles.button} disabled={isSubmitting}>
            {isSubmitting ? '登録中...' : '登録する'}
          </button>
        </form>
      </div>
    </div>
  )
}
```

スタイルは既存のLoginPage/SignUpPageのパターンに合わせて作成する。

- [ ] **Step 4: テスト実行して成功を確認**

Run: `docker compose run --rm frontend npx vitest run src/pages/OauthUsernamePage/OauthUsernamePage.test.tsx`
Expected: 全テストPASS

- [ ] **Step 5: コミット**

```bash
git add frontend/src/pages/OauthUsernamePage/
git commit -m "feat: OauthUsernamePage（OAuth新規登録時のユーザー名入力）を追加"
```

---

## Task 16: EmailPromptPage + EmailPromptBanner

**Files:**
- Create: `frontend/src/pages/EmailPromptPage/EmailPromptPage.tsx`
- Create: `frontend/src/pages/EmailPromptPage/EmailPromptPage.module.css`
- Create: `frontend/src/pages/EmailPromptPage/EmailPromptPage.test.tsx`
- Create: `frontend/src/components/EmailPromptBanner/EmailPromptBanner.tsx`
- Create: `frontend/src/components/EmailPromptBanner/EmailPromptBanner.module.css`
- Create: `frontend/src/components/EmailPromptBanner/EmailPromptBanner.test.tsx`

- [ ] **Step 1: EmailPromptBannerのテストを書く**

```tsx
// frontend/src/components/EmailPromptBanner/EmailPromptBanner.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { EmailPromptBanner } from './EmailPromptBanner'

describe('EmailPromptBanner', () => {
  it('メール未設定時にバナーを表示', () => {
    render(
      <MemoryRouter>
        <EmailPromptBanner />
      </MemoryRouter>
    )
    expect(screen.getByText(/メールアドレスを設定/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: EmailPromptBannerを実装**

```tsx
// frontend/src/components/EmailPromptBanner/EmailPromptBanner.tsx
import { Link } from 'react-router-dom'
import styles from './EmailPromptBanner.module.css'

export function EmailPromptBanner() {
  return (
    <div className={styles.banner}>
      <p className={styles.text}>
        メールアドレスを設定すると、パスワードリセットなどの機能が使えるようになります。
      </p>
      <Link to="/auth/email-setup" className={styles.link}>
        メールアドレスを設定する
      </Link>
    </div>
  )
}
```

- [ ] **Step 3: EmailPromptPageのテストを書く**

```tsx
// frontend/src/pages/EmailPromptPage/EmailPromptPage.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { EmailPromptPage } from './EmailPromptPage'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

describe('EmailPromptPage', () => {
  it('メールアドレス入力フォームを表示', () => {
    render(
      <MemoryRouter>
        <EmailPromptPage />
      </MemoryRouter>
    )
    expect(screen.getByLabelText('メールアドレス')).toBeInTheDocument()
  })

  it('スキップボタンでダッシュボードに遷移', async () => {
    render(
      <MemoryRouter>
        <EmailPromptPage />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText('あとで設定する'))
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true })
  })
})
```

- [ ] **Step 4: EmailPromptPageを実装**

メールアドレス入力フォーム + 「あとで設定する」スキップボタンを持つページ。送信時にバックエンドAPIでメール重複チェック。

- [ ] **Step 5: テスト実行**

Run: `docker compose run --rm frontend npm test`
Expected: 全テストPASS

- [ ] **Step 6: コミット**

```bash
git add frontend/src/pages/EmailPromptPage/ frontend/src/components/EmailPromptBanner/
git commit -m "feat: EmailPromptPage・EmailPromptBannerを追加"
```

---

## Task 17: AccountSettingsPage（設定画面）

**Files:**
- Create: `frontend/src/pages/AccountSettingsPage/AccountSettingsPage.tsx`
- Create: `frontend/src/pages/AccountSettingsPage/AccountSettingsPage.module.css`
- Create: `frontend/src/pages/AccountSettingsPage/AccountSettingsPage.test.tsx`

- [ ] **Step 1: テストを書く**

```tsx
// frontend/src/pages/AccountSettingsPage/AccountSettingsPage.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { AccountSettingsPage } from './AccountSettingsPage'

vi.mock('../../contexts/useAuth', () => ({
  useAuth: () => ({
    user: {
      id: 1, username: 'testuser', email: 'test@example.com',
      has_password: true, providers: ['google_oauth2'], email_missing: false,
      avatar_url: null, bio: null, created_at: '2026-01-01',
    },
    setUser: vi.fn(),
  }),
}))

describe('AccountSettingsPage', () => {
  it('連携済みプロバイダを表示', () => {
    render(
      <MemoryRouter>
        <AccountSettingsPage />
      </MemoryRouter>
    )
    expect(screen.getByText('Google')).toBeInTheDocument()
    expect(screen.getByText('連携済み')).toBeInTheDocument()
  })

  it('未連携プロバイダの連携ボタンを表示', () => {
    render(
      <MemoryRouter>
        <AccountSettingsPage />
      </MemoryRouter>
    )
    expect(screen.getByText(/Xと連携/)).toBeInTheDocument()
  })

  it('パスワード設定済みの場合「変更」と表示', () => {
    render(
      <MemoryRouter>
        <AccountSettingsPage />
      </MemoryRouter>
    )
    expect(screen.getByText('パスワードを変更')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: テスト実行して失敗を確認**

Run: `docker compose run --rm frontend npx vitest run src/pages/AccountSettingsPage/AccountSettingsPage.test.tsx`
Expected: FAIL

- [ ] **Step 3: ページを実装**

OAuth連携状況の表示、連携追加/解除ボタン、パスワード設定/変更フォームを持つ設定画面。最後のログイン手段の解除ボタンは無効化+理由表示。

- [ ] **Step 4: テスト実行して成功を確認**

Run: `docker compose run --rm frontend npx vitest run src/pages/AccountSettingsPage/AccountSettingsPage.test.tsx`
Expected: 全テストPASS

- [ ] **Step 5: コミット**

```bash
git add frontend/src/pages/AccountSettingsPage/
git commit -m "feat: AccountSettingsPage（アカウント設定画面）を追加"
```

---

## Task 18: ルーティング統合 + ダッシュボードにEmailPromptBanner追加

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/pages/DashboardPage/DashboardPage.tsx`（ダッシュボードにバナー追加）

- [ ] **Step 1: App.tsxに新規ルートを追加**

```tsx
import { AuthCallbackPage } from './pages/AuthCallbackPage/AuthCallbackPage'
import { OauthUsernamePage } from './pages/OauthUsernamePage/OauthUsernamePage'
import { EmailPromptPage } from './pages/EmailPromptPage/EmailPromptPage'
import { AccountSettingsPage } from './pages/AccountSettingsPage/AccountSettingsPage'

// ルート定義に追加（認証不要）
<Route path="/auth/callback" element={<AuthCallbackPage />} />
<Route path="/auth/complete" element={<OauthUsernamePage />} />

// ProtectedRoute内に追加（認証必要）
<Route path="/auth/email-setup" element={<EmailPromptPage />} />
<Route path="/settings" element={<AccountSettingsPage />} />
```

- [ ] **Step 2: ダッシュボードにEmailPromptBannerを追加**

ダッシュボードページで `user.email_missing` が `true` の場合に `<EmailPromptBanner />` を表示。

- [ ] **Step 3: NavBarに設定画面へのリンクを追加**

ユーザーメニューに「設定」リンクを追加。

- [ ] **Step 4: 全フロントエンドテスト実行**

Run: `docker compose run --rm frontend npm test`
Expected: 全テストPASS

- [ ] **Step 5: lint実行**

Run: `docker compose run --rm frontend npm run lint`
Expected: エラーなし

- [ ] **Step 6: コミット**

```bash
git add frontend/src/App.tsx frontend/src/pages/DashboardPage/ frontend/src/components/ui/NavBar/
git commit -m "feat: OAuthルーティング統合、ダッシュボードにメール設定バナー追加"
```

---

## Task 19: 全体結合テスト + 最終確認

**Files:** なし（テスト実行のみ）

- [ ] **Step 1: バックエンド全テスト**

Run: `docker compose run --rm -e RAILS_ENV=test backend bundle exec rspec`
Expected: 全テストPASS

- [ ] **Step 2: フロントエンド全テスト**

Run: `docker compose run --rm frontend npm test`
Expected: 全テストPASS

- [ ] **Step 3: バックエンドlint**

Run: `docker compose run --rm backend bundle exec rubocop`
Expected: 違反なし

- [ ] **Step 4: フロントエンドlint**

Run: `docker compose run --rm frontend npm run lint`
Expected: エラーなし

- [ ] **Step 5: 200行ルール確認**

全新規ファイルが200行以内であることを確認。超える場合は分割。

- [ ] **Step 6: VITE_API_URL環境変数の確認**

OAuthボタンのフォームPOSTはViteプロキシを通らないため、`VITE_API_URL` が正しく設定されていることを確認。本番環境では必須。

- [ ] **Step 7: 環境変数の.envサンプル更新**

開発用 `.env` に以下を追加（実際の値はOAuthプロバイダ設定後に設定）:

```bash
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
X_CLIENT_ID=your_x_client_id
X_CLIENT_SECRET=your_x_client_secret
VITE_API_URL=http://localhost:3000
```

- [ ] **Step 8: コミット**

```bash
git add -A
git commit -m "chore: OAuth認証の環境変数設定を追加"
```

---

## Task 20: OAuthプロバイダ設定ドキュメント + TODO.md更新

**Files:**
- Modify: `docs/TODO.md`

- [ ] **Step 1: TODO.mdのOAuth項目を完了にマーク**

```markdown
- [x] Google OAuth
- [x] X（Twitter）OAuth
```

- [ ] **Step 2: コミット**

```bash
git add docs/TODO.md
git commit -m "docs: OAuth認証のTODOを完了にマーク"
```
