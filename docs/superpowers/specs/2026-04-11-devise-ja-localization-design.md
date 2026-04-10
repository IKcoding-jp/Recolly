# devise.ja.yml + Rails標準バリデーション 日本語化

## 概要

Deviseのフラッシュメッセージ・バリデーションメッセージ、およびRails標準バリデーションメッセージを日本語化する。
現状、Deviseのデフォルト英語メッセージがそのまま `errors.full_messages` 経由でAPIレスポンスに含まれており、日本語UIと不整合が発生している。

## 背景

- コントローラーでハードコードしたエラーメッセージは既に日本語
- しかし `errors.full_messages` 経由で返るDevise/Railsのバリデーションメッセージは英語のまま
- 例: "Email has already been taken", "Password can't be blank", "Invalid Email or password."

## スコープ

### 含まれるもの

1. `config/application.rb` に `config.i18n.default_locale = :ja` を設定
2. `config/locales/devise.ja.yml` を新規作成（Deviseメッセージ全キーの日本語訳）
3. `config/locales/ja.yml` を新規作成（Rails標準バリデーション + モデル属性名の日本語訳）
4. 日本語化により壊れる既存テストの修正

### 含まれないもの

- フロントエンドの変更（バックエンドのみ）
- 多言語切り替え機能（Recollyは日本語のみ）
- devise-i18n / rails-i18n gemの導入（手動で翻訳ファイルを作成する）

## 技術設計

### 1. config/application.rb の変更

```ruby
config.i18n.default_locale = :ja
```

### 2. config/locales/devise.ja.yml

`devise.en.yml` の全キーを日本語化する。主な翻訳:

| キー | 英語 | 日本語 |
|------|------|--------|
| `devise.failure.invalid` | Invalid %{authentication_keys} or password. | メールアドレスまたはパスワードが正しくありません |
| `devise.failure.unauthenticated` | You need to sign in or sign up before continuing. | ログインが必要です |
| `devise.sessions.signed_in` | Signed in successfully. | ログインしました |
| `devise.sessions.signed_out` | Signed out successfully. | ログアウトしました |
| `devise.registrations.signed_up` | Welcome! You have signed up successfully. | アカウントを登録しました |
| `devise.passwords.send_instructions` | You will receive an email with instructions on how to reset your password in a few minutes. | パスワードリセットの手順をメールで送信しました |
| `devise.passwords.updated` | Your password has been changed successfully. You are now signed in. | パスワードを変更しました |
| `devise.mailer.reset_password_instructions.subject` | Reset password instructions | パスワードリセットのご案内 |
| `devise.mailer.confirmation_instructions.subject` | Confirmation instructions | メールアドレス確認のご案内 |
| `devise.mailer.email_changed.subject` | Email Changed | メールアドレス変更のお知らせ |
| `devise.mailer.password_change.subject` | Password Changed | パスワード変更のお知らせ |

（上記は代表例。devise.en.yml の全キーを網羅する）

### 3. config/locales/ja.yml

Rails標準バリデーションメッセージとモデル属性名の日本語化。

#### バリデーションメッセージ（errors.messages）

| キー | 英語 | 日本語 |
|------|------|--------|
| `blank` | can't be blank | を入力してください |
| `taken` | has already been taken | はすでに存在します |
| `too_short` | is too short (minimum is %{count} characters) | は%{count}文字以上で入力してください |
| `too_long` | is too long (maximum is %{count} characters) | は%{count}文字以内で入力してください |
| `invalid` | is invalid | は不正な値です |
| `confirmation` | doesn't match %{attribute} | が一致しません |
| `not_a_number` | is not a number | は数値で入力してください |
| `greater_than` | must be greater than %{count} | は%{count}より大きい値にしてください |
| `less_than_or_equal_to` | must be less than or equal to %{count} | は%{count}以下の値にしてください |

（Rails標準の全バリデーションメッセージキーを網羅する）

#### モデル属性名（activerecord.attributes）

```yaml
ja:
  activerecord:
    attributes:
      user:
        email: メールアドレス
        password: パスワード
        password_confirmation: パスワード（確認用）
        username: ユーザー名
```

これにより `errors.full_messages` が「メールアドレスを入力してください」のような自然な日本語になる。

### 4. 既存テストへの影響

以下のテストが英語メッセージをアサーションしており、修正が必要:

- `spec/models/image_spec.rb:27` — `"can't be blank"` → `"を入力してください"`
- `spec/models/image_spec.rb:34` — `"has already been taken"` → `"はすでに存在します"`

## テスト方針

1. `I18n.default_locale` が `:ja` であることを確認するテスト
2. Deviseの主要キーに翻訳漏れがないことを確認するテスト（`translation missing` が出ないこと）
3. Rails標準バリデーションの主要キーに翻訳漏れがないことを確認するテスト
4. 既存テストの修正（英語メッセージ → 日本語メッセージ）
5. 既存の全テストがパスすることの確認
