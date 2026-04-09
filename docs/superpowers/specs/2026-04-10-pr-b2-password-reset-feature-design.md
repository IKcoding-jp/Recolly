# PR-B2: パスワードリセット機能の実装（#107 + #112）

- **日付**: 2026-04-10
- **担当**: IK
- **対応 Issue**: [#107](https://github.com/IKcoding-jp/Recolly/issues/107) / [#112](https://github.com/IKcoding-jp/Recolly/issues/112)
- **関連 PR**: PR-B1 (#108 AWS SES 基盤構築) に依存
- **ステータス**: Design

## 背景

Recolly はパスワードを忘れたユーザーが自力で再設定できる手段を持っていない。PR #104 の動作確認中にオーナーアカウントがロックアウト状態に陥り、AWS SSM Session Manager 経由で EC2 の Rails console から直接パスワードを書き換える復旧しかできなかった。実ユーザーが同じ状況になったら詰む。

PR-B1 で AWS SES によるメール送信基盤が整ったため、本 PR（PR-B2）でパスワードリセット機能の実装と、それに関連する LoginPage の導線強化（#112）を完結させる。

### 現状の実装

- Devise の `:recoverable` モジュールは `User` モデルで有効化済み
- `backend/app/controllers/api/v1/passwords_controller.rb` に `create` アクションのみ実装（リセットメール送信リクエスト受付）
- `spec/requests/api/v1/passwords_spec.rb` に `POST /api/v1/password` のテストあり（from アドレスの回帰テスト含む）
- フロントエンドに「パスワードを忘れた」リンクも新パスワード設定 UI も存在しない
- Devise メールテンプレートは未カスタマイズ（英語デフォルト）
- `config/locales/devise.en.yml` のみ存在、`devise.ja.yml` は未整備

## スコープ

**#107（パスワードリセット機能）を完全実装し、#112（LoginPage 401 エラー時の導線強化）も同時にクローズする。**

- ✅ バックエンド `PUT /api/v1/password`（新パスワード設定）アクション実装
- ✅ カスタム `DeviseMailer` でフロントエンド URL を注入
- ✅ 日本語のメールテンプレート（HTML + text の multipart）
- ✅ フロントエンド新規ページ 2 つ（`/password/new`, `/password/edit`）
- ✅ LoginPage に常時「パスワードをお忘れですか？」リンク + 401 時の強調バナー
- ✅ LoginPage に 401 時の「Google でログイン」誘導バナー（#112 要件）
- ✅ テスト一式（RSpec + Vitest）
- ✅ 本番動作確認（受信メールのリンクから通しで動く）
- ❌ SES サンドボックス解除申請（別 Issue）
- ❌ バウンス / complaint 通知処理（別 Issue）
- ❌ パスワード要件の強化（大文字小文字記号必須化等）

## 技術判断サマリ

| # | 判断事項 | 選択 | 理由 |
|---|---|---|---|
| 1 | 吸収する Issue の範囲 | **#107 + #112 を同時クローズ** | #112 の完了条件は #107 のページに依存しており、同一 PR で完結させる方がレビュー負荷が低い |
| 2 | URL 構造 | **Devise 標準**（`/password/new`, `/password/edit?reset_password_token=xxx`） | Devise が生成するトークンパラメータ名 `reset_password_token` をそのまま URL に流せる |
| 3 | メール形式 | **HTML + text の multipart** | スパム判定リスク低減、古いメーラーでも表示可能。実装コストはテンプレート 2 ファイルのみ |
| 4 | 「Google でログイン」誘導バナー | **401 エラー時のみ表示** | 常時表示はノイズが強い。ログイン失敗した文脈でだけ「Google で登録していませんか？」と問いかける方が自然 |
| 5 | 「パスワードをお忘れですか？」リンク | **常時リンク + 401 時バナーの二段構え** | #107 の「常時リンク」と #112 の「401 時強調」の両要件を満たす |
| 6 | バックエンド `update` の実装 | **`reset_password_by_token` を直接呼ぶ** | Devise の API をそのまま利用。エラーは `resource.errors` 経由で JSON 化 |
| 7 | メール内 URL の組み立て | **環境変数 `FRONTEND_URL` をカスタム DeviseMailer に注入** | API モードのため routes ヘルパーはバックエンド URL を返す。フロントエンド URL を明示的に渡す必要あり |
| 8 | リセット成功時の遷移 | **`/login` に遷移して成功メッセージ表示**（自動ログインなし） | Issue #107 の要件通り。自動ログインはセキュリティ観点で避ける |
| 9 | トークン無効・期限切れ時の UX | **エラー + `/password/new` への再申請リンクを表示** | ユーザーが詰まないように次のアクションを明示 |
| 10 | クライアントサイドバリデーション | **8 文字以上 + 一致確認** | 既存の SignUpPage と同じ基準。送信前に事前チェック（CLAUDE.md の規約通り） |

## 全体アーキテクチャ

```
[ ユーザー ]
      │
      │ ① /login の「パスワードをお忘れですか？」リンクを押下
      ▼
[ /password/new ]  ← 新規ページ
      │
      │ ② メアド入力 & 送信
      ▼
[ POST /api/v1/password ]  ← 既存、変更なし
      │
      │ ③ Devise が reset_password_token を生成・保存
      │    → DeviseMailer#reset_password_instructions 呼び出し
      ▼
[ カスタム DeviseMailer ]  ← 新規
      │
      │ ④ @frontend_url を ENV['FRONTEND_URL'] からセット
      │    → multipart/alternative で HTML + text を送信
      ▼
[ AWS SES (PR-B1 で構築済み) ]
      │
      │ ⑤ メール配送
      ▼
[ ユーザーの受信箱 ]
      │
      │ ⑥ 「パスワードを変更する」リンクをクリック
      │    URL: https://recolly.net/password/edit?reset_password_token=xxx
      ▼
[ /password/edit?reset_password_token=xxx ]  ← 新規ページ
      │
      │ ⑦ 新パスワード入力 & 送信
      ▼
[ PUT /api/v1/password ]  ← 新規アクション
      │
      │ ⑧ Devise の reset_password_by_token で検証・更新
      │    成功: 200 OK
      │    失敗: 422 Unprocessable Entity (トークン無効 / 期限切れ / パスワード要件違反)
      ▼
[ /login に遷移 ]
      │
      │ ⑨ location.state 経由で「パスワードを更新しました」メッセージ表示
      ▼
[ 通常ログインフロー ]
```

## コンポーネント設計

### バックエンド（Rails）

| ファイル | 変更内容 | 新規/修正 |
|---|---|---|
| `app/controllers/api/v1/passwords_controller.rb` | `update` アクション追加。`reset_password_by_token` を呼び出し、成功/失敗を JSON で返す | **修正** |
| `app/mailers/devise_mailer.rb` | `Devise::Mailer` を継承し、`reset_password_instructions` を override して `@frontend_url` をセット | **新規** |
| `app/views/devise/mailer/reset_password_instructions.html.erb` | 日本語 HTML メールテンプレート | **新規** |
| `app/views/devise/mailer/reset_password_instructions.text.erb` | 日本語テキストメールテンプレート | **新規** |
| `config/initializers/devise.rb` | `config.mailer = 'DeviseMailer'` を設定 | **修正** |
| `spec/requests/api/v1/passwords_spec.rb` | `PUT /api/v1/password` のテストを追加（正常系、無効トークン、期限切れ、パスワード要件違反） | **追記** |
| `spec/mailers/devise_mailer_spec.rb` | メール本文に日本語テキストと `FRONTEND_URL/password/edit?reset_password_token=xxx` が含まれることを検証 | **新規** |

#### `PasswordsController#update` 実装イメージ

```ruby
# PUT /api/v1/password
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
```

#### `DeviseMailer` サブクラス実装イメージ

```ruby
# app/mailers/devise_mailer.rb
class DeviseMailer < Devise::Mailer
  default from: 'noreply@recolly.net'

  def reset_password_instructions(record, token, opts = {})
    @frontend_url = ENV.fetch('FRONTEND_URL', 'http://localhost:5173')
    super
  end
end
```

#### メールテンプレート本文（設計）

**HTML 版** (`reset_password_instructions.html.erb`):

```erb
<p><%= @resource.username %> さん、こんにちは。</p>

<p>パスワードリセットのリクエストを受け付けました。<br>
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

**text 版** (`reset_password_instructions.text.erb`):

```erb
<%= @resource.username %> さん、こんにちは。

パスワードリセットのリクエストを受け付けました。
下の URL から新しいパスワードを設定してください。

<%= "#{@frontend_url}/password/edit?reset_password_token=#{@token}" %>

このリンクは 6 時間有効です。

このリクエストに心当たりがない場合は、このメールを無視してください。
パスワードは変更されません。

— Recolly
```

### フロントエンド（React）

| ファイル | 変更内容 | 新規/修正 |
|---|---|---|
| `src/pages/PasswordNewPage/PasswordNewPage.tsx` | メアド入力フォーム。送信後は同じページで成功メッセージ表示 | **新規** |
| `src/pages/PasswordNewPage/PasswordNewPage.test.tsx` | フォーム送信成功・失敗、成功メッセージ表示のテスト | **新規** |
| `src/pages/PasswordEditPage/PasswordEditPage.tsx` | 新パスワード入力フォーム。URL から `reset_password_token` を取得 | **新規** |
| `src/pages/PasswordEditPage/PasswordEditPage.test.tsx` | トークンなしリダイレクト、バリデーション、成功遷移、エラー時再申請リンク表示のテスト | **新規** |
| `src/pages/LoginPage/LoginPage.tsx` | 常時「パスワードをお忘れですか？」リンク追加 / 401 時バナー追加 / `location.state` のメッセージ表示 | **修正** |
| `src/pages/LoginPage/LoginPage.test.tsx` | 常時リンク、401 時バナー、成功メッセージ表示のテスト追加 | **追記** |
| `src/lib/api.ts` | `requestPasswordReset(email)` と `updatePassword(token, password, passwordConfirmation)` 関数を追加 | **追記** |
| `src/App.tsx` | `/password/new`, `/password/edit` の 2 ルート追加 | **修正** |
| `src/styles/authForm.module.css` | 必要なら `.success`, `.warningBanner` クラスを追記（tokens.css のトークンのみ使用） | **追記** |

#### `PasswordNewPage` の構造

```tsx
<div className={styles.page}>
  <div className={styles.card}>
    <Typography variant="h2">パスワードをリセット</Typography>
    <Divider />
    {submitted ? (
      <p className={styles.success}>
        パスワードリセットの手順をメールでお送りしました。<br />
        メールをご確認ください。
      </p>
    ) : (
      <form onSubmit={handleSubmit}>
        <FormInput label="メールアドレス" type="email" ... />
        <Button variant="primary" type="submit">リセットメールを送信</Button>
      </form>
    )}
    <div className={styles.link}>
      <Link to="/login">ログインに戻る</Link>
    </div>
  </div>
</div>
```

#### `PasswordEditPage` の構造

```tsx
// URL からトークン取得、なければリダイレクト
const [searchParams] = useSearchParams()
const token = searchParams.get('reset_password_token')
useEffect(() => {
  if (!token) navigate('/password/new', { replace: true })
}, [token, navigate])

// バリデーション: 8 文字以上 + 一致確認
const isValid = password.length >= 8 && password === passwordConfirmation

// 成功時は /login に遷移してメッセージ表示
await updatePassword(token, password, passwordConfirmation)
navigate('/login', {
  state: { message: 'パスワードを更新しました。ログインしてください。' }
})
```

エラー時（`password_reset_failed`）:
```tsx
<p className={styles.error}>
  リンクが無効または期限切れです。再度リセットを申請してください。
</p>
<Link to="/password/new">パスワードリセットを再申請</Link>
```

#### `LoginPage` の差分

**常時表示（フォーム下部）**:
```tsx
<div className={styles.link}>
  <Link to="/password/new">パスワードをお忘れですか？</Link>
  <Link to="/signup">アカウントを作成</Link>
</div>
```

**401 時のバナー（エラー表示直下）**:
```tsx
{error && (
  <>
    <p className={styles.error}>{error}</p>
    {isUnauthorized && (
      <div className={styles.warningBanner}>
        <p>もしかして Google で登録していませんか？下の「Google でログイン」からお試しください。</p>
        <p>パスワードを忘れた方は <Link to="/password/new">こちらから再設定</Link> できます。</p>
      </div>
    )}
  </>
)}
```

**`/password/edit` からの遷移時メッセージ表示**:
```tsx
useEffect(() => {
  const state = location.state as { message?: string; error?: string } | null
  if (state?.message) {
    setSuccessMessage(state.message)
  }
  if (state?.error) {
    setError(state.error)
  }
  window.history.replaceState({}, '')
}, [location.state])
```

## UI 一貫性（CLAUDE.md のルール遵守）

- **共通コンポーネント使用**: `FormInput`, `Button`, `Typography`, `Divider`, `Link`（react-router-dom）のみ使用。HTML 要素直書きなし
- **スタイル**: 既存の `src/styles/authForm.module.css` を流用。新規 CSS ファイルは作らない
- **tokens.css のみ使用**: 色・フォント・スペーシング・角丸・トランジションは全て CSS 変数で参照。ハードコード禁止
- **成功メッセージ・警告バナー用の新クラス** (`.success`, `.warningBanner`) は `authForm.module.css` に追記。必要なトークン（成功色、警告色）が `tokens.css` に存在しない場合は先に tokens.css を拡張する
- **async 関数の onClick 渡し禁止**: `() => void fn()` または try/catch でラップ

## エラーハンドリング

### バックエンド

| ケース | HTTP ステータス | レスポンス |
|---|---|---|
| リセット成功 | 200 OK | `{ "message": "パスワードを更新しました" }` |
| トークン無効 | 422 Unprocessable Entity | `{ "error": "password_reset_failed", "errors": ["Reset password token is invalid"] }` |
| トークン期限切れ | 422 Unprocessable Entity | `{ "error": "password_reset_failed", "errors": ["Reset password token has expired, please request a new one"] }` |
| パスワード短すぎ | 422 Unprocessable Entity | `{ "error": "password_reset_failed", "errors": ["Password is too short..."] }` |

**注**: Devise のエラーメッセージは現在英語。`config/locales/devise.ja.yml` の整備は別 Issue として切り出す（本 PR のスコープ外）。フロントエンド側で `password_reset_failed` コードを見て「リンクが無効または期限切れです」という統一メッセージに変換する。

### フロントエンド

| ページ | ケース | 表示 |
|---|---|---|
| `/password/new` | 送信成功（登録有無問わず） | 「パスワードリセットの手順をメールでお送りしました」 |
| `/password/new` | ネットワークエラー等 | `ApiError.message` を表示 |
| `/password/edit` | マウント時にトークンなし | `/password/new` にリダイレクト |
| `/password/edit` | クライアントバリデーション失敗 | 送信ボタン disabled、フォーム内で警告表示 |
| `/password/edit` | サーバー側で `password_reset_failed` | 「リンクが無効または期限切れです」+ 再申請リンク |
| `/password/edit` | その他エラー | `ApiError.message` を表示 |
| `/login` | `/password/edit` からの遷移 | `location.state.message` を成功バナーで表示 |
| `/login` | 401 エラー | 常時リンクに加えて強調バナー表示 |

## テスト戦略

### バックエンド（RSpec）

**`spec/requests/api/v1/passwords_spec.rb` 追記**:

```ruby
describe 'PUT /api/v1/password（新パスワード設定）' do
  let(:raw_token) { user.send_reset_password_instructions }

  context '正常系' do
    it '有効なトークンでパスワード更新成功（200）'
    it '更新後のパスワードで login できる'
  end

  context '異常系' do
    it '無効なトークンで 422'
    it '期限切れトークンで 422（travel_to で 6 時間経過を模倣）'
    it '短すぎるパスワードで 422'
    it 'パスワードとパスワード確認が不一致で 422'
  end
end
```

**`spec/mailers/devise_mailer_spec.rb` 新規**:

```ruby
describe '#reset_password_instructions' do
  it 'subject が日本語'
  it 'body にユーザー名を含む'
  it 'body に FRONTEND_URL/password/edit?reset_password_token=xxx を含む'
  it 'HTML パートと text パートの両方が存在する'
  it '送信元が noreply@recolly.net'
end
```

### フロントエンド（Vitest + React Testing Library）

**`PasswordNewPage.test.tsx`**:
- フォーム送信時に API を呼び出す
- 成功時にフォームが非表示になり成功メッセージ表示
- エラー時にエラーメッセージ表示
- 「ログインに戻る」リンクの存在

**`PasswordEditPage.test.tsx`**:
- トークンなしでアクセスすると `/password/new` にリダイレクト
- パスワード 8 文字未満で送信ボタン disabled
- パスワードと確認が不一致で送信ボタン disabled
- 送信成功時に `/login` に遷移し `state.message` を渡す
- `password_reset_failed` エラー時に再申請リンク表示

**`LoginPage.test.tsx` 追記**:
- 「パスワードをお忘れですか？」リンクが常時表示される
- 401 エラー時に強調バナー（Google 誘導 + 再設定リンク）が表示される
- `location.state.message` が渡されたら成功メッセージ表示

## デプロイ・環境変数

### 新規に必要な環境変数

**`FRONTEND_URL`**:
- ローカル開発: `docker-compose.yml` の backend サービスに `FRONTEND_URL=http://localhost:5173` を追加
- 本番: EC2 の Rails 環境変数（`.env.production` or systemd unit file）に `FRONTEND_URL=https://recolly.net` を追加

### `deploy.sh` の更新

**必要あり**。EC2 の Rails プロセス起動時に `FRONTEND_URL` が設定されている必要がある。

メモリ `project_deploy_script.md` の通り、EC2 の `deploy.sh` は自動更新されないため手動同期が必要。本 PR マージ後、IK が EC2 に SSM Session Manager で接続して `deploy.sh` を更新する運用手順を `docs/setup/` に追記する。

### インフラ（Terraform）への影響

**なし**。`FRONTEND_URL` は Rails プロセスの環境変数として設定されるため、Terraform の管理対象外。

## 完了条件（Definition of Done）

### コード

#### バックエンド

- [ ] `PasswordsController#update` が実装され、`reset_password_by_token` を呼び出している
- [ ] `DeviseMailer` サブクラスが作成され、`@frontend_url` をセットしている
- [ ] `devise.rb` で `config.mailer = 'DeviseMailer'` が設定されている
- [ ] `reset_password_instructions.html.erb` と `reset_password_instructions.text.erb` が日本語で作成されている
- [ ] `passwords_spec.rb` の `PUT /api/v1/password` テストが全てパス
- [ ] `devise_mailer_spec.rb` の全テストがパス
- [ ] 既存テスト（`POST /api/v1/password` の from 検証等）が壊れていない

#### フロントエンド

- [ ] `PasswordNewPage` が実装されテストがパス
- [ ] `PasswordEditPage` が実装されテストがパス
- [ ] `LoginPage` に常時リンク + 401 バナーが追加されテストがパス
- [ ] `api.ts` に `requestPasswordReset` と `updatePassword` 関数が追加されている
- [ ] `App.tsx` に `/password/new`, `/password/edit` のルートが追加されている
- [ ] `authForm.module.css` の新規クラスが tokens.css のトークンのみ使用している
- [ ] ESLint / Prettier パス

### ドキュメント

- [ ] `docs/setup/ses-setup.md` もしくは `docs/setup/frontend-url-env.md` に `FRONTEND_URL` 環境変数の設定手順が追記されている

### CI

- [ ] Backend Lint (RuboCop) パス
- [ ] Backend Test (RSpec) パス
- [ ] Frontend Lint (ESLint + Prettier) パス
- [ ] Frontend Test (Vitest) パス
- [ ] Security Scan パス

### 動作確認（手動 / Playwright MCP）

- [ ] ローカル: `/login` → 「パスワードをお忘れですか？」クリック → `/password/new` 遷移
- [ ] ローカル: `/password/new` でメアド送信 → letter_opener_web でメール確認 → リンククリック → `/password/edit` 遷移
- [ ] ローカル: `/password/edit` で新パスワード設定 → `/login` に遷移 → 成功メッセージ表示 → 新パスワードでログイン成功
- [ ] ローカル: `/password/edit?reset_password_token=invalid` で再申請リンク表示
- [ ] ローカル: `/login` でわざと間違えたパスワードを入力 → 401 バナー表示（Google 誘導 + 再設定リンク）
- [ ] 本番: IK の個人メアド（サンドボックス検証済み）でパスワードリセット実行 → 受信メールのリンクから通しで動作

## リスク整理

| # | リスク | 発生確率 | 影響 | 対策 |
|---|---|---|---|---|
| 1 | Devise の `reset_password_by_token` が想定と違う挙動（例: トークン消費のタイミング） | 低 | 中 | TDD で正常系・異常系を先にテスト化して仕様を固定 |
| 2 | メールテンプレートの `@frontend_url` が空で `http:///password/edit?...` のような壊れた URL が生成される | 中 | 高 | `devise_mailer_spec.rb` で URL の形式を正規表現検証 |
| 3 | `FRONTEND_URL` 環境変数を本番 EC2 で設定し忘れる | 高 | 高 | `ENV.fetch` でデフォルト値を設定し、`docs/setup/` に明記。本番デプロイ後に動作確認必須 |
| 4 | Devise のエラーメッセージが英語のまま本番で表示される | 高 | 低 | フロントエンド側で `password_reset_failed` コードを見て日本語メッセージに変換する（詳細は「エラーハンドリング」参照） |
| 5 | `authForm.module.css` にハードコード値を追加してしまう | 中 | 中 | PR レビューで tokens.css のトークン使用を確認。なければ先に tokens.css を拡張 |
| 6 | SES サンドボックスのため、本番動作確認は IK の個人メアドにしか送れない | 高 | 低 | 受け入れ条件を「IK の受信箱に届く」で定義。サンドボックス解除は別 Issue |
| 7 | 既存の `passwords_spec.rb` の from 検証テストが DeviseMailer サブクラス化で壊れる | 中 | 中 | DeviseMailer の `default from: 'noreply@recolly.net'` で同じ挙動を維持。TDD で既存テストが通ることを確認 |
| 8 | `/password/edit` で `location.search` のトークンが長すぎて URL エンコード問題が起きる | 低 | 中 | `useSearchParams` が自動でデコードしてくれる。TDD で長いトークンをテスト |

## スコープ外（明示）

以下は本 PR では対応しない：

- ❌ Devise メッセージの日本語化（`config/locales/devise.ja.yml` 整備）→ 別 Issue
- ❌ SES サンドボックス解除申請 → 別 Issue
- ❌ バウンス / complaint 通知処理（SNS + SQS） → 別 Issue
- ❌ パスワード要件の強化（大文字小文字記号必須化、パスワード強度インジケーター等）→ YAGNI、必要になったら別 Issue
- ❌ リセットメール送信のレート制限（同一アドレスへの連続送信防止）→ 必要性を検証後、別 Issue
- ❌ 「パスワードを変更しました」通知メール → Devise の `:confirmable` 相当の挙動。YAGNI

## 参照

- **依存 PR**: PR-B1 (#108 AWS SES 基盤構築) — [docs/superpowers/specs/2026-04-10-pr-b1-ses-smtp-setup-design.md](./2026-04-10-pr-b1-ses-smtp-setup-design.md)
- **関連 Issue**: [#107](https://github.com/IKcoding-jp/Recolly/issues/107), [#112](https://github.com/IKcoding-jp/Recolly/issues/112)
- **関連 ADR**: [docs/adr/0037-ses-api方式でメール送信.md](../../adr/0037-ses-api方式でメール送信.md)
- **Devise ドキュメント**: [Devise::PasswordsController](https://www.rubydoc.info/github/heartcombo/devise/Devise/PasswordsController)
