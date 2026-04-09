# ADR-0035: Google認証をOmniAuthからGoogle Identity Servicesに変更

## ステータス
承認済み

## 背景

2026年4月、本番環境で「AndroidのPWA（ホーム画面に追加したアプリ表示）からGoogleログインすると白画面になり進めない」という不具合が報告された。調査の結果：

- PC（通常ブラウザ）では正常動作
- スマホの通常ブラウザでも正常動作
- **AndroidのPWAスタンドアロンモードでのみ白画面**
- PWAを閉じて再度開くとログイン画面に戻る（セッションCookieがPWAに保存されていない）

現在の認証は ADR-0013 に基づき、OmniAuth（サーバーサイドリダイレクト方式）でGoogle OAuth2を実装している。フローは以下の通り：

1. フロントエンドが `<form>` POST で `/api/v1/auth/google_oauth2` に送信
2. RailsがGoogleの認証ページへ302リダイレクト
3. Google認証後、Railsのコールバックエンドポイントに戻る
4. Railsがセッション/remember_user_tokenのCookieをセット
5. フロントエンドの `/auth/callback` へリダイレクト

**問題の原因:** 上記の手順2〜5で外部ドメイン（`accounts.google.com`）への遷移が発生する。iOS/AndroidのPWAスタンドアロンモードでは、外部ドメインへの遷移がシステムブラウザ（Chrome Custom Tab等）で処理され、PWAのWebViewから完全に離脱する。認証後に設定されるCookieはシステムブラウザ側に保存されるため、PWAのWebViewからは参照できず、ログイン状態が反映されない。

この不具合はOmniAuthの「サーバーサイドリダイレクト」アーキテクチャに由来するもので、設定変更では解決しない。認証フローそのものを「ページ遷移なし（ブラウザ内完結）」方式に変える必要がある。

## 選択肢

### A案: OmniAuthのまま、PWAで案内表示のみ追加

- **これは何か:** 認証方式は変えず、PWAスタンドアロン時に「Googleログインが使えません、メールでログインしてください」と案内を出す
- **長所:**
  - 実装コストが最小（バナー追加のみ）
  - 既存コードへの影響ほぼゼロ
- **短所:**
  - 根本解決ではない、PWAユーザーはGoogleログインが使えないまま
  - 「機能の片肺運転」で体験が悪い

### B案: PWAの `display` を `browser` に変更

- **これは何か:** `vite.config.ts` のPWAマニフェストで `display: 'standalone'` を `display: 'browser'` に変える。ホーム画面から起動してもURLバー付きの普通のブラウザタブとして開かれる
- **長所:**
  - 1行修正で済む
  - Googleログインが普通に動く
- **短所:**
  - PWAのアプリらしさ（フルスクリーン表示）が消える
  - ADR-0014でPWA対応を採用した意図に反する

### C案: Google Identity Services (GIS) + ID Token検証方式に変更 【採用】

- **これは何か:** Googleが推奨している新しい認証方式。ブラウザ上でJavaScript SDKを使い、Googleのポップアップで認証した結果を**JWT形式のID Token**（署名付きのユーザー情報）としてJavaScriptコールバックで受け取る。その後、ID Tokenをバックエンドに送信し、バックエンドがGoogleの公開鍵で署名を検証する
- **長所:**
  - ページ遷移が発生しないのでPWAで動作する
  - Googleが現在推奨している方式（従来のOAuth2ブラウザリダイレクトは段階的に非推奨化の方向）
  - FedCM（ブラウザ標準のフェデレーテッド認証API）対応で将来性が高い
- **短所:**
  - OmniAuth関連のバックエンドコード（OmniauthCallbacksController、OauthRegistrationsController、OmniAuth設定）を削除・置換する必要がある
  - フロントエンド（OAuthButtons、AuthCallbackPage）の書き換えが必要
  - テストの書き換えが必要
  - 初学者には新概念（JWT、FedCM、ID Token検証）の学習コストがある

## 決定

**C案：Google Identity Services（GIS）+ ID Token検証方式に変更する。**

実装の詳細:
- **フロントエンド:** GoogleのJavaScript SDK (`https://accounts.google.com/gsi/client`) を読み込み、Googleが提供する公式ボタン（`g_id_signin`）を描画する
- **バックエンド:** Google公式の `googleauth` gem を使ってID Tokenを検証する新エンドポイント `POST /api/v1/auth/google_id_token` を追加する。既存のOmniAuth設定・コントローラーは削除する
- **既存ユーザー:** Googleが発行する `sub`（Subject Identifier = ユーザー固有ID）は両方式で同じものが返るため、既存ユーザーはそのままログインできる見込み（実装時にIdentityテーブルの構造を確認して確定）

## 理由

- **A案を選ばなかった理由:** 問題の根本解決にならず、PWAユーザーの体験が悪いまま放置される
- **B案を選ばなかった理由:** PWA対応の意図（ADR-0014）と矛盾し、せっかく導入したPWA体験を捨てることになる
- **C案を選んだ理由:** 問題を根本から解決でき、かつ将来性のあるモダンな認証方式に移行できる。学習コストは発生するが、JWT・ID Token検証・FedCMは認証基盤の基礎知識であり、学ぶ価値がある

## 影響

### 変更が必要なファイル（実装フェーズで確定）

**削除:**
- `backend/app/controllers/api/v1/omniauth_callbacks_controller.rb`
- `backend/config/initializers/omniauth.rb`
- OmniAuth関連のroutes設定
- Gemfileの `omniauth`, `omniauth-google-oauth2`, `omniauth-rails_csrf_protection`
- `backend/app/controllers/api/v1/oauth_registrations_controller.rb` は内容次第で変更（新規ユーザー登録の流れが変わるため）

**追加:**
- Gemfile: `googleauth` gem
- `backend/app/controllers/api/v1/google_id_token_controller.rb`（仮称）
- `POST /api/v1/auth/google_id_token` ルーティング
- 対応するrequest spec

**変更:**
- `frontend/src/components/OAuthButtons/OAuthButtons.tsx`：GIS SDKを読み込む形に書き換え
- `frontend/src/pages/AuthCallbackPage/AuthCallbackPage.tsx`：Googleの扱いが減り、役割縮小（新規登録時のusername入力誘導のみ残る可能性）
- `frontend/src/lib/api.ts`：新エンドポイント用のAPIクライアント追加
- OAuth関連のテスト全般

### 運用・セキュリティへの影響

- **ID Token検証は絶対に自前実装しないこと。** 公式gem（`googleauth`）を使う
- Google Cloud Consoleの **OAuthクライアントIDの「承認済みのJavaScript生成元」** に本番・ローカル両方のオリジンを追加する必要がある（現状の設定と異なる可能性があるため確認必須）
- ADR-0013（OmniAuth採用）は本ADRにより**廃止**とする
- CSRF対策はID Token自体が署名付きなのでフォームベースの対策は不要になる。ただしJSON送信のPOSTリクエストへの基本的なCSRF対策は引き続き必要（バックエンドで確認する）

### 既存ユーザーへの影響

- Googleの `sub` が両方式で同じ値を返すため、既存ユーザーは**シームレスに移行できる見込み**
- ただし、実装前にIdentityテーブル（または同等のもの）を確認し、`sub` が保存されているかをチェックする必要がある
