# ログイン保持機能 + ログイン失敗バグ修正 設計書

## 概要

PWA環境でアプリを閉じるたびに再ログインが必要になる問題を解決し、90日間のログイン保持機能を実装する。併せてIssue #49（開発環境でのログイン失敗）のバグ修正も同スコープで対応する。

## 関連Issue

- [#49 開発環境でログイン・Googleログインが失敗する](https://github.com/IKcoding-jp/Recolly/issues/49)

## 背景

### 現状の問題

1. **ログイン保持ができない**: セッションCookieに有効期限が未設定のため、ブラウザ/PWAを閉じるとセッションが消える
2. **開発環境でログイン失敗（Issue #49）**: Cookie設定（`same_site`, `secure`）が未指定で、FRONTEND_URL環境変数も未設定

### 根本原因

- `_recolly_session` Cookieが有効期限なし（ブラウザセッションCookie）のため、ブラウザ終了で削除される
- Deviseの `:rememberable` モジュールはUserモデルに含まれているが、未活用
- Cookie属性（`same_site`, `secure`）の明示化が不足

## 設計

### アプローチ

Deviseの `rememberable` 機能を有効化する。既にUserモデルに `:rememberable` が含まれているため、最小限の設定変更で実現可能。

- 常にログイン保持する（チェックボックス不要）
- メール/パスワードログイン・Google OAuthログインの両方に適用
- 保持期間: 90日（アクセスのたびに延長）

### 90日の選定根拠

- Recollyは記録・分析アプリのため毎日利用するとは限らない。30日では月1ペースのユーザーが切れる可能性がある
- PWAとしてスマホにインストールしている前提で、モバイルアプリに近い体験を目指す
- 1年は共有端末でのリスクが高すぎる。90日が利便性とセキュリティのバランス点

### 変更内容

#### 1. Cookie/Session設定の修正（バグ修正）

**`backend/config/application.rb`**

Session CookieStoreに `same_site` と `secure` を明示化:
- `same_site: :lax` — CSRF対策の標準設定
- `secure: Rails.env.production?` — 開発環境（HTTP）では `false`、本番（HTTPS）では `true`

#### 2. Devise rememberable の設定

**`backend/config/initializers/devise.rb`**

- `config.remember_for = 90.days` — remember_me Cookieの有効期限
- `config.extend_remember_period = true` — アクセスのたびに90日延長（アクティブユーザーは実質ログアウト不要）

#### 3. ログイン時に常に remember_me を有効化

以下のコントローラーで `remember_me(user)` を呼び出し:

- **`sessions_controller.rb`** — メール/パスワードログイン
- **`omniauth_callbacks_controller.rb`** — Google OAuthログイン（既存ユーザー）
- **`oauth_registrations_controller.rb`** — Google OAuth新規登録完了

#### 4. FRONTEND_URL環境変数の設定（バグ修正）

- `.env.example` に `FRONTEND_URL=http://localhost:5173` を追記
- `docker-compose.yml` の backend サービスに `FRONTEND_URL` 環境変数を追加

### フロントエンド

**変更不要。** 理由:
- `credentials: 'include'` は設定済み → remember_me Cookieも自動送信される
- `AuthContext` の `getCurrentUser()` → remember_me Cookieによるセッション復元がそのまま動作
- PWA Service Workerも変更不要（APIはキャッシュ対象外）

## セキュリティ

| 観点 | 対応 |
|------|------|
| パスワード変更時の失効 | Deviseが `remember_token` のソルトを変更し、他端末のCookieが自動無効化 |
| ログアウト時のCookie削除 | `sign_out` が remember_me Cookieも削除（`expire_all_remember_me_on_sign_out = true` 設定済み） |
| Cookie属性 | `httponly: true`（JS不可）、`secure`（本番のみ）、`same_site: :lax` |
| XSS耐性 | HTTP-only Cookieのため、JavaScriptからトークンにアクセス不可 |

## テスト方針

### バックエンド（RSpec）

- SessionsController: ログイン成功時に remember_me Cookieが発行されること
- OmniauthCallbacksController: OAuthログイン時に remember_me Cookieが発行されること
- OauthRegistrationsController: OAuth新規登録完了時に remember_me Cookieが発行されること
- ログアウト: remember_me Cookieが削除されること

### 手動動作確認

- ブラウザでログイン → ブラウザ完全終了 → 再度開く → ログイン状態維持を確認
- PWAでログイン → アプリを閉じる → 再度開く → ログイン状態維持を確認
- ログアウト → DevToolsで remember_me Cookieが消えていることを確認

## 変更ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `backend/config/application.rb` | Session Cookie に `same_site: :lax, secure` 追加 |
| `backend/config/initializers/devise.rb` | `remember_for = 90.days`, `extend_remember_period = true` |
| `backend/app/controllers/api/v1/sessions_controller.rb` | `remember_me(user)` 追加 |
| `backend/app/controllers/api/v1/omniauth_callbacks_controller.rb` | `remember_me(user)` 追加 |
| `backend/app/controllers/api/v1/oauth_registrations_controller.rb` | `remember_me(user)` 追加 |
| `.env.example` | `FRONTEND_URL` 追記 |
| `docker-compose.yml` | backend に `FRONTEND_URL` 環境変数追加 |
