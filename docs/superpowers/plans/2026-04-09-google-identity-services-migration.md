# 実装計画: Google認証をGoogle Identity Servicesに移行

対応ADR: ADR-0035
対応spec: `docs/superpowers/specs/2026-04-09-google-identity-services-migration-design.md`
ブランチ: `fix/pwa-google-oauth-white-screen`

## 全体方針

- **TDD（テスト駆動開発）** を徹底する：テストを先に書いて red を確認してから実装
- **小さく区切ってコミットする**：各フェーズの終わりにコミットを入れる
- **バックエンド → フロントエンドの順**で実装する（API契約を先に固める）
- 既存のテストが壊れる場所は都度修正しながら進める
- 全工程でlint（RuboCop / ESLint / Prettier）を通す

---

## フェーズ0: 事前準備

### 0.1 Google Cloud Console設定確認

- [ ] 既存のOAuthクライアントIDを確認
- [ ] 「承認済みのJavaScript生成元」に以下が含まれることを確認（無ければ追加）：
  - `http://localhost:5173`（ローカル開発）
  - `https://recolly.net`（本番）
- [ ] 「承認済みのリダイレクトURI」は**不要**になるので残っていても問題なし（GIS方式ではリダイレクト使わない）

### 0.2 環境変数の準備

- [ ] `frontend/.env.example` に `VITE_GOOGLE_CLIENT_ID` を追加
- [ ] `frontend/.env.local`（個人用）に実際の値を設定
- [ ] 本番の環境変数（CloudFrontビルド時）に `VITE_GOOGLE_CLIENT_ID` を追加する必要があるか確認

---

## フェーズ1: バックエンド - googleauth gem導入と検証サービス

### 1.1 gemの追加と削除

- [ ] `backend/Gemfile` に `gem 'googleauth'` を追加
- [ ] `backend/Gemfile` から以下を削除：
  - `gem 'omniauth'`
  - `gem 'omniauth-google-oauth2'`
  - `gem 'omniauth-rails_csrf_protection'`
- [ ] `bundle install` 実行
- [ ] `docker compose build backend` でビルドが通ることを確認

### 1.2 GoogleIdTokenVerifierサービスの spec 作成（Red）

- [ ] `backend/spec/services/google_id_token_verifier_spec.rb` を作成
- [ ] 以下のテストケースを書く：
  - 有効なID Token（mockで返す） → `{ sub:, email:, name: }` を返す
  - 無効なID Token → `Google::Auth::IDTokens::VerificationError` を raise
  - audience不一致 → `Google::Auth::IDTokens::AudienceMismatchError` を raise
- [ ] `bundle exec rspec spec/services/google_id_token_verifier_spec.rb` → **Red** を確認

### 1.3 GoogleIdTokenVerifierサービスの実装（Green）

- [ ] `backend/app/services/google_id_token_verifier.rb` を作成
- [ ] `Google::Auth::IDTokens.verify_oidc` をラップ
- [ ] audience は `ENV.fetch('GOOGLE_CLIENT_ID')` から取得
- [ ] 検証成功時は `{ sub:, email:, name: }` を返す
- [ ] `bundle exec rspec spec/services/google_id_token_verifier_spec.rb` → **Green** を確認

### 1.4 コミット

- [ ] `git add backend/Gemfile backend/Gemfile.lock backend/app/services/google_id_token_verifier.rb backend/spec/services/google_id_token_verifier_spec.rb`
- [ ] コミット: `feat: googleauth gemとGoogleIdTokenVerifierサービスを追加`

---

## フェーズ2: バックエンド - FindOrCreateUserServiceの汎用化

### 2.1 既存テストを読んで把握

- [ ] `backend/spec/services/oauth/find_or_create_user_service_spec.rb` を読む
- [ ] 現状のテストが通る前提でリファクタリング

### 2.2 引数形式の変更（Refactor）

- [ ] `FindOrCreateUserService` の `initialize` 引数を OmniAuth形式 `auth_data` から汎用Hash `{ provider:, uid:, email:, name: }` に変更
- [ ] 内部ロジックは変えない
- [ ] `backend/spec/services/oauth/find_or_create_user_service_spec.rb` を新しい引数形式に合わせて更新
- [ ] `bundle exec rspec spec/services/oauth/` → **Green** を確認

### 2.3 コミット

- [ ] コミット: `refactor: FindOrCreateUserServiceの引数を汎用Hashに変更`

---

## フェーズ3: バックエンド - GoogleIdTokenSessionsController

### 3.1 request spec 作成（Red）

- [ ] `backend/spec/requests/api/v1/google_id_token_sessions_spec.rb` を作成
- [ ] テストケース（スペック4.3節「テスト戦略」参照）：
  - 有効なID Token + 既存ユーザー → 200 + user返却 + sessionに sign_in 状態
  - 有効なID Token + 新規ユーザー → 200 `{ status: 'new_user' }` + session[:oauth_data] 保存
  - 有効なID Token + メール衝突（別provider） → 409 + error code
  - 有効なID Token + メール衝突（パスワード登録済み） → 409 + error code
  - 無効なID Token → 401
  - credential パラメータ欠落 → 400
  - remember_user_token Cookie がセットされる
- [ ] テスト内で `GoogleIdTokenVerifier` を stub:
  ```ruby
  allow_any_instance_of(GoogleIdTokenVerifier).to receive(:call).and_return(
    { sub: 'test_sub_123', email: 'test@example.com', name: 'Test User' }
  )
  ```
- [ ] `bundle exec rspec spec/requests/api/v1/google_id_token_sessions_spec.rb` → **Red** を確認

### 3.2 ルーティング追加

- [ ] `backend/config/routes.rb` に追加：
  ```ruby
  namespace :api do
    namespace :v1 do
      post 'auth/google_id_token', to: 'google_id_token_sessions#create'
    end
  end
  ```

### 3.3 コントローラー実装（Green）

- [ ] `backend/app/controllers/api/v1/google_id_token_sessions_controller.rb` を作成
- [ ] `create` アクションで：
  1. `params.require(:credential)` でID Token取得
  2. `GoogleIdTokenVerifier.new(credential: ...).call`
  3. 検証失敗時（例外）→ 401 返却
  4. 検証成功時 → `Oauth::FindOrCreateUserService` で判定
  5. 既存ユーザー → `sign_in` + `remember_me` + 200 success返却
  6. 新規ユーザー → session[:oauth_data] に保存 + 200 new_user返却
  7. 衝突 → 409返却
- [ ] `ActionController::Cookies` と `Devise::Controllers::Rememberable` を include
- [ ] `skip_forgery_protection` でCSRF検証スキップ（ログイン前）
- [ ] `bundle exec rspec spec/requests/api/v1/google_id_token_sessions_spec.rb` → **Green** を確認

### 3.4 コミット

- [ ] コミット: `feat: GoogleIdTokenSessionsControllerを追加`

---

## フェーズ4: バックエンド - link_providerアクション追加

### 4.1 request spec 作成（Red）

- [ ] `backend/spec/requests/api/v1/account_settings_spec.rb` にテスト追加：
  - ログイン済み + 有効なID Token + 未連携 → 200 + UserProvider作成
  - ログイン済み + 既に同プロバイダ連携済み → 422
  - 未ログイン → 401
  - 無効なID Token → 401
- [ ] `bundle exec rspec spec/requests/api/v1/account_settings_spec.rb` → **Red**

### 4.2 実装（Green）

- [ ] `backend/app/controllers/api/v1/account_settings_controller.rb` に `link_provider` アクションを追加
- [ ] `GoogleIdTokenVerifier` で検証 → `sub` で重複チェック → `UserProvider.create!` → JSON返却
- [ ] `bundle exec rspec spec/requests/api/v1/account_settings_spec.rb` → **Green**

### 4.3 コミット

- [ ] コミット: `feat: AccountSettingsControllerにlink_providerアクションを追加`

---

## フェーズ5: バックエンド - OmniAuth削除

### 5.1 参照の確認

- [ ] `grep -rn omniauth backend/` で参照箇所を列挙
- [ ] 全ての参照を以下から削除：
  - `backend/app/models/user.rb` の `:omniauthable` モジュール
  - `backend/app/models/user.rb` の `omniauth_providers: [:google_oauth2]`
  - `backend/config/initializers/devise.rb` のOmniAuth関連設定
  - `backend/config/routes.rb` の `omniauth_callbacks` 指定

### 5.2 ファイル削除

- [ ] `backend/app/controllers/api/v1/omniauth_callbacks_controller.rb`
- [ ] `backend/spec/requests/api/v1/omniauth_callbacks_spec.rb`
- [ ] `backend/config/initializers/omniauth.rb`（存在する場合）

### 5.3 全テスト実行

- [ ] `docker compose run --rm backend bundle exec rspec` で全テストが通ることを確認
- [ ] `docker compose run --rm backend bundle exec rubocop` でlintエラーなし

### 5.4 コミット

- [ ] コミット: `refactor: OmniAuth関連コードを削除`

---

## フェーズ6: フロントエンド - GIS SDKとOAuthButtons

### 6.1 index.htmlにスクリプトタグ追加

- [ ] `frontend/index.html` の `<head>` に追加：
  ```html
  <script src="https://accounts.google.com/gsi/client" async defer></script>
  ```

### 6.2 window.google の型定義追加

- [ ] `frontend/src/types/google-gsi.d.ts` を作成：
  ```typescript
  interface GoogleIdConfiguration {
    client_id: string
    callback: (response: { credential: string }) => void
    auto_select?: boolean
    cancel_on_tap_outside?: boolean
  }
  
  interface GoogleButtonConfiguration {
    theme?: 'outline' | 'filled_blue' | 'filled_black'
    size?: 'large' | 'medium' | 'small'
    text?: 'signin_with' | 'signup_with' | 'continue_with'
    shape?: 'rectangular' | 'pill' | 'circle' | 'square'
    logo_alignment?: 'left' | 'center'
    width?: number
    locale?: string
  }
  
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: GoogleIdConfiguration) => void
          renderButton: (element: HTMLElement, config: GoogleButtonConfiguration) => void
          prompt: () => void
          disableAutoSelect: () => void
        }
      }
    }
  }
  ```

### 6.3 APIクライアント追加

- [ ] `frontend/src/lib/api.ts` に `googleAuthApi` を追加（specの通り）
- [ ] 型定義 `GoogleAuthSignInResponse`, `GoogleAuthStatus` を `frontend/src/lib/types.ts` に追加

### 6.4 OAuthButtons.test.tsx の更新（Red）

- [ ] `frontend/src/components/OAuthButtons/OAuthButtons.test.tsx` を GIS 前提に書き換え
- [ ] テストケース：
  - GIS SDKが読み込まれた状態を `window.google` のモックで再現
  - コンポーネントマウント時に `google.accounts.id.initialize` が呼ばれる
  - `google.accounts.id.renderButton` が呼ばれる
  - コールバックにダミーcredentialを渡すと `/auth/google_id_token` にPOSTされる
  - success レスポンス → navigate('/dashboard')
  - new_user レスポンス → navigate('/auth/complete')
  - error レスポンス → エラーメッセージ表示
- [ ] `npm test` → **Red**

### 6.5 OAuthButtons.tsx の実装（Green）

- [ ] `frontend/src/components/OAuthButtons/OAuthButtons.tsx` を全面書き換え
- [ ] ポイント：
  - `useEffect` で `window.google` を待つポーリング
  - `google.accounts.id.initialize({ client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID, callback: handleCredentialResponse })`
  - `google.accounts.id.renderButton(buttonRef.current, { theme: 'outline', size: 'large' })`
  - `handleCredentialResponse` で API 呼び出し → status別分岐
  - `mode` プロップで "sign_in" / "link" を切り替え
- [ ] `npm test` → **Green**

### 6.6 コミット

- [ ] コミット: `feat: OAuthButtonsをGoogle Identity Services方式に変更`

---

## フェーズ7: フロントエンド - AuthCallbackPage削除

### 7.1 影響範囲調査

- [ ] `grep -rn "auth/callback\|AuthCallbackPage" frontend/src/` で参照を確認
- [ ] 残っているのは `App.tsx` のルート定義のみであることを確認

### 7.2 削除

- [ ] `frontend/src/App.tsx` から `<Route path="/auth/callback" ... />` とインポートを削除
- [ ] `frontend/src/pages/AuthCallbackPage/` ディレクトリごと削除

### 7.3 テスト確認

- [ ] `npm test` で全テスト通過

### 7.4 コミット

- [ ] コミット: `refactor: AuthCallbackPageを削除（GIS移行によりリダイレクト不要）`

---

## フェーズ8: フロントエンド - AccountSettingsPageの連携UI更新

### 8.1 影響確認

- [ ] `frontend/src/pages/AccountSettingsPage/AccountSettingsPage.tsx` の現状を読む
- [ ] Google連携追加の導線を把握

### 8.2 テスト更新（Red）

- [ ] `AccountSettingsPage.test.tsx` を更新して GIS ボタン経由の連携を検証
- [ ] モックで `window.google.accounts.id` のコールバックを発火させる

### 8.3 実装（Green）

- [ ] 既存のOmniAuthフォームを `<OAuthButtons mode="link">` に置き換え
- [ ] `googleAuthApi.linkProvider(credential)` で連携処理
- [ ] 成功時は user情報をrefetchして画面更新

### 8.4 コミット

- [ ] コミット: `feat: AccountSettingsPageのGoogle連携をGIS方式に変更`

---

## フェーズ9: ローカル動作確認

### 9.1 ローカルで全機能確認

- [ ] `docker compose up -d`
- [ ] 新規ユーザーでGoogleログイン → ユーザー名入力 → ダッシュボード表示
- [ ] 既存ユーザーでGoogleログイン → ダッシュボード直行
- [ ] ログアウト → 再ログインできる
- [ ] メール衝突ケース（事前にメール登録したユーザーと同じメールのGoogleアカウントでログイン試行）→ エラーメッセージ
- [ ] アカウント設定からGoogle連携追加・解除

### 9.2 スマホエミュレータ or 実機で確認

- [ ] Chrome DevToolsのモバイルエミュレータでPWAをインストール → Googleログイン成功
- [ ] 可能なら実機Androidでも確認

### 9.3 linter・テスト全通過

- [ ] `docker compose run --rm backend bundle exec rspec` → 全Green
- [ ] `docker compose run --rm backend bundle exec rubocop` → lintエラーなし
- [ ] `docker compose run --rm frontend npm test` → 全Green
- [ ] `docker compose run --rm frontend npm run lint` → lintエラーなし
- [ ] `docker compose run --rm frontend npm run build` → ビルド成功

---

## フェーズ10: PR作成とレビュー

### 10.1 未コミットファイル確認

- [ ] `git status` で未コミットファイルがないことを確認
- [ ] schemaファイル・docs・ADR・spec・plan すべてコミット済みを確認（memory に沿う）

### 10.2 PR作成

- [ ] `git push -u origin fix/pwa-google-oauth-white-screen`
- [ ] `gh pr create` でPR作成
- [ ] PRタイトル: `fix: PWAでGoogleログインが白画面になる不具合を修正（GIS移行）`
- [ ] PR本文にsummary・test plan・関連リンク（ADR-0035、spec）を記載

### 10.3 セルフレビュー

- [ ] `recolly-git-rules` スキルのPRセルフチェックに従ってセルフレビュー

### 10.4 CIが通るのを待つ

- [ ] GitHub Actionsが全部Green

### 10.5 マージ

- [ ] Claude Code Reviewの指摘があれば対応
- [ ] mainにマージ

---

## フェーズ11: 本番デプロイと検証

### 11.1 デプロイ

- [ ] mainへのマージがGitHub Actionsで本番デプロイをトリガー
- [ ] デプロイが完了するのを待つ
- [ ] CloudFrontのキャッシュパージが必要な場合は実施

### 11.2 本番動作確認

- [ ] PCブラウザで既存ユーザーでGoogleログイン → 成功
- [ ] **Android PWA（ホーム画面追加済み）でGoogleログイン → 白画面が解消され、ダッシュボードに遷移することを確認** ← これがゴール
- [ ] Android通常ブラウザでも正常動作
- [ ] iPhone実機があれば確認（任意）

### 11.3 監視

- [ ] 本番のログでエラーが発生していないか確認
- [ ] ユーザーからの追加報告がないか確認

---

## フェーズ12: 学習ノート作成（任意）

- [ ] 新技術（GIS, FedCM, ID Token, JWT検証, googleauth gem）についての学習ノートを作成する
- [ ] `docs/learning/` に配置
- [ ] `learning-note` スキルを起動して対話的に作成

---

## 想定リスクと対策

| リスク | 発生確率 | 影響 | 対策 |
|-------|---------|------|------|
| GIS SDKがネットワーク経由で読み込めない環境 | 低 | Googleログイン使えない | メール/パスワードログインがフォールバックとして機能 |
| 既存ユーザーの `sub` が想定と違う値で保存されている | 低 | 既存ユーザーが新規扱い | 本番確認前にステージング相当で検証 |
| Google Cloud ConsoleのClient ID設定漏れ | 中 | ローカル・本番でログイン不可 | フェーズ0で確認する |
| GIS SDKのAPIが将来変わる | 低 | 動かなくなる | 定期的にGoogleのドキュメント確認 |
| CSRFトークン検証のすり抜け | 低 | セキュリティ | `POST /auth/google_id_token` はID Token自体がトークン扱い、POST後のセッションは通常CSRF保護 |

---

## 作業順序のフローチャート

```
ADR-0035（済） → spec（済） → plan（この文書）
  ↓
フェーズ1-5（バックエンド実装・テスト・OmniAuth削除）
  ↓
フェーズ6-8（フロントエンド実装・テスト）
  ↓
フェーズ9（ローカル動作確認）
  ↓
フェーズ10（PR作成）
  ↓
フェーズ11（本番デプロイと検証）
  ↓
フェーズ12（学習ノート作成・任意）
```
