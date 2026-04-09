# 設計仕様書: Google認証をGoogle Identity Servicesに移行

## 背景と目的

2026年4月、本番環境でAndroidのPWAスタンドアロンモードからGoogleログインすると白画面になり進めない不具合が報告された（ADR-0035参照）。原因はOmniAuthのサーバーサイドリダイレクトフローがPWAと相性が悪く、外部ブラウザに認証処理が移管されてCookieがPWAに戻らないことにある。

本仕様書では、**OmniAuthを廃止してGoogle Identity Services（GIS）+ ID Token検証方式に移行する**設計を定める。

### 解決する問題

1. **PWAでのGoogleログイン白画面不具合を根本的に解消する**
2. 将来性のあるモダンな認証方式（FedCM対応）に移行する

### 目的外（Out of Scope）

- メール/パスワードログインのフロー変更（既存のまま維持）
- UIデザインの大幅変更（Googleボタンは公式のg_id_signinデザインに準拠する）
- 既存ユーザーのデータマイグレーション（既存DBスキーマをそのまま使用）
- remember_meの期間変更（既存の90日を維持）

---

## 現状のアーキテクチャ（Before）

### データモデル

```
user_providers テーブル
├── id
├── user_id         (belongs_to User)
├── provider        (string, 例: "google_oauth2")
├── provider_uid    (string, Googleの sub を保存)
├── created_at
└── updated_at

ユニーク制約:
- (provider, provider_uid)
- (user_id, provider)
```

### ログインフロー（OmniAuth版）

```
[Browser/PWA]
  └─ <form method="post" action="/api/v1/auth/google_oauth2">
     └─ [Rails] OmniAuth initializer → 302 redirect
        └─ [accounts.google.com] ユーザー認証
           └─ [Rails] /api/v1/auth/google_oauth2/callback
              ├─ OmniauthCallbacksController#google_oauth2
              ├─ FindOrCreateUserService で既存/新規判定
              ├─ sign_in + remember_me + Set-Cookie
              └─ 302 redirect to /auth/callback?status=success
                 └─ [Browser] AuthCallbackPage → navigate /dashboard
```

**問題:** `accounts.google.com` への遷移でPWAが外部ブラウザに移管される。

---

## 新しいアーキテクチャ（After）

### データモデル

**変更なし。** `user_providers` テーブルをそのまま使用する。`provider` 値は `"google_oauth2"` を継続使用し、`provider_uid` にもGoogleの `sub` を保存する（これまでと同じ）。

### ログインフロー（GIS版）

```
[Browser/PWA]
  ├─ <script src="https://accounts.google.com/gsi/client">
  ├─ GIS SDK初期化（client_id設定）
  └─ <div id="g_id_signin"> がGoogle公式ボタンを自動描画
     └─ ユーザーがタップ
        └─ Google側でポップアップ認証（FedCMまたは従来方式）
           └─ JavaScript callback: credential（ID Token JWT文字列）
              └─ [Frontend] POST /api/v1/auth/google_id_token
                 { credential: "eyJhbGciOi..." }
                 └─ [Rails] GoogleIdTokenSessionsController#create
                    ├─ googleauth gem で署名検証
                    │   ├─ 署名（Googleの公開鍵）
                    │   ├─ audience (client_id一致)
                    │   ├─ issuer (accounts.google.com)
                    │   └─ 有効期限
                    ├─ 検証済みpayloadから sub, email, name を抽出
                    ├─ FindOrCreateUserService（再利用）で既存/新規判定
                    ├─ 既存ユーザー: sign_in + remember_me
                    └─ レスポンス返却（JSON）
                       └─ [Frontend] setUser + navigate /dashboard
```

**ポイント:** 全ての通信がPWA内で完結する。外部ブラウザへの遷移が一切発生しない。

---

## API契約

### 新エンドポイント1: Googleログイン

```
POST /api/v1/auth/google_id_token
Content-Type: application/json

Request Body:
{
  "credential": "eyJhbGciOiJSUzI1NiIs..."  (Google ID Token, JWT形式)
}

Response (成功・既存ユーザー): 200 OK
{
  "status": "success",
  "user": {
    "id": 1,
    "username": "...",
    "email": "user@example.com",
    ...
  }
}
Set-Cookie: _recolly_session=...; remember_user_token=...

Response (新規ユーザー・ユーザー名入力待ち): 200 OK
{
  "status": "new_user"
}
Set-Cookie: _recolly_session=...  (oauth_dataがsessionに格納される)

Response (メール衝突): 409 Conflict
{
  "status": "error",
  "code": "email_already_registered" | "email_registered_with_other_provider",
  "message": "..."
}

Response (ID Token検証失敗): 401 Unauthorized
{
  "error": "認証に失敗しました"
}
```

### 新エンドポイント2: OAuth連携追加（ログイン済みユーザー用）

```
POST /api/v1/account_settings/link_provider
Content-Type: application/json
Cookie: _recolly_session=...

Request Body:
{
  "credential": "eyJhbGciOiJSUzI1NiIs..."
}

Response (成功): 200 OK
{
  "user": {
    ...
    "providers": ["google_oauth2"]
  }
}

Response (既に連携済み): 422 Unprocessable Content
{
  "error": "このプロバイダは既に連携済みです"
}

Response (認証エラー): 401 Unauthorized
{
  "error": "ログインが必要です"
}
```

### 既存エンドポイントの変更

**変更なし:**
- `POST /api/v1/auth/complete_registration`（新規ユーザー名登録）はそのまま動作する（session[:oauth_data]を読む仕組み維持）
- `DELETE /api/v1/account_settings/unlink_provider` 変更なし

**削除:**
- `GET /api/v1/auth/google_oauth2` （Devise omniauth_authorizable経由）
- `GET /api/v1/auth/google_oauth2/callback` （Devise omniauth_callbacks経由）

---

## バックエンド設計

### 新規ファイル

#### 1. `backend/app/controllers/api/v1/google_id_token_sessions_controller.rb`

GIS ID Tokenを受け取ってログイン処理を行うコントローラー。

**責務:**
- リクエストボディから `credential` を取得
- `GoogleIdTokenVerifier` で検証
- `FindOrCreateUserService` で既存/新規判定
- ケース別のレスポンス返却

**主要メソッド:** `create`

#### 2. `backend/app/services/google_id_token_verifier.rb`

`googleauth` gem をラップしてID Tokenを検証するサービス。

**責務:**
- `Google::Auth::IDTokens.verify_oidc` を使って検証
- 検証失敗時は例外（`Google::Auth::IDTokens::VerificationError`）
- 検証成功時は `{ sub:, email:, name: }` の形式で返す

**主要メソッド:** `#call`

**環境変数:** `GOOGLE_CLIENT_ID` を audience として使用する（既存のOmniAuth設定で使用していたものを流用）

### 変更ファイル

#### `backend/Gemfile`

```ruby
# 削除
gem 'omniauth'
gem 'omniauth-google-oauth2'
gem 'omniauth-rails_csrf_protection'

# 追加
gem 'googleauth'
```

#### `backend/config/routes.rb`

```ruby
# 削除:
#   controllers: { omniauth_callbacks: "api/v1/omniauth_callbacks" }

# 追加:
namespace :api do
  namespace :v1 do
    post 'auth/google_id_token', to: 'google_id_token_sessions#create'
    # ...
  end
end
```

#### `backend/app/models/user.rb`

- `:omniauthable` モジュールを削除
- `omniauth_providers: [:google_oauth2]` 設定を削除

#### `backend/config/initializers/devise.rb`

- OmniAuth関連の設定を削除

#### `backend/app/controllers/api/v1/account_settings_controller.rb`

- `link_provider` アクションを新規追加（GIS ID Token経由でUserProviderを作成）

#### `backend/app/services/oauth/find_or_create_user_service.rb`

- 引数を `auth_data`（OmniAuth形式）から汎用の `{ provider:, uid:, email:, name: }` Hashに変更
- ロジック自体は変更なし

### 削除ファイル

- `backend/app/controllers/api/v1/omniauth_callbacks_controller.rb`
- `backend/config/initializers/omniauth.rb`（存在する場合）
- `backend/spec/requests/api/v1/omniauth_callbacks_spec.rb`

---

## フロントエンド設計

### 環境変数

- `VITE_GOOGLE_CLIENT_ID`: GoogleのOAuthクライアントID（公開情報なのでフロントエンドに埋め込み可）
  - ローカル: `.env.local` または `.env.development`
  - 本番: CloudFront配信時のビルド環境変数

### 新規/変更ファイル

#### `frontend/index.html`

GIS SDKの `<script>` タグを追加（非同期読み込み）：

```html
<script src="https://accounts.google.com/gsi/client" async defer></script>
```

#### `frontend/src/components/OAuthButtons/OAuthButtons.tsx`

全面書き換え。主な責務：

1. `window.google?.accounts.id` が利用可能になるのを待つ
2. `google.accounts.id.initialize({ client_id, callback })` を呼ぶ
3. コンテナ `<div>` にGoogle公式ボタンを描画（`google.accounts.id.renderButton`）
4. コールバックで受け取った `credential` を `/api/v1/auth/google_id_token` にPOST
5. レスポンスの `status` に応じて分岐:
   - `success` → setUser + navigate('/dashboard')
   - `new_user` → navigate('/auth/complete')
   - `error` → setError表示

**リンク連携モードもプロパティで切替:**
- `mode="sign_in"` → /api/v1/auth/google_id_token
- `mode="link"` → /api/v1/account_settings/link_provider

#### `frontend/src/lib/api.ts`

新規APIクライアントを追加：

```ts
export const googleAuthApi = {
  signIn(credential: string): Promise<GoogleAuthResponse> {
    return request<GoogleAuthResponse>('/auth/google_id_token', {
      method: 'POST',
      body: JSON.stringify({ credential }),
    })
  },
  linkProvider(credential: string): Promise<AuthResponse> {
    return request<AuthResponse>('/account_settings/link_provider', {
      method: 'POST',
      body: JSON.stringify({ credential }),
    })
  },
}
```

#### `frontend/src/pages/AuthCallbackPage/AuthCallbackPage.tsx`

役割が大きく縮小する。以下のどちらかを選ぶ（実装時に決定）：

- **選択肢1:** ページごと削除し、`/auth/callback` ルートも削除する
- **選択肢2:** ページを残すが、単純なリダイレクト画面にする

**推奨:** 選択肢1（ルートごと削除）。理由: GISではリダイレクト先として `/auth/callback` を使わないため、役割がない

#### `frontend/src/pages/AccountSettingsPage/AccountSettingsPage.tsx`

- OAuth連携追加の部分をGIS ボタンを使う形に変更
- `googleAuthApi.linkProvider` を呼び出す

#### `frontend/src/pages/OauthUsernamePage/OauthUsernamePage.tsx`

- 変更は最小限。既存のユーザー名入力→`/auth/complete_registration` POST フローは変えない

---

## エラー処理・エッジケース

### ID Token検証エラー

| 状況 | バックエンド応答 | フロントエンド挙動 |
|------|--------------|----------------|
| JWT形式不正 | 401 | 「認証に失敗しました」表示 |
| 署名不正 | 401 | 同上 |
| audience不一致 | 401 | 同上 |
| issuer不正 | 401 | 同上 |
| 有効期限切れ | 401 | 同上 |

### ユーザー判定ロジック

| 条件 | 結果 |
|------|------|
| UserProvider が google_oauth2 + sub で見つかる | 既存ユーザーとしてログイン |
| メール衝突（同じメールで別provider登録済み） | `email_registered_with_other_provider` エラー |
| メール衝突（同じメールでパスワード登録済み） | `email_already_registered` エラー |
| 上記に該当しない | 新規ユーザー登録フローへ |

### セッション管理

- GIS側にはログアウトAPIがない（Google側セッションは触らない）
- Recollyのログアウトは既存の `DELETE /api/v1/logout` をそのまま使用
- ログアウト後は `_recolly_session` と `remember_user_token` がクリアされる

### CSRF対策

ID Tokenは署名付きで改ざん不能なので、ID Token自体がトークン役を兼ねる。別途CSRFトークンは不要。ただし：

- `POST /api/v1/auth/google_id_token` はDeviseのCSRF検証対象外にする（ログイン前なのでsessionにCSRFトークンがない）
- `POST /api/v1/account_settings/link_provider` はログイン後なので通常のCSRF保護を適用する

---

## 移行戦略

### 既存ユーザーへの影響

**シームレス移行。**

- `UserProvider.provider_uid` にはOmniAuth経由で保存されたGoogleの `sub` が既に入っている
- GIS経由で受け取るID Tokenの `sub` も同じ値
- クエリ `UserProvider.find_by(provider: 'google_oauth2', provider_uid: sub)` で既存レコードがヒットする
- データマイグレーション不要

### ロールアウト順序

1. ローカル環境で新フロー実装 + テスト（既存ユーザー・新規ユーザー・エラー系すべて検証）
2. PRレビュー
3. mainマージ後、本番デプロイ（バックエンド + フロントエンド同時）
4. Android PWAで実機確認（白画面解消の確認）
5. PCブラウザで既存ユーザーがログインできるか確認

### ロールバック戦略

- 本番デプロイ後、重大な問題が出た場合は `git revert` で前バージョンに戻す
- `user_providers` テーブルのデータは変更しないので、ロールバックしてもOmniAuth版に戻るだけで済む

---

## セキュリティ考慮

1. **ID Token検証は必ず `googleauth` gem を使う。自前実装禁止**
2. **audience検証必須:** 他サイト向けに発行されたID Tokenを受け入れないこと
3. **issuer検証必須:** `accounts.google.com` または `https://accounts.google.com` のみ受け入れ
4. **有効期限検証必須:** 期限切れID Tokenは拒否
5. **Replay攻撃対策:** ID Tokenの `jti` または `exp` を信頼する（googleauthが自動処理）
6. **HTTPS必須:** 本番環境はCloudFront + ACM証明書で強制済み
7. **Client ID漏洩:** Client IDは公開情報（JSのクライアント側に出る）のでOK。Secretはサーバー側にも不要（GIS方式ではclient_secretが要らない）

---

## テスト戦略

### バックエンドテスト（RSpec）

#### 新規テスト: `backend/spec/requests/api/v1/google_id_token_sessions_spec.rb`

```
POST /api/v1/auth/google_id_token
├─ 有効なID Token + 既存ユーザー → 200 success + user返却
├─ 有効なID Token + 新規ユーザー + メール衝突なし → 200 new_user
├─ 有効なID Token + メール衝突（別provider） → 409
├─ 有効なID Token + メール衝突（パスワード登録済み） → 409
├─ 無効なID Token（署名不正） → 401
├─ 無効なID Token（audience不一致） → 401
├─ 無効なID Token（有効期限切れ） → 401
├─ credentialパラメータ欠落 → 400
└─ remember_user_token Cookieがセットされる
```

#### 変更テスト: `backend/spec/requests/api/v1/account_settings_spec.rb`

- `link_provider` アクションのrequest specを追加

#### 削除テスト:

- `backend/spec/requests/api/v1/omniauth_callbacks_spec.rb` → 削除

### バックエンドテストでの署名対応

ID Token検証は実際のGoogle公開鍵にアクセスするためテストでは困難。解決策：

- `GoogleIdTokenVerifier` をモック化（`allow(verifier).to receive(:call).and_return(...)`)
- または、`Google::Auth::IDTokens::Verifier` をstubする
- または、テスト用の公開鍵ペアを生成し、テスト環境では別のaudience/issuerを使う

**推奨:** `GoogleIdTokenVerifier` サービスを独立させ、request specではサービスをstubする

### フロントエンドテスト（Vitest + RTL）

#### 変更テスト: `frontend/src/components/OAuthButtons/OAuthButtons.test.tsx`

- `window.google.accounts.id` をモック
- GIS SDK初期化が呼ばれることを検証
- コールバックにcredentialを渡すと `/auth/google_id_token` に POST することを検証
- レスポンスの status 別の画面遷移を検証

#### 変更テスト: `frontend/src/pages/AuthCallbackPage/AuthCallbackPage.test.tsx`

- ページを削除する場合はテストも削除
- ページを残す場合は簡素化

---

## 未解決の質問（実装時に確定）

1. **AuthCallbackPageをページごと削除するか残すか** → 使われ方次第。実装時に「`/auth/callback` ルートに来る唯一のケースがGoogle OAuth戻りのみ」であることが確認できれば削除する
2. **`GOOGLE_CLIENT_ID` を既存のSSM Parameterから参照する形にするか、新規に追加するか** → 既存のOmniAuth用と同じものを流用する（値を変える必要なし）
3. **GIS SDK読み込みのタイミング** → `index.html` に入れて常時読み込むか、ログインページだけで動的に読み込むか → 実装時に決定（まずはindex.htmlで十分）
4. **`remember_me` の扱い** → GIS経由でも `remember_me(user)` を呼んで `remember_user_token` Cookieを付与する（現状踏襲）

---

## 成功判定

以下すべてを満たせば移行完了：

- [ ] Android PWAで「Googleでログイン」をタップして、ダッシュボードまで遷移できる
- [ ] PCブラウザで既存ユーザーが今まで通りログインできる
- [ ] スマホ通常ブラウザ（PWAではない）でも動作する
- [ ] 新規ユーザーの登録フロー（ユーザー名入力画面）が動作する
- [ ] アカウント設定からGoogle連携追加・解除が動作する
- [ ] バックエンド・フロントエンド両方のテストが通る
- [ ] RuboCop / ESLint / Prettier でlintエラーなし
