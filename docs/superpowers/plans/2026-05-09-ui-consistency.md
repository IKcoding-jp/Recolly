# UI一貫性システム実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** DESIGN.md・CLAUDE.md追記・tokens.css整理・PageLayoutコンポーネントの4パーツを実装し、バイブコーディングによるUI不一致を仕組みで防ぐ。

**Architecture:** ドキュメント層（DESIGN.md・CLAUDE.md）でAIへのルールを明文化し、トークン層（tokens.css）でCSS値を一元化、コンポーネント層（PageLayout）でページレイアウトを統一する。既存17ページの修正は対象外。

**Tech Stack:** React 19 / TypeScript / CSS Modules / Vitest + React Testing Library / Docker Compose

---

## ファイル構成

| 操作 | パス | 内容 |
|---|---|---|
| 新規作成 | `DESIGN.md` | AIへのデザイン憲法 |
| 編集 | `CLAUDE.md` | デザインシステム参照ルールを追記 |
| 編集 | `frontend/src/styles/tokens.css` | 新トークン6種追加 |
| 編集 | `frontend/src/components/ui/FormInput/FormInput.module.css` | 2px・1.5px をトークン参照に変更 |
| 編集 | `frontend/src/components/ui/NavBar/NavBar.module.css` | 1.375rem・1.5px をトークン参照に変更 |
| 編集 | `frontend/src/components/RecordListItem/RecordListItem.module.css` | 50px・70px をトークン参照に変更 |
| 新規作成 | `frontend/src/components/ui/PageLayout/PageLayout.tsx` | ページラッパーコンポーネント |
| 新規作成 | `frontend/src/components/ui/PageLayout/PageLayout.module.css` | レイアウトCSS |
| 新規作成 | `frontend/src/components/ui/PageLayout/index.ts` | エクスポート |
| 新規作成 | `frontend/src/components/ui/PageLayout/PageLayout.test.tsx` | Vitestテスト |

---

## Task 1: DESIGN.md を作成する

**Files:**
- 新規作成: `DESIGN.md`

- [ ] **Step 1: DESIGN.md を作成する**

`DESIGN.md` をプロジェクトルートに新規作成する。以下の内容をそのまま書く：

```markdown
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
- ❌ `px`・`rem`・`em`・カラーコードをCSSに直書きしない
- ❌ `tokens.css` に存在しないCSS変数名を使わない
- ❌ `tokens.css` にないトークン値が必要なときは、まずトークンを追加してから使う
- ❌ `max-width`・`padding`・`margin: 0 auto` をページ固有CSSに書かない（PageLayoutが担う）

### コンポーネントのルール
- ❌ `<input>`・`<select>`・`<textarea>` をJSX内に直接書かない
- ❌ 既存UIコンポーネントと同機能のコンポーネントを新規作成しない
- ❌ ページ固有CSSに `max-width` や水平 `padding` を書かない（PageLayoutが担う）

---

## New Page Checklist

新しいページを作るときは以下をすべて満たすこと：

- [ ] `PageLayout` コンポーネントでページコンテンツをラップしている
- [ ] `SectionTitle` コンポーネントでセクション見出しを表示している
- [ ] CSS値はすべて `tokens.css` の変数を使っている（直書きなし）
- [ ] `frontend/src/components/ui/` の既存コンポーネントを確認・活用している
- [ ] `<input>`・`<select>`・`<textarea>` を直接使っていない
```

- [ ] **Step 2: コミットする**

```bash
git add DESIGN.md
git commit -m "docs: DESIGN.md を新規作成（AIへのデザイン憲法）"
```

---

## Task 2: CLAUDE.md にデザインルールを追記する

**Files:**
- 編集: `CLAUDE.md`

- [ ] **Step 1: 追記箇所を確認する**

`CLAUDE.md` を開き、`### フロントエンドUI一貫性ルール` セクションを見つける。  
`#### 新しいスタイル値が必要な場合` の手順の末尾（ファイル内の該当セクション最後）に追記する。

- [ ] **Step 2: CLAUDE.md に追記する**

`### フロントエンドUI一貫性ルール` セクションの末尾（次のセクション `## テスト` の直前）に以下を追加する：

```markdown
### デザインシステム参照ルール（AI向け）

新しいUIコンポーネント・ページを作るときは必ず以下の順で確認する：

1. `DESIGN.md` を読んで禁止事項・使用ルールを確認する
2. `frontend/src/components/ui/` に同機能のコンポーネントがないか確認する
3. `frontend/src/styles/tokens.css` からCSS変数を使う（値の直書き禁止）
4. 新しいページは `PageLayout` コンポーネントでラップする

### 新しいCSSを書く前のチェック

- px値・rem値・色コードを直書きしない → tokens.css の変数を使う
- tokens.css にない値が必要なときは、まずトークンを追加してから使う
- 既存コンポーネントと見た目が似ているUIを新規作成しない
```

- [ ] **Step 3: コミットする**

```bash
git add CLAUDE.md
git commit -m "docs: CLAUDE.md にデザインシステム参照ルールを追記"
```

---

## Task 3: tokens.css にトークンを追加しハードコード値を置き換える

**Files:**
- 編集: `frontend/src/styles/tokens.css`
- 編集: `frontend/src/components/ui/FormInput/FormInput.module.css`
- 編集: `frontend/src/components/ui/NavBar/NavBar.module.css`
- 編集: `frontend/src/components/RecordListItem/RecordListItem.module.css`

- [ ] **Step 1: tokens.css に新トークンを追加する**

`frontend/src/styles/tokens.css` を編集し、以下のトークンを追加する。

**① カラーセクション（`--color-accent` の次の行）に追加：**
```css
  /* --- 評価 --- */
  --color-star: #f59e0b;
```

**② タイポグラフィセクション（既存の `--font-size-tab` の次の行）に追加：**
```css
  --font-size-logo: 1.375rem;
```

**③ ボーダーセクション（既存の `--border-style` の次の行）に追加：**
```css
  --border-width-input: 1.5px;
```

**④ ファイル末尾の `:root { }` 閉じ括弧の直前に追加：**
```css
  /* --- レターースペーシング --- */
  --letter-spacing-nav: 1.5px;

  /* --- コンポーネント固有サイズ --- */
  --size-work-thumbnail-w: 50px;
  --size-work-thumbnail-h: 70px;

  /* --- レイアウト --- */
  --page-max-width: 900px;
  --spacing-input-x: 2px;
```

- [ ] **Step 2: FormInput.module.css のハードコード値を置き換える**

`frontend/src/components/ui/FormInput/FormInput.module.css` の `.input` クラスを以下に変更する：

変更前：
```css
.input {
  padding: var(--spacing-sm) 2px;
  border: none;
  border-bottom: 1.5px solid var(--color-border-light);
```

変更後：
```css
.input {
  padding: var(--spacing-sm) var(--spacing-input-x);
  border: none;
  border-bottom: var(--border-width-input) solid var(--color-border-light);
```

- [ ] **Step 3: NavBar.module.css のハードコード値を置き換える**

`frontend/src/components/ui/NavBar/NavBar.module.css` を以下の2箇所変更する：

変更前（`.logo` クラス）：
```css
.logo {
  font-family: var(--font-heading);
  font-weight: var(--font-weight-bold);
  font-size: 1.375rem;
```

変更後：
```css
.logo {
  font-family: var(--font-heading);
  font-weight: var(--font-weight-bold);
  font-size: var(--font-size-logo);
```

変更前（`.link` クラス）：
```css
.link {
  font-size: var(--font-size-body);
  font-weight: var(--font-weight-bold);
  letter-spacing: 1.5px;
```

変更後：
```css
.link {
  font-size: var(--font-size-body);
  font-weight: var(--font-weight-bold);
  letter-spacing: var(--letter-spacing-nav);
```

変更前（`.disabled` クラス）：
```css
.disabled {
  font-size: var(--font-size-body);
  font-weight: var(--font-weight-bold);
  letter-spacing: 1.5px;
```

変更後：
```css
.disabled {
  font-size: var(--font-size-body);
  font-weight: var(--font-weight-bold);
  letter-spacing: var(--letter-spacing-nav);
```

- [ ] **Step 4: RecordListItem.module.css のハードコード値を置き換える**

`frontend/src/components/RecordListItem/RecordListItem.module.css` の `.coverWrapper` クラスを変更する：

変更前：
```css
.coverWrapper {
  flex-shrink: 0;
  width: 50px;
  height: 70px;
}
```

変更後：
```css
.coverWrapper {
  flex-shrink: 0;
  width: var(--size-work-thumbnail-w);
  height: var(--size-work-thumbnail-h);
}
```

- [ ] **Step 5: ハードコード値が残っていないか確認する**

以下のコマンドを実行し、対象ファイルにハードコード値が残っていないことを確認する：

```bash
grep -n "1\.5px\|1\.375rem" frontend/src/components/ui/FormInput/FormInput.module.css frontend/src/components/ui/NavBar/NavBar.module.css frontend/src/components/RecordListItem/RecordListItem.module.css
```

期待する結果：**出力なし（0件）**

```bash
grep -n "width: 50px\|height: 70px" frontend/src/components/RecordListItem/RecordListItem.module.css
```

期待する結果：**出力なし（0件）**

- [ ] **Step 6: --color-star がトークンとして定義されていることを確認する**

```bash
grep "color-star" frontend/src/styles/tokens.css
```

期待する結果：
```
  --color-star: #f59e0b;
```

- [ ] **Step 7: コミットする**

```bash
git add frontend/src/styles/tokens.css \
        frontend/src/components/ui/FormInput/FormInput.module.css \
        frontend/src/components/ui/NavBar/NavBar.module.css \
        frontend/src/components/RecordListItem/RecordListItem.module.css
git commit -m "refactor: tokens.css にトークンを追加しハードコード値をトークン参照に変更"
```

---

## Task 4: PageLayout コンポーネントを作成する（TDD）

**Files:**
- 新規作成: `frontend/src/components/ui/PageLayout/PageLayout.test.tsx`
- 新規作成: `frontend/src/components/ui/PageLayout/PageLayout.tsx`
- 新規作成: `frontend/src/components/ui/PageLayout/PageLayout.module.css`
- 新規作成: `frontend/src/components/ui/PageLayout/index.ts`

- [ ] **Step 1: テストファイルを作成する（失敗状態）**

`frontend/src/components/ui/PageLayout/PageLayout.test.tsx` を新規作成する：

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { PageLayout } from './PageLayout'

describe('PageLayout', () => {
  it('子要素を描画する', () => {
    render(
      <PageLayout>
        <p>テストコンテンツ</p>
      </PageLayout>,
    )
    expect(screen.getByText('テストコンテンツ')).toBeInTheDocument()
  })

  it('追加のclassNameを受け取れる', () => {
    const { container } = render(
      <PageLayout className="custom-class">
        <p>コンテンツ</p>
      </PageLayout>,
    )
    expect(container.firstChild).toHaveClass('custom-class')
  })

  it('divタグとしてレンダリングされる', () => {
    const { container } = render(
      <PageLayout>
        <p>コンテンツ</p>
      </PageLayout>,
    )
    expect(container.firstChild?.nodeName).toBe('DIV')
  })
})
```

- [ ] **Step 2: テストを実行して失敗を確認する**

```bash
docker compose exec frontend npx vitest run src/components/ui/PageLayout/PageLayout.test.tsx
```

期待する結果：**FAIL**（`PageLayout` が存在しないためエラー）

- [ ] **Step 3: PageLayout.module.css を作成する**

`frontend/src/components/ui/PageLayout/PageLayout.module.css` を新規作成する：

```css
.layout {
  max-width: var(--page-max-width);
  margin: 0 auto;
  padding: var(--spacing-xl) var(--spacing-lg);
  padding-bottom: calc(var(--bottom-tab-height) + var(--spacing-xl));
}
```

- [ ] **Step 4: PageLayout.tsx を作成する**

`frontend/src/components/ui/PageLayout/PageLayout.tsx` を新規作成する：

```tsx
import styles from './PageLayout.module.css'

interface PageLayoutProps {
  children: React.ReactNode
  className?: string
}

export function PageLayout({ children, className }: PageLayoutProps) {
  const classes = [styles.layout, className].filter(Boolean).join(' ')
  return <div className={classes}>{children}</div>
}
```

- [ ] **Step 5: index.ts を作成する**

`frontend/src/components/ui/PageLayout/index.ts` を新規作成する：

```ts
export { PageLayout } from './PageLayout'
```

- [ ] **Step 6: テストを実行して成功を確認する**

```bash
docker compose exec frontend npx vitest run src/components/ui/PageLayout/PageLayout.test.tsx
```

期待する結果：
```
 ✓ src/components/ui/PageLayout/PageLayout.test.tsx (3)
   ✓ PageLayout > 子要素を描画する
   ✓ PageLayout > 追加のclassNameを受け取れる
   ✓ PageLayout > divタグとしてレンダリングされる

 Test Files  1 passed (1)
 Tests       3 passed (3)
```

- [ ] **Step 7: フロントエンド全テストを実行してリグレッションがないか確認する**

```bash
docker compose exec frontend npm test
```

期待する結果：全テスト PASS

- [ ] **Step 8: TypeCheck を実行する**

```bash
docker compose exec frontend npm run typecheck
```

期待する結果：エラーなし

- [ ] **Step 9: コミットする**

```bash
git add frontend/src/components/ui/PageLayout/
git commit -m "feat: PageLayout コンポーネントを追加（ページレイアウト一元管理）"
```
