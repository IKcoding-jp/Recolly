# Devise + Rails標準バリデーション日本語化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deviseのフラッシュメッセージ・バリデーションメッセージ、およびRails標準バリデーションメッセージを日本語化する。

**Architecture:** `config.i18n.default_locale = :ja` を設定し、`devise.ja.yml`（Deviseメッセージ）と `ja.yml`（Rails標準バリデーション + モデル属性名）を手動作成する。gem追加なし。

**Tech Stack:** Ruby on Rails 8 / Devise / I18n / RSpec

**Issue:** #122

---

## ファイル構成

| ファイル | 操作 | 責務 |
|---------|------|------|
| `backend/config/application.rb` | 修正 | `default_locale = :ja` を追加 |
| `backend/config/locales/ja.yml` | 新規 | Rails標準バリデーション + モデル属性名 |
| `backend/config/locales/devise.ja.yml` | 新規 | Deviseメッセージ全キーの日本語訳 |
| `backend/spec/config/i18n_spec.rb` | 新規 | ロケール設定 + 翻訳漏れチェック |
| `backend/spec/models/image_spec.rb` | 修正 | 英語メッセージ→日本語メッセージに修正 |

---

## Task 1: default_locale の設定 + ロケール設定テスト

**Files:**
- Modify: `backend/config/application.rb:37`（`config.time_zone` コメント付近）
- Create: `backend/spec/config/i18n_spec.rb`

- [ ] **Step 1: ロケール設定テストを作成**

`backend/spec/config/i18n_spec.rb` を作成:

```ruby
# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'I18n設定' do
  describe 'default_locale' do
    it 'デフォルトロケールが:jaであること' do
      expect(I18n.default_locale).to eq(:ja)
    end
  end
end
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `docker compose exec backend bundle exec rspec spec/config/i18n_spec.rb -v`
Expected: FAIL — `expected: :ja, got: :en`

- [ ] **Step 3: application.rb に default_locale を設定**

`backend/config/application.rb` の `config.autoload_lib` の後に追加:

```ruby
    # デフォルトロケールを日本語に設定（Issue #122）
    config.i18n.default_locale = :ja
```

- [ ] **Step 4: テストがパスすることを確認**

Run: `docker compose exec backend bundle exec rspec spec/config/i18n_spec.rb -v`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add backend/config/application.rb backend/spec/config/i18n_spec.rb
git commit -m "feat(backend): I18n default_locale を :ja に設定 #122"
```

---

## Task 2: Rails標準バリデーション日本語化（ja.yml）

**Files:**
- Create: `backend/config/locales/ja.yml`
- Modify: `backend/spec/config/i18n_spec.rb`

- [ ] **Step 1: 翻訳漏れチェックテストを追加**

`backend/spec/config/i18n_spec.rb` に以下を追加:

```ruby
  describe 'Rails標準バリデーションメッセージ' do
    it '主要なバリデーションキーが翻訳されていること' do
      keys = %i[blank taken invalid too_short too_long confirmation
                not_a_number greater_than less_than_or_equal_to
                greater_than_or_equal_to]
      keys.each do |key|
        translation = I18n.t("errors.messages.#{key}", count: 1, attribute: 'テスト')
        expect(translation).not_to include('translation missing'),
          "errors.messages.#{key} が未翻訳です"
      end
    end

    it 'Userモデルの属性名が翻訳されていること' do
      %i[email password username].each do |attr|
        name = User.human_attribute_name(attr)
        expect(name).not_to eq(attr.to_s),
          "User.#{attr} の属性名が未翻訳です"
      end
    end
  end
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `docker compose exec backend bundle exec rspec spec/config/i18n_spec.rb -v`
Expected: FAIL — `translation missing` および属性名が未翻訳

- [ ] **Step 3: ja.yml を作成**

`backend/config/locales/ja.yml` を作成:

```yaml
ja:
  activerecord:
    errors:
      messages:
        record_invalid: "バリデーションに失敗しました: %{errors}"
        restrict_dependent_destroy:
          has_one: "%{record}が存在しているため削除できません"
          has_many: "%{record}が存在しているため削除できません"
    attributes:
      user:
        email: メールアドレス
        password: パスワード
        password_confirmation: パスワード（確認用）
        username: ユーザー名
        bio: 自己紹介
  errors:
    format: "%{attribute}%{message}"
    messages:
      accepted: を承認してください
      blank: を入力してください
      confirmation: が一致しません
      empty: を入力してください
      equal_to: は%{count}にしてください
      even: は偶数にしてください
      exclusion: は予約されています
      greater_than: は%{count}より大きい値にしてください
      greater_than_or_equal_to: は%{count}以上の値にしてください
      in: は%{count}の範囲に含めてください
      inclusion: は一覧にありません
      invalid: は不正な値です
      less_than: は%{count}より小さい値にしてください
      less_than_or_equal_to: は%{count}以下の値にしてください
      model_invalid: "バリデーションに失敗しました: %{errors}"
      not_a_number: は数値で入力してください
      not_an_integer: は整数で入力してください
      odd: は奇数にしてください
      other_than: は%{count}以外の値にしてください
      present: は入力しないでください
      required: を入力してください
      taken: はすでに存在します
      too_long: は%{count}文字以内で入力してください
      too_short: は%{count}文字以上で入力してください
      wrong_length: は%{count}文字で入力してください
```

- [ ] **Step 4: テストがパスすることを確認**

Run: `docker compose exec backend bundle exec rspec spec/config/i18n_spec.rb -v`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add backend/config/locales/ja.yml backend/spec/config/i18n_spec.rb
git commit -m "feat(backend): Rails標準バリデーションメッセージを日本語化 #122"
```

---

## Task 3: Deviseメッセージ日本語化（devise.ja.yml）

**Files:**
- Create: `backend/config/locales/devise.ja.yml`
- Modify: `backend/spec/config/i18n_spec.rb`

- [ ] **Step 1: Devise翻訳漏れチェックテストを追加**

`backend/spec/config/i18n_spec.rb` に以下を追加:

```ruby
  describe 'Deviseメッセージ' do
    it 'devise.en.yml の全キーが devise.ja.yml にも存在すること' do
      en_devise = I18n.backend.translations[:en][:devise] || {}
      ja_devise = I18n.backend.translations[:ja][:devise] || {}

      missing = find_missing_keys(en_devise, ja_devise)
      expect(missing).to be_empty,
        "以下のDeviseキーが日本語訳にありません:\n#{missing.join("\n")}"
    end

    it 'Deviseの認証失敗メッセージが日本語であること' do
      msg = I18n.t('devise.failure.invalid', authentication_keys: 'メールアドレス')
      expect(msg).not_to include('Invalid')
      expect(msg).to include('メールアドレス')
    end

    it 'Deviseのメール件名が日本語であること' do
      subject = I18n.t('devise.mailer.reset_password_instructions.subject')
      expect(subject).not_to include('Reset')
    end
  end

  private

  # ネストされたHashのキーを再帰的に比較し、不足キーをドット区切りで返す
  def find_missing_keys(reference, target, prefix = '')
    missing = []
    reference.each_key do |key|
      full_key = prefix.empty? ? key.to_s : "#{prefix}.#{key}"
      if reference[key].is_a?(Hash)
        if target[key].is_a?(Hash)
          missing += find_missing_keys(reference[key], target[key], full_key)
        else
          missing << "#{full_key} (セクションごと不足)"
        end
      elsif !target.key?(key)
        missing << full_key
      end
    end
    missing
  end
```

注意: `find_missing_keys` はprivateメソッドだが、RSpecのdescribeブロック内ではヘルパーメソッドとして定義する。実際には `describe` ブロックの外・`RSpec.describe` ブロックの内側に `def` で定義する。

- [ ] **Step 2: テストが失敗することを確認**

Run: `docker compose exec backend bundle exec rspec spec/config/i18n_spec.rb -v`
Expected: FAIL — Deviseの日本語キーが存在しない

- [ ] **Step 3: devise.ja.yml を作成**

`backend/config/locales/devise.ja.yml` を作成:

```yaml
ja:
  devise:
    confirmations:
      confirmed: "メールアドレスの確認が完了しました"
      send_instructions: "メールアドレスの確認手順をメールで送信しました"
      send_paranoid_instructions: "メールアドレスが登録済みの場合、確認手順をメールで送信します"
    failure:
      already_authenticated: "すでにログインしています"
      inactive: "アカウントがまだ有効化されていません"
      invalid: "%{authentication_keys}またはパスワードが正しくありません"
      locked: "アカウントがロックされています"
      last_attempt: "あと1回失敗するとアカウントがロックされます"
      not_found_in_database: "%{authentication_keys}またはパスワードが正しくありません"
      timeout: "セッションの有効期限が切れました。もう一度ログインしてください"
      unauthenticated: "ログインが必要です"
      unconfirmed: "メールアドレスの確認が必要です"
    mailer:
      confirmation_instructions:
        subject: "メールアドレス確認のご案内"
      reset_password_instructions:
        subject: "パスワードリセットのご案内"
      unlock_instructions:
        subject: "アカウントロック解除のご案内"
      email_changed:
        subject: "メールアドレス変更のお知らせ"
      password_change:
        subject: "パスワード変更のお知らせ"
    omniauth_callbacks:
      failure: "%{kind}での認証に失敗しました（理由: %{reason}）"
      success: "%{kind}アカウントで認証しました"
    passwords:
      no_token: "このページにはパスワードリセットメールのリンクからのみアクセスできます。リセットメールからアクセスした場合は、URLが正しいことをご確認ください"
      send_instructions: "パスワードリセットの手順をメールで送信しました"
      send_paranoid_instructions: "メールアドレスが登録済みの場合、パスワードリセットの手順をメールで送信します"
      updated: "パスワードを変更しました"
      updated_not_active: "パスワードを変更しました"
    registrations:
      destroyed: "アカウントを削除しました。またのご利用をお待ちしています"
      signed_up: "アカウントを登録しました"
      signed_up_but_inactive: "アカウントを登録しましたが、まだ有効化されていません"
      signed_up_but_locked: "アカウントを登録しましたが、アカウントがロックされています"
      signed_up_but_unconfirmed: "確認メールを送信しました。メール内のリンクをクリックしてアカウントを有効化してください"
      update_needs_confirmation: "アカウントを更新しましたが、新しいメールアドレスの確認が必要です。確認メールをご確認ください"
      updated: "アカウントを更新しました"
      updated_but_not_signed_in: "アカウントを更新しましたが、パスワードが変更されたため再ログインが必要です"
    sessions:
      signed_in: "ログインしました"
      signed_out: "ログアウトしました"
      already_signed_out: "ログアウトしました"
    unlocks:
      send_instructions: "アカウントロック解除の手順をメールで送信しました"
      send_paranoid_instructions: "アカウントが存在する場合、ロック解除の手順をメールで送信します"
      unlocked: "アカウントのロックを解除しました。ログインしてください"
  errors:
    messages:
      already_confirmed: "はすでに確認済みです。ログインしてください"
      confirmation_period_expired: "は%{period}以内に確認する必要があります。再送信してください"
      expired: "の有効期限が切れました。再発行してください"
      not_found: "は見つかりませんでした"
      not_locked: "はロックされていません"
      not_saved:
        one: "1件のエラーにより%{resource}を保存できませんでした:"
        other: "%{count}件のエラーにより%{resource}を保存できませんでした:"
```

- [ ] **Step 4: テストがパスすることを確認**

Run: `docker compose exec backend bundle exec rspec spec/config/i18n_spec.rb -v`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add backend/config/locales/devise.ja.yml backend/spec/config/i18n_spec.rb
git commit -m "feat(backend): Deviseメッセージを日本語化 #122"
```

---

## Task 4: 既存テストの修正

**Files:**
- Modify: `backend/spec/models/image_spec.rb:27,34`

- [ ] **Step 1: 壊れているテストを確認**

Run: `docker compose exec backend bundle exec rspec spec/models/image_spec.rb -v`
Expected: FAIL — `"can't be blank"` と `"has already been taken"` が日本語に変わっているため

- [ ] **Step 2: image_spec.rb の英語メッセージを日本語に修正**

`backend/spec/models/image_spec.rb` の2箇所を修正:

27行目:
```ruby
      # 変更前: expect(image.errors[:s3_key]).to include("can't be blank")
      expect(image.errors[:s3_key]).to include("を入力してください")
```

34行目:
```ruby
      # 変更前: expect(duplicate.errors[:s3_key]).to include('has already been taken')
      expect(duplicate.errors[:s3_key]).to include('はすでに存在します')
```

- [ ] **Step 3: 修正したテストがパスすることを確認**

Run: `docker compose exec backend bundle exec rspec spec/models/image_spec.rb -v`
Expected: PASS

- [ ] **Step 4: コミット**

```bash
git add backend/spec/models/image_spec.rb
git commit -m "fix(backend): image_spec のバリデーションメッセージを日本語に合わせて修正 #122"
```

---

## Task 5: 全テスト + リンター実行

**Files:** なし（検証のみ）

- [ ] **Step 1: 全テストを実行**

Run: `docker compose exec backend bundle exec rspec`
Expected: 全テスト PASS

- [ ] **Step 2: RuboCop を実行**

Run: `docker compose exec backend bundle exec rubocop`
Expected: no offenses detected

- [ ] **Step 3: 問題があれば修正してコミット**

問題がなければこのステップはスキップ。
