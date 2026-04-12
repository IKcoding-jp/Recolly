# フロントエンドアニメーション追加（フェーズ1）実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recollyのフロントエンドに「静かに現れて、触ると軽快に応える」アニメーションを行き渡らせる。motion ライブラリを導入し、共通モーショントークン基盤・リスト登場アニメ・モーダル開閉アニメ・ホバー反応統一・reduced-motion 対応を実装する。

**Architecture:** `frontend/src/lib/motion/` に共通基盤（tokens / variants / useRecollyMotion フック）を新設。既存49ファイルのCSSは原則変更せず、9ファイルのみホバー文法統一のため修正。motionは「リストのコンテナ」と「条件付き表示要素」の**ラッパーだけ**に適用し、既存コンポーネントの中身は触らない。

**Tech Stack:** React 19, TypeScript, motion (旧Framer Motion) v11+, CSS Modules, Vitest + React Testing Library

**関連ドキュメント:**
- 設計書: `docs/superpowers/specs/2026-04-12-frontend-animations-design.md`
- ADR: `docs/adr/0040-アニメーション基盤にmotionを採用.md`

**ブランチ:** `feat/frontend-animations`（既に作成済み、ADRとspecをコミット済み）

---

## Task 1: motion ライブラリのインストール

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json`

- [ ] **Step 1: motion をインストール**

`frontend/` ディレクトリで以下を実行：

```bash
cd frontend && npm install motion
```

- [ ] **Step 2: package.json に motion が追加されたことを確認**

```bash
grep '"motion"' frontend/package.json
```

Expected: `"motion": "^X.Y.Z"` 形式で表示される（X >= 11）

- [ ] **Step 3: ビルドが通ることを確認**

```bash
cd frontend && npm run build
```

Expected: `vite v8.x.x building for production...` → エラーなく完了

- [ ] **Step 4: コミット**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "$(cat <<'EOF'
chore: motion ライブラリを追加

ADR-0040 で決定したアニメーション基盤として motion (旧Framer Motion) を導入。
React 19 公式サポート版 v11+ を使用。

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: モーショントークン定数の作成

**Files:**
- Create: `frontend/src/lib/motion/tokens.ts`

- [ ] **Step 1: ディレクトリを作成**

```bash
mkdir -p frontend/src/lib/motion
```

- [ ] **Step 2: tokens.ts を作成**

```typescript
// frontend/src/lib/motion/tokens.ts

/**
 * アニメーションの時間（秒単位、motion ライブラリの形式）
 *
 * Editorial Calm × Snappy Modern ハイブリッドのキャラクターに基づく値:
 * - fast/base は Snappy Modern 側（即応的フィードバック）
 * - slow/slower は Editorial Calm 側（主要な登場・遷移）
 */
export const duration = {
  /** ホバー、フォーカスなどの即応的フィードバック */
  fast: 0.16, // 160ms
  /** ボタンクリック、トグルなどの状態変化 */
  base: 0.24, // 240ms
  /** カード登場、モーダル開閉などの主要な動き */
  slow: 0.38, // 380ms
  /** ページ遷移、大きな構造変化（フェーズ2用に予約） */
  slower: 0.52, // 520ms
} as const

/**
 * アニメーションのイージング曲線（cubic-bezier 4点形式）
 *
 * cubic-bezier(x1, y1, x2, y2) は加速減速のカーブを定義する。
 * https://cubic-bezier.com/ で視覚的に確認できる。
 */
export const easing = {
  /** Snappy Modern用：素早く立ち上がってスッと止まる */
  snap: [0.32, 0.72, 0, 1] as const,
  /** Editorial Calm用：ゆったり減速。最も使う */
  calm: [0.16, 1, 0.3, 1] as const,
  /** 退場用：最初は緩やかで途中で加速 */
  exit: [0.7, 0, 0.84, 0] as const,
} as const
```

- [ ] **Step 3: TypeScriptビルドが通ることを確認**

```bash
cd frontend && npx tsc --noEmit
```

Expected: エラーなし

- [ ] **Step 4: コミット**

```bash
git add frontend/src/lib/motion/tokens.ts
git commit -m "$(cat <<'EOF'
feat(frontend): モーショントークン定数（duration / easing）を追加

Editorial Calm × Snappy Modern ハイブリッドのキャラクターに基づく
duration（fast/base/slow/slower）と easing（snap/calm/exit）を定義。

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: variants 定義の作成

**Files:**
- Create: `frontend/src/lib/motion/variants.ts`

- [ ] **Step 1: variants.ts を作成**

```typescript
// frontend/src/lib/motion/variants.ts
import type { Variants } from 'motion/react'
import { duration, easing } from './tokens'

/**
 * 子要素を staggered fade-in させるリストコンテナ用 variants。
 * staggerChildren で子要素を順次表示する時間差を制御する。
 */
export const listContainerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.1, // 100ms間隔で子要素を順次表示
      delayChildren: 0.05,
    },
  },
}

/**
 * リストアイテム（カード等）の登場：下から16pxふわっと上昇しながらフェードイン
 */
export const fadeInUpVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: duration.slow, ease: easing.calm },
  },
}

/**
 * モーダル本体（ダイアログのコンテンツ）の出現/消失
 * scale と y のわずかな変化で「奥から手前に出てくる」感覚を演出
 */
export const modalVariants: Variants = {
  hidden: { opacity: 0, scale: 0.96, y: 8 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: duration.slow, ease: easing.calm },
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    y: 4,
    transition: { duration: duration.base, ease: easing.exit },
  },
}

/**
 * モーダル背景オーバーレイ（半透明黒）のフェード
 */
export const overlayVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: duration.base } },
  exit: { opacity: 0, transition: { duration: duration.fast } },
}

/**
 * ドロップダウン等の小さなフロート要素
 * 上から少しスライドダウンしながら出現
 */
export const dropdownVariants: Variants = {
  hidden: { opacity: 0, y: -4, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: duration.base, ease: easing.calm },
  },
  exit: {
    opacity: 0,
    y: -2,
    scale: 0.99,
    transition: { duration: duration.fast, ease: easing.exit },
  },
}

/**
 * トースト通知（画面下からスライドイン）
 * UpdatePrompt 等で使用
 */
export const toastVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: duration.slow, ease: easing.calm },
  },
  exit: {
    opacity: 0,
    y: 16,
    transition: { duration: duration.base, ease: easing.exit },
  },
}

/**
 * バナー（ヘッダー下からスライドイン、height 含む例外）
 * EmailPromptBanner 等で使用
 *
 * 注: 制約「transform と opacity のみ」の唯一の例外として height を使う。
 * 理由: バナーが閉じた時にレイアウト上のスペースも消す必要があるため。
 */
export const bannerVariants: Variants = {
  hidden: { opacity: 0, y: -16, height: 0 },
  visible: {
    opacity: 1,
    y: 0,
    height: 'auto',
    transition: { duration: duration.slow, ease: easing.calm },
  },
  exit: {
    opacity: 0,
    y: -8,
    height: 0,
    transition: { duration: duration.base, ease: easing.exit },
  },
}
```

- [ ] **Step 2: TypeScriptビルドが通ることを確認**

```bash
cd frontend && npx tsc --noEmit
```

Expected: エラーなし

- [ ] **Step 3: コミット**

```bash
git add frontend/src/lib/motion/variants.ts
git commit -m "$(cat <<'EOF'
feat(frontend): motion 用 variants 定義を追加

list / fadeInUp / modal / overlay / dropdown / toast / banner の
7種類のアニメーション variants を定義。
spec の B/C カテゴリで使用する全パターンを網羅。

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: useRecollyMotion フック作成（TDD）

**Files:**
- Create: `frontend/src/lib/motion/useRecollyMotion.ts`
- Create: `frontend/src/lib/motion/useRecollyMotion.test.ts`

このタスクは TDD で進める。reduced-motion 対応はアクセシビリティの中核ロジックなので、テストを先に書く。

- [ ] **Step 1: 失敗するテストを書く**

`frontend/src/lib/motion/useRecollyMotion.test.ts` を作成：

```typescript
// frontend/src/lib/motion/useRecollyMotion.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

// useReducedMotion をモックする
vi.mock('motion/react', () => ({
  useReducedMotion: vi.fn(),
}))

import { useReducedMotion } from 'motion/react'
import { useRecollyMotion } from './useRecollyMotion'
import { fadeInUpVariants, modalVariants } from './variants'

describe('useRecollyMotion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('reduced-motion=false の時、通常 variants を返す', () => {
    vi.mocked(useReducedMotion).mockReturnValue(false)

    const { result } = renderHook(() => useRecollyMotion())

    expect(result.current.fadeInUp).toBe(fadeInUpVariants)
    expect(result.current.modal).toBe(modalVariants)
  })

  it('reduced-motion=true の時、即時版 variants（opacity のみ）を返す', () => {
    vi.mocked(useReducedMotion).mockReturnValue(true)

    const { result } = renderHook(() => useRecollyMotion())

    // 通常版とは異なるオブジェクトであるべき
    expect(result.current.fadeInUp).not.toBe(fadeInUpVariants)
    expect(result.current.modal).not.toBe(modalVariants)

    // hidden 状態は opacity: 0 のみで y や scale を含まないこと
    const fadeHidden = result.current.fadeInUp.hidden as Record<string, unknown>
    expect(fadeHidden).toEqual({ opacity: 0 })

    const modalHidden = result.current.modal.hidden as Record<string, unknown>
    expect(modalHidden).toEqual({ opacity: 0 })
  })

  it('reduced-motion=true の時、duration が 0 になる', () => {
    vi.mocked(useReducedMotion).mockReturnValue(true)

    const { result } = renderHook(() => useRecollyMotion())

    const visible = result.current.fadeInUp.visible as Record<string, unknown>
    const transition = visible.transition as Record<string, number>
    expect(transition.duration).toBe(0)
  })

  it('reduced-motion=true の時、stagger も 0 になる', () => {
    vi.mocked(useReducedMotion).mockReturnValue(true)

    const { result } = renderHook(() => useRecollyMotion())

    const containerVisible = result.current.listContainer.visible as Record<string, unknown>
    const transition = containerVisible.transition as Record<string, number>
    expect(transition.staggerChildren).toBe(0)
  })

  it('全 variants（list/fadeInUp/modal/overlay/dropdown/toast/banner）を返す', () => {
    vi.mocked(useReducedMotion).mockReturnValue(false)

    const { result } = renderHook(() => useRecollyMotion())

    expect(result.current.listContainer).toBeDefined()
    expect(result.current.fadeInUp).toBeDefined()
    expect(result.current.modal).toBeDefined()
    expect(result.current.overlay).toBeDefined()
    expect(result.current.dropdown).toBeDefined()
    expect(result.current.toast).toBeDefined()
    expect(result.current.banner).toBeDefined()
  })
})
```

- [ ] **Step 2: テストを実行して失敗を確認**

```bash
cd frontend && npx vitest run src/lib/motion/useRecollyMotion.test.ts
```

Expected: FAIL with "Cannot find module './useRecollyMotion'"

- [ ] **Step 3: useRecollyMotion.ts を実装**

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
 *
 * reduced-motion が有効なら、全 variants を「即時状態変化」版（opacity のみ、duration 0）
 * に置き換える。translate/scale/rotate は禁止し、フェードのみ残すのは WCAG 慣習に従う。
 */
export function useRecollyMotion() {
  const shouldReduce = useReducedMotion()

  if (shouldReduce) {
    return {
      listContainer: {
        hidden: {},
        visible: { transition: { staggerChildren: 0 } },
      },
      fadeInUp: {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { duration: 0 } },
      },
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

- [ ] **Step 4: テストを実行してパスを確認**

```bash
cd frontend && npx vitest run src/lib/motion/useRecollyMotion.test.ts
```

Expected: 5 tests passed

- [ ] **Step 5: コミット**

```bash
git add frontend/src/lib/motion/useRecollyMotion.ts frontend/src/lib/motion/useRecollyMotion.test.ts
git commit -m "$(cat <<'EOF'
feat(frontend): useRecollyMotion フックを追加（TDD）

reduced-motion 設定を尊重する共通フック。
有効時は全 variants を opacity のみ・duration 0 の即時版に切り替える。
WCAG 2.1 SC 2.3.3 準拠。

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: motion ライブラリの公開エントリポイント（index.ts）

**Files:**
- Create: `frontend/src/lib/motion/index.ts`

- [ ] **Step 1: index.ts を作成**

```typescript
// frontend/src/lib/motion/index.ts
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

- [ ] **Step 2: TypeScriptビルドが通ることを確認**

```bash
cd frontend && npx tsc --noEmit
```

Expected: エラーなし

- [ ] **Step 3: コミット**

```bash
git add frontend/src/lib/motion/index.ts
git commit -m "$(cat <<'EOF'
feat(frontend): lib/motion の公開エントリポイントを追加

各コンポーネントから 'lib/motion' 1行で必要なものをインポートできるようにする。

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: tokens.css 更新（既存変数の値変更 + 新規追加 + reduced-motion ブロック）

**Files:**
- Modify: `frontend/src/styles/tokens.css`

- [ ] **Step 1: 既存の `--transition-fast` と `--transition-normal` の値を更新**

`frontend/src/styles/tokens.css` 内の以下を更新：

```css
/* 変更前 */
--transition-fast: 150ms ease;
--transition-normal: 250ms ease;
```

```css
/* 変更後 */
--transition-fast: 160ms cubic-bezier(0.32, 0.72, 0, 1);
--transition-normal: 240ms cubic-bezier(0.16, 1, 0.3, 1);
```

- [ ] **Step 2: 新規変数を追加**

`--transition-normal` の直後に以下を追加：

```css
--transition-slow: 380ms cubic-bezier(0.16, 1, 0.3, 1);
--easing-snap: cubic-bezier(0.32, 0.72, 0, 1);
--easing-calm: cubic-bezier(0.16, 1, 0.3, 1);
--easing-exit: cubic-bezier(0.7, 0, 0.84, 0);
```

- [ ] **Step 3: ファイル末尾に prefers-reduced-motion ブロックを追加**

`tokens.css` の `:root { ... }` の閉じ括弧の**外側**（ファイル末尾）に追加：

```css
/* ===== prefers-reduced-motion 対応 ===== */
/* OS設定で「動きを減らす」が有効な場合、全アニメーションを実質無効化する */
/* WCAG 2.1 SC 2.3.3 準拠。!important はアクセシビリティ対応の例外として許容 */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

- [ ] **Step 4: ビルドが通ることを確認**

```bash
cd frontend && npm run build
```

Expected: エラーなし

- [ ] **Step 5: 既存テストが全て通ることを確認**

```bash
cd frontend && npm test
```

Expected: 全テストパス（CSS変更はテストには影響しないはず）

- [ ] **Step 6: コミット**

```bash
git add frontend/src/styles/tokens.css
git commit -m "$(cat <<'EOF'
feat(frontend): tokens.css にモーション変数追加と reduced-motion 対応

- 既存の --transition-fast / --transition-normal を新しい曲線に更新
- --transition-slow / --easing-snap / --easing-calm / --easing-exit を新規追加
- @media (prefers-reduced-motion: reduce) ブロックを追加し、
  全49ファイルのCSS transitionを reduced-motion 時に無効化

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: test-setup.ts に motion モックを追加

**Files:**
- Modify: `frontend/src/test-setup.ts`

- [ ] **Step 1: test-setup.ts を更新**

現在の `frontend/src/test-setup.ts`:

```typescript
import '@testing-library/jest-dom'
```

これを以下に置き換え：

```typescript
import '@testing-library/jest-dom'
import { vi } from 'vitest'
import type React from 'react'

/**
 * motion ライブラリをテスト環境用にモックする。
 *
 * AnimatePresence をパススルー（子要素を素通し）にすることで、
 * 既存テストが「閉じるボタン押下後、即座にダイアログが消える」前提で
 * 動き続けられるようにする。
 *
 * アニメーション自体の見た目はテスト対象ではないので、
 * motion.div 等は通常の div として扱われれば十分。
 */
vi.mock('motion/react', async () => {
  const actual = await vi.importActual<typeof import('motion/react')>('motion/react')
  return {
    ...actual,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  }
})
```

- [ ] **Step 2: 既存テストが全て通ることを確認**

```bash
cd frontend && npm test
```

Expected: 全テストパス（モックの追加で既存テストが壊れないことを確認）

- [ ] **Step 3: コミット**

```bash
git add frontend/src/test-setup.ts
git commit -m "$(cat <<'EOF'
test(frontend): motion ライブラリのテスト用モックを追加

AnimatePresence をパススルーにして、既存テストが「ダイアログが
即座に消える」前提を維持できるようにする。
アニメーション自体はテスト対象外。

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: D-Group1 — Button.module.css の :active 反応とtransition拡張

**Files:**
- Modify: `frontend/src/components/ui/Button/Button.module.css`

- [ ] **Step 1: `.base` の transition に transform を追加**

現状の `.base` セレクタ：

```css
.base {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  font-family: var(--font-body);
  font-weight: var(--font-weight-medium);
  border: var(--border-width) var(--border-style) transparent;
  transition:
    background-color var(--transition-fast),
    color var(--transition-fast),
    border-color var(--transition-fast);
}
```

これを以下に置き換え：

```css
.base {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  font-family: var(--font-body);
  font-weight: var(--font-weight-medium);
  border: var(--border-width) var(--border-style) transparent;
  transition:
    background-color var(--transition-fast),
    color var(--transition-fast),
    border-color var(--transition-fast),
    transform var(--transition-fast);
}
```

- [ ] **Step 2: `:active` 状態を追加**

ファイルの末尾に以下を追加：

```css
/* クリック反応：押された時のフィードバック */
.primary:active:not(:disabled),
.secondary:active:not(:disabled) {
  transform: scale(0.97);
}
```

- [ ] **Step 3: 既存テストが全て通ることを確認**

```bash
cd frontend && npm test -- src/components/ui/Button
```

Expected: Button のテストパス

- [ ] **Step 4: コミット**

```bash
git add frontend/src/components/ui/Button/Button.module.css
git commit -m "$(cat <<'EOF'
feat(frontend): Button にクリック反応の scale(0.97) を追加

primary/secondary ボタンの :active 状態に押し心地の
transform: scale(0.97) を追加。
.base の transition に transform を含めて滑らかに動くようにする。

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: D-Group2 — カード系5ファイルのホバー反応統一

**Files:**
- Modify: `frontend/src/components/WorkCard/WorkCard.module.css`
- Modify: `frontend/src/components/RecordCardItem/RecordCardItem.module.css`
- Modify: `frontend/src/components/WatchingListItem/WatchingListItem.module.css`
- Modify: `frontend/src/components/RecordCompactItem/RecordCompactItem.module.css`
- Modify: `frontend/src/components/RecordListItem/RecordListItem.module.css`

カード系コンポーネントは2種類ある：

- **グリッドカード型**（独立したカードで表示）: WorkCard, RecordCardItem
  → `transform: translateY(-2px)` + `box-shadow` を新規ホバーとして追加
- **ボーダー区切り行型**（リスト内で行として並ぶ）: WatchingListItem, RecordCompactItem, RecordListItem
  → 既存の background-color hover を維持しつつ、わずかな `box-shadow` を追加（translateYは行型では border-bottom を破壊するため避ける）

> **設計判断（spec の補足）:** spec 7.1 は「クリック可能なカード = translateY + 影」と一律に記載しているが、
> border-bottom 区切りの行型コンポーネントで translateY を使うと、行と区切り線の間に隙間が生じて視覚的に破綻する。
> そのため行型では「translateYなし、box-shadowのみ追加」で spec の意図（「触ったときの軽快な反応」）を満たす。
> グリッドカード型は spec 通り translateY + 影 を適用する。

- [ ] **Step 1: WorkCard.module.css を更新**

現状の `.card` セレクタ：

```css
.card {
  display: flex;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  border-bottom: var(--border-width) var(--border-style) var(--color-border-light);
  align-items: flex-start;
}
```

これを以下に置き換え（transition を追加）：

```css
.card {
  display: flex;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  border-bottom: var(--border-width) var(--border-style) var(--color-border-light);
  align-items: flex-start;
  transition:
    background-color var(--transition-fast),
    box-shadow var(--transition-fast);
}

.card:hover {
  background-color: var(--color-bg);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}
```

> 注: WorkCard は border-bottom 区切りの「行型」なので translateY なし。

- [ ] **Step 2: RecordCardItem.module.css を更新**

現状の `.card` と `.card:hover`：

```css
.card {
  display: flex;
  flex-direction: column;
  text-decoration: none;
  color: inherit;
  transition: opacity var(--transition-fast);
  /* グリッド内で画像の元サイズに引きずられないようにする */
  min-width: 0;
}

.card:hover {
  opacity: 0.8;
}
```

これを以下に置き換え：

```css
.card {
  display: flex;
  flex-direction: column;
  text-decoration: none;
  color: inherit;
  transition:
    transform var(--transition-fast),
    box-shadow var(--transition-fast);
  /* グリッド内で画像の元サイズに引きずられないようにする */
  min-width: 0;
}

.card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
}
```

> 注: RecordCardItem はグリッドカード型（border-bottom なし）なので translateY あり。

- [ ] **Step 3: WatchingListItem.module.css を更新**

現状の `.row` セレクタの transition と `.row:hover`：

```css
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-sm) var(--spacing-md);
  border: var(--border-width-thin) solid var(--color-border-light);
  border-radius: var(--radius-sm);
  transition: background var(--transition-fast);
}
.row:hover {
  background: var(--color-bg);
}
```

`.row` の transition と `.row:hover` のみ更新：

```css
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-sm) var(--spacing-md);
  border: var(--border-width-thin) solid var(--color-border-light);
  border-radius: var(--radius-sm);
  transition:
    background var(--transition-fast),
    box-shadow var(--transition-fast),
    transform var(--transition-fast);
}
.row:hover {
  background: var(--color-bg);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  transform: translateY(-1px);
}
```

> 注: WatchingListItem は border-radius を持つ独立行型（border-bottom ではなく囲み線）。
> translateY -1px と軽い影で「カード感」を出す。

- [ ] **Step 4: RecordCompactItem.module.css を更新**

現状の `.row`：

```css
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  border-bottom: 1px solid var(--color-border-light);
  text-decoration: none;
  color: inherit;
  transition: background-color var(--transition-fast);
}

.row:hover {
  background-color: var(--color-bg);
}
```

`.row` の transition と `.row:hover` のみ更新：

```css
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  border-bottom: 1px solid var(--color-border-light);
  text-decoration: none;
  color: inherit;
  transition:
    background-color var(--transition-fast),
    box-shadow var(--transition-fast);
}

.row:hover {
  background-color: var(--color-bg);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
}
```

> 注: border-bottom 区切りの行型なので translateY なし、box-shadow のみ。

- [ ] **Step 5: RecordListItem.module.css を更新**

現状の `.card`：

```css
.card {
  display: flex;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  border-bottom: var(--border-width) var(--border-style) var(--color-border-light);
  text-decoration: none;
  color: inherit;
  transition: background-color var(--transition-fast);
}

.card:hover {
  background-color: var(--color-bg);
}
```

`.card` の transition と `.card:hover` のみ更新：

```css
.card {
  display: flex;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  border-bottom: var(--border-width) var(--border-style) var(--color-border-light);
  text-decoration: none;
  color: inherit;
  transition:
    background-color var(--transition-fast),
    box-shadow var(--transition-fast);
}

.card:hover {
  background-color: var(--color-bg);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}
```

> 注: border-bottom 区切り型なので translateY なし。

- [ ] **Step 6: 全テストパス確認**

```bash
cd frontend && npm test
```

Expected: 全テストパス

- [ ] **Step 7: コミット**

```bash
git add frontend/src/components/WorkCard/WorkCard.module.css \
        frontend/src/components/RecordCardItem/RecordCardItem.module.css \
        frontend/src/components/WatchingListItem/WatchingListItem.module.css \
        frontend/src/components/RecordCompactItem/RecordCompactItem.module.css \
        frontend/src/components/RecordListItem/RecordListItem.module.css
git commit -m "$(cat <<'EOF'
feat(frontend): カード系5コンポーネントのホバー反応を統一

- グリッドカード型（RecordCardItem）: translateY(-2px) + box-shadow
- 独立行型（WatchingListItem）: translateY(-1px) + box-shadow
- ボーダー区切り行型（WorkCard, RecordCompactItem, RecordListItem）:
  既存の background-color に box-shadow を追加（translateY は border-bottom
  と相性が悪いため不採用）

spec 7.1 の意図「触ったときの軽快な反応」を、各コンポーネントの構造に
合わせた形で実現する。

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: D-Group3 — フォーム入力系3ファイルの focus 反応強化

**Files:**
- Modify: `frontend/src/components/ui/FormInput/FormInput.module.css`
- Modify: `frontend/src/components/ui/FormSelect/FormSelect.module.css`
- Modify: `frontend/src/components/ui/FormTextarea/FormTextarea.module.css`

3ファイルとも共通構造で、`.input/.select/.textarea` がボトムボーダースタイルのフォーム要素。focus時のborder-bottom変化に加えて、わずかな影を追加する。

- [ ] **Step 1: FormInput.module.css を更新**

現状の `.input` と `.input:focus`:

```css
.input {
  padding: var(--spacing-sm) 2px;
  border: none;
  border-bottom: 1.5px solid var(--color-border-light);
  border-radius: var(--radius-none);
  font-family: var(--font-body);
  font-size: var(--font-size-body);
  color: var(--color-text);
  background: transparent;
  transition: border-color var(--transition-fast);
}

.input:focus {
  outline: none;
  border-bottom-color: var(--color-text);
}
```

これを以下に置き換え：

```css
.input {
  padding: var(--spacing-sm) 2px;
  border: none;
  border-bottom: 1.5px solid var(--color-border-light);
  border-radius: var(--radius-none);
  font-family: var(--font-body);
  font-size: var(--font-size-body);
  color: var(--color-text);
  background: transparent;
  transition:
    border-color var(--transition-fast),
    box-shadow var(--transition-fast);
}

.input:focus {
  outline: none;
  border-bottom-color: var(--color-text);
  box-shadow: 0 1px 0 0 var(--color-text);
}
```

> 注: `box-shadow: 0 1px 0 0 var(--color-text)` でボトムボーダーを「2px相当の太さ感」に強調する。
> focus 状態がより明確になり、アクセシビリティも向上する。

- [ ] **Step 2: FormSelect.module.css を更新**

現状の `.select` と `.select:focus`:

```css
.select {
  padding: var(--spacing-sm) 2px;
  border: none;
  border-bottom: 1.5px solid var(--color-border-light);
  border-radius: var(--radius-none);
  font-family: var(--font-body);
  font-size: var(--font-size-body);
  color: var(--color-text);
  background: transparent;
  cursor: pointer;
  transition: border-color var(--transition-fast);
}

.select:focus {
  outline: none;
  border-bottom-color: var(--color-text);
}
```

これを以下に置き換え：

```css
.select {
  padding: var(--spacing-sm) 2px;
  border: none;
  border-bottom: 1.5px solid var(--color-border-light);
  border-radius: var(--radius-none);
  font-family: var(--font-body);
  font-size: var(--font-size-body);
  color: var(--color-text);
  background: transparent;
  cursor: pointer;
  transition:
    border-color var(--transition-fast),
    box-shadow var(--transition-fast);
}

.select:focus {
  outline: none;
  border-bottom-color: var(--color-text);
  box-shadow: 0 1px 0 0 var(--color-text);
}
```

- [ ] **Step 3: FormTextarea.module.css を更新**

現状の `.textarea` と `.textarea:focus`:

```css
.textarea {
  padding: var(--spacing-sm) 2px;
  border: none;
  border-bottom: 1.5px solid var(--color-border-light);
  border-radius: var(--radius-none);
  font-family: var(--font-body);
  font-size: var(--font-size-body);
  color: var(--color-text);
  background: transparent;
  resize: vertical;
  transition: border-color var(--transition-fast);
}

.textarea:focus {
  outline: none;
  border-bottom-color: var(--color-text);
}
```

これを以下に置き換え：

```css
.textarea {
  padding: var(--spacing-sm) 2px;
  border: none;
  border-bottom: 1.5px solid var(--color-border-light);
  border-radius: var(--radius-none);
  font-family: var(--font-body);
  font-size: var(--font-size-body);
  color: var(--color-text);
  background: transparent;
  resize: vertical;
  transition:
    border-color var(--transition-fast),
    box-shadow var(--transition-fast);
}

.textarea:focus {
  outline: none;
  border-bottom-color: var(--color-text);
  box-shadow: 0 1px 0 0 var(--color-text);
}
```

- [ ] **Step 4: 全テストパス確認**

```bash
cd frontend && npm test
```

Expected: 全テストパス

- [ ] **Step 5: コミット**

```bash
git add frontend/src/components/ui/FormInput/FormInput.module.css \
        frontend/src/components/ui/FormSelect/FormSelect.module.css \
        frontend/src/components/ui/FormTextarea/FormTextarea.module.css
git commit -m "$(cat <<'EOF'
feat(frontend): フォーム要素3種に focus 時の box-shadow 強調を追加

FormInput / FormSelect / FormTextarea の :focus 状態に box-shadow を追加し、
ボトムボーダーがより太く見えるようにする。
focus 状態の視認性とアクセシビリティを向上させる。

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: B-1 — HomePage に staggered fade-in を追加

**Files:**
- Modify: `frontend/src/pages/HomePage/HomePage.tsx`

- [ ] **Step 1: HomePage.tsx を更新**

現状の HomePage.tsx 全体：

```tsx
import { SectionTitle } from '../../components/ui/SectionTitle/SectionTitle'
import { WatchingListItem } from '../../components/WatchingListItem/WatchingListItem'
import { DashboardEmptyState } from '../../components/DashboardEmptyState/DashboardEmptyState'
import { EmailPromptBanner } from '../../components/EmailPromptBanner/EmailPromptBanner'
import { useAuth } from '../../contexts/useAuth'
import { useDashboard } from '../../hooks/useDashboard'
import styles from './HomePage.module.css'

export function HomePage() {
  const { user } = useAuth()
  const { records, isLoading, error, handleAction } = useDashboard()

  return (
    <div className={styles.container}>
      {user?.email_missing && <EmailPromptBanner />}
      {isLoading && <div className={styles.loading}>読み込み中...</div>}
      {error && <div className={styles.error}>{error}</div>}
      {!isLoading && !error && records.length === 0 && <DashboardEmptyState />}
      {!isLoading && !error && records.length > 0 && (
        <>
          <SectionTitle>進行中</SectionTitle>
          <div className={styles.list}>
            {records.map((record) => (
              <WatchingListItem
                key={record.id}
                record={record}
                onAction={() => void handleAction(record)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
```

これを以下に置き換え：

```tsx
import { motion } from 'motion/react'
import { SectionTitle } from '../../components/ui/SectionTitle/SectionTitle'
import { WatchingListItem } from '../../components/WatchingListItem/WatchingListItem'
import { DashboardEmptyState } from '../../components/DashboardEmptyState/DashboardEmptyState'
import { EmailPromptBanner } from '../../components/EmailPromptBanner/EmailPromptBanner'
import { useAuth } from '../../contexts/useAuth'
import { useDashboard } from '../../hooks/useDashboard'
import { useRecollyMotion } from '../../lib/motion'
import styles from './HomePage.module.css'

export function HomePage() {
  const { user } = useAuth()
  const { records, isLoading, error, handleAction } = useDashboard()
  const m = useRecollyMotion()

  return (
    <div className={styles.container}>
      {user?.email_missing && <EmailPromptBanner />}
      {isLoading && <div className={styles.loading}>読み込み中...</div>}
      {error && <div className={styles.error}>{error}</div>}
      {!isLoading && !error && records.length === 0 && <DashboardEmptyState />}
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
                <WatchingListItem
                  record={record}
                  onAction={() => void handleAction(record)}
                />
              </motion.div>
            ))}
          </motion.div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: HomePage のテストが通ることを確認**

```bash
cd frontend && npm test -- src/pages/HomePage
```

Expected: 全パス

- [ ] **Step 3: コミット**

```bash
git add frontend/src/pages/HomePage/HomePage.tsx
git commit -m "$(cat <<'EOF'
feat(frontend): HomePage にカードリストの staggered fade-in を追加

進行中の作品リストを motion.div でラップし、カードが
下から100ms間隔で順次フェードインするようにする。
WatchingListItem の中身は変更しない。

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: B-2 — LibraryPage に staggered fade-in を追加

**Files:**
- Modify: `frontend/src/pages/LibraryPage/LibraryPage.tsx`

- [ ] **Step 1: LibraryPage.tsx の import を更新**

ファイル冒頭の import 群に以下を追加：

```typescript
import { motion } from 'motion/react'
import { useRecollyMotion } from '../../lib/motion'
```

- [ ] **Step 2: useLibrary フックの直後に useRecollyMotion を追加**

`useLibrary(perPage)` の分割代入の直後に：

```typescript
const m = useRecollyMotion()
```

- [ ] **Step 3: 記録一覧表示部分を motion.div でラップ**

現状（L160-181）：

```tsx
{!isLoading && !error && records.length > 0 && (
  <>
    <div
      className={
        layout === 'card'
          ? styles.cardGrid
          : layout === 'compact'
            ? styles.compactList
            : styles.list
      }
    >
      {records.map((record) => {
        switch (layout) {
          case 'card':
            return <RecordCardItem key={record.id} record={record} />
          case 'compact':
            return <RecordCompactItem key={record.id} record={record} />
          default:
            return <RecordListItem key={record.id} record={record} />
        }
      })}
    </div>
    <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
  </>
)}
```

これを以下に置き換え：

```tsx
{!isLoading && !error && records.length > 0 && (
  <>
    <motion.div
      key={`${layout}-${page}-${status ?? 'all'}-${mediaType ?? 'all'}-${sort}-${selectedTags.join(',')}`}
      className={
        layout === 'card'
          ? styles.cardGrid
          : layout === 'compact'
            ? styles.compactList
            : styles.list
      }
      variants={m.listContainer}
      initial="hidden"
      animate="visible"
    >
      {records.map((record) => (
        <motion.div key={record.id} variants={m.fadeInUp}>
          {layout === 'card' && <RecordCardItem record={record} />}
          {layout === 'compact' && <RecordCompactItem record={record} />}
          {layout === 'list' && <RecordListItem record={record} />}
        </motion.div>
      ))}
    </motion.div>
    <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
  </>
)}
```

> **注:** `key` プロパティに layout/page/filter を含めることで、レイアウトやページが変わったとき
> motion.div が「新しいインスタンス」と認識され、再度 fade-in アニメーションが走る。
> これがないと、ページネーション時にカードが既に表示済みになってアニメが見えない。

- [ ] **Step 4: LibraryPage のテストが通ることを確認**

```bash
cd frontend && npm test -- src/pages/LibraryPage
```

Expected: 全パス

- [ ] **Step 5: コミット**

```bash
git add frontend/src/pages/LibraryPage/LibraryPage.tsx
git commit -m "$(cat <<'EOF'
feat(frontend): LibraryPage に記録カードの staggered fade-in を追加

3種類のレイアウト（card/compact/list）すべてで動作。
レイアウト変更・ページ変更・フィルタ変更時に再アニメーション
されるよう key 戦略を採用。

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: B-3 — SearchPage に staggered fade-in を追加

**Files:**
- Modify: `frontend/src/pages/SearchPage/SearchPage.tsx`

- [ ] **Step 1: SearchPage.tsx の import を更新**

ファイル冒頭の import 群に以下を追加：

```typescript
import { motion } from 'motion/react'
import { useRecollyMotion } from '../../lib/motion'
```

- [ ] **Step 2: コンポーネント本体の上部で useRecollyMotion を呼ぶ**

`export function SearchPage()` 内、`useState` 群の直後に以下を追加：

```typescript
const m = useRecollyMotion()
```

- [ ] **Step 3: 検索結果リストを motion.div でラップ**

現状（L271-286 周辺）：

```tsx
{results.length > 0 && (
  <div className={styles.results}>
    {results.map((work) => {
      const workKey = `${work.external_api_source}:${work.external_api_id}`
      return (
        <WorkCard
          key={workKey}
          work={work}
          onRecord={handleOpenModal}
          isRecorded={recordedIds.has(workKey)}
          isLoading={loadingId === workKey}
        />
      )
    })}
  </div>
)}
```

これを以下に置き換え：

```tsx
{results.length > 0 && (
  <motion.div
    key={`${query}-${genre}-${results.length}`}
    className={styles.results}
    variants={m.listContainer}
    initial="hidden"
    animate="visible"
  >
    {results.map((work) => {
      const workKey = `${work.external_api_source}:${work.external_api_id}`
      return (
        <motion.div key={workKey} variants={m.fadeInUp}>
          <WorkCard
            work={work}
            onRecord={handleOpenModal}
            isRecorded={recordedIds.has(workKey)}
            isLoading={loadingId === workKey}
          />
        </motion.div>
      )
    })}
  </motion.div>
)}
```

> 注: `key` に query/genre/results.length を含めることで、検索結果の更新時に再度 stagger fade-in が走る。

- [ ] **Step 4: SearchPage のテストが通ることを確認**

```bash
cd frontend && npm test -- src/pages/SearchPage
```

Expected: 全パス

- [ ] **Step 5: コミット**

```bash
git add frontend/src/pages/SearchPage/SearchPage.tsx
git commit -m "$(cat <<'EOF'
feat(frontend): SearchPage に検索結果の staggered fade-in を追加

検索結果の WorkCard リストを motion でラップ。
query や genre が変わって新しい結果が来た時に再度
fade-in アニメーションが走るよう key 戦略を採用。

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 14: B-4 — RecommendationsPage に staggered fade-in を追加

**Files:**
- Modify: `frontend/src/pages/RecommendationsPage/RecommendationsPage.tsx`

- [ ] **Step 1: 既存ファイルを Read で確認**

```bash
# 実装エージェントは Read tool で全文を確認すること
```

ファイル: `frontend/src/pages/RecommendationsPage/RecommendationsPage.tsx`（242行）

- [ ] **Step 2: import を追加**

ファイル冒頭の import 群に追加：

```typescript
import { motion } from 'motion/react'
import { useRecollyMotion } from '../../lib/motion'
```

- [ ] **Step 3: コンポーネント本体で useRecollyMotion を呼ぶ**

`export function RecommendationsPage()` 内の hook 群の直後に：

```typescript
const m = useRecollyMotion()
```

- [ ] **Step 4: おすすめ作品カードのリスト箇所を motion でラップ**

`RecommendedWorkCard` を `.map()` で並べている箇所を見つけ、HomePage と同じパターンで motion.div でラップする。

パターン：

```tsx
<motion.div
  className={styles.cardGrid}  // or 既存のクラス名
  variants={m.listContainer}
  initial="hidden"
  animate="visible"
>
  {recommendations.map((rec) => (
    <motion.div key={rec.id} variants={m.fadeInUp}>
      <RecommendedWorkCard ... />
    </motion.div>
  ))}
</motion.div>
```

> 注: 既存ファイルの構造を Read で確認して、正確なクラス名・ループ変数名を使うこと。

- [ ] **Step 5: AnalysisDetail / AnalysisSummaryCard など他セクションがあれば、それぞれ `motion.div` で `m.fadeInUp` を割り当て、トップレベルの container に `m.listContainer` を割り当てる**

具体的な構造は既存ファイルを確認して、HomePage や WorkDetailPage（Task 15）と同じ「セクション順次出現」パターンで適用する。

- [ ] **Step 6: RecommendationsPage のテストが通ることを確認**

```bash
cd frontend && npm test -- src/pages/RecommendationsPage
```

Expected: 全パス

- [ ] **Step 7: コミット**

```bash
git add frontend/src/pages/RecommendationsPage/RecommendationsPage.tsx
git commit -m "$(cat <<'EOF'
feat(frontend): RecommendationsPage に staggered fade-in を追加

おすすめ作品カードと分析セクションを motion でラップし、
順次フェードインで表示する。

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 15: B-5 — WorkDetailPage に セクション順次出現を追加

**Files:**
- Modify: `frontend/src/pages/WorkDetailPage/WorkDetailPage.tsx`

- [ ] **Step 1: 既存ファイルを Read で確認**

```bash
# 実装エージェントは Read tool で全文を確認すること
```

ファイル: `frontend/src/pages/WorkDetailPage/WorkDetailPage.tsx`（236行）

- [ ] **Step 2: import を追加**

```typescript
import { motion } from 'motion/react'
import { useRecollyMotion } from '../../lib/motion'
```

- [ ] **Step 3: コンポーネント本体で useRecollyMotion を呼ぶ**

`export function WorkDetailPage()` 内の hook 群の直後に：

```typescript
const m = useRecollyMotion()
```

- [ ] **Step 4: 主要セクションを motion.div で順次出現させる**

WorkDetailPage は2カラムサイドバー型のレイアウトで、複数のセクション（WorkHeader、ReviewSection、EpisodeReviewSection、TagSection、DiscussionSection 等）を含む。

メインコンテンツ部分（return の `<div className={styles.page}>...</div>` の中身）の最も外側の wrapper（または各セクションを並べているコンテナ）を `motion.div` に置き換え、`variants={m.listContainer}` を適用する。

各セクションコンポーネントを `<motion.div variants={m.fadeInUp}>...</motion.div>` でラップする：

```tsx
<motion.div variants={m.listContainer} initial="hidden" animate="visible">
  <motion.div variants={m.fadeInUp}>
    {/* 既存の作品ヘッダー部分 */}
  </motion.div>
  <motion.div variants={m.fadeInUp}>
    <ReviewSection ... />
  </motion.div>
  <motion.div variants={m.fadeInUp}>
    <EpisodeReviewSection ... />
  </motion.div>
  <motion.div variants={m.fadeInUp}>
    <TagSection ... />
  </motion.div>
  <motion.div variants={m.fadeInUp}>
    <DiscussionSection ... />
  </motion.div>
  {/* 他のセクションも同様 */}
</motion.div>
```

> 注: WorkDetailPage はサイドバー2カラムの可能性があるので、レイアウト崩れに注意。
> 既存の `<div>` を `<motion.div>` に置き換えるだけなら `className` が引き継がれてレイアウトは保たれる。
> RecordDeleteDialog はこのファイル内で呼ばれているが、Task 18 で別途処理する（このタスクでは触らない）。

- [ ] **Step 5: WorkDetailPage のテストが通ることを確認**

```bash
cd frontend && npm test -- src/pages/WorkDetailPage
```

Expected: 全パス

- [ ] **Step 6: ブラウザで目視確認**

```bash
cd frontend && npm run dev
```

→ 適当な作品詳細ページを開いて、各セクションが順次フェードインすることを確認。レイアウトが崩れていないことも確認。

- [ ] **Step 7: コミット**

```bash
git add frontend/src/pages/WorkDetailPage/WorkDetailPage.tsx
git commit -m "$(cat <<'EOF'
feat(frontend): WorkDetailPage にセクション順次出現を追加

作品ヘッダー、レビュー、エピソードレビュー、タグ、ディスカッション
の各セクションを motion でラップし、上から順にフェードインで
表示する。サイドバー型レイアウトは維持。

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 16: C-1 — UserMenu にドロップダウン開閉アニメを追加

**Files:**
- Modify: `frontend/src/components/ui/UserMenu/UserMenu.tsx`

UserMenu は内部で `isOpen` state を管理しているので、`<AnimatePresence>` を内側に置けるパターン。

- [ ] **Step 1: import を追加**

`UserMenu.tsx` の import 群に追加：

```typescript
import { motion, AnimatePresence } from 'motion/react'
import { useRecollyMotion } from '../../../lib/motion'
```

- [ ] **Step 2: useRecollyMotion を呼ぶ**

`export function UserMenu({ user, onLogout }: UserMenuProps)` 内、`useState` の直後に：

```typescript
const m = useRecollyMotion()
```

- [ ] **Step 3: ドロップダウン部分を AnimatePresence + motion.div でラップ**

現状の return 内のドロップダウン部分（L47-63）：

```tsx
{isOpen && (
  <div className={styles.dropdown}>
    <div className={styles.header}>{user.username}</div>
    <div className={styles.email}>{user.email}</div>
    <div className={styles.divider} />
    <Link to={`/users/${user.id}`} className={styles.item} onClick={() => setIsOpen(false)}>
      プロフィール
    </Link>
    <Link to="/settings" className={styles.item} onClick={() => setIsOpen(false)}>
      設定
    </Link>
    <div className={styles.divider} />
    <button className={styles.item} onClick={onLogout}>
      ログアウト
    </button>
  </div>
)}
```

これを以下に置き換え：

```tsx
<AnimatePresence>
  {isOpen && (
    <motion.div
      className={styles.dropdown}
      variants={m.dropdown}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      <div className={styles.header}>{user.username}</div>
      <div className={styles.email}>{user.email}</div>
      <div className={styles.divider} />
      <Link to={`/users/${user.id}`} className={styles.item} onClick={() => setIsOpen(false)}>
        プロフィール
      </Link>
      <Link to="/settings" className={styles.item} onClick={() => setIsOpen(false)}>
        設定
      </Link>
      <div className={styles.divider} />
      <button className={styles.item} onClick={onLogout}>
        ログアウト
      </button>
    </motion.div>
  )}
</AnimatePresence>
```

- [ ] **Step 4: UserMenu のテストが通ることを確認**

```bash
cd frontend && npm test -- src/components/ui/UserMenu
```

Expected: 全パス（test-setup.ts の AnimatePresence モックにより、即座に表示/消失する挙動が維持される）

- [ ] **Step 5: コミット**

```bash
git add frontend/src/components/ui/UserMenu/UserMenu.tsx
git commit -m "$(cat <<'EOF'
feat(frontend): UserMenu にドロップダウン開閉アニメを追加

AnimatePresence でドロップダウンを包み、開閉時の
フェード+わずかなスライドダウンアニメを実装。

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 17: C-2 — DropdownMenu に開閉アニメを追加

**Files:**
- Modify: `frontend/src/components/ui/DropdownMenu/DropdownMenu.tsx`

UserMenu と同じパターン。内部で `isOpen` state を管理しているので、`<AnimatePresence>` を内側に置く。

- [ ] **Step 1: import を追加**

```typescript
import { motion, AnimatePresence } from 'motion/react'
import { useRecollyMotion } from '../../../lib/motion'
```

- [ ] **Step 2: useRecollyMotion を呼ぶ**

`export function DropdownMenu({ items }: Props)` 内、`useState` の直後に：

```typescript
const m = useRecollyMotion()
```

- [ ] **Step 3: メニュー部分を AnimatePresence + motion.div でラップ**

現状（L39-55）：

```tsx
{isOpen && (
  <div className={styles.menu}>
    {items.map((item) => (
      <button
        key={item.label}
        type="button"
        className={item.danger ? styles.dangerItem : styles.menuItem}
        onClick={() => {
          item.onClick()
          setIsOpen(false)
        }}
      >
        {item.label}
      </button>
    ))}
  </div>
)}
```

これを以下に置き換え：

```tsx
<AnimatePresence>
  {isOpen && (
    <motion.div
      className={styles.menu}
      variants={m.dropdown}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          className={item.danger ? styles.dangerItem : styles.menuItem}
          onClick={() => {
            item.onClick()
            setIsOpen(false)
          }}
        >
          {item.label}
        </button>
      ))}
    </motion.div>
  )}
</AnimatePresence>
```

- [ ] **Step 4: DropdownMenu のテストが通ることを確認**

```bash
cd frontend && npm test -- src/components/ui/DropdownMenu
```

Expected: 全パス

- [ ] **Step 5: コミット**

```bash
git add frontend/src/components/ui/DropdownMenu/DropdownMenu.tsx
git commit -m "$(cat <<'EOF'
feat(frontend): DropdownMenu に開閉アニメを追加

AnimatePresence でメニューを包み、フェード+わずかなスライドダウンを実装。

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 18: C-3 — RecordDeleteDialog をmotion化（呼び出し元refactor含む）

**Files:**
- Modify: `frontend/src/components/RecordDeleteDialog/RecordDeleteDialog.tsx`
- Modify: `frontend/src/pages/WorkDetailPage/WorkDetailPage.tsx`
- Modify: `frontend/src/components/RecordDeleteDialog/RecordDeleteDialog.test.tsx`（必要なら）

このコンポーネントは現在 `isOpen` プロップで自身が `if (!isOpen) return null` する設計。
`<AnimatePresence>` を使うには、親が条件付きレンダリング `{isOpen && <RecordDeleteDialog ... />}` する形にリファクタする必要がある。

- [ ] **Step 1: RecordDeleteDialog.tsx をリファクタ + motion化**

現状の RecordDeleteDialog.tsx 全体：

```tsx
import { Button } from '../ui/Button/Button'
import styles from './RecordDeleteDialog.module.css'

type RecordDeleteDialogProps = {
  isOpen: boolean
  workTitle: string
  onConfirm: () => void
  onCancel: () => void
  isLoading: boolean
}

export function RecordDeleteDialog({
  isOpen,
  workTitle,
  onConfirm,
  onCancel,
  isLoading,
}: RecordDeleteDialogProps) {
  if (!isOpen) return null

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <h3 className={styles.title}>記録を削除</h3>
        <p className={styles.message}>
          「{workTitle}」の記録を削除しますか？この操作は取り消せません。
        </p>
        <div className={styles.actions}>
          <Button variant="secondary" onClick={onCancel}>
            キャンセル
          </Button>
          <Button variant="primary" onClick={onConfirm} disabled={isLoading}>
            {isLoading ? '削除中...' : '削除する'}
          </Button>
        </div>
      </div>
    </div>
  )
}
```

これを以下に置き換え（`isOpen` プロップ削除、motion化）：

```tsx
import { motion } from 'motion/react'
import { Button } from '../ui/Button/Button'
import { useRecollyMotion } from '../../lib/motion'
import styles from './RecordDeleteDialog.module.css'

type RecordDeleteDialogProps = {
  workTitle: string
  onConfirm: () => void
  onCancel: () => void
  isLoading: boolean
}

export function RecordDeleteDialog({
  workTitle,
  onConfirm,
  onCancel,
  isLoading,
}: RecordDeleteDialogProps) {
  const m = useRecollyMotion()

  return (
    <motion.div
      className={styles.overlay}
      onClick={onCancel}
      variants={m.overlay}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      <motion.div
        className={styles.dialog}
        onClick={(e) => e.stopPropagation()}
        variants={m.modal}
      >
        <h3 className={styles.title}>記録を削除</h3>
        <p className={styles.message}>
          「{workTitle}」の記録を削除しますか？この操作は取り消せません。
        </p>
        <div className={styles.actions}>
          <Button variant="secondary" onClick={onCancel}>
            キャンセル
          </Button>
          <Button variant="primary" onClick={onConfirm} disabled={isLoading}>
            {isLoading ? '削除中...' : '削除する'}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  )
}
```

> 注: 子の `motion.div`（dialog）には variants を渡しているが、親（overlay）の `initial/animate/exit` を子も自動的に継承する。これが motion の variants 伝播機構。

- [ ] **Step 2: WorkDetailPage.tsx で `<RecordDeleteDialog>` の呼び出しを `<AnimatePresence>` でラップし、isOpen を条件付きレンダリングに変換**

WorkDetailPage.tsx の import 群に追加（既に Task 15 で `motion` import 済みなら `AnimatePresence` のみ追加）：

```typescript
import { motion, AnimatePresence } from 'motion/react'
```

L227 周辺の現状：

```tsx
<RecordDeleteDialog
  isOpen={showDeleteDialog}
  workTitle={work.title}
  onConfirm={confirmDelete}
  ...
/>
```

これを以下に置き換え（具体的な props は既存の状態を読んで合わせる）：

```tsx
<AnimatePresence>
  {showDeleteDialog && (
    <RecordDeleteDialog
      workTitle={work.title}
      onConfirm={confirmDelete}
      ...
    />
  )}
</AnimatePresence>
```

> `isOpen` プロップは削除する。`{showDeleteDialog && ...}` で条件分岐を親側に移す。
> 他の props（`onCancel`, `isLoading` 等）はそのまま維持。

- [ ] **Step 3: RecordDeleteDialog.test.tsx の修正が必要か確認**

```bash
cd frontend && cat frontend/src/components/RecordDeleteDialog/RecordDeleteDialog.test.tsx
```

`isOpen={true}` や `isOpen={false}` を直接渡しているテストがあれば、条件付きレンダリングのパターンに修正する：

- `<RecordDeleteDialog isOpen={true} ... />` → `<RecordDeleteDialog ... />` （プロップ削除）
- `<RecordDeleteDialog isOpen={false} ... />` → 該当箇所では何も描画しない、または `null` を期待

- [ ] **Step 4: テストが通ることを確認**

```bash
cd frontend && npm test -- src/components/RecordDeleteDialog
cd frontend && npm test -- src/pages/WorkDetailPage
```

Expected: 全パス

- [ ] **Step 5: コミット**

```bash
git add frontend/src/components/RecordDeleteDialog/RecordDeleteDialog.tsx \
        frontend/src/components/RecordDeleteDialog/RecordDeleteDialog.test.tsx \
        frontend/src/pages/WorkDetailPage/WorkDetailPage.tsx
git commit -m "$(cat <<'EOF'
feat(frontend): RecordDeleteDialog にmotionアニメを追加

isOpen プロップを削除し、親側（WorkDetailPage）で条件付きレンダリング
+ AnimatePresence でラップする形にリファクタ。
オーバーレイのフェード + ダイアログ本体の scale フェードを実装。

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 19: C-4 — DiscussionCreateModal を motion 化

**Files:**
- Modify: `frontend/src/components/DiscussionCreateModal/DiscussionCreateModal.tsx`
- Modify: `frontend/src/components/DiscussionSection/DiscussionSection.tsx`

DiscussionCreateModal は親側で `{showCreateModal && <DiscussionCreateModal ... />}` 形式で呼ばれているので、リファクタ不要。motion化と AnimatePresence ラップのみ。

- [ ] **Step 1: DiscussionCreateModal.tsx の return 部分を motion 化**

ファイル冒頭の import に追加：

```typescript
import { motion } from 'motion/react'
import { useRecollyMotion } from '../../lib/motion'
```

`export function DiscussionCreateModal(...)` 内、`useState` 群の直後に：

```typescript
const m = useRecollyMotion()
```

return 文の最初の `<div className={styles.overlay} ...>` と `<div className={styles.modal} ...>` を motion.div に変換：

```tsx
return (
  <motion.div
    className={styles.overlay}
    onClick={onClose}
    variants={m.overlay}
    initial="hidden"
    animate="visible"
    exit="exit"
  >
    <motion.div
      className={styles.modal}
      onClick={(e) => e.stopPropagation()}
      variants={m.modal}
    >
      {/* 既存のヘッダー、フィールド、アクション群はそのまま */}
      ...
    </motion.div>
  </motion.div>
)
```

> 内側の既存JSX（header, field, actions 等）は一切変更しない。

- [ ] **Step 2: DiscussionSection.tsx で `<DiscussionCreateModal>` を `<AnimatePresence>` でラップ**

ファイル冒頭の import に追加：

```typescript
import { AnimatePresence } from 'motion/react'
```

L119 周辺の現状：

```tsx
{showCreateModal && (
  <DiscussionCreateModal
    workId={workId}
    totalEpisodes={totalEpisodes}
    onClose={() => {
      ...
    }}
  />
)}
```

これを以下に置き換え：

```tsx
<AnimatePresence>
  {showCreateModal && (
    <DiscussionCreateModal
      workId={workId}
      totalEpisodes={totalEpisodes}
      onClose={() => {
        ...
      }}
    />
  )}
</AnimatePresence>
```

- [ ] **Step 3: テストが通ることを確認**

```bash
cd frontend && npm test -- src/components/DiscussionCreateModal
cd frontend && npm test -- src/components/DiscussionSection
```

Expected: 全パス

- [ ] **Step 4: コミット**

```bash
git add frontend/src/components/DiscussionCreateModal/DiscussionCreateModal.tsx \
        frontend/src/components/DiscussionSection/DiscussionSection.tsx
git commit -m "$(cat <<'EOF'
feat(frontend): DiscussionCreateModal にmotionアニメを追加

オーバーレイと本体に motion variants を適用、
DiscussionSection で AnimatePresence ラップして開閉アニメを実装。

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 20: C-5 — UpdatePrompt を motion 化（App.tsx parent refactor含む）

**Files:**
- Modify: `frontend/src/components/ui/UpdatePrompt/UpdatePrompt.tsx`
- Modify: `frontend/src/App.tsx`

UpdatePrompt も RecordDeleteDialog と同じく、現状は `if (!needRefresh) return null` で内部判定している。`needRefresh` プロップを削除して、親（App.tsx）側で条件分岐 + AnimatePresence ラップする形にリファクタ。

- [ ] **Step 1: UpdatePrompt.tsx をリファクタ + motion化**

現状の `frontend/src/components/ui/UpdatePrompt/UpdatePrompt.tsx`:

```tsx
import styles from './UpdatePrompt.module.css'

type UpdatePromptProps = {
  needRefresh: boolean
  onRefresh: () => void
  onClose: () => void
}

export function UpdatePrompt({ needRefresh, onRefresh, onClose }: UpdatePromptProps) {
  if (!needRefresh) return null

  return (
    <div className={styles.toast}>
      <span className={styles.message}>新しいバージョンがあります</span>
      <button className={styles.refreshButton} onClick={onRefresh}>
        更新する
      </button>
      <button className={styles.closeButton} onClick={onClose} aria-label="閉じる">
        ✕
      </button>
    </div>
  )
}
```

これを以下に置き換え：

```tsx
import { motion } from 'motion/react'
import { useRecollyMotion } from '../../../lib/motion'
import styles from './UpdatePrompt.module.css'

type UpdatePromptProps = {
  onRefresh: () => void
  onClose: () => void
}

export function UpdatePrompt({ onRefresh, onClose }: UpdatePromptProps) {
  const m = useRecollyMotion()

  return (
    <motion.div
      className={styles.toast}
      variants={m.toast}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      <span className={styles.message}>新しいバージョンがあります</span>
      <button className={styles.refreshButton} onClick={onRefresh}>
        更新する
      </button>
      <button className={styles.closeButton} onClick={onClose} aria-label="閉じる">
        ✕
      </button>
    </motion.div>
  )
}
```

> 注: `needRefresh` プロップを削除。

- [ ] **Step 2: App.tsx で UpdatePrompt の呼び出しをリファクタ**

App.tsx の import 群に AnimatePresence を追加：

```typescript
import { AnimatePresence } from 'motion/react'
```

現状 L100-104 周辺：

```tsx
<UpdatePrompt
  needRefresh={needRefresh}
  onRefresh={() => void updateServiceWorker(true)}
  onClose={() => setNeedRefresh(false)}
/>
```

これを以下に置き換え：

```tsx
<AnimatePresence>
  {needRefresh && (
    <UpdatePrompt
      onRefresh={() => void updateServiceWorker(true)}
      onClose={() => setNeedRefresh(false)}
    />
  )}
</AnimatePresence>
```

- [ ] **Step 3: UpdatePrompt のテストが通ることを確認**

```bash
cd frontend && npm test -- src/components/ui/UpdatePrompt
cd frontend && npm test -- src/App
```

UpdatePrompt のテストで `needRefresh` プロップを使っているものがあれば修正する。テストが落ちる場合は、`<UpdatePrompt needRefresh={false} />` のような書き方を `{false && <UpdatePrompt />}` に置き換える。

- [ ] **Step 4: コミット**

```bash
git add frontend/src/components/ui/UpdatePrompt/UpdatePrompt.tsx \
        frontend/src/components/ui/UpdatePrompt/UpdatePrompt.test.tsx \
        frontend/src/App.tsx
git commit -m "$(cat <<'EOF'
feat(frontend): UpdatePrompt をtoastアニメに変更

needRefresh プロップを削除し、親（App.tsx）側で条件付きレンダリング
+ AnimatePresence でラップ。
画面下からスライドインするtoast スタイルを実装。

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 21: C-6 — EmailPromptBanner を motion 化（HomePage parent含む）

**Files:**
- Modify: `frontend/src/components/EmailPromptBanner/EmailPromptBanner.tsx`
- Modify: `frontend/src/pages/HomePage/HomePage.tsx`

EmailPromptBanner は現状ステートレスで、親（HomePage）が `{user?.email_missing && <EmailPromptBanner />}` で条件分岐している。リファクタ不要、motion化と AnimatePresence ラップのみ。

- [ ] **Step 1: EmailPromptBanner.tsx を motion 化**

現状：

```tsx
import { Link } from 'react-router-dom'
import styles from './EmailPromptBanner.module.css'

export function EmailPromptBanner() {
  return (
    <div className={styles.banner}>
      <p className={styles.text}>
        メールアドレスを設定すると、パスワードリセットなどの機能が使えるようになります。
      </p>
      <Link to="/auth/email-setup" className={styles.link}>
        メールアドレスを設定する
      </Link>
    </div>
  )
}
```

これを以下に置き換え：

```tsx
import { motion } from 'motion/react'
import { Link } from 'react-router-dom'
import { useRecollyMotion } from '../../lib/motion'
import styles from './EmailPromptBanner.module.css'

export function EmailPromptBanner() {
  const m = useRecollyMotion()

  return (
    <motion.div
      className={styles.banner}
      variants={m.banner}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      <p className={styles.text}>
        メールアドレスを設定すると、パスワードリセットなどの機能が使えるようになります。
      </p>
      <Link to="/auth/email-setup" className={styles.link}>
        メールアドレスを設定する
      </Link>
    </motion.div>
  )
}
```

- [ ] **Step 2: HomePage.tsx で EmailPromptBanner を AnimatePresence でラップ**

HomePage.tsx の import 群に追加（Task 11 で `motion` 既に追加済み）：

```typescript
import { motion, AnimatePresence } from 'motion/react'
```

return 文の現状（Task 11 で motion 化済み）：

```tsx
return (
  <div className={styles.container}>
    {user?.email_missing && <EmailPromptBanner />}
    ...
```

これを以下に置き換え：

```tsx
return (
  <div className={styles.container}>
    <AnimatePresence>
      {user?.email_missing && <EmailPromptBanner />}
    </AnimatePresence>
    ...
```

- [ ] **Step 3: テストが通ることを確認**

```bash
cd frontend && npm test -- src/components/EmailPromptBanner
cd frontend && npm test -- src/pages/HomePage
```

Expected: 全パス

- [ ] **Step 4: コミット**

```bash
git add frontend/src/components/EmailPromptBanner/EmailPromptBanner.tsx \
        frontend/src/pages/HomePage/HomePage.tsx
git commit -m "$(cat <<'EOF'
feat(frontend): EmailPromptBanner にbanner sliding-inアニメを追加

bannerVariants（height + opacity アニメ）を適用し、
HomePage で AnimatePresence ラップ。
表示時にヘッダー下からスライドダウン、消失時にスライドアップ。

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 22: 全体検証

このタスクは全実装が終わった後の最終確認。新しいコミットは作らない。

- [ ] **Step 1: 全テスト実行**

```bash
cd frontend && npm test
```

Expected: 全テストパス、テストファイル数とパス数を記録

- [ ] **Step 2: lint 実行**

```bash
cd frontend && npm run lint
```

Expected: エラー・警告なし

- [ ] **Step 3: ビルド実行**

```bash
cd frontend && npm run build
```

Expected: ビルド成功、bundle size を記録（motion 追加で +60KB 程度の増加が想定範囲）

- [ ] **Step 4: 開発サーバー起動して手動巡回**

```bash
cd frontend && npm run dev
```

ブラウザで以下を確認：

#### 基本動作確認
- [ ] ログインページ → ダッシュボード遷移後、進行中カードが下から順次フェードイン
- [ ] マイライブラリで記録カードが順次フェードイン、レイアウト切り替え時にも再生される
- [ ] 検索ページで検索結果が順次フェードイン、検索クエリ変更時にも再生される
- [ ] 作品詳細ページで各セクションが上から順次出現
- [ ] おすすめページで作品カードと分析セクションがフェードイン
- [ ] カード・ボタンにホバーすると新しい曲線で軽快に反応する
- [ ] ボタンをクリックすると `scale(0.97)` で押し込まれる感覚がある
- [ ] フォームフィールドにフォーカスすると box-shadow が強調される

#### モーダル/ダイアログ確認
- [ ] 削除確認ダイアログが開く時にフェードイン、閉じる時にフェードアウトする
- [ ] DiscussionCreateModal が同様に開閉アニメする
- [ ] UserMenu のドロップダウンが上からスライドダウン
- [ ] DropdownMenu が同様に動作
- [ ] PWA 更新通知（UpdatePrompt）が画面下からスライドイン
- [ ] EmailPromptBanner（あれば）がヘッダー下からスライドイン

#### reduced-motion 確認
1. **Windows:** 設定 → アクセシビリティ → 視覚効果 → アニメーション効果 をオフ
2. **macOS:** システム環境設定 → アクセシビリティ → ディスプレイ → 視差効果を減らす をオン
3. ブラウザを再読み込み
4. 確認:
   - [ ] カードの登場が即座（フェードのみ、translate なし）
   - [ ] モーダルの開閉が即座
   - [ ] ホバー時のtransform/box-shadow も無効化されている
5. 設定を元に戻す

- [ ] **Step 5: 各コミット履歴の確認**

```bash
git log --oneline feat/frontend-animations -20
```

Expected: ADR + spec + 21 個の実装コミット = 計23コミット程度

- [ ] **Step 6: PR 作成準備**

verification 完了後、`recolly-git-rules` スキルに従って PR を作成する。

---

## Self-Review チェック結果

### Spec カバレッジ
- [x] §1 全体方針 → Task 1〜21 全体で適用
- [x] §2 役割分担 → Task 8〜10（CSS）、Task 11〜21（motion）で実装
- [x] §3 共通モーショントークン → Task 2〜6 で完全実装
- [x] §4 reduced-motion 戦略 → Task 4（フック）+ Task 6（CSS）で実装
- [x] §5 B カテゴリ（5画面）→ Task 11〜15
- [x] §6 C カテゴリ（6コンポーネント）→ Task 16〜21
- [x] §7 D カテゴリ（9ファイル）→ Task 8〜10
- [x] §8 ファイル構成 → Task 2〜5
- [x] §9 テスト方針・実装順序・完了条件 → Task 4（test）+ Task 7（mock）+ Task 22（検証）

### プレースホルダー scan
- ❌ Task 14（RecommendationsPage）と Task 15（WorkDetailPage）は「既存ファイルを Read で確認」と書いてある部分がある。これは spec の自然な制約（motion化対象が抽象的に「セクション群」と書かれているため、ファイル毎に具体構造を確認する必要がある）。実装エージェントが Read tool を使うことを明示して許容する。

### 型一貫性
- `useRecollyMotion` の戻り値プロパティ名（listContainer, fadeInUp, modal, overlay, dropdown, toast, banner）が Task 4・5・11〜21 全てで一貫している。
- `RecordDeleteDialogProps` の `isOpen` 削除は Task 18 で完結（test も同一タスク内で更新）。
- `UpdatePromptProps` の `needRefresh` 削除は Task 20 で完結（同上）。

### 補足
- ホバー反応について、グリッドカード型と行型でパターンを使い分ける判断を Task 9 内で明示した（spec 7.1 への補足）。
- Task 14（RecommendationsPage）と Task 15（WorkDetailPage）は既存ファイル構造に依存するため、エージェントが Read で確認する手順を明示した。
