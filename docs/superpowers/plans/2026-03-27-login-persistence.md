# ログイン保持機能 + ログイン失敗バグ修正 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PWA環境でのログイン保持（90日）を実現し、Issue #49のログイン失敗バグを修正する

**Architecture:** Deviseの既存 `:rememberable` モジュールを有効化し、全ログイン経路（メール/パスワード、Google OAuth）で `remember_me(user)` を呼び出す。Cookie設定の明示化とFRONTEND_URL環境変数の追加で開発環境のバグも修正する。

**Tech Stack:** Ruby on Rails 8 / Devise / RSpec

---

### Task 1: Devise rememberable の設定

**Files:**
- Modify: `backend/config/initializers/devise.rb:29`

- [ ] **Step 1: devise.rbに remember_for と extend_remember_period を追加**

`config.expire_all_remember_me_on_sign_out = true`（29行目）の直後に以下を追加:

```ruby
  # ログイン保持期間（remember meトークンの有効期限）
  config.remember_for = 90.days

  # アクセスのたびにremember meの有効期限を延長する
  # （アクティブユーザーは実質ログアウト不要になる）
  config.extend_remember_period = true
```

- [ ] **Step 2: コミット**

```bash
git add backend/config/initializers/devise.rb
git commit -m "feat: Deviseのremember_for（90日）とextend_remember_periodを設定"
```

---

### Task 2: Session Cookie設定の修正（Issue #49 バグ修正）

**Files:**
- Modify: `backend/config/application.rb:46`

- [ ] **Step 1: CookieStoreにsame_siteとsecureを追加**

46行目を以下に変更:

変更前:
```ruby
    config.middleware.use ActionDispatch::Session::CookieStore, key: "_recolly_session"
```

変更後:
```ruby
    config.middleware.use ActionDispatch::Session::CookieStore,
                         key: "_recolly_session",
                         same_site: :lax,
                         secure: Rails.env.production?
```

- [ ] **Step 2: コミット**

```bash
git add backend/config/application.rb
git commit -m "fix: Session Cookieにsame_siteとsecure属性を明示化（Issue #49）"
```

---

### Task 3: FRONTEND_URL環境変数の設定（Issue #49 バグ修正）

**Files:**
- Modify: `.env.example`
- Modify: `docker-compose.yml:43-44`

- [ ] **Step 1: .env.exampleにFRONTEND_URLを追加**

ファイル末尾に以下を追加:

```
# === フロントエンド ===
FRONTEND_URL=http://localhost:5173
```

- [ ] **Step 2: docker-compose.ymlのbackendサービスにFRONTEND_URLを追加**

`docker-compose.yml` の backend の environment セクション（41-45行目）に `FRONTEND_URL` を追加:

変更前:
```yaml
    environment:
      DB_HOST: db
      DB_USERNAME: postgres
      DB_PASSWORD: password
      RAILS_ENV: development
      REDIS_URL: redis://redis:6379/0
```

変更後:
```yaml
    environment:
      DB_HOST: db
      DB_USERNAME: postgres
      DB_PASSWORD: password
      RAILS_ENV: development
      REDIS_URL: redis://redis:6379/0
      FRONTEND_URL: http://localhost:5173
```

- [ ] **Step 3: コミット**

```bash
git add .env.example docker-compose.yml
git commit -m "fix: FRONTEND_URL環境変数を追加（Issue #49）"
```

---

### Task 4: SessionsControllerにremember_meを追加 + テスト

**Files:**
- Modify: `backend/app/controllers/api/v1/sessions_controller.rb:11`
- Modify: `backend/spec/requests/api/v1/sessions_spec.rb`

- [ ] **Step 1: sessions_spec.rbにremember_me Cookieのテストを追加**

`describe 'POST /api/v1/login（ログイン）'` の正常系コンテキスト内（33行目の `end` の前）に以下を追加:

```ruby
      it 'remember_me Cookieがセットされる' do
        post user_session_path,
             params: { user: { email: 'test@example.com', password: 'password123' } },
             as: :json
        expect(response.headers['Set-Cookie']).to match(/remember_user_token/)
      end
```

`describe 'DELETE /api/v1/logout（ログアウト）'` の正常系コンテキスト内（73行目の `end` の前）に以下を追加:

```ruby
      it 'ログアウト後にremember_me Cookieが削除される' do
        # ログインしてremember_meを設定
        post user_session_path,
             params: { user: { email: 'test@example.com', password: 'password123' } },
             as: :json
        # ログアウト
        delete destroy_user_session_path, as: :json
        expect(response.headers['Set-Cookie']).to match(/remember_user_token=;/)
      end
```

- [ ] **Step 2: テストを実行して失敗を確認**

```bash
docker compose exec backend bundle exec rspec spec/requests/api/v1/sessions_spec.rb --format documentation
```

期待: 「remember_me Cookieがセットされる」が FAIL（まだ `remember_me(resource)` を呼んでいないため）

- [ ] **Step 3: sessions_controller.rbにremember_meを追加**

`sign_in(resource_name, resource)`（11行目）の後に `remember_me(resource)` を追加:

変更前:
```ruby
      def create
        self.resource = warden.authenticate!(auth_options)
        sign_in(resource_name, resource)
        render json: { user: user_json(resource) }, status: :ok
      end
```

変更後:
```ruby
      def create
        self.resource = warden.authenticate!(auth_options)
        sign_in(resource_name, resource)
        remember_me(resource)
        render json: { user: user_json(resource) }, status: :ok
      end
```

- [ ] **Step 4: テストを実行して成功を確認**

```bash
docker compose exec backend bundle exec rspec spec/requests/api/v1/sessions_spec.rb --format documentation
```

期待: 全テスト PASS

- [ ] **Step 5: コミット**

```bash
git add backend/app/controllers/api/v1/sessions_controller.rb backend/spec/requests/api/v1/sessions_spec.rb
git commit -m "feat: メール/パスワードログインでremember_meを常に有効化"
```

---

### Task 5: OmniauthCallbacksControllerにremember_meを追加 + テスト

**Files:**
- Modify: `backend/app/controllers/api/v1/omniauth_callbacks_controller.rb:38`
- Modify: `backend/spec/requests/api/v1/omniauth_callbacks_spec.rb`

- [ ] **Step 1: omniauth_callbacks_spec.rbにremember_me Cookieのテストを追加**

`context '既存ユーザー（UserProvider一致）'` のコンテキスト内（28行目の `end` の前）に以下を追加:

```ruby
      it 'remember_me Cookieがセットされる' do
        get '/api/v1/auth/google_oauth2/callback'
        expect(response.headers['Set-Cookie']).to match(/remember_user_token/)
      end
```

- [ ] **Step 2: テストを実行して失敗を確認**

```bash
docker compose exec backend bundle exec rspec spec/requests/api/v1/omniauth_callbacks_spec.rb --format documentation
```

期待: 「remember_me Cookieがセットされる」が FAIL

- [ ] **Step 3: omniauth_callbacks_controller.rbの既存ユーザーログインにremember_meを追加**

`handle_service_result` メソッドの `:existing_user` ケースを変更:

変更前:
```ruby
        when :existing_user
          sign_in(result[:user])
          redirect_to_frontend(status: 'success')
```

変更後:
```ruby
        when :existing_user
          sign_in(result[:user])
          remember_me(result[:user])
          redirect_to_frontend(status: 'success')
```

- [ ] **Step 4: テストを実行して成功を確認**

```bash
docker compose exec backend bundle exec rspec spec/requests/api/v1/omniauth_callbacks_spec.rb --format documentation
```

期待: 全テスト PASS

- [ ] **Step 5: コミット**

```bash
git add backend/app/controllers/api/v1/omniauth_callbacks_controller.rb backend/spec/requests/api/v1/omniauth_callbacks_spec.rb
git commit -m "feat: Google OAuthログインでremember_meを常に有効化"
```

---

### Task 6: OauthRegistrationsControllerにremember_meを追加 + テスト

**Files:**
- Modify: `backend/app/controllers/api/v1/oauth_registrations_controller.rb:12`
- Modify: `backend/spec/requests/api/v1/oauth_registrations_spec.rb`

- [ ] **Step 1: oauth_registrations_spec.rbにremember_me Cookieのテストを追加**

`context '有効なセッションデータがある場合'` のコンテキスト内（27行目の `end` の前）に以下を追加:

```ruby
      it 'remember_me Cookieがセットされる' do
        post '/api/v1/auth/complete_registration',
             params: { username: 'newuser' },
             as: :json
        expect(response.headers['Set-Cookie']).to match(/remember_user_token/)
      end
```

- [ ] **Step 2: テストを実行して失敗を確認**

```bash
docker compose exec backend bundle exec rspec spec/requests/api/v1/oauth_registrations_spec.rb --format documentation
```

期待: 「remember_me Cookieがセットされる」が FAIL

- [ ] **Step 3: oauth_registrations_controller.rbにremember_meを追加**

`sign_in(user)`（12行目）の後に `remember_me(user)` を追加:

変更前:
```ruby
        sign_in(user)
        render json: { user: user_json(user.reload) }, status: :created
```

変更後:
```ruby
        sign_in(user)
        remember_me(user)
        render json: { user: user_json(user.reload) }, status: :created
```

- [ ] **Step 4: テストを実行して成功を確認**

```bash
docker compose exec backend bundle exec rspec spec/requests/api/v1/oauth_registrations_spec.rb --format documentation
```

期待: 全テスト PASS

- [ ] **Step 5: コミット**

```bash
git add backend/app/controllers/api/v1/oauth_registrations_controller.rb backend/spec/requests/api/v1/oauth_registrations_spec.rb
git commit -m "feat: OAuth新規登録完了時にremember_meを常に有効化"
```

---

### Task 7: 全テスト実行 + 最終確認

**Files:** なし（テスト実行のみ）

- [ ] **Step 1: バックエンドの全テストを実行**

```bash
docker compose exec backend bundle exec rspec --format documentation
```

期待: 全テスト PASS

- [ ] **Step 2: RuboCopを実行**

```bash
docker compose exec backend bundle exec rubocop
```

期待: 違反なし

- [ ] **Step 3: 問題があれば修正してコミット**

テストやRuboCopで問題が出た場合のみ、修正してコミット。
