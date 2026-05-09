# Recolly Design System

このファイルはAI（Claude Code）が新しいUIを生成するときに必ず参照するデザイン憲法。
コードを書く前に必ずこのファイルを読み、禁止事項・使用ルールを確認すること。

---

## Colors

### 基本色

| トークン | 値 | 用途 |
|---|---|---|
| `--color-bg` | `#fafaf8` | ページ背景・ホバー背景 |
| `--color-bg-white` | `#ffffff` | カード・モーダル背景 |
| `--color-text` | `#2c2c2c` | メインテキスト・ボーダー |
| `--color-text-muted` | `#6b6b6b` | サブテキスト・プレースホルダー |
| `--color-border` | `#2c2c2c` | 強調ボーダー |
| `--color-border-light` | `#e0e0e0` | 通常ボーダー・区切り線 |
| `--color-accent` | `#c85a3f` | アクセントカラー（CTAボタン等） |

### ステータス色

| トークン | 値 | 用途 |
|---|---|---|
| `--color-error` | `#c0392b` | エラーテキスト・ボーダー |
| `--color-error-bg` | `#fef2f2` | エラー背景 |
| `--color-success` | `#2e7d32` | 成功テキスト |
| `--color-warning-bg` | `#fff8e1` | 警告背景 |
| `--color-star` | `#f59e0b` | 評価星 |

### メディアタイプ別色

各メディアタイプの識別色。ステータスバッジ等に使用する。

| トークン | 値 | メディア |
|---|---|---|
| `--color-anime` | `#3d5a80` | アニメ |
| `--color-movie` | `#5e548e` | 映画 |
| `--color-drama` | `#9f86c0` | ドラマ |
| `--color-book` | `#c4956a` | 本 |
| `--color-manga` | `#e07a5f` | 漫画 |
| `--color-game` | `#6b9080` | ゲーム |

---

## Typography

### フォントファミリー

| トークン | フォント | 用途 |
|---|---|---|
| `--font-heading` | `'Fraunces', serif` | 見出し・ロゴ |
| `--font-body` | `'Zen Kaku Gothic New', sans-serif` | 本文・UI全般 |

### フォントサイズ

| トークン | 値 | 用途 |
|---|---|---|
| `--font-size-h1` | `3rem` | ページタイトル（LandingPage等） |
| `--font-size-h2` | `2rem` | セクション大見出し |
| `--font-size-h3` | `1.5rem` | セクション中見出し |
| `--font-size-h4` | `1.25rem` | サブ見出し |
| `--font-size-body` | `1rem` | 通常テキスト |
| `--font-size-label` | `0.875rem` | ラベル・フォーム |
| `--font-size-meta` | `0.75rem` | メタ情報・エラーテキスト |
| `--font-size-logo` | `1.375rem` | ナビゲーションロゴ専用 |

### フォントウェイト

| トークン | 値 |
|---|---|
| `--font-weight-normal` | `400` |
| `--font-weight-medium` | `500` |
| `--font-weight-bold` | `700` |

---

## Spacing & Layout

### スペーシング

| トークン | 値 | 目安 |
|---|---|---|
| `--spacing-xs` | `0.25rem` | アイコン間・最小余白 |
| `--spacing-sm` | `0.5rem` | タイト |
| `--spacing-md` | `1rem` | 標準（最多使用） |
| `--spacing-lg` | `1.5rem` | 少し広め |
| `--spacing-xl` | `2rem` | セクション内余白 |
| `--spacing-2xl` | `3rem` | セクション間 |
| `--spacing-3xl` | `4rem` | 大きなセクション間 |

### レイアウト

| トークン | 値 | 用途 |
|---|---|---|
| `--page-max-width` | `900px` | 全ページ共通の最大幅（PageLayoutが使用） |
| `--bottom-tab-height` | `64px` | モバイル用BottomTabBarの高さ |

---

## Components

### 使用必須コンポーネント一覧

新しいUIを作る前に `frontend/src/components/ui/` を確認し、同等の機能を持つコンポーネントがあれば必ずそれを使う。

| コンポーネント | 用途 | 代替禁止 |
|---|---|---|
| `<Button>` | あらゆるボタン | `<button>` 直書き禁止 |
| `<FormInput>` | テキスト入力 | `<input>` 直書き禁止 |
| `<FormSelect>` | セレクトボックス | `<select>` 直書き禁止 |
| `<FormTextarea>` | テキストエリア | `<textarea>` 直書き禁止 |
| `<Typography>` | テキスト表示（h1〜meta） | 生の `<p>/<h1>` 等は原則禁止 |
| `<SectionTitle>` | ページ内セクション見出し | 独自見出しスタイル禁止 |
| `<PageLayout>` | 全ページのラッパー | ページ固有のコンテナCSS禁止 |
| `<Pagination>` | ページネーション | 独自実装禁止 |
| `<SearchInput>` | 検索入力 | 独自実装禁止 |

---

## Forbidden（禁止事項）

以下は必ず守ること。違反しているコードを見つけた場合は修正してから先に進む。

### CSSのルール

- `px`・`rem`・`em`・カラーコードをCSSに直書きしない
- `tokens.css` に存在しないCSS変数名を使わない
- `tokens.css` にないトークン値が必要なときは、まずトークンを追加してから使う
- `max-width`・`padding`・`margin: 0 auto` をページ固有CSSに書かない（PageLayoutが担う）

### コンポーネントのルール

- `<input>`・`<select>`・`<textarea>` をJSX内に直接書かない
- 既存UIコンポーネントと同機能のコンポーネントを新規作成しない
- ページ固有CSSに `max-width` や水平 `padding` を書かない（PageLayoutが担う）

---

## New Page Checklist

新しいページを作るときは以下をすべて満たすこと：

- [ ] `PageLayout` コンポーネントでページコンテンツをラップしている
- [ ] `SectionTitle` コンポーネントでセクション見出しを表示している
- [ ] CSS値はすべて `tokens.css` の変数を使っている（直書きなし）
- [ ] `frontend/src/components/ui/` の既存コンポーネントを確認・活用している
- [ ] `<input>`・`<select>`・`<textarea>` を直接使っていない
