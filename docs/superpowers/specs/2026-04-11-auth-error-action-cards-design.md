# 認証エラー時のアクション誘導カード設計

## 概要

OAuthButtons と AccountSettingsPage でエラーが発生した際に、ユーザーが次に取るべきアクションを明示するカード型UIを追加する。

対象Issue: #113, #114

## 背景

- OAuthButtons: エラーメッセージのテキストだけ表示されており、次のアクションが分からない
- AccountSettingsPage: 連携解除失敗時に「パスワードを設定してください」と出るが、パスワードフォームへの導線がない

## 新規コンポーネント: ActionErrorCard

`frontend/src/components/ui/ActionErrorCard/` に配置する共通コンポーネント。

### Props

```typescript
type ActionErrorCardProps = {
  title: string           // 太字のタイトル
  message: string         // 説明文
  actionLabel?: string    // ボタンテキスト（省略時はボタン非表示）
  onAction?: () => void   // ボタンクリック時の処理（省略可）
}
```

### デザイン

PR #119 のヒントカードと同じ雰囲気のカード型表示。

- 背景色: `var(--color-error-bg)` (#fef2f2)
- ボーダー: `var(--color-error)` (#c0392b)
- 角丸: `var(--radius-md)` (8px)
- パディング: `var(--spacing-md)` (1rem)
- タイトル: `var(--color-error)`, `var(--font-weight-medium)`, `var(--font-size-label)`
- メッセージ: `var(--color-text)`, `var(--font-size-meta)`
- ボタン: 背景 `var(--color-text)`, 文字 `var(--color-bg-white)`, 角丸 `var(--radius-sm)`

## 変更箇所

### 1. OAuthButtons (#113)

**ファイル:** `frontend/src/components/OAuthButtons/OAuthButtons.tsx`

**現状:** catchブロックで `ApiError.message` のみ使用。エラーコード(`code`)を見ていない。

**変更内容:**

- `error` state を文字列から `{ message: string; code?: string }` 型に変更
- catchブロックで `ApiError.code` も保持
- エラーコード別の表示分岐:

| エラーコード | タイトル | ボタン | ボタン動作 |
|-------------|---------|--------|-----------|
| `email_already_registered` | ログイン方法が異なります | メールでログイン | メールフォームにスクロール＆フォーカス |
| `email_registered_with_other_provider` | 別のアカウントで登録済みです | なし | — |
| その他 | — | — | 現状通りテキスト表示 |

**スクロール先:** LoginPage のメールフォームに `id="email-login-form"` を付与。OAuthButtons は `onAction` コールバック経由でスクロールを実行（親コンポーネントから制御）。

### 2. AccountSettingsPage (#114)

**ファイル:**
- `frontend/src/pages/AccountSettingsPage/useAccountSettings.ts`
- `frontend/src/pages/AccountSettingsPage/AccountSettingsPage.tsx`

**現状:** `providerError` が文字列のみ。エラーコードを保持していない。

**変更内容:**

- `useAccountSettings` フックの `providerError` を `{ message: string; code?: string } | null` 型に変更
- `last_login_method` エラー時に ActionErrorCard を表示:

| エラーコード | タイトル | ボタン | ボタン動作 |
|-------------|---------|--------|-----------|
| `last_login_method` | 解除できません | パスワードを設定する | パスワードフォームにスクロール＆フォーカス |
| その他 | — | — | 現状通りテキスト表示 |

**スクロール先:** パスワード設定フォームに `id="password-form"` を付与。`scrollIntoView({ behavior: 'smooth' })` でスムーズスクロール。

## バックエンド変更

なし。

- `email_registered_with_other_provider` エラー時のプロバイダ名は `email_conflict_checker.rb` が既にメッセージに埋め込んでいる
- `last_login_method` エラーは既にコード付きで返却されている

## テスト

### ActionErrorCard 単体テスト
- タイトルとメッセージが表示される
- actionLabel を渡した時にボタンが表示される
- actionLabel を渡さない時にボタンが非表示
- ボタンクリックで onAction が呼ばれる

### OAuthButtons テスト追加
- `email_already_registered` エラー時に ActionErrorCard が表示される
- `email_already_registered` エラー時に「メールでログイン」ボタンが表示される
- `email_registered_with_other_provider` エラー時に ActionErrorCard が表示される（ボタンなし）
- その他のエラー時は従来通りテキスト表示

### AccountSettingsPage テスト追加
- `last_login_method` エラー時に ActionErrorCard が表示される
- 「パスワードを設定する」ボタンが表示される
- ボタンクリックでスクロールが実行される
- その他のエラー時は従来通りテキスト表示

## スタイルルール

- 全てのスタイル値は `tokens.css` のCSS変数を使用
- ハードコードされた色・サイズ値は禁止
