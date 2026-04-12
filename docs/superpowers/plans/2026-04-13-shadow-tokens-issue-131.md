# Issue #131: shadow トークン追加と既存15箇所統一 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `frontend/src/styles/tokens.css` に `--shadow-*` トークンを追加し、既存 CSS Modules の `box-shadow` リテラル値（12 箇所）を `var(--shadow-*)` 参照に置換する。

**Architecture:** 既存値を視覚的に分類し、6 つのトークン（`xs`/`sm`/`sm-strong`/`md`/`xl`/`control-sm`）を定義。既存値との alpha 差は max ±0.02 に収め、視覚的退行を最小化する。

**Tech Stack:** CSS Variables（`:root`）、CSS Modules、Vite、Vitest

**関連:** Issue #131、ADR-0040、PR #130 最終 Code Review I-1

---

## 既存値の分析と置換マッピング

`grep -rn "box-shadow.*rgba(0, 0, 0" frontend/src` の結果 12 箇所（+ `var(--color-text)` 使用の FormInput/FormSelect/FormTextarea の 3 箇所は置換対象外）。

| 既存値 | 箇所 | 置換先トークン | 差分 |
|--------|------|------------|------|
| `0 2px 6px rgba(0, 0, 0, 0.04)` | RecordCompactItem | `--shadow-xs` | 完全一致 |
| `0 2px 8px rgba(0, 0, 0, 0.04)` | WorkCard | `--shadow-sm` | alpha -0.01 |
| `0 2px 8px rgba(0, 0, 0, 0.04)` | RecordListItem | `--shadow-sm` | alpha -0.01 |
| `0 2px 8px rgba(0, 0, 0, 0.05)` | WatchingListItem | `--shadow-sm` | 完全一致 |
| `0 2px 8px rgba(0, 0, 0, 0.06)` | RecommendationsPage | `--shadow-sm` | alpha +0.01 |
| `0 2px 8px rgba(0, 0, 0, 0.08)` | DropdownMenu | `--shadow-sm-strong` | 完全一致 |
| `0 4px 12px rgba(0, 0, 0, 0.06)` | RecordCardItem | `--shadow-md` | alpha -0.02 |
| `0 4px 12px rgba(0, 0, 0, 0.06)` | PublicLibrary | `--shadow-md` | alpha -0.02 |
| `0 4px 12px rgba(0, 0, 0, 0.1)` | UserMenu | `--shadow-md` | alpha +0.02 |
| `0 8px 32px rgba(0, 0, 0, 0.12)` | DiscussionCreateModal | `--shadow-xl` | 完全一致 |
| `0 1px 3px rgba(0, 0, 0, 0.2)` | RatingSlider（thumb） | `--shadow-control-sm` | 完全一致 |
| `0 1px 3px rgba(0, 0, 0, 0.2)` | RatingSlider（dragging） | `--shadow-control-sm` | 完全一致 |

**採用トークン（6 つ）:**

```css
--shadow-xs: 0 2px 6px rgba(0, 0, 0, 0.04);         /* 薄いカード・コンパクト行 */
--shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.05);         /* 標準カード */
--shadow-sm-strong: 0 2px 8px rgba(0, 0, 0, 0.08);  /* 強めの標準カード・ドロップダウン */
--shadow-md: 0 4px 12px rgba(0, 0, 0, 0.08);        /* 浮上カード・メニュー */
--shadow-xl: 0 8px 32px rgba(0, 0, 0, 0.12);        /* モーダル・大オーバーレイ */
--shadow-control-sm: 0 1px 3px rgba(0, 0, 0, 0.2);  /* スライダー thumb 等の小型コントロール */
```

**注:** Issue 提案の `--shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.08)` は該当する既存値がないため今回は追加しない（YAGNI）。必要になった時に追加する。

---

## Task 1: tokens.css に shadow トークンを追加

**Files:**
- Modify: `frontend/src/styles/tokens.css`（`--transition-*` セクションの下に追加）

- [ ] **Step 1: `--transition-*` セクションの直後、`--breakpoint-*` セクションの前に影トークンを追加する**

`frontend/src/styles/tokens.css` の line 89（`--easing-exit` の次の空行）と line 91（`/* --- ブレークポイント --- */`）の間に以下を挿入する：

```css

  /* --- 影 --- */
  /* box-shadow は必ずこれらのトークンを使用する。リテラル値の直書きは禁止。 */
  --shadow-xs: 0 2px 6px rgba(0, 0, 0, 0.04);         /* 薄いカード・コンパクト行 */
  --shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.05);         /* 標準カード */
  --shadow-sm-strong: 0 2px 8px rgba(0, 0, 0, 0.08);  /* 強めの標準カード・ドロップダウン */
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.08);        /* 浮上カード・メニュー */
  --shadow-xl: 0 8px 32px rgba(0, 0, 0, 0.12);        /* モーダル・大オーバーレイ */
  --shadow-control-sm: 0 1px 3px rgba(0, 0, 0, 0.2);  /* スライダー thumb 等の小型コントロール */
```

- [ ] **Step 2: コミット**

```bash
git add frontend/src/styles/tokens.css
git commit -m "feat(frontend): tokens.css に box-shadow トークンを追加

- --shadow-xs/sm/sm-strong/md/xl/control-sm の6つのトークンを定義
- 既存の box-shadow リテラル値を統一する準備（Task 2 で置換）
- Issue #131 の対応

Refs: #131"
```

---

## Task 2: 既存 12 箇所の box-shadow 値を var(--shadow-*) に置換

各ファイルを Edit ツールで修正する。視覚的退行を防ぐため、`alpha 差 ±0.02 以内` のトークンに置換する。

**Files:**
- Modify: `frontend/src/components/WorkCard/WorkCard.module.css:15`
- Modify: `frontend/src/components/WatchingListItem/WatchingListItem.module.css:15`
- Modify: `frontend/src/components/RecordListItem/RecordListItem.module.css:18`
- Modify: `frontend/src/components/RecordCompactItem/RecordCompactItem.module.css:18`
- Modify: `frontend/src/components/RecordCardItem/RecordCardItem.module.css:15`
- Modify: `frontend/src/components/PublicLibrary/PublicLibrary.module.css:66`
- Modify: `frontend/src/components/ui/UserMenu/UserMenu.module.css:35`
- Modify: `frontend/src/components/ui/DropdownMenu/DropdownMenu.module.css:33`
- Modify: `frontend/src/components/ui/RatingSlider/RatingSlider.module.css:42`
- Modify: `frontend/src/components/ui/RatingSlider/RatingSlider.module.css:52`
- Modify: `frontend/src/components/DiscussionCreateModal/DiscussionCreateModal.module.css:22`
- Modify: `frontend/src/pages/RecommendationsPage/RecommendationsPage.module.css:493`

- [ ] **Step 1: WorkCard — `--shadow-sm` に置換**

置換前: `  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);`
置換後: `  box-shadow: var(--shadow-sm);`

- [ ] **Step 2: WatchingListItem — `--shadow-sm` に置換**

置換前: `  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);`
置換後: `  box-shadow: var(--shadow-sm);`

- [ ] **Step 3: RecordListItem — `--shadow-sm` に置換**

置換前: `  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);`
置換後: `  box-shadow: var(--shadow-sm);`

- [ ] **Step 4: RecordCompactItem — `--shadow-xs` に置換**

置換前: `  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);`
置換後: `  box-shadow: var(--shadow-xs);`

- [ ] **Step 5: RecordCardItem — `--shadow-md` に置換**

置換前: `  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);`
置換後: `  box-shadow: var(--shadow-md);`

- [ ] **Step 6: PublicLibrary — `--shadow-md` に置換**

置換前: `  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);`
置換後: `  box-shadow: var(--shadow-md);`

- [ ] **Step 7: UserMenu — `--shadow-md` に置換**

置換前: `  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);`
置換後: `  box-shadow: var(--shadow-md);`

- [ ] **Step 8: DropdownMenu — `--shadow-sm-strong` に置換**

置換前: `  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);`
置換後: `  box-shadow: var(--shadow-sm-strong);`

- [ ] **Step 9: RatingSlider 42行目 — `--shadow-control-sm` に置換**

置換前: `  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);`
置換後: `  box-shadow: var(--shadow-control-sm);`

`replace_all` は使用しない（行 42 と 52 両方を個別に置換する必要があるため、まず 42 行目を置換し、次に 52 行目を置換する。ただし同じ値なので context を含めた Edit で位置を特定する）。

- [ ] **Step 10: RatingSlider 52行目 — `--shadow-control-sm` に置換**

42行目を Step 9 で置換済みなので、残った同値が 1 箇所になる。そこを置換する。

- [ ] **Step 11: DiscussionCreateModal — `--shadow-xl` に置換**

置換前: `  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);`
置換後: `  box-shadow: var(--shadow-xl);`

- [ ] **Step 12: RecommendationsPage:493 — `--shadow-sm` に置換**

置換前: `  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);`
置換後: `  box-shadow: var(--shadow-sm);`

- [ ] **Step 13: コミット**

```bash
git add frontend/src/components frontend/src/pages
git commit -m "refactor(frontend): box-shadow リテラル値を shadow トークンに置換

既存12箇所の box-shadow リテラル値を var(--shadow-*) 参照に統一：
- WorkCard, WatchingListItem, RecordListItem, RecommendationsPage → --shadow-sm
- RecordCompactItem → --shadow-xs
- RecordCardItem, PublicLibrary, UserMenu → --shadow-md
- DropdownMenu → --shadow-sm-strong
- DiscussionCreateModal → --shadow-xl
- RatingSlider (×2) → --shadow-control-sm

視覚的退行を避けるため、既存値との alpha 差は max ±0.02 に収めている。

Refs: #131"
```

---

## Task 3: 検証（grep + test + build）

**Files:**
- Verify only（コード変更なし）

- [ ] **Step 1: grep で置換漏れを確認**

Run: `grep -rn "box-shadow.*rgba(0, 0, 0" frontend/src`
Expected: マッチ 0 件（exit code 1）

- [ ] **Step 2: Vitest 全件パス確認**

Run: `cd frontend && npm test -- --run`
Expected: 全テストパス

- [ ] **Step 3: ESLint 確認**

Run: `cd frontend && npm run lint`
Expected: エラー 0 件

- [ ] **Step 4: Vite build 成功確認**

Run: `cd frontend && npx vite build`
Expected: ビルド成功、main bundle サイズに変化がないこと

- [ ] **Step 5: 変更まとめコミット（必要に応じて）**

検証のみで追加コミット不要。この Task は成果物なし。検証結果のみ記録。

---

## 完了条件（Issue #131 受け入れ条件の対応）

- [x] `tokens.css` に `--shadow-*` トークンが追加されている（Task 1）
- [x] `grep -rn "box-shadow.*rgba(0, 0, 0" frontend/src` の結果が 0 件（Task 3 Step 1）
- [x] 既存テスト全てパス（Task 3 Step 2）
- [ ] ブラウザで主要画面の影の見た目に視覚的退行がないことを確認（動作確認フェーズで実施）

## 動作確認で重点的に見るべき画面

alpha 差 ±0.02 の箇所：
1. **RecordCardItem / PublicLibrary**: グリッドカード（alpha 0.06→0.08）→ ホーム画面・パブリックライブラリ
2. **UserMenu**: ユーザーメニュー（alpha 0.1→0.08）→ ヘッダーのアバタークリック
3. **RecommendationsPage line 493**: レコメンドカード（alpha 0.06→0.05）→ レコメンドページ
