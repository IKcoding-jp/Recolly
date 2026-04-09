# PR-A: ロックアウト防御とエラー基盤整備 — 設計ドキュメント

**作成日:** 2026-04-09
**対応 Issue:** #105, #106, #109（基盤部分のみ）, #110
**関連 ADR:** [ADR-0036](../../adr/0036-パスワード設定状態をpassword-set-atで独立管理.md)
**関連 PR:** #104（きっかけ）
**ブランチ名案:** `fix/lockout-prevention-and-error-basis`

## 概要

PR #104（Google Identity Services 移行）の動作確認中に発覚した以下4件の問題をまとめて解決する：

1. **#105** — 本番オーナーアカウントが「パスワード空 + OAuth 連携空」のロックアウト状態に陥った。根本原因は `oauth_registrations_controller.rb` の `update_column(:encrypted_password, '')` による空文字ハック。多層防御で根絶する
2. **#106** — 409 Conflict 時にバックエンドの具体的メッセージが失われて「エラーが発生しました」としか表示されない
3. **#109（基盤のみ）** — エラーレスポンス形式の統一、エラーコード辞書、フロント共通基盤の整備。「パスワードを忘れた」リンク等の UI 誘導は PR-B（#107 依存）のため除外
4. **#110** — ロックアウト状態のユーザーを検出する Rake タスク

## 背景と目的

### 背景

詳細は ADR-0036 の「背景」セクション参照。要点：

- セーフガード `last_login_method?` は初回コミットから存在しており、コードパスだけでは説明できない経路でロックアウトが発生した
- `OauthRegistrationsController#create_oauth_user` に `update_column(:encrypted_password, '')` が残っており、これが Issue #105 の温床になっている
- フロントエンドのエラー表示は `{error}` フィールドしか読んでおらず、バックエンドが返す `{code, message}` 形式が拾えていない（#106）
- エラー表示のメッセージ内容が曖昧で、ユーザーが次のアクションを取れない（#109）

### 目的

- 「パスワード空文字 + OAuth 連携空」というロックアウト状態を、**アプリケーション層のどの経路からも到達不可能** にする
- エラーレスポンス形式を統一し、フロントエンドがコード別に適切な日本語メッセージを表示できる基盤を作る
- ロックアウト状態のユーザーを運用側から検出できる手段を提供する

## スコープ

### このPRに含む（PR-A）

- **#105 全部**: モデル層の多層防御、`update_column` 空文字ハック削除、`set_password` 空文字拒否、`unlink_provider` トランザクション保護
- **#106 全部**: 409 エラー時のメッセージ表示、バックエンドのエラー形式統一（触ったエンドポイントのみ）
- **#109 基盤部分**: エラーコード辞書（`backend/app/errors/api_error_codes.rb`、`docs/api-error-codes.md`）、フロントの `ApiError.code`、`lib/errorMessages.ts` マッピング、OAuthButtons のエラー表示改善、AccountSettingsPage の連携解除エラー改善
- **#110 全部**: `lockout:detect` Rake タスク + spec

### このPRに含まない（別PRへ）

- **#107 パスワードリセット機能** → PR-B
- **#108 AWS SES 設定** → PR-B
- **#109 の UI 誘導部分**: LoginPage の「パスワードを忘れた」リンク（#107 依存）、LoginPage の「Google でログイン」誘導バナー、OAuthButtons の「メールでログイン」誘導ボタン → 別 Issue に分割して残す
- **エラー形式統一の全エンドポイント適用** → 触ったエンドポイント（GoogleIdTokenSessions, AccountSettings）のみ対応。残りは将来の別 PR で拡大

## 技術設計

### 多層防御の全体像

ロックアウト状態への遷移を以下の **5層** で防ぐ：

```
┌───────────────────────────────────────────────┐
│ ① UI 層 — canUnlink (既存、useAccountSettings) │
│    ログイン方法が1つだけなら「解除」ボタンを出さない │
├───────────────────────────────────────────────┤
│ ② Controller 層 — last_login_method?           │
│    unlink_provider で destroy 前にチェック      │
├───────────────────────────────────────────────┤
│ ③ Controller 層 — set_password 空文字拒否 (新)   │
│    空文字入力を 422 で弾く                      │
├───────────────────────────────────────────────┤
│ ④ Controller 層 — unlink_provider トランザク    │
│    ション保護 (新)                              │
│    destroy! が before_destroy で止められたら    │
│    ActiveRecord::RecordNotDestroyed を rescue   │
├───────────────────────────────────────────────┤
│ ⑤ Model 層 — User#before_update + UserProvider │
│    #before_destroy (新)                        │
│    Rails console からの誤操作や将来の別経路     │
│    でも発動する最後の砦                         │
└───────────────────────────────────────────────┘
```

### バックエンド変更詳細

#### B1. マイグレーション（ADR-0036）

`db/migrate/YYYYMMDDHHMMSS_add_password_set_at_to_users.rb` を新規作成：

```ruby
class AddPasswordSetAtToUsers < ActiveRecord::Migration[8.0]
  def up
    add_column :users, :password_set_at, :datetime, null: true

    # バックフィル: encrypted_password が空文字ではない既存ユーザーに現在時刻を設定
    execute <<~SQL
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

#### B2. User モデル (`backend/app/models/user.rb`)

```ruby
before_update :prevent_lockout_transition

private

def prevent_lockout_transition
  # encrypted_password が変わるときのみチェック
  return unless encrypted_password_changed?
  return if encrypted_password.present?
  return if user_providers.any?

  errors.add(:base, 'ログイン手段を全て失う変更はできません')
  throw(:abort)
end
```

**注1**: `throw(:abort)` は ActiveRecord のコールバック内で「この操作を中止する」を意味する Rails の慣習。`save` / `update` が `false` を返すようになる。

**注2: なぜ PR-A 後もこのコールバックが必要か**: PR-A 実装後は `OauthRegistrationsController` の空文字ハックが削除され、通常の経路では `encrypted_password` が空になる状況はもう発生しない（OAuth 新規登録ユーザーも `SecureRandom.hex(32)` の bcrypt ハッシュが常に残る）。このコールバックは「Rails console からの `user.update(encrypted_password: '')` のような直接操作」「将来追加される別機能が誤って encrypted_password を空にする」といったコードパス以外の経路に対する最後の防御層として機能する。

#### B3. UserProvider モデル (`backend/app/models/user_provider.rb`)

```ruby
before_destroy :prevent_lockout_on_destroy

private

def prevent_lockout_on_destroy
  return if user.destroyed?  # User 削除に伴う連鎖削除は許可
  return if user.password_set_at.present?  # パスワード設定済みなら解除OK
  return if user.user_providers.where.not(id: id).exists?  # 他のプロバイダがあれば解除OK

  errors.add(:base, '最後のログイン手段は解除できません')
  throw(:abort)
end
```

**`user.destroyed?` チェックの理由**: `User` が削除されると `dependent: :destroy` により `UserProvider` が連鎖削除されるが、そのとき `before_destroy` が発動してしまうと User 自体が消せなくなってしまう。`destroyed?` は Rails の標準メソッドで、User 側が `destroy` を開始していれば `true` を返す。

#### B4. エラーレスポンス形式統一

**新規作成: `backend/app/errors/api_error_codes.rb`**

```ruby
# frozen_string_literal: true

# API エラーコード定数。
# フロントエンドの lib/errorMessages.ts と対応する。
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

**`ApplicationController` にヘルパー追加**:

```ruby
def render_error(code:, message:, status:)
  render json: { error: message, code: code, message: message }, status: status
end
```

統一形式:
```json
{
  "error": "人間向けメッセージ（後方互換、code の日本語版と同じ）",
  "code": "エラーコード文字列（機械判別用）",
  "message": "人間向けメッセージ（新形式、code と同じ内容）"
}
```

**対象コントローラー**:
- `GoogleIdTokenSessionsController`: `render_conflict`, `render_unauthorized`, `render_bad_request` の3つを `render_error` に統一
- `AccountSettingsController`: `unlink_provider`, `set_password`, `set_email` のすべてのエラーを `render_error` に統一

#### B5. `has_password` 判定の切り替え

`ApplicationController#user_json`:
```ruby
# 変更前
has_password: user.encrypted_password.present?,
# 変更後
has_password: user.password_set_at.present?,
```

`AccountSettingsController#last_login_method?`:
```ruby
# 変更前
def last_login_method?
  has_password = current_user.encrypted_password.present?
  provider_count = current_user.user_providers.count
  !has_password && provider_count <= 1
end
# 変更後
def last_login_method?
  has_password = current_user.password_set_at.present?
  provider_count = current_user.user_providers.count
  !has_password && provider_count <= 1
end
```

#### B6. `set_password` の空文字拒否 + `password_set_at` 更新

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

private

def update_password
  current_user.password = params[:password]
  current_user.password_confirmation = params[:password_confirmation]
  current_user.password_set_at = Time.current
  save_and_render(current_user)
end
```

#### B7. `unlink_provider` のトランザクション保護

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
    provider.destroy!  # before_destroy で再検証、失敗したら rollback
  end

  render json: { user: user_json(current_user.reload) }
rescue ActiveRecord::RecordNotDestroyed
  render_error(code: ApiErrorCodes::LAST_LOGIN_METHOD,
               message: '最後のログイン手段は解除できません',
               status: :unprocessable_content)
end
```

**設計意図**: Controller 層の `last_login_method?` チェック（先チェック）と Model 層の `before_destroy`（再検証）の両方で同じ条件を検査する。二重チェックは冗長だが、多層防御のため意図的。

#### B8. `OauthRegistrationsController` の空文字ハック削除

```ruby
def create_oauth_user(oauth_data)
  user = build_user(oauth_data)
  user.save!  # update_column とトランザクションブロックは不要になる
  user
end
```

これにより OAuth 新規登録ユーザーの `encrypted_password` は `SecureRandom.hex(32)` の bcrypt ハッシュが残る。この 32 文字のランダム値は誰も知らない値（ユーザーにも返されない）なので、ログインパスワードとしては実質的に機能しない。一方で `password_set_at` は NULL のままなので UI 上は「パスワード未設定」と正しく表示される。将来 #107 のパスワードリセット機能で、OAuth ユーザーが初めて「自分のパスワード」を設定した時点で `password_set_at` が更新され、`has_password` が true になる。

#### B9. エラーコード辞書のドキュメント化

**新規作成: `docs/api-error-codes.md`**

全 `ApiErrorCodes` 定数の意味、HTTPステータス、発生元コントローラーを一覧化する運用ドキュメント。フロントエンドの `errorMessages.ts` と対応表として機能する。

### フロントエンド変更詳細

#### F1. `types.ts` の `ErrorResponse` 拡張

**`frontend/src/lib/types.ts`** に `code`, `message` フィールドを追加：

```ts
export interface ErrorResponse {
  error?: string
  code?: string    // ← 追加
  message?: string // ← 追加
  errors?: string[]
}
```

#### F2. `api.ts` の `request()` 改修

```ts
import { getErrorMessage } from './errorMessages'

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...options.headers },
    })

    if (response.status === 204) return undefined as T

    const data: unknown = await response.json()

    if (!response.ok) {
      const errorData = data as ErrorResponse
      const code = errorData.code
      const rawMessage =
        errorData.error ??
        errorData.message ??
        errorData.errors?.join(', ') ??
        'エラーが発生しました'
      // エラーコード辞書を優先、該当なしなら raw メッセージを使う
      const message = getErrorMessage(code, rawMessage)
      throw new ApiError(message, response.status, code)
    }

    return data as T
  } catch (err) {
    // ネットワークエラー（fetch自体の失敗）を判別
    if (err instanceof ApiError) throw err
    if (err instanceof TypeError) {
      throw new ApiError('ネットワークに接続できませんでした。通信環境をご確認ください', 0, 'network_error')
    }
    throw err
  }
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

#### F3. `lib/errorMessages.ts` 新規作成

```ts
// バックエンドの ApiErrorCodes と対応する日本語メッセージ辞書。
// バックエンドから code が返ってきたら辞書を引いて日本語メッセージに変換する。
// 辞書にない code や code なしの場合はバックエンドの message をそのまま使う。

const ERROR_MESSAGES: Record<string, string> = {
  email_already_registered:
    'このメールアドレスは既にメール+パスワードで登録されています。メールでログインしてください',
  email_registered_with_other_provider:
    'このメールアドレスは別のアカウントで登録されています',
  unauthorized:
    '認証に失敗しました。もう一度お試しください',
  invalid_credential:
    '認証情報が無効です',
  last_login_method:
    '最後のログイン手段は解除できません。先にパスワードを設定するか、別のOAuthを連携してください',
  provider_not_found:
    '連携が見つかりません',
  provider_already_linked:
    'このプロバイダは既に連携済みです',
  password_empty:
    'パスワードを入力してください',
  password_mismatch:
    'パスワードが一致しません',
  email_already_set:
    'メールアドレスは既に設定されています',
  email_taken:
    'このメールアドレスは既に使用されています',
  network_error:
    'ネットワークに接続できませんでした。通信環境をご確認ください',
}

export function getErrorMessage(code: string | undefined, fallback: string): string {
  if (!code) return fallback
  return ERROR_MESSAGES[code] ?? fallback
}
```

#### F4. `OAuthButtons` のエラー表示改善

現状の `OAuthButtons` では conflict エラー時に「エラーが発生しました」のフォールバック文言が表示される。`ApiError.code` を受け取れるようになるので、`catch (err)` 内で `err.message` を表示するだけで辞書経由の正確なメッセージが出る。

コード変更は最小限：`onLinkError(err.message)` の呼び出しで自動的に改善される。

#### F5. `AccountSettingsPage` の連携解除エラー改善

`useAccountSettings.ts` の `handleUnlinkProvider` は既に `err.message` を表示しているので、`api.ts` の改修によって自動的に改善される。追加コード変更は不要。

#### F6. エラー表示の UI は現状維持

デザイン判断（A案）により、エラー表示 UI は現状のインライン `<p className={styles.error}>{error}</p>` のまま。見た目は変えず、メッセージ内容の精度のみ向上する。

### Rake タスク (#110)

#### R1. `backend/lib/tasks/lockout.rake` 新規作成

```ruby
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

**実行方法**:
```bash
docker compose exec backend bundle exec rake lockout:detect
```

本番では AWS SSM Session Manager 経由の EC2 上で同じコマンドを実行する。

## データモデル変更

### 追加カラム

| テーブル | カラム | 型 | NULL | デフォルト | 用途 |
|---------|--------|-----|------|-----------|------|
| users | password_set_at | datetime | 許可 | NULL | ユーザーが自分でパスワードを設定した時刻 |

インデックスは付けない（検索クエリがないため）。

### バックフィル

マイグレーション実行時に、`encrypted_password` が空文字ではない既存ユーザーに `password_set_at = NOW()` を設定する。空文字だった既存ユーザー（本番で過去ロックアウト状態だったユーザー）は NULL のまま。

## API 変更

### エラーレスポンス形式の統一

**変更前（バラバラ）**:
```json
// AccountSettingsController
{ "error": "..." }

// GoogleIdTokenSessionsController conflict
{ "status": "error", "code": "...", "message": "..." }

// GoogleIdTokenSessionsController unauthorized / bad_request
{ "error": "..." }
```

**変更後（統一）**:
```json
{
  "error": "...",    // 後方互換・フロントのフォールバック読み取り用
  "code": "...",     // 機械的判別用
  "message": "..."   // 新形式の主読み取り先
}
```

**HTTPステータスは既存と同じ**（後方互換）。

### 触らないエンドポイント

`RegistrationsController`、`SessionsController`、その他リソース系エンドポイントは今回触らない。将来の別 PR で段階的に統一する。

## テスト要件

### バックエンド（RSpec）

#### モデル層
- **`spec/models/user_spec.rb`**（追加）:
  - `prevent_lockout_transition` が encrypted_password を空にする update を拒否することを検証
  - encrypted_password を空にしても user_providers が存在すれば通ることを検証
- **`spec/models/user_provider_spec.rb`**（追加）:
  - `prevent_lockout_on_destroy` が「最後の UserProvider かつ password 未設定」の destroy を拒否することを検証
  - `user.destroy` 連鎖時は発動しないことを検証（`dependent: :destroy` の正常動作）
  - password_set_at が present なら destroy OK を検証

#### コントローラー層
- **`spec/requests/api/v1/account_settings_spec.rb`**（追加）:
  - `set_password` が空文字を 422 `password_empty` で拒否
  - `set_password` 成功時に `password_set_at` が設定される
  - `unlink_provider` が最後の OAuth を拒否（last_login_method コード）
  - `unlink_provider` がトランザクション内で before_destroy に弾かれたケースの rescue 動作
  - エラーレスポンスが `{error, code, message}` 形式であることを検証
- **`spec/requests/api/v1/google_id_token_sessions_spec.rb`**（追加）:
  - 409 conflict が `{error, code, message}` 形式であることを検証
  - 401 unauthorized も同形式
  - 400 bad_request も同形式
- **`spec/requests/api/v1/oauth_registrations_spec.rb`**（更新）:
  - OAuth 新規登録後、`user.encrypted_password` が空文字ではないこと
  - OAuth 新規登録後、`user.password_set_at` が nil であること
  - レスポンスの `user.has_password` が `false` であること

#### Rake タスク
- **`spec/tasks/lockout_spec.rb`**（新規）:
  - `lockout:detect` がロックアウト状態のユーザーを正しくカウントして出力する

### フロントエンド（Vitest）

- **`src/lib/api.test.ts`**（新規 or 追加）:
  - `request()` がレスポンスの `code` を読み取り `ApiError.code` にセットする
  - `getErrorMessage` 経由で辞書メッセージが適用される
  - バックエンドから `message` のみ返ってきた場合のフォールバック
  - 従来の `error` フィールドのみの場合も読み取れる（後方互換）
  - `TypeError` をキャッチしてネットワークエラーに変換する
- **`src/lib/errorMessages.test.ts`**（新規）:
  - 各エラーコードに対応するメッセージが返る
  - 未知のコードはフォールバックメッセージを返す
  - undefined コードはフォールバックを返す
- **`src/components/OAuthButtons/OAuthButtons.test.tsx`**（更新）:
  - 409 conflict レスポンス時に辞書メッセージが表示される

## 完了条件

### コード
- [ ] `users.password_set_at` カラム追加マイグレーションが作成され、ローカルで実行できる
- [ ] `User#before_update :prevent_lockout_transition` が実装されている
- [ ] `UserProvider#before_destroy :prevent_lockout_on_destroy` が実装されている
- [ ] `ApplicationController#render_error` ヘルパーが追加されている
- [ ] `ApiErrorCodes` モジュールが作成されている
- [ ] `GoogleIdTokenSessionsController` と `AccountSettingsController` の全エラーレスポンスが `render_error` 経由
- [ ] `OauthRegistrationsController` から `update_column(:encrypted_password, '')` とそれを囲むトランザクションが削除されている
- [ ] `AccountSettingsController#set_password` が空文字を拒否し、成功時に `password_set_at` を更新する
- [ ] `AccountSettingsController#unlink_provider` がトランザクション + `rescue ActiveRecord::RecordNotDestroyed` で保護されている
- [ ] `ApplicationController#user_json` と `last_login_method?` が `password_set_at.present?` で判定している
- [ ] `frontend/src/lib/api.ts` の `request()` が `code` を読み取り、`ApiError.code` にセットする
- [ ] `frontend/src/lib/errorMessages.ts` が新規作成されている
- [ ] `frontend/src/lib/types.ts` の `ErrorResponse` に `code`, `message` が追加されている
- [ ] `backend/lib/tasks/lockout.rake` が作成されている
- [ ] `docs/api-error-codes.md` が作成されている

### テスト
- [ ] バックエンドのモデル spec が全パス
- [ ] バックエンドの request spec が全パス
- [ ] Rake タスクの spec が全パス
- [ ] フロントエンドの Vitest が全パス
- [ ] RuboCop がパス
- [ ] ESLint + Prettier がパス

### 動作確認
- [ ] ローカルで Google ログインが正常動作する
- [ ] ローカルで メール+パスワードログインが正常動作する
- [ ] ローカルで OAuth 連携追加・解除が動作する（最後の1つは解除できないことも確認）
- [ ] ローカルで既に登録済みメールアドレスで Google ログインを試して、辞書経由の具体的メッセージが出る
- [ ] `bundle exec rake lockout:detect` がローカルで実行できる

## スコープ外（PR-B 以降）

- **#107**: パスワードリセット機能（バックエンド Mailer テンプレート整備、フロント /password/new /password/edit ルート追加）
- **#108**: AWS SES 設定（Terraform、DNS 検証、Sending Limits 解除）
- **#109 の残り**:
  - LoginPage の「パスワードを忘れた方はこちら」リンク（#107 依存）
  - LoginPage の「Google でログイン」誘導バナー
  - OAuthButtons の「メールでログイン」誘導ボタン
  - AccountSettingsPage の「パスワードを設定する」直接導線ボタン
  - 上記の代わりに新 Issue を作成して残す

## リスクと緩和策

| リスク | 緩和策 |
|--------|--------|
| マイグレーションが本番で失敗して `password_set_at` が NULL だらけになる | ローカル・ステージング相当での事前検証。マイグレーションの `up` / `down` が往復できることを確認 |
| `before_destroy` が User の連鎖削除を誤って止めてしまう | `user.destroyed?` チェックで回避。spec で連鎖削除のテストを追加 |
| `before_update` が既存の User 更新処理（プロフィール更新等）の副作用を起こす | `encrypted_password_changed?` ガードで encrypted_password が変わるときのみ発動 |
| エラーレスポンス形式変更で既存フロントの読み取りが壊れる | `error` フィールドを維持することで後方互換を確保 |
| `set_password` の空文字拒否が既存の「パスワード変更」フロー（パスワード設定済みユーザー）を壊す | 既存ユーザーは `password_set_at` が present なので、空文字で上書きする用途はない。`render_error` で 422 を返すだけで害はない |

## 実装順序（案1: データフロー下流から積む）

1. バックエンドのエラーレスポンス形式統一（#106 + #109 基盤）
   - `ApiErrorCodes` モジュール作成
   - `render_error` ヘルパー追加
   - `GoogleIdTokenSessionsController` と `AccountSettingsController` のエラーを置換
   - `docs/api-error-codes.md` 作成
2. フロントエンド共通基盤（#106 + #109 基盤）
   - `ErrorResponse` 型拡張
   - `api.ts` の `request()` 改修、`ApiError` に code 追加
   - `errorMessages.ts` 新規作成
3. マイグレーション + User モデル層の多層防御（#105）
   1. `password_set_at` マイグレーション作成・適用（先にカラムが存在していないと後続コードが動かない）
   2. `ApplicationController#user_json` と `AccountSettingsController#last_login_method?` を `password_set_at` ベースに切り替え
   3. User モデル `before_update :prevent_lockout_transition` 追加
   4. UserProvider モデル `before_destroy :prevent_lockout_on_destroy` 追加
   5. `OauthRegistrationsController#create_oauth_user` から `update_column(:encrypted_password, '')` とトランザクションブロックを削除
   6. `AccountSettingsController#set_password` に空文字拒否 + `password_set_at = Time.current` の代入を追加
4. Controller 層のトランザクション保護（#105）
   - `unlink_provider` のトランザクション + rescue
5. `lockout:detect` Rake タスク（#110）

各ステップで TDD（テストを先に書き失敗を確認してから実装）を徹底する。
