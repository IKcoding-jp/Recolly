# フロントエンド全体アニメーション追加 設計書（フェーズ1）

- 作成日: 2026-04-12
- ステータス: 承認待ち
- 関連ADR: [ADR-0040 アニメーション基盤にmotionを採用](../../adr/0040-アニメーション基盤にmotionを採用.md)
- 関連タスク: フロントエンド全体のアニメーション追加（おしゃれでモダンなページの実現）

---

## 1. 全体方針

### 1.1 ねらい

Recollyのフロントエンドに「**静かに現れて、触ると軽快に応える**」アニメーションを行き渡らせる。物語性のある作品コンテンツを主役に据えたまま、プロダクトとしての触り心地を底上げする。

### 1.2 アニメーションのキャラクター

| 項目 | 決定 |
|---|---|
| 全体キャラクター | **Editorial Calm × Snappy Modern ハイブリッド** |
| 登場・遷移の動き | ゆったり（300〜400ms）の `cubic-bezier(0.16, 1, 0.3, 1)`、stagger間隔 80〜120ms |
| ホバー・クリックの動き | キビキビ（120〜180ms）の `ease-out`、translate -2px / scale 1.02 程度の控えめな反応 |

### 1.3 スコープ

**本spec（フェーズ1）に含むもの:**

- **B**. リスト要素の登場アニメ（カード・記録の staggered fade-in）
- **C**. モーダル/ダイアログ/ドロップダウンの開閉アニメ
- **D**. ホバー・クリック反応の統一
- 共通モーショントークン基盤
- `prefers-reduced-motion` 全面対応

**スコープ外（フェーズ2以降に持ち越し）:**

- A. ページ遷移アニメ
- E. ナビゲーション layout アニメ
- F. リスト並べ替えアニメ
- G. スクロール出現アニメ
- H. ローディング演出の見直し
- I. フォーム要素の細かいアニメ
- J. マイクロインタラクション（お気に入り、評価入力等）
- K. PWA起動時演出

### 1.4 守るべき制約

1. **コンテンツが主役、動きは脇役**。派手すぎる動きで作品ポスターやレビューから目をそらさせない
2. **全アニメーションは `transform` と `opacity` のみで構成**。レイアウトを再計算させるプロパティ（width/height/top/left）でアニメしない。GPU合成を維持して 60FPS を確保（バナーの `height` のみ例外、6.3節参照）
3. **`prefers-reduced-motion` を必ず尊重**。システム設定でユーザーが「動きを減らす」を選んでいたら、アニメは即座に最終状態へジャンプする
4. **既存49ファイルのCSSは原則触らない**。motion は「新規アニメ」と「CSSでは実現できないアニメ」のみに使う

---

## 2. CSS と motion の役割分担

### 2.1 判定フロー

```
1. その要素は React で「あったり無かったり」するか？
   ├─ YES → motion（AnimatePresence が必要）
   └─ NO  ↓
2. その要素はレイアウト（位置・サイズ）が動的に変わるか？
   ├─ YES → motion（layout プロパティが必要）
   └─ NO  ↓
3. それ以外（ホバー・色変化・常駐要素の登場など）
        → CSS
```

### 2.2 カテゴリ別の振り分け

| 場面 | CSS / motion | 理由 |
|---|---|---|
| ボタン・カードのホバー反応（色・translate・scale） | **CSS** | 常駐要素、49ファイル既存ルール維持 |
| 入力フィールドのフォーカスリング | **CSS** | 同上 |
| 常駐要素の初回フェードイン（カードがふわっと出る） | **motion** | stagger制御が宣言的、reduced-motion自動対応 |
| モーダル / ダイアログの開閉 | **motion**（AnimatePresence） | CSSでは消える瞬間が表現できない |
| ドロップダウン / メニューの開閉 | **motion**（AnimatePresence） | 同上 |
| 削除確認ダイアログのフェード | **motion**（AnimatePresence） | 同上 |
| トースト通知（UpdatePrompt）の出現/消失 | **motion**（AnimatePresence） | 同上 |
| ローディング（スケルトン）のシマー | **CSS**（既存 `@keyframes`） | シンプルなループ、既存挙動維持 |
| スピナーの回転 | **CSS** | 同上 |
| エラー文言の出現 | **motion**（AnimatePresence） | 表示/非表示の切り替え |

### 2.3 「ラッパーだけ触る」原則

motion で包むのは「リストのコンテナ」と「条件付きで表示される要素」だけ。個々のアイテムコンポーネント（`WatchingListItem`、`Button`、`SectionTitle` など）の **中身は触らない**。これにより49ファイルの既存実装は無傷で保たれる。

---

## 3. 共通モーショントークン

### 3.1 ファイル構成

`frontend/src/lib/motion/` に以下の4ファイルを新規作成：

```
frontend/src/lib/motion/
├── tokens.ts              # duration, easing の定数
├── variants.ts            # variants 定義
├── useRecollyMotion.ts    # reduced-motion 対応の共通フック
└── index.ts               # 上記をまとめて re-export
```

### 3.2 `tokens.ts`

```typescript
export const duration = {
  /** ホバー、フォーカスなどの即応的フィードバック（Snappy Modern側） */
  fast: 0.16,    // 160ms
  /** ボタンクリック、トグルなどの状態変化 */
  base: 0.24,    // 240ms
  /** カード登場、モーダル開閉などの主要な動き（Editorial Calm側） */
  slow: 0.38,    // 380ms
  /** ページ遷移、大きな構造変化（フェーズ2用に予約） */
  slower: 0.52,  // 520ms
} as const

export const easing = {
  /** Snappy Modern用：素早く立ち上がってスッと止まる */
  snap: [0.32, 0.72, 0, 1] as const,
  /** Editorial Calm用：ゆったり減速。最も使う */
  calm: [0.16, 1, 0.3, 1] as const,
  /** 退場用：最初は緩やかで途中で加速 */
  exit: [0.7, 0, 0.84, 0] as const,
} as const
```

### 3.3 `variants.ts`

```typescript
import type { Variants } from 'motion/react'
import { duration, easing } from './tokens'

/** 子要素を staggered fade-in させるリストコンテナ用 */
export const listContainerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.05,
    },
  },
}

/** リストアイテム（カード等）の登場：下からふわっと */
export const fadeInUpVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: duration.slow, ease: easing.calm },
  },
}

/** モーダル本体の出現/消失 */
export const modalVariants: Variants = {
  hidden: { opacity: 0, scale: 0.96, y: 8 },
  visible: {
    opacity: 1, scale: 1, y: 0,
    transition: { duration: duration.slow, ease: easing.calm },
  },
  exit: {
    opacity: 0, scale: 0.98, y: 4,
    transition: { duration: duration.base, ease: easing.exit },
  },
}

/** モーダル背景オーバーレイのフェード */
export const overlayVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: duration.base } },
  exit: { opacity: 0, transition: { duration: duration.fast } },
}

/** ドロップダウン等の小さなフロート要素 */
export const dropdownVariants: Variants = {
  hidden: { opacity: 0, y: -4, scale: 0.98 },
  visible: {
    opacity: 1, y: 0, scale: 1,
    transition: { duration: duration.base, ease: easing.calm },
  },
  exit: {
    opacity: 0, y: -2, scale: 0.99,
    transition: { duration: duration.fast, ease: easing.exit },
  },
}

/** トースト通知（画面下からスライドイン） */
export const toastVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: duration.slow, ease: easing.calm } },
  exit: { opacity: 0, y: 16, transition: { duration: duration.base, ease: easing.exit } },
}

/** バナー（ヘッダー下からスライドイン、height含む例外） */
export const bannerVariants: Variants = {
  hidden: { opacity: 0, y: -16, height: 0 },
  visible: { opacity: 1, y: 0, height: 'auto', transition: { duration: duration.slow, ease: easing.calm } },
  exit: { opacity: 0, y: -8, height: 0, transition: { duration: duration.base, ease: easing.exit } },
}
```

### 3.4 `tokens.css` の連動更新

`frontend/src/styles/tokens.css` を以下のように更新（変数名は同じ、値のみ更新 + 新規追加）：

```css
:root {
  /* 既存の値を更新（変数名は同じ） */
  --transition-fast: 160ms cubic-bezier(0.32, 0.72, 0, 1);    /* = duration.fast + easing.snap */
  --transition-normal: 240ms cubic-bezier(0.16, 1, 0.3, 1);   /* = duration.base + easing.calm */

  /* 新規追加 */
  --transition-slow: 380ms cubic-bezier(0.16, 1, 0.3, 1);     /* = duration.slow + easing.calm */
  --easing-snap: cubic-bezier(0.32, 0.72, 0, 1);
  --easing-calm: cubic-bezier(0.16, 1, 0.3, 1);
  --easing-exit: cubic-bezier(0.7, 0, 0.84, 0);
}
```

これにより、CSSで書くアニメ（ホバー等）も motion で書くアニメ（モーダル等）も**同じ時間・同じ曲線**で動く。

---

## 4. `prefers-reduced-motion` 対応戦略

### 4.1 motion 側：`useRecollyMotion` 共通フック

```typescript
// frontend/src/lib/motion/useRecollyMotion.ts
import { useReducedMotion } from 'motion/react'
import {
  fadeInUpVariants,
  listContainerVariants,
  modalVariants,
  overlayVariants,
  dropdownVariants,
  toastVariants,
  bannerVariants,
} from './variants'

/**
 * Recolly全体のアニメーションを reduced-motion に応じて切り替える共通フック。
 * reduced-motion が有効なら、全variantsを「即時状態変化」版（透明度切り替えのみ）に置き換える。
 */
export function useRecollyMotion() {
  const shouldReduce = useReducedMotion()

  if (shouldReduce) {
    return {
      listContainer: { hidden: {}, visible: { transition: { staggerChildren: 0 } } },
      fadeInUp: { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0 } } },
      modal: {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { duration: 0 } },
        exit: { opacity: 0, transition: { duration: 0 } },
      },
      overlay: {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { duration: 0 } },
        exit: { opacity: 0, transition: { duration: 0 } },
      },
      dropdown: {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { duration: 0 } },
        exit: { opacity: 0, transition: { duration: 0 } },
      },
      toast: {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { duration: 0 } },
        exit: { opacity: 0, transition: { duration: 0 } },
      },
      banner: {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { duration: 0 } },
        exit: { opacity: 0, transition: { duration: 0 } },
      },
    }
  }

  return {
    listContainer: listContainerVariants,
    fadeInUp: fadeInUpVariants,
    modal: modalVariants,
    overlay: overlayVariants,
    dropdown: dropdownVariants,
    toast: toastVariants,
    banner: bannerVariants,
  }
}
```

### 4.2 設計判断：reduced-motion時もopacityフェードは残す

translate / scale / rotate は禁止だが、`opacity: 0 → 1` だけは残す。これは「完全にぱっと出る」より、軽くフェードする方が違和感が少ないというWCAG慣習に従う。

### 4.3 CSS 側：`tokens.css` 末尾に全体上書きブロック追加

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

この1ブロックで、49ファイルすべてのCSS transitionが reduced-motion 時に無効化される。`!important` はアクセシビリティ対応の例外として許容。

---

## 5. B. リスト要素登場アニメの実装方針

### 5.1 対象画面（5つ）

| # | 画面 | 対象リスト | 対象ファイル |
|---|---|---|---|
| 1 | ダッシュボード | 進行中の作品リスト | `pages/HomePage/HomePage.tsx` の `.list` |
| 2 | マイライブラリ | 記録カード/コンパクト一覧 | `pages/LibraryPage/LibraryPage.tsx` |
| 3 | 検索結果 | 作品カード一覧 | `pages/SearchPage/SearchPage.tsx` |
| 4 | 作品詳細 | 2カラムサイドバーメインのセクション群 | `pages/WorkDetailPage/WorkDetailPage.tsx` |
| 5 | おすすめ | おすすめ作品カード一覧 | `pages/RecommendationsPage/RecommendationsPage.tsx` |

### 5.2 パターンA：単純なリスト（HomePage / LibraryPage / SearchPage / RecommendationsPage）

```tsx
// 例: HomePage.tsx
import { motion } from 'motion/react'
import { useRecollyMotion } from '../../lib/motion'

export function HomePage() {
  const m = useRecollyMotion()
  // ...既存のhooks
  return (
    <div className={styles.container}>
      {!isLoading && !error && records.length > 0 && (
        <>
          <SectionTitle>進行中</SectionTitle>
          <motion.div
            className={styles.list}
            variants={m.listContainer}
            initial="hidden"
            animate="visible"
          >
            {records.map((record) => (
              <motion.div key={record.id} variants={m.fadeInUp}>
                <WatchingListItem record={record} onAction={() => void handleAction(record)} />
              </motion.div>
            ))}
          </motion.div>
        </>
      )}
    </div>
  )
}
```

### 5.3 パターンB：構造的なページ（WorkDetailPage）

```tsx
<motion.div variants={m.listContainer} initial="hidden" animate="visible">
  <motion.div variants={m.fadeInUp}><WorkHeader ... /></motion.div>
  <motion.div variants={m.fadeInUp}><ReviewSection ... /></motion.div>
  <motion.div variants={m.fadeInUp}><EpisodeReviewSection ... /></motion.div>
  <motion.div variants={m.fadeInUp}><TagSection ... /></motion.div>
</motion.div>
```

### 5.4 やらないこと

- 無限スクロール時の追加読み込み分のフェードイン
- 画面外要素の `whileInView` トリガー（フェーズG）
- 個別アイテム内部の動き
- AuthPage / SettingsPage 等のフォーム系

---

## 6. C. モーダル/ダイアログ開閉の実装方針

### 6.1 対象コンポーネント（6つ）

| # | コンポーネント | 適用variants | パターン |
|---|---|---|---|
| 1 | `RecordDeleteDialog` | `modalVariants` + `overlayVariants` | 親側に `<AnimatePresence>` |
| 2 | `DiscussionCreateModal` | `modalVariants` + `overlayVariants` | 親側に `<AnimatePresence>` |
| 3 | `UpdatePrompt`（PWA更新通知） | `toastVariants` | App.tsx で `<AnimatePresence>` |
| 4 | `EmailPromptBanner` | `bannerVariants` | 親側で `<AnimatePresence>` |
| 5 | `DropdownMenu`（ジャンル/ソート） | `dropdownVariants` | 内側に `<AnimatePresence>` |
| 6 | `UserMenu`（ナビ右上アバター） | `dropdownVariants` | 内側に `<AnimatePresence>` |

### 6.2 パターンA：モーダル系

```tsx
// 親コンポーネント側（呼び出し例）
import { AnimatePresence } from 'motion/react'

<AnimatePresence>
  {showDeleteDialog && (
    <RecordDeleteDialog
      onConfirm={handleDelete}
      onCancel={() => setShowDeleteDialog(false)}
    />
  )}
</AnimatePresence>
```

```tsx
// RecordDeleteDialog.tsx の中身
import { motion } from 'motion/react'
import { useRecollyMotion } from '../../lib/motion'

export function RecordDeleteDialog({ onConfirm, onCancel }) {
  const m = useRecollyMotion()
  return (
    <motion.div
      className={styles.overlay}
      variants={m.overlay}
      initial="hidden" animate="visible" exit="exit"
      onClick={onCancel}
    >
      <motion.div
        className={styles.dialog}
        variants={m.modal}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 既存のダイアログ内容 */}
      </motion.div>
    </motion.div>
  )
}
```

### 6.3 バナー height アニメ例外

`bannerVariants` のみ `height: 'auto' → 0` を例外的に使う。理由：バナーは閉じたときレイアウト上のスペースも消す必要があるため。これは設計制約「transform と opacity のみ」の唯一の例外。

### 6.4 パターンB：ドロップダウン系

```tsx
export function UserMenu({ user, onLogout }) {
  const [isOpen, setIsOpen] = useState(false)
  const m = useRecollyMotion()
  return (
    <div className={styles.wrapper}>
      <button onClick={() => setIsOpen(!isOpen)}>...</button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className={styles.menu}
            variants={m.dropdown}
            initial="hidden" animate="visible" exit="exit"
          >
            {/* 既存のメニュー項目 */}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
```

### 6.5 パターンC：トースト/バナー系（UpdatePrompt, EmailPromptBanner）

それぞれ独立した位置に常駐する（または条件付きで現れる）コンポーネント。自身を `motion.div` 化し、親側（`App.tsx` または `HomePage.tsx`）で `<AnimatePresence>` で囲む。

```tsx
// 親側（例: App.tsx）
import { AnimatePresence } from 'motion/react'

<AnimatePresence>
  {needRefresh && (
    <UpdatePrompt
      needRefresh={needRefresh}
      onRefresh={...}
      onClose={...}
    />
  )}
</AnimatePresence>
```

```tsx
// UpdatePrompt.tsx の中身（既存ロジック維持、ラッパーをmotion化）
import { motion } from 'motion/react'
import { useRecollyMotion } from '../../../lib/motion'

export function UpdatePrompt({ needRefresh, onRefresh, onClose }) {
  const m = useRecollyMotion()
  return (
    <motion.div
      className={styles.toast}
      variants={m.toast}
      initial="hidden" animate="visible" exit="exit"
    >
      {/* 既存のトースト内容 */}
    </motion.div>
  )
}
```

`EmailPromptBanner` も同じパターンで `m.banner` を使う（heightアニメ含む、6.3節参照）。

### 6.6 やらないこと

- ジャンルフィルタチップの選択時アニメ（D範疇）
- 既存 `SearchProgress` のCSSアニメ（変更しない）
- `Pagination` のページ切り替えアニメ

---

## 7. D. ホバー・クリック反応の実装方針

### 7.1 統一ルール（ホバー文法）

| 要素タイプ | ホバー時の動き | duration | easing |
|---|---|---|---|
| クリック可能なカード | `translateY(-2px)` + 影 | `--transition-fast` (160ms) | `--easing-snap` |
| プライマリボタン | 背景色を `#1a1a1a` に | `--transition-fast` | `--easing-snap` |
| セカンダリボタン | 背景反転 | `--transition-fast` | `--easing-snap` |
| ゴーストボタン | 下線を引く | `--transition-fast` | `--easing-snap` |
| アイコンボタン | 背景ハイライト + scale(1.05) | `--transition-fast` | `--easing-snap` |
| リンクテキスト | 下線 + 色変化 | `--transition-fast` | linear |
| 入力フィールド | ボーダー色変化 + 影 | `--transition-fast` | `--easing-snap` |

### 7.2 クリック反応（`:active`）統一

プライマリ/セカンダリボタンに `transform: scale(0.97)` を追加：

```css
.primary:active:not(:disabled),
.secondary:active:not(:disabled) {
  transform: scale(0.97);
}
```

### 7.3 修正対象（9ファイル、3グループ）

#### グループ1: 共通ボタン
- `components/ui/Button/Button.module.css`

#### グループ2: 共通カード系
- `components/WorkCard/WorkCard.module.css`
- `components/RecordCardItem/RecordCardItem.module.css`
- `components/WatchingListItem/WatchingListItem.module.css`
- `components/RecordCompactItem/RecordCompactItem.module.css`
- `components/RecordListItem/RecordListItem.module.css`

#### グループ3: その他共通UI
- `components/ui/FormInput/FormInput.module.css`
- `components/ui/FormSelect/FormSelect.module.css`
- `components/ui/FormTextarea/FormTextarea.module.css`

3グループに分けるのは、コミット単位を分けて巻き戻しを可能にするため。

### 7.4 修正対象から除外するもの

- 静的UI（SectionTitle, Typography, Divider 等）
- 既にホバー反応が良い感じのもの
- ジャンル別カードカラーのhover時グラデーション
- Pagination, BottomTabBar 等の特殊UI

### 7.5 stylelint等のルール強制はスコープ外

将来的な検討事項として記録。フェーズ1では実装に集中する。

---

## 8. ファイル構成

### 8.1 新規作成（4ファイル）

```
frontend/src/lib/motion/
├── tokens.ts
├── variants.ts
├── useRecollyMotion.ts
└── index.ts
```

### 8.2 `index.ts` の役割

```typescript
export { duration, easing } from './tokens'
export {
  listContainerVariants,
  fadeInUpVariants,
  modalVariants,
  overlayVariants,
  dropdownVariants,
  toastVariants,
  bannerVariants,
} from './variants'
export { useRecollyMotion } from './useRecollyMotion'
```

各コンポーネントは1行でimportできる：
```typescript
import { useRecollyMotion } from '../../lib/motion'
```

### 8.3 `package.json` への追加

```json
"dependencies": {
  "motion": "^12.38.0",
  "react": "^19.2.4",
  "react-dom": "^19.2.4",
  "react-router-dom": "^7.13.1"
}
```

実装時点で v12.38.0（React 19 公式サポート、現行安定版）にアップデートして導入した。当初 spec 起草時は v11+ を想定していたが、`npm install motion` 実行時に v12 系が最新 stable だったため v12 を採用。motion v12 は v11 の後継メジャーで React 19 サポートも継続している。

### 8.4 全変更ファイル一覧

| 種別 | パス |
|---|---|
| 新規 | `frontend/src/lib/motion/tokens.ts` |
| 新規 | `frontend/src/lib/motion/variants.ts` |
| 新規 | `frontend/src/lib/motion/useRecollyMotion.ts` |
| 新規 | `frontend/src/lib/motion/index.ts` |
| 新規 | `frontend/src/lib/motion/useRecollyMotion.test.ts` |
| 変更 | `frontend/src/styles/tokens.css` |
| 変更 | `frontend/src/test-setup.ts` |
| 変更 | `frontend/package.json` |
| 変更 | `frontend/src/pages/HomePage/HomePage.tsx` |
| 変更 | `frontend/src/pages/LibraryPage/LibraryPage.tsx` |
| 変更 | `frontend/src/pages/SearchPage/SearchPage.tsx` |
| 変更 | `frontend/src/pages/WorkDetailPage/WorkDetailPage.tsx` |
| 変更 | `frontend/src/pages/RecommendationsPage/RecommendationsPage.tsx` |
| 変更 | `frontend/src/components/RecordDeleteDialog/RecordDeleteDialog.tsx` |
| 変更 | `frontend/src/components/DiscussionCreateModal/DiscussionCreateModal.tsx` |
| 変更 | `frontend/src/components/EmailPromptBanner/EmailPromptBanner.tsx` |
| 変更 | `frontend/src/components/ui/UpdatePrompt/UpdatePrompt.tsx` |
| 変更 | `frontend/src/components/ui/DropdownMenu/DropdownMenu.tsx` |
| 変更 | `frontend/src/components/ui/UserMenu/UserMenu.tsx` |
| 変更 | `frontend/src/components/ui/Button/Button.module.css` |
| 変更 | `frontend/src/components/WorkCard/WorkCard.module.css` |
| 変更 | `frontend/src/components/RecordCardItem/RecordCardItem.module.css` |
| 変更 | `frontend/src/components/WatchingListItem/WatchingListItem.module.css` |
| 変更 | `frontend/src/components/RecordCompactItem/RecordCompactItem.module.css` |
| 変更 | `frontend/src/components/RecordListItem/RecordListItem.module.css` |
| 変更 | `frontend/src/components/ui/FormInput/FormInput.module.css` |
| 変更 | `frontend/src/components/ui/FormSelect/FormSelect.module.css` |
| 変更 | `frontend/src/components/ui/FormTextarea/FormTextarea.module.css` |
| 親側追加 | 各モーダル呼び出し元（数ヶ所） |

**新規5ファイル + 変更約23ファイル = 合計28ファイル前後の変更。**

---

## 9. テスト方針 & 実装順序

### 9.1 テスト方針

#### 9.1.1 既存テスト

- 既存の `*.test.tsx` は基本そのまま動くべき
- `motion.div` は通常の div として扱われるので、`getByText`, `getByRole` 等のクエリは影響を受けない
- アニメーション自体の見た目はテストしない

#### 9.1.2 motion を test 環境でモックする

`frontend/src/test-setup.ts` に追加：

```typescript
vi.mock('motion/react', async () => {
  const actual = await vi.importActual<typeof import('motion/react')>('motion/react')
  return {
    ...actual,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  }
})
```

これにより、テスト環境では `<AnimatePresence>` がパススルー（即座に消える）になり、既存テストの「閉じるボタン押下後、即座にダイアログが消える」前提が維持される。

#### 9.1.3 新規テスト

| 対象 | テスト内容 |
|---|---|
| `useRecollyMotion` フック | reduced-motion=false 時に通常variants / =true 時に即時版variantsを返すか |

`useRecollyMotion.test.ts` を新規作成。`useReducedMotion()` をモックして戻り値を切り替え、フックの分岐ロジックを検証する。

それ以外、新規テストは書かない。アニメーションの視覚的品質はIKさんがブラウザで手動確認する。

### 9.2 実装順序

#### Step 0: 準備
1. `npm install motion` でライブラリ追加
2. `frontend/package.json` 更新確認

#### Step 1: 基盤（最優先・他すべての依存元）
1. `lib/motion/tokens.ts` 作成
2. `lib/motion/variants.ts` 作成
3. `lib/motion/useRecollyMotion.ts` 作成
4. `lib/motion/useRecollyMotion.test.ts` 作成
5. `lib/motion/index.ts` 作成
6. `styles/tokens.css` 更新（既存変数値変更 + 新規変数追加 + reduced-motionブロック追加）
7. `test-setup.ts` に motion モック追加

#### Step 2: D（ホバー反応統一）— CSS変更のみ、安全
グループ1から順に：
1. `Button.module.css` 更新
2. WorkCard / RecordCardItem / WatchingListItem / RecordCompactItem / RecordListItem の `.module.css` 更新
3. FormInput / FormSelect / FormTextarea の `.module.css` 更新

各更新後に `npm test` で既存テストが通ることを確認。

#### Step 3: B（リスト登場）— 1ページずつ
1. HomePage
2. LibraryPage
3. SearchPage
4. RecommendationsPage
5. WorkDetailPage

各ページごとに `npm test` で既存テストが通ることを確認。

#### Step 4: C（モーダル/ダイアログ）— 1コンポーネントずつ
1. UserMenu
2. DropdownMenu
3. RecordDeleteDialog
4. DiscussionCreateModal
5. UpdatePrompt
6. EmailPromptBanner

各コンポーネントごとに `npm test` 実行 + ブラウザで開閉動作を目視確認。

#### Step 5: 全体検証
1. `npm test` 全パス
2. `npm run lint` パス
3. `npm run build` パス
4. ブラウザで全画面を手動巡回（reduced-motion ON/OFF両方）
5. PRオープン

#### 並列化可能性

Step 2（D）はCSS変更のみで motion 知識不要なので、Step 3（B）/ Step 4（C）と並列で進めても良い。ただし **Step 1 は必ず最初に終わらせる**（他すべての依存元）。

### 9.3 完了条件（Definition of Done）

- [ ] `frontend/src/lib/motion/` の4ファイルが存在し、TypeScriptビルドが通る
- [ ] `frontend/src/styles/tokens.css` に reduced-motion ブロックが存在
- [ ] B対象5ページでカードのstaggered fade-inが動く
- [ ] C対象6コンポーネントの開閉アニメが動く
- [ ] D対象9ファイルでホバー時のtransitionが新しい曲線で動く
- [ ] OS設定で「動きを減らす」を有効にすると、全アニメーションが無効化される
- [ ] 既存のVitestテストが全て通る
- [ ] `useRecollyMotion` の単体テストが追加され、通る
- [ ] `npm run lint`, `npm run build` が通る
- [ ] code-review（自動）が通る

---

## 10. 関連ドキュメント

- ADR-0040: アニメーション基盤にmotionを採用
- ADR-0002: フロントエンドにReact + TypeScriptを採用
- ADR-0006: CSSスタイリング方式にCSS Modules + グローバルCSS変数を採用
- ADR-0031: フォント選定とデザイントークン体系
