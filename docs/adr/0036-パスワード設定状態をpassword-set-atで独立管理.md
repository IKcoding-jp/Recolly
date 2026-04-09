# ADR-0036: パスワード設定状態を password_set_at で独立管理

## ステータス
承認済み

## 背景

ADR-0035 の Google Identity Services 移行（PR #104）の動作確認中に、本番環境のオーナーアカウント (user_id=1) が `encrypted_password` 空文字 かつ `user_providers` 空 の「どのログイン方法でもログインできない」ロックアウト状態に陥る事例が発生した。AWS SSM Session Manager 経由の Rails console で手動復旧が必要だった。

git log 調査の結果、セーフガード `AccountSettingsController#last_login_method?` は初回コミット（2026-03-23）から存在しており、コードパスだけでは発生経路を説明できない。ただし根本原因として、`OauthRegistrationsController#create_oauth_user` に以下のコードが残っていることが判明した：

```ruby
user.save!
# OAuthユーザーはパスワード認証不要のため、暗号化パスワードをクリア
user.update_column(:encrypted_password, '')
```

この「encrypted_password 空文字ハック」が、OAuth専用ユーザーの `has_password` 判定を成立させる唯一の仕組みになっていた。`ApplicationController#user_json` の `has_password: user.encrypted_password.present?` がこれに依存している。

Issue #105 で多層防御を追加するにあたり、このハックを削除したい。しかし単純に `update_column` を消すと、`SecureRandom.hex(32)` で作られたランダムパスワードのハッシュがそのまま残り、OAuth 専用ユーザーも `encrypted_password.present? = true` → UI が「パスワード設定済み」と誤表示してしまう。本人は設定していないランダム32文字なので、UX が壊れる。

そこで、パスワード設定状態を `encrypted_password` から独立した形で管理する必要がある。

## 選択肢

### A案: users.password_set_at (datetime) カラムを新設
- **これは何か:** ユーザーが自分でパスワードを設定したタイミングを記録する新カラム。OAuth 新規登録時は NULL のまま、`set_password` 成功時に `Time.current` を代入する。`has_password` の判定は `encrypted_password.present?` から `password_set_at.present?` に切り替える。
- **長所:**
  - has_password 判定が直感的（NULL でなければ設定済み）
  - 「いつパスワードを設定したか」の履歴が追える（将来の監査・通知機能に活用可能）
  - encrypted_password は常に bcrypt ハッシュで統一され、空文字ハックを根絶できる
  - Issue #105 の根本修正になる
  - 将来の #107（パスワードリセット機能）と整合性が良い
- **短所:**
  - DB マイグレーションとバックフィル（既存レコードへの値埋め）が必要
  - `has_password` を参照する箇所を一斉に書き換える必要がある

### B案: users.password_set_by_user (boolean) カラムを新設
- **これは何か:** A案の datetime 代わりに boolean。`true` / `false` のシンプルな真偽値で設定済みか否かを記録する。
- **長所:**
  - コードがシンプル
  - ストレージ効率が datetime よりわずかに良い
- **短所:**
  - 「いつ設定したか」の情報が失われる
  - 将来の「最終パスワード変更から90日」「初回パスワード設定からの猶予期間」といった機能に対応できない
  - A案 と実装コストはほぼ同じなのに情報量が劣る

### C案: update_column(:encrypted_password, '') の削除を諦め、現状維持
- **これは何か:** OAuth 新規登録時に `encrypted_password` を空文字にするハックを残したまま、防御層（`User#before_update`、`UserProvider#before_destroy`）だけ追加する。
- **長所:**
  - DB 変更不要、マイグレーション不要
  - 既存コードの変更量が最小
- **短所:**
  - ロックアウトの根本原因（空文字ハック）が残る
  - Issue #105 の「多層防御を全部やる」方針と矛盾する
  - 将来 #107 のパスワードリセット機能実装時に、OAuth ユーザーが初めてパスワードを設定した瞬間の状態遷移が不自然（空文字 → bcrypt ハッシュ）
  - 「DB 上の空文字」が技術的負債として残り続ける

## 決定

**A案（`password_set_at` datetime カラムの新設）を採用する。**

## 理由

- ロックアウトの根本原因である「encrypted_password 空文字ハック」を完全に根絶できる。Issue #105 の修正方針として最も clean
- `has_password` の判定が「NULL か否か」という直感的な形になり、コードの意味が明確になる
- #107（パスワードリセット）実装時に、「OAuth ユーザーが初めてパスワードを設定した日」として意味のあるデータになる
- bcrypt のパスワードハッシュを空文字にするハックは、他のセキュリティ機構（例: Devise の recoverable）との相互作用で予期しない問題を引き起こすリスクがある
- B案の boolean と比べて datetime は情報量が多く、将来の拡張に対応できる。コードの複雑さの差は僅か
- C案は根本修正にならず、IK さんの「多層防御を全部やる」という PR-A の方針と矛盾する

## 影響

### マイグレーション

`db/migrate/YYYYMMDDHHMMSS_add_password_set_at_to_users.rb` を新規作成し、以下を実行する：

```ruby
class AddPasswordSetAtToUsers < ActiveRecord::Migration[8.0]
  def up
    add_column :users, :password_set_at, :datetime, null: true

    # バックフィル: encrypted_password が空文字ではない既存ユーザーに現在時刻を設定
    execute <<~SQL
      UPDATE users
      SET password_set_at = NOW()
      WHERE encrypted_password IS NOT NULL
        AND encrypted_password != ''
    SQL
  end

  def down
    remove_column :users, :password_set_at
  end
end
```

- `null: true`: OAuth 新規登録時は NULL を許可
- インデックスは付けない（password_set_at で検索するクエリがないため）
- 本番実行時、`encrypted_password = ''` の既存ユーザーは NULL になる（UI 上は「パスワード未設定」と正しく表示される）

### コード変更箇所

- **ApplicationController#user_json:**
  - `has_password: user.encrypted_password.present?` → `has_password: user.password_set_at.present?`
- **AccountSettingsController#set_password:**
  - 成功時に `current_user.password_set_at = Time.current` を代入（save と同トランザクション内）
  - 空文字を拒否するバリデーションも追加（Issue #105）
- **AccountSettingsController#last_login_method?:**
  - `encrypted_password.present?` → `password_set_at.present?` に変更
- **OauthRegistrationsController#create_oauth_user:**
  - `user.update_column(:encrypted_password, '')` を削除
  - `password_set_at` は build 時点で nil のまま（明示的に設定しない）
  - 不要になった `ActiveRecord::Base.transaction` ブロックも削除（単一 save! のみ）
- **User モデル:**
  - `before_update :prevent_lockout_transition` コールバック追加（多層防御）
- **UserProvider モデル:**
  - `before_destroy :prevent_lockout_on_destroy` コールバック追加（多層防御）

### テストへの影響

- 既存 request spec で `has_password` の期待値を検証している箇所は、API 仕様が変わらないため基本的に修正不要
- 新規テスト: `password_set_at` が set_password 成功時に設定されるか
- 新規テスト: OAuth 新規登録後の `password_set_at` が NULL であるか
- 新規テスト: `prevent_lockout_transition` コールバックがロックアウト遷移を拒否するか
- 新規テスト: `prevent_lockout_on_destroy` コールバックが最後の UserProvider 削除を拒否するか

### 関連

- Issue #105（根本修正対象）
- PR #104 / ADR-0035（きっかけ）
- 将来 Issue #107（パスワードリセット機能）でも活用される
