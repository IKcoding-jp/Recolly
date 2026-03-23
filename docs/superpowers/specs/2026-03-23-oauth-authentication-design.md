# OAuth認証設計仕様書

## 概要

Recollyにフェーズ1.5としてOAuth認証を追加する。Google OAuth、X (Twitter) OAuthの2プロバイダに対応し、ログイン/サインアップ、設定画面でのOAuth連携管理、パスワード設定機能を実装する。

**関連ADR:** ADR-0013（OAuth認証にOmniAuth + サーバーサイドフローを採用）

## スコープ

- Google OAuth / X (Twitter) OAuthでのログイン・サインアップ
- 設定画面でのOAuth連携追加・解除
- OAuth専用ユーザーのパスワード設定
- メールアドレス未設定ユーザーへの設定促進（初回専用画面 + バナー）
- OAuth新規登録時のユーザー名入力画面

## スコープ外

- モバイルアプリ対応（JWT）
- MFA（多要素認証）
- OAuth以外のソーシャルログイン（GitHub, Discord等）

---

## 1. データベース設計

### 1.1 UserProvidersテーブル（新規作成）

| カラム | 型 | 説明 |
|--------|-----|------|
| id | bigint (PK) | |
| user_id | bigint (FK → users) | NOT NULL |
| provider | string | `google_oauth2` / `twitter2`（NOT NULL。OmniAuthのプロバイダ名に合わせる） |
| provider_uid | string | OAuthプロバイダのユーザーID（NOT NULL） |
| created_at | datetime | |
| updated_at | datetime | |

**インデックス・制約:**
- ユニーク制約: `(provider, provider_uid)` — プロバイダ内で同一UIDは1つだけ
- ユニーク制約: `(user_id, provider)` — 1ユーザーにつき同一プロバイダは1つまで
- 外部キー: `user_id → users.id`

**表示名マッピング:** UIでは `google_oauth2` → 「Google」、`twitter2` → 「X」と表示する。マッピングはフロントエンド・バックエンド双方で定数として定義する。

### 1.2 Usersテーブルの変更

- `encrypted_password`: NOT NULL制約維持（空文字列 `""` がデフォルト）。deviseの `password_required?` メソッドをオーバーライドし、UserProviderがある場合は `false` を返してパスワードなしを許可（注: 親仕様書では `password_digest` と記載されているが、deviseの標準カラム名は `encrypted_password`。同義）
- `email`: NOT NULL制約維持（空文字列 `""` がデフォルト）。Xでメール未取得の場合は空文字列。deviseの `email_required?` メソッドをオーバーライドし、UserProviderがありメールなしの場合は `false` を返す
- `email`のユニークインデックス: 条件付きユニークインデックスに変更 — 空文字列の重複を許可

**マイグレーション手順:**
1. `remove_index :users, :email`（既存の無条件ユニークインデックスを削除）
2. `add_index :users, :email, unique: true, where: "email != ''"` （条件付きユニークインデックスを追加）

---

## 2. バックエンドアーキテクチャ

### 2.1 追加gem

```ruby
gem 'omniauth'                        # OAuthの共通フレームワーク
gem 'omniauth-google-oauth2'          # Google OAuth 2.0
gem 'omniauth-twitter2'               # X (Twitter) OAuth 2.0
gem 'omniauth-rails_csrf_protection'  # CSRF対策（OmniAuth 2.0必須）
```

### 2.2 Userモデルの変更

```ruby
# app/models/user.rb
devise :database_authenticatable, :registerable,
       :recoverable, :rememberable, :validatable,
       :omniauthable, omniauth_providers: [:google_oauth2, :twitter2]

has_many :user_providers, dependent: :destroy
```

### 2.3 OmniAuthプロバイダ初期化設定

```ruby
# config/initializers/devise.rb に追加
config.omniauth :google_oauth2,
                ENV['GOOGLE_CLIENT_ID'],
                ENV['GOOGLE_CLIENT_SECRET'],
                scope: 'email,profile'

config.omniauth :twitter2,
                ENV['X_CLIENT_ID'],
                ENV['X_CLIENT_SECRET'],
                scope: 'tweet.read users.read'
```

### 2.4 OAuthフロー（サーバーサイド）

```
[ブラウザ] 「Googleでログイン」クリック
    ↓
[ブラウザ] POST /api/v1/auth/google_oauth2（CSRFトークン付きHTMLフォーム）
    ↓
[Rails/OmniAuth] → Googleのログイン画面にリダイレクト
    ↓
[Google] ユーザーがログイン＆許可
    ↓
[Google] → GET /api/v1/auth/google_oauth2/callback に認可コードを付けてリダイレクト
    ↓
[Rails] OmniauthCallbacksController
    ├─ provider + uid でUserProviderを検索
    ├─ 見つかった → 既存ユーザーでセッション作成 → フロントにリダイレクト
    ├─ 見つからない → メール衝突チェック
    │   ├─ 衝突あり → エラーメッセージ付きでフロントにリダイレクト
    │   └─ 衝突なし → ユーザー名入力画面にリダイレクト（仮データをセッションに保持）
```

OmniauthCallbacksControllerではdeviseの `navigational_formats` に依存せず、明示的に `redirect_to` でフロントエンドURLにリダイレクトする（既存設定 `config.navigational_formats = []` との衝突を回避）。

### 2.5 コントローラー構成

| コントローラー | 責務 |
|-------------|------|
| `Api::V1::OmniauthCallbacksController` | OAuthコールバック処理（Google/X共通ロジック + プロバイダ別メソッド） |
| `Api::V1::OauthRegistrationsController` | OAuth新規登録の完了（ユーザー名入力後のアカウント作成） |
| `Api::V1::AccountSettingsController` | OAuth連携追加・解除、パスワード設定。200行を超える場合は `ProviderLinksController` と `PasswordSettingsController` に分割する |

### 2.6 サービスオブジェクト

| サービス | 責務 |
|---------|------|
| `Oauth::FindOrCreateUserService` | OAuthデータからユーザー検索/作成のコアロジック |
| `Oauth::EmailConflictChecker` | メール衝突チェック（セクション3 / 親仕様書セクション5.3のルール実装） |

### 2.7 ルーティング

既存の `devise_for` ブロックに `omniauth_callbacks` を追加する形で統合:

```ruby
# 既存のdevise設定にomniauth_callbacksを追加
devise_for :users,
           path: "api/v1",
           path_names: { sign_in: "login", sign_out: "logout", registration: "signup" },
           controllers: {
             sessions: "api/v1/sessions",
             registrations: "api/v1/registrations",
             passwords: "api/v1/passwords",
             omniauth_callbacks: "api/v1/omniauth_callbacks"
           }

# OAuth新規登録完了
namespace :api do
  namespace :v1 do
    post 'auth/complete_registration', to: 'oauth_registrations#create'

    # 設定画面用
    resource :account_settings, only: [] do
      post :link_provider       # 201 Created
      delete :unlink_provider   # 200 OK
      put :set_password         # 200 OK
    end
  end
end
```

### 2.8 APIレスポンスステータスコード

| エンドポイント | メソッド | 成功時ステータス |
|-------------|--------|----------------|
| `auth/complete_registration` | POST | 201 Created |
| `account_settings/link_provider` | POST | 201 Created |
| `account_settings/unlink_provider` | DELETE | 200 OK |
| `account_settings/set_password` | PUT | 200 OK |
| `csrf_token` | GET | 200 OK |

### 2.9 フロントへのリダイレクト

OAuthコールバック後、Railsはフロントエンドにリダイレクトする。結果はクエリパラメータで渡す:

- 成功時: `FRONTEND_URL/auth/callback?status=success`
- 新規登録: `FRONTEND_URL/auth/callback?status=new_user`（セッションに仮データ保持済み）
- エラー時: `FRONTEND_URL/auth/callback?status=error&message={コード}&provider={プロバイダ名}`

### 2.10 User JSON表現の拡張

バックエンドのuser_jsonメソッドにOAuth関連情報を追加:

```ruby
def user_json(user)
  user.as_json(only: %i[id username email avatar_url bio created_at]).merge(
    has_password: user.encrypted_password.present?,
    providers: user.user_providers.pluck(:provider),
    email_missing: user.email.blank?
  )
end
```

---

## 3. メール衝突ルール（親仕様書セクション5.3準拠）

### 3.1 判定フロー

```
OAuthコールバックでメールアドレスを取得
    ↓
メールアドレスあり？
    ├─ なし（Xでメール未取得）→ 衝突なし、メールなしでアカウント作成
    └─ あり ↓

同じメールのユーザーが存在する？
    ├─ なし → 衝突なし、新規アカウント作成
    └─ あり ↓

そのユーザーに同じプロバイダのUserProviderがある？
    ├─ あり → 既存ユーザーでログイン（正常フロー）
    └─ なし → エラーを返す
```

### 3.2 エラーメッセージ

- メール登録ユーザーの場合: 「このメールアドレスは既に登録されています。メールアドレスでログインしてください」
- 別のOAuth登録ユーザーの場合: 「このメールアドレスは既に{provider表示名}で登録されています」

### 3.3 設定画面からの連携追加時

ログイン済みユーザーがOAuth連携を追加する場合は、メール衝突チェックをスキップする（自身のアカウントへの紐づけのため）。

### 3.4 メールアドレス後設定時の重複チェック

OAuth専用ユーザーがメールアドレスを後から設定する際、そのメールアドレスが既に別ユーザーに使われている場合はエラーを返す: 「このメールアドレスは既に使用されています」

---

## 4. フロントエンド設計

### 4.1 新規ページ/コンポーネント

| ページ/コンポーネント | パス | 役割 |
|---------------------|------|------|
| `AuthCallbackPage` | `/auth/callback` | OAuthコールバック受信。クエリパラメータに応じてルーティング |
| `OauthUsernamePage` | `/auth/complete` | OAuth新規登録時のユーザー名入力画面 |
| `EmailPromptPage` | `/auth/email-setup` | メールアドレス未設定ユーザーへの設定画面（初回） |
| `EmailPromptBanner` | （コンポーネント） | メール未設定ユーザーへのバナー（ダッシュボード等に表示） |
| `AccountSettingsPage` | `/settings` | OAuth連携管理・パスワード設定 |

### 4.2 既存ページの変更

| ページ | 変更内容 |
|--------|---------|
| `LoginPage` | メールフォームの下にOAuthボタン追加（区切り線「または」+ OAuthボタン） |
| `SignUpPage` | 同様にOAuthボタン追加 |
| `AuthContext` | OAuth新規登録完了API・設定画面APIの追加。メール未設定フラグの管理 |

### 4.3 OAuthボタン配置

ログイン・サインアップ画面ともに:
1. メール+パスワードフォーム（上）
2. 区切り線「または」
3. 「Googleでログイン」「Xでログイン」ボタン（下）

### 4.4 AuthCallbackPageのフロー

```
/auth/callback にリダイレクト到着
    ├─ status=success → getCurrentUser() → /dashboard
    ├─ status=new_user → /auth/complete（ユーザー名入力）
    └─ status=error → /（ログインページ）+ エラートースト表示
```

### 4.5 OauthUsernamePageのフロー

```
ユーザー名入力 → POST /api/v1/auth/complete_registration
    ├─ 成功 → メール未設定？
    │   ├─ はい → /auth/email-setup
    │   └─ いいえ → /dashboard
    └─ 失敗 → エラー表示
```

### 4.6 AccountSettingsPage（設定画面）

| セクション | 機能 |
|-----------|------|
| ログイン方法 | 現在の連携状況表示（メール+パスワード / Google / X） |
| OAuth連携 | 未連携プロバイダの「連携する」ボタン / 連携済みプロバイダの「解除」ボタン |
| パスワード設定 | 未設定時は「パスワードを設定」、設定済み時は「パスワードを変更」 |
| 解除制限 | 最後のログイン手段の場合は解除ボタンを無効化 + 理由を表示 |

### 4.7 フロントエンド型定義の拡張

```typescript
interface User {
  id: number
  username: string
  email: string
  avatar_url: string | null
  bio: string | null
  created_at: string
  has_password: boolean      // パスワード設定済みか
  providers: string[]        // 連携済みOAuthプロバイダ名のリスト
  email_missing: boolean     // メールアドレス未設定か
}
```

---

## 5. セキュリティ

### 5.1 CSRF対策

- OmniAuth 2.0以降、OAuthリクエストの起点はPOSTが必須（`omniauth-rails_csrf_protection` が強制）
- フロントエンドからのOAuth開始はHTMLフォームのPOSTで送信（fetchではなくフォーム送信）

**Rails APIモードでのCSRF対応:**

現在のRailsは `ActionController::API` を継承しておりCSRF機構を持たない。OmniAuthのPOST要件に対応するため:
- `ApplicationController` に `ActionController::RequestForgeryProtection` を `include`
- デフォルトでは `protect_from_forgery with: :null_session`（既存のAPIエンドポイントに影響を与えない）
- CSRFトークン取得用エンドポイント `GET /api/v1/csrf_token` を追加し、`form_authenticity_token` を返す
- フロントエンドがページロード時にCSRFトークンを取得し、OAuthフォームのhiddenフィールドにセット

### 5.2 OAuthステートパラメータ

OmniAuthが自動でstateパラメータを生成・検証。CSRF攻撃・リプレイ攻撃を防止。

### 5.3 コールバックURLのホワイトリスト

各OAuthプロバイダの管理画面で許可するコールバックURLを厳密に設定:
- 開発: `http://localhost:3000/api/v1/auth/google_oauth2/callback`、`http://localhost:3000/api/v1/auth/twitter2/callback`
- 本番: `https://{本番ドメイン}/api/v1/auth/google_oauth2/callback`、`https://{本番ドメイン}/api/v1/auth/twitter2/callback`

### 5.4 仮登録データの保護

OAuth新規登録時のOAuthプロバイダ情報はRailsセッションに保存:
- Cookie Storeで暗号化
- 仮データにタイムスタンプを含め、コントローラー側で15分超過を検知して無効化:
```ruby
session[:oauth_data] = {
  provider: ..., uid: ..., email: ..., name: ...,
  expires_at: 15.minutes.from_now.to_i
}
```
- 期限切れ時はセッションデータを削除し「認証の有効期限が切れました。もう一度お試しください」と案内

---

## 6. テスト戦略

TDD（テスト駆動開発）で実装する。

### 6.1 バックエンド（RSpec）

| テスト対象 | テスト内容 |
|-----------|-----------|
| `OmniauthCallbacksController` | Google/Xコールバックの正常系、メール衝突時のエラー、メールなしアカウント作成 |
| `OauthRegistrationsController` | ユーザー名入力後のアカウント作成（201）、バリデーションエラー、セッション期限切れ |
| `AccountSettingsController` | OAuth連携追加（201）・解除、最後のログイン手段の解除禁止、パスワード設定 |
| `Oauth::FindOrCreateUserService` | 新規作成、既存ユーザーログイン、各メール衝突パターン |
| `Oauth::EmailConflictChecker` | セクション3の全パターン網羅 |
| `UserProvider` モデル | バリデーション、ユニーク制約 |
| `User` モデル | OAuth専用ユーザーのパスワードなし許可、メールなし許可 |

OmniAuth標準のテストモード（`OmniAuth.config.test_mode = true`）を使用し、実際のOAuthプロバイダへのリクエストをモック化する。

### 6.2 フロントエンド（Vitest + React Testing Library）

| テスト対象 | テスト内容 |
|-----------|-----------|
| `LoginPage` | OAuthボタンの表示、フォーム送信 |
| `SignUpPage` | OAuthボタンの表示 |
| `AuthCallbackPage` | 各ステータス（success/new_user/error）のルーティング |
| `OauthUsernamePage` | ユーザー名入力・送信・バリデーションエラー |
| `EmailPromptPage` | メール設定フォーム、メール重複エラー |
| `EmailPromptBanner` | バナー表示・非表示の条件 |
| `AccountSettingsPage` | 連携状況表示、連携・解除、パスワード設定、解除制限 |

---

## 7. OAuthプロバイダ設定手順

### 7.1 Google Cloud Console

1. Google Cloud Console（https://console.cloud.google.com）にアクセス
2. プロジェクトを選択（または新規作成）
3. 「APIとサービス」→「認証情報」→「認証情報を作成」→「OAuth クライアント ID」
4. アプリケーションの種類: 「ウェブ アプリケーション」
5. 承認済みリダイレクトURI:
   - 開発: `http://localhost:3000/api/v1/auth/google_oauth2/callback`
   - 本番: `https://{本番ドメイン}/api/v1/auth/google_oauth2/callback`
6. クライアントIDとクライアントシークレットを取得
7. 「OAuth同意画面」でアプリ情報（名前、ロゴ、スコープ）を設定
8. スコープ: `email`, `profile`（基本情報のみ）

### 7.2 X (Twitter) Developer Portal

1. X Developer Portal（https://developer.x.com）にアクセス
2. プロジェクト・アプリを作成（またはFreeプランで既存アプリを使用）
3. 「User authentication settings」→「Set up」
4. OAuth 2.0を有効化
5. Type of App: 「Web App, Automated App or Bot」
6. コールバックURL:
   - 開発: `http://localhost:3000/api/v1/auth/twitter2/callback`
   - 本番: `https://{本番ドメイン}/api/v1/auth/twitter2/callback`
7. クライアントIDとクライアントシークレットを取得
8. スコープ: `tweet.read`, `users.read`（基本情報のみ）

**注意:** X OAuth 2.0ではメールアドレスは基本的に取得できない（Elevated accessが必要）。本プロジェクトではXからのメール未取得を前提とし、メールなしでのアカウント作成を許可する。

### 7.3 環境変数

```bash
# Google OAuth
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx

# X (Twitter) OAuth
X_CLIENT_ID=xxx
X_CLIENT_SECRET=xxx

# フロントエンドURL（OAuthコールバック後のリダイレクト先）
FRONTEND_URL=http://localhost:5173
```

開発環境: `.env` ファイル（Dockerから読み込み）
本番環境: AWS SSM Parameter Store
