# UI一貫性システム設計仕様書

## 概要

バイブコーディング（AI主体の開発）においてページごとにUIやデザインがバラつく問題を、  
**仕組み**で解決する。既存ページの修正ではなく、将来の一貫性を担保するシステムを構築する。

## 背景と課題

### 問題

Claude Codeが新しいUIを生成するとき、tokens.cssや共通コンポーネントを参照せず  
独自のスタイルを直書きしてしまうことがある。その結果：

- ページごとにmax-widthやpaddingが異なる（例：HomePage 900px vs LibraryPage 1000px）
- tokens.cssに存在しないハードコード値が各CSSに散在する
- 未定義のCSS変数が参照されている（`--color-star`）

### コード調査で判明したハードコード値

| ファイル | 直書き値 | 問題 |
|---|---|---|
| `FormInput.module.css` | `1.5px`（border-bottom） | トークン未定義 |
| `NavBar.module.css` | `1.375rem`（font-size）、`1.5px`（letter-spacing） | トークン未定義 |
| `RecordListItem.module.css` | `50px / 70px`（サムネイル）、`--color-star`参照 | トークン未定義 |

## 対策方針（Bプラン）

4つのパーツを実装する。

## 実装内容

### 1. DESIGN.md（新規作成）

**場所：** `/DESIGN.md`（プロジェクトルート）

AIが新しいUIを作るたびに参照するデザイン憲法。  
Claude Codeはコード生成前にこのファイルを読むことが義務付けられる（CLAUDE.mdで指示）。

**構成：**

```
# Recolly Design System

## Colors
- 各色トークンの一覧と使用場面の説明
- メディアタイプ別カラー（anime/movie/drama/book/manga/game）の用途

## Typography
- フォントファミリー（Fraunces / Zen Kaku Gothic New）
- サイズスケール（h1〜meta）と用途別ルール

## Spacing & Layout
- spacing-xs〜3xlの一覧と使用場面
- ページ幅・パディングの標準値（PageLayoutが担う値）

## Components
- 共通コンポーネントの使用ルール一覧
- 例：「フォーム入力は必ずFormInputを使う。<input>直書き禁止」

## Forbidden（禁止事項）
- CSSにハードコード値を書かない（tokens.cssのCSS変数のみ）
- 共通コンポーネントと同機能のUIを新規作成しない
- HTMLの<input><select><textarea>を直接使わない

## New Page Checklist
- 新しいページを作るときの必須チェックリスト
- PageLayoutでラップする
- SectionTitleを使う
- tokens.cssの変数のみ使用する
```

### 2. CLAUDE.md への追記

**場所：** `/CLAUDE.md`（既存ファイル編集）

既存の「フロントエンドUI一貫性ルール」セクション末尾に追記する。

**追記内容：**

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

### 3. tokens.css の完全整理

**場所：** `/frontend/src/styles/tokens.css`（既存ファイル編集）

#### ① 未定義変数の追加

| トークン | 値 | 用途 |
|---|---|---|
| `--color-star` | `#f59e0b` | 評価星の色（RecordListItemで使用中） |

#### ② ハードコード値のトークン化

| 追加するトークン | 値 | 直書きされていた場所 |
|---|---|---|
| `--border-width-input` | `1.5px` | FormInput.module.css |
| `--font-size-logo` | `1.375rem` | NavBar.module.css |
| `--letter-spacing-nav` | `1.5px` | NavBar.module.css |
| `--size-work-thumbnail-w` | `50px` | RecordListItem.module.css |
| `--size-work-thumbnail-h` | `70px` | RecordListItem.module.css |
| `--page-max-width` | `900px` | PageLayoutが使用（新規） |

#### ③ 各CSSファイルの修正

- `FormInput.module.css` — `1.5px` → `var(--border-width-input)`
- `NavBar.module.css` — `1.375rem` → `var(--font-size-logo)`、`1.5px` → `var(--letter-spacing-nav)`
- `RecordListItem.module.css` — `50px / 70px` → `var(--size-work-thumbnail-w/h)`

### 4. PageLayout コンポーネント（新規作成）

**場所：** `/frontend/src/components/ui/PageLayout/`

全ページを包む共通ラッパーコンポーネント。  
max-width・水平パディング・BottomTabBar分の余白を一元管理する。

#### ファイル構成

```
frontend/src/components/ui/PageLayout/
├── PageLayout.tsx
├── PageLayout.module.css
└── index.ts
```

#### インターフェース

```typescript
interface PageLayoutProps {
  children: React.ReactNode
  className?: string  // ページ固有の追加スタイルが必要なときのみ
}
```

#### CSS

```css
.layout {
  max-width: var(--page-max-width);
  margin: 0 auto;
  padding: var(--spacing-xl) var(--spacing-lg);
  padding-bottom: calc(var(--bottom-tab-height) + var(--spacing-xl));
}
```

#### 使い方

```tsx
import { PageLayout } from '../../components/ui/PageLayout/PageLayout'

export function NewPage() {
  return (
    <PageLayout>
      {/* ページコンテンツ */}
    </PageLayout>
  )
}
```

#### 既存ページへの適用方針

- **今回はコンポーネントを作るだけ**。既存17ページへの適用は対象外。
- 新しいページを作るときは必ずPageLayoutを使う（DESIGN.md・CLAUDE.mdに明記）。
- 既存ページは機能追加のついでに順次対応する。

## スコープ外

- 既存17ページのレイアウト修正（今回は対象外）
- ESLintカスタムルールによる自動チェック（将来の検討事項）
- LandingPageのアプリ内ページとのデザイン統一（今回は対象外）

## 完了条件

- [ ] `DESIGN.md` がプロジェクトルートに存在する
- [ ] `CLAUDE.md` にデザインシステム参照ルールが追記されている
- [ ] `tokens.css` に未定義変数・新規トークンが追加されている
- [ ] 各CSSファイルのハードコード値がトークン参照に置き換わっている
- [ ] `PageLayout` コンポーネントが `frontend/src/components/ui/` に存在する
- [ ] `DESIGN.md` と `CLAUDE.md` の内容が整合している
