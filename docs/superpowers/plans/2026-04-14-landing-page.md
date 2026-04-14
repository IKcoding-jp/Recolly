# Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 未ログインで `/` を訪問したユーザーに向けた、多ジャンル横断記録アプリとしての訴求ページを実装する。ログイン済みの動作（`/dashboard` リダイレクト）は維持する。

**Architecture:** `frontend/src/pages/LandingPage/` 配下にセクションごとの React コンポーネントを並べ、`LandingPage.tsx` は薄いラッパーとして全セクション + `useScrollReveal` hook + 既存 `Footer` を合成する。`App.tsx` の `RootRedirect` を `RootRoute` に改名して、未ログイン時にリダイレクトではなく `LandingPage` を描画する。LP はコード分割のため `lazy()` でインポートする。

**Tech Stack:** React 19 / TypeScript / Vite / React Router 7 / Vitest + React Testing Library / CSS Modules / Intersection Observer API

**Spec:** `docs/superpowers/specs/2026-04-14-landing-page-design.md`
**モック参考:** `mockups/landing-page.html`
**Issue:** IKcoding-jp/Recolly#149

---

## 設計判断サマリ

| 判断事項 | 決定 | 理由 |
|---|---|---|
| テスト戦略 | TDD は `useScrollReveal` と `LandingPage` 統合テストと `RootRoute` に限定。各セクション単体テストは書かない | プレゼンテーショナルコンポーネントは統合テストで網羅できる。個別テストは分量爆発で価値が薄い |
| ファイル分割 | セクション 1 つにつき `*.tsx` + `*.module.css` の 2 ファイル | CLAUDE.md の 200 行以内ガイドラインに従う |
| スクロール・リビール | `useScrollReveal` hook（Intersection Observer を hook 内にカプセル化） | 再利用性とテスタビリティ |
| ヒーロー作品カード | `data/heroSamples.ts` で TypeScript 定数として分離 | 将来の差し替え・テストの容易さ |
| RootRedirect の扱い | 名前を `RootRoute` に変更（リダイレクトではなくなるため） | 意図を名前で表す |
| CSS Modules | セクション毎に個別 `.module.css` | 1 ファイルが大きくなるのを防ぐ |
| モバイル対応 | CSS `@media (max-width: 900px)` で各セクションに折り畳みルール | PWA 用途を踏襲 |

---

## File Structure

**新規作成:**

- `frontend/src/pages/LandingPage/LandingPage.tsx` — 全セクションを並べる薄いラッパー
- `frontend/src/pages/LandingPage/LandingPage.module.css` — LP 全体のルート要素スタイル（背景色・layout root flex 構造など）
- `frontend/src/pages/LandingPage/LandingPage.test.tsx` — 統合スモークテスト
- `frontend/src/pages/LandingPage/data/heroSamples.ts` — ヒーロー右側の作品カード 3 枚のサンプルデータ + 型
- `frontend/src/pages/LandingPage/hooks/useScrollReveal.ts` — Intersection Observer の hook
- `frontend/src/pages/LandingPage/hooks/useScrollReveal.test.ts` — hook の単体テスト
- `frontend/src/pages/LandingPage/sections/LandingNav.tsx`
- `frontend/src/pages/LandingPage/sections/LandingNav.module.css`
- `frontend/src/pages/LandingPage/sections/HeroSection.tsx`
- `frontend/src/pages/LandingPage/sections/HeroSection.module.css`
- `frontend/src/pages/LandingPage/sections/ProblemSection.tsx`
- `frontend/src/pages/LandingPage/sections/ProblemSection.module.css`
- `frontend/src/pages/LandingPage/sections/SolutionSection.tsx`
- `frontend/src/pages/LandingPage/sections/SolutionSection.module.css`
- `frontend/src/pages/LandingPage/sections/HowItWorksSection.tsx`
- `frontend/src/pages/LandingPage/sections/HowItWorksSection.module.css`
- `frontend/src/pages/LandingPage/sections/ReflectSection.tsx`
- `frontend/src/pages/LandingPage/sections/ReflectSection.module.css`
- `frontend/src/pages/LandingPage/sections/CreatorNoteSection.tsx`
- `frontend/src/pages/LandingPage/sections/CreatorNoteSection.module.css`
- `frontend/src/pages/LandingPage/sections/PromiseSection.tsx`
- `frontend/src/pages/LandingPage/sections/PromiseSection.module.css`
- `frontend/src/pages/LandingPage/sections/FaqSection.tsx`
- `frontend/src/pages/LandingPage/sections/FaqSection.module.css`
- `frontend/src/pages/LandingPage/sections/FinalCtaSection.tsx`
- `frontend/src/pages/LandingPage/sections/FinalCtaSection.module.css`
- `frontend/src/pages/LandingPage/sections/sectionShared.module.css` — `.section__label`, `.reveal` 共通クラス

**修正:**

- `frontend/src/App.tsx` — `RootRedirect` → `RootRoute` 改名 + `LandingPage` lazy import
- `frontend/src/styles/tokens.css` — `--color-bg-paper`, `--color-text-soft`, `--color-accent` を追加

---

## Task 1: デザイントークン追加

**Files:**
- Modify: `frontend/src/styles/tokens.css`

- [ ] **Step 1: tokens.css に LP 用トークンを追加**

`frontend/src/styles/tokens.css` の `:root` 内の `--color-border-light: #e0e0e0;` の次の行に以下を追加:

```css
  /* --- ランディングページ用 --- */
  --color-bg-paper: #f4f0e6;
  --color-text-soft: #9a9a9a;
  --color-accent: #c85a3f;
```

- [ ] **Step 2: 型チェックとビルドが壊れていないことを確認**

```bash
cd frontend && npm run typecheck
```

Expected: エラーなし。

- [ ] **Step 3: コミット**

```bash
git add frontend/src/styles/tokens.css
git commit -m "feat(landing-page): tokens.css に LP 用カラートークンを追加"
```

---

## Task 2: `useScrollReveal` hook — TDD

**Files:**
- Create: `frontend/src/pages/LandingPage/hooks/useScrollReveal.test.ts`
- Create: `frontend/src/pages/LandingPage/hooks/useScrollReveal.ts`

- [ ] **Step 1: テストファイルを作成**

`frontend/src/pages/LandingPage/hooks/useScrollReveal.test.ts`:

```ts
import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useScrollReveal } from './useScrollReveal'

describe('useScrollReveal', () => {
  // IntersectionObserver のグローバルモック
  let observeFn: ReturnType<typeof vi.fn>
  let disconnectFn: ReturnType<typeof vi.fn>
  let unobserveFn: ReturnType<typeof vi.fn>
  let lastCallback: IntersectionObserverCallback | null = null

  beforeEach(() => {
    observeFn = vi.fn()
    disconnectFn = vi.fn()
    unobserveFn = vi.fn()
    lastCallback = null

    vi.stubGlobal(
      'IntersectionObserver',
      vi.fn(function (
        this: IntersectionObserver,
        cb: IntersectionObserverCallback,
      ) {
        lastCallback = cb
        this.observe = observeFn
        this.disconnect = disconnectFn
        this.unobserve = unobserveFn
        this.takeRecords = vi.fn()
        this.root = null
        this.rootMargin = ''
        this.thresholds = []
        return this
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('マウント後に .reveal 要素を監視する', () => {
    const el1 = document.createElement('div')
    el1.classList.add('reveal')
    const el2 = document.createElement('div')
    el2.classList.add('reveal')
    document.body.append(el1, el2)

    renderHook(() => useScrollReveal())

    expect(observeFn).toHaveBeenCalledWith(el1)
    expect(observeFn).toHaveBeenCalledWith(el2)

    el1.remove()
    el2.remove()
  })

  it('要素が画面内に入ると in クラスを付与して監視を解除する', () => {
    const el = document.createElement('div')
    el.classList.add('reveal')
    document.body.append(el)

    renderHook(() => useScrollReveal())

    // コールバックを手動発火
    if (!lastCallback) throw new Error('callback not captured')
    lastCallback(
      [
        {
          target: el,
          isIntersecting: true,
          intersectionRatio: 1,
          time: 0,
          boundingClientRect: el.getBoundingClientRect(),
          intersectionRect: el.getBoundingClientRect(),
          rootBounds: null,
        } as IntersectionObserverEntry,
      ],
      {} as IntersectionObserver,
    )

    expect(el.classList.contains('in')).toBe(true)
    expect(unobserveFn).toHaveBeenCalledWith(el)

    el.remove()
  })

  it('要素が画面内に入らない場合は in クラスを付与しない', () => {
    const el = document.createElement('div')
    el.classList.add('reveal')
    document.body.append(el)

    renderHook(() => useScrollReveal())

    if (!lastCallback) throw new Error('callback not captured')
    lastCallback(
      [
        {
          target: el,
          isIntersecting: false,
          intersectionRatio: 0,
          time: 0,
          boundingClientRect: el.getBoundingClientRect(),
          intersectionRect: el.getBoundingClientRect(),
          rootBounds: null,
        } as IntersectionObserverEntry,
      ],
      {} as IntersectionObserver,
    )

    expect(el.classList.contains('in')).toBe(false)
    expect(unobserveFn).not.toHaveBeenCalled()

    el.remove()
  })

  it('アンマウント時に observer を disconnect する', () => {
    const el = document.createElement('div')
    el.classList.add('reveal')
    document.body.append(el)

    const { unmount } = renderHook(() => useScrollReveal())
    unmount()

    expect(disconnectFn).toHaveBeenCalled()

    el.remove()
  })
})
```

- [ ] **Step 2: テストを実行して失敗を確認**

```bash
cd frontend && npm run test -- src/pages/LandingPage/hooks/useScrollReveal.test.ts
```

Expected: `Cannot find module './useScrollReveal'` のエラー。

- [ ] **Step 3: hook 本体を実装**

`frontend/src/pages/LandingPage/hooks/useScrollReveal.ts`:

```ts
import { useEffect } from 'react'

/**
 * `.reveal` クラスを持つ要素を Intersection Observer で監視し、
 * 画面内に入った瞬間に `.in` クラスを付与して監視を解除する。
 *
 * LandingPage のスクロール・リビール用。各セクションのフェードイン演出に使う。
 * `prefers-reduced-motion: reduce` の環境では初期状態で全ての要素に `.in` を付与する
 * （アニメーション無しで即座に表示）。
 */
export function useScrollReveal(): void {
  useEffect(() => {
    const targets = document.querySelectorAll<HTMLElement>('.reveal')

    // prefers-reduced-motion 対応: アニメーション無しで即座表示
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion) {
      targets.forEach((el) => el.classList.add('in'))
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.12, rootMargin: '0px 0px -10% 0px' },
    )

    targets.forEach((el) => observer.observe(el))

    return () => {
      observer.disconnect()
    }
  }, [])
}
```

- [ ] **Step 4: テストを実行して PASS を確認**

```bash
cd frontend && npm run test -- src/pages/LandingPage/hooks/useScrollReveal.test.ts
```

Expected: 全 4 テスト PASS。

- [ ] **Step 5: 型チェック + lint**

```bash
cd frontend && npm run typecheck && npm run lint -- src/pages/LandingPage/
```

Expected: エラーなし。

- [ ] **Step 6: コミット**

```bash
git add frontend/src/pages/LandingPage/hooks/
git commit -m "feat(landing-page): useScrollReveal hook を追加

Intersection Observer を使ってスクロール・リビール演出を実現する hook。
prefers-reduced-motion 対応で、モーション抑制環境では即座表示する。"
```

---

## Task 3: ヒーロー作品カードのサンプルデータ

**Files:**
- Create: `frontend/src/pages/LandingPage/data/heroSamples.ts`

- [ ] **Step 1: 型とデータを作成**

`frontend/src/pages/LandingPage/data/heroSamples.ts`:

```ts
/**
 * ヒーロー右側に浮遊表示する作品カードのサンプルデータ。
 * 実 API からは取得せず、装飾として静的に描画する。
 *
 * NOTE: 作品名は外部作品の商標である可能性があるため、公開前に
 * 架空作品名に差し替えるか、ジャンル表示のみにするかを再判断すること。
 * Spec: docs/superpowers/specs/2026-04-14-landing-page-design.md §4.6
 */

export type HeroCardMediaType = 'anime' | 'movie' | 'drama' | 'book' | 'manga' | 'game'

export type HeroCardSample = {
  mediaType: HeroCardMediaType
  mediaLabel: string
  title: string
  serial: string
  rating: number
  progressPercent: number
}

export const HERO_CARD_SAMPLES: readonly HeroCardSample[] = [
  {
    mediaType: 'anime',
    mediaLabel: 'アニメ',
    title: '葬送のフリーレン',
    serial: '#023',
    rating: 9.2,
    progressPercent: 74,
  },
  {
    mediaType: 'book',
    mediaLabel: '本',
    title: 'コンビニ人間',
    serial: '#058',
    rating: 8.6,
    progressPercent: 100,
  },
  {
    mediaType: 'game',
    mediaLabel: 'ゲーム',
    title: 'Outer Wilds',
    serial: '#091',
    rating: 9.8,
    progressPercent: 55,
  },
] as const
```

- [ ] **Step 2: 型チェック**

```bash
cd frontend && npm run typecheck
```

Expected: エラーなし。

- [ ] **Step 3: コミット**

```bash
git add frontend/src/pages/LandingPage/data/
git commit -m "feat(landing-page): ヒーロー作品カードのサンプルデータを追加"
```

---

## Task 4: `reveal` 用グローバル CSS

**背景:** `useScrollReveal` hook は `document.querySelectorAll('.reveal')` で DOM を直接検索し、`in` クラスを付与する方式。CSS Modules はクラス名をハッシュ化するため、セクション側の `className={styles.reveal}` にしてしまうと hook から拾えない。したがって `reveal` クラスの定義は**グローバル CSS** として置き、各セクションでは `className="reveal"` を**文字列リテラル**で指定する。

**Files:**
- Create: `frontend/src/pages/LandingPage/landingGlobal.css`

- [ ] **Step 1: グローバル CSS ファイルを作成**

`frontend/src/pages/LandingPage/landingGlobal.css`:

```css
/* ランディングページのグローバルスタイル（CSS Modules ではなく、プレーン CSS） */
/* reveal クラスは useScrollReveal hook が DOM で直接拾うため、ハッシュ化を避ける */

.landing-page .reveal {
  opacity: 0;
  transform: translateY(32px);
  transition:
    opacity 1s cubic-bezier(0.16, 1, 0.3, 1),
    transform 1s cubic-bezier(0.16, 1, 0.3, 1);
}

.landing-page .reveal.in {
  opacity: 1;
  transform: none;
}

@media (prefers-reduced-motion: reduce) {
  .landing-page .reveal {
    opacity: 1;
    transform: none;
    transition: none;
  }
}
```

- [ ] **Step 2: 型チェックとビルドが壊れていないこと**

```bash
cd frontend && npm run typecheck
```

Expected: エラーなし。

- [ ] **Step 3: コミット**

```bash
git add frontend/src/pages/LandingPage/landingGlobal.css
git commit -m "feat(landing-page): reveal 用グローバル CSS を追加

CSS Modules のハッシュ化を避けて、useScrollReveal hook が
document.querySelectorAll('.reveal') で拾えるようにする。"
```

---

## Task 5: LandingNav セクション

**Files:**
- Create: `frontend/src/pages/LandingPage/sections/LandingNav.tsx`
- Create: `frontend/src/pages/LandingPage/sections/LandingNav.module.css`

- [ ] **Step 1: CSS Module を作成**

`frontend/src/pages/LandingPage/sections/LandingNav.module.css`:

```css
.nav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  padding: 20px 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(250, 250, 248, 0.9);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid transparent;
  transition: border-color 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.navScrolled {
  border-bottom-color: var(--color-border-light);
}

.brand {
  font-family: var(--font-body);
  font-size: 20px;
  font-weight: var(--font-weight-bold);
  letter-spacing: 0.02em;
  color: var(--color-text);
  text-decoration: none;
}

.actions {
  display: flex;
  gap: 24px;
  align-items: center;
  font-size: 14px;
}

.link {
  color: var(--color-text);
  text-decoration: none;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.link:hover {
  opacity: 1;
}

.cta {
  color: var(--color-bg);
  background: var(--color-text);
  padding: 10px 20px;
  border-radius: 2px;
  text-decoration: none;
  font-size: 13px;
  letter-spacing: 0.05em;
  transition: background 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.cta:hover {
  background: var(--color-accent);
}

@media (max-width: 900px) {
  .nav {
    padding: 16px 24px;
  }
  /* モバイルでは中間リンクを非表示にし、ログイン/CTA のみ残す */
  .link.hideMobile {
    display: none;
  }
  .actions {
    gap: 12px;
  }
}
```

- [ ] **Step 2: コンポーネントを実装**

`frontend/src/pages/LandingPage/sections/LandingNav.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import styles from './LandingNav.module.css'

/**
 * ランディングページ専用の固定ナビゲーション。
 * スクロール量が 20px を超えると下部に罫線が表れる。
 */
export function LandingNav() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <nav className={`${styles.nav} ${scrolled ? styles.navScrolled : ''}`}>
      <Link to="/" className={styles.brand}>
        Recolly
      </Link>
      <div className={styles.actions}>
        <a className={`${styles.link} ${styles.hideMobile}`} href="#solution">
          特徴
        </a>
        <a className={`${styles.link} ${styles.hideMobile}`} href="#how">
          使い方
        </a>
        <a className={`${styles.link} ${styles.hideMobile}`} href="#faq">
          FAQ
        </a>
        <Link className={styles.link} to="/login">
          ログイン
        </Link>
        <Link className={styles.cta} to="/signup">
          無料で始める
        </Link>
      </div>
    </nav>
  )
}
```

- [ ] **Step 3: 型チェック + lint**

```bash
cd frontend && npm run typecheck && npm run lint -- src/pages/LandingPage/sections/LandingNav.tsx
```

Expected: エラーなし。

- [ ] **Step 4: コミット**

```bash
git add frontend/src/pages/LandingPage/sections/LandingNav.tsx frontend/src/pages/LandingPage/sections/LandingNav.module.css
git commit -m "feat(landing-page): LandingNav セクションを追加"
```

---

## Task 6: HeroSection

**Files:**
- Create: `frontend/src/pages/LandingPage/sections/HeroSection.tsx`
- Create: `frontend/src/pages/LandingPage/sections/HeroSection.module.css`

- [ ] **Step 1: CSS Module を作成**

`frontend/src/pages/LandingPage/sections/HeroSection.module.css`:

```css
.hero {
  min-height: 100vh;
  display: flex;
  align-items: center;
  padding: 160px 48px 80px;
  position: relative;
  overflow: hidden;
  background: var(--color-bg);
}

.grid {
  display: grid;
  grid-template-columns: 1.15fr 1fr;
  gap: 80px;
  align-items: center;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
}

.eyebrow {
  font-size: 12px;
  font-weight: var(--font-weight-medium);
  color: var(--color-text-muted);
  margin-bottom: 28px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.eyebrow::before {
  content: '';
  width: 32px;
  height: 1px;
  background: var(--color-text-muted);
}

.title {
  font-family: var(--font-body);
  font-size: clamp(32px, 3.8vw, 54px);
  font-weight: var(--font-weight-bold);
  line-height: 1.4;
  letter-spacing: -0.01em;
  margin-bottom: 32px;
  color: var(--color-text);
}

.subtitle {
  font-size: 17px;
  line-height: 1.9;
  color: var(--color-text-muted);
  max-width: 520px;
  margin-bottom: 40px;
}

.ctaRow {
  display: flex;
  gap: 24px;
  align-items: center;
  flex-wrap: wrap;
}

.btnPrimary {
  background: var(--color-text);
  color: var(--color-bg);
  padding: 18px 36px;
  border: none;
  font-family: var(--font-body);
  font-size: 15px;
  font-weight: var(--font-weight-medium);
  letter-spacing: 0.05em;
  cursor: pointer;
  text-decoration: none;
  display: inline-block;
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.btnPrimary::after {
  content: '→';
  margin-left: 12px;
  display: inline-block;
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.btnPrimary:hover {
  transform: translateY(-2px);
}

.btnPrimary:hover::after {
  transform: translateX(4px);
}

.note {
  font-size: 13px;
  color: var(--color-text-soft);
}

/* 右カラム: 作品カード・スタック */
.deck {
  position: relative;
  height: 520px;
}

.card {
  position: absolute;
  background: var(--color-bg-white);
  border: 1px solid var(--color-border-light);
  padding: 24px 28px;
  box-shadow: 0 30px 60px -30px rgba(0, 0, 0, 0.15);
  width: 280px;
  border-radius: 4px;
}

.cardTitle {
  font-family: var(--font-body);
  font-size: 17px;
  font-weight: var(--font-weight-bold);
  margin-bottom: 4px;
  color: var(--color-text);
}

.cardMeta {
  font-size: 11px;
  font-weight: var(--font-weight-medium);
  margin-bottom: 16px;
  display: flex;
  justify-content: space-between;
  color: var(--color-text-muted);
}

.cardMediaLabel {
  display: flex;
  align-items: center;
  gap: 6px;
}

.cardGenreDot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.cardBar {
  height: 2px;
  background: var(--color-border-light);
  margin: 12px 0;
  position: relative;
  overflow: hidden;
}

.cardBarFill {
  position: absolute;
  inset: 0;
  background: var(--color-text);
}

.cardRating {
  font-family: var(--font-heading);
  font-size: 28px;
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
}

.cardRatingMax {
  font-size: 13px;
  color: var(--color-text-muted);
  font-weight: var(--font-weight-normal);
  font-family: var(--font-body);
}

.card1 {
  top: 0;
  left: 40px;
  transform: rotate(-3deg);
  animation: float1 6s ease-in-out infinite;
}

.card2 {
  top: 120px;
  right: 0;
  transform: rotate(2deg);
  animation: float2 7s ease-in-out infinite;
}

.card3 {
  bottom: 20px;
  left: 0;
  transform: rotate(1deg);
  animation: float3 8s ease-in-out infinite;
}

@keyframes float1 {
  0%, 100% { transform: rotate(-3deg) translateY(0); }
  50% { transform: rotate(-3deg) translateY(-8px); }
}

@keyframes float2 {
  0%, 100% { transform: rotate(2deg) translateY(0); }
  50% { transform: rotate(2deg) translateY(-10px); }
}

@keyframes float3 {
  0%, 100% { transform: rotate(1deg) translateY(0); }
  50% { transform: rotate(1deg) translateY(-6px); }
}

@media (prefers-reduced-motion: reduce) {
  .card1, .card2, .card3 {
    animation: none;
  }
}

.genres {
  position: absolute;
  bottom: 60px;
  left: 48px;
  display: flex;
  gap: 24px;
  font-size: 11px;
  font-weight: var(--font-weight-medium);
  color: var(--color-text-muted);
}

.genreItem {
  display: flex;
  align-items: center;
  gap: 8px;
}

.genreItem::before {
  content: '';
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.genreAnime::before { background: var(--color-anime); }
.genreMovie::before { background: var(--color-movie); }
.genreDrama::before { background: var(--color-drama); }
.genreBook::before { background: var(--color-book); }
.genreManga::before { background: var(--color-manga); }
.genreGame::before { background: var(--color-game); }

@media (max-width: 900px) {
  .hero {
    padding: 120px 24px 80px;
  }
  .grid {
    grid-template-columns: 1fr;
    gap: 64px;
  }
  .deck {
    height: 400px;
  }
  .genres {
    position: static;
    margin-top: 48px;
    flex-wrap: wrap;
  }
}
```

- [ ] **Step 2: コンポーネントを実装**

`frontend/src/pages/LandingPage/sections/HeroSection.tsx`:

```tsx
import { Link } from 'react-router-dom'
import { HERO_CARD_SAMPLES, type HeroCardMediaType } from '../data/heroSamples'
import styles from './HeroSection.module.css'

const MEDIA_COLOR_VAR: Record<HeroCardMediaType, string> = {
  anime: 'var(--color-anime)',
  movie: 'var(--color-movie)',
  drama: 'var(--color-drama)',
  book: 'var(--color-book)',
  manga: 'var(--color-manga)',
  game: 'var(--color-game)',
}

const CARD_POSITION_CLASSES = [styles.card1, styles.card2, styles.card3] as const

/**
 * ランディングページのヒーロー。
 * 左側に主訴求と CTA、右側に浮遊する作品カード 3 枚を配置する。
 */
export function HeroSection() {
  return (
    <section className={styles.hero}>
      <div className={styles.grid}>
        <div>
          <div className={`${styles.eyebrow} reveal`}>
            ジャンルをまたぐ、あなたの記録のための場所
          </div>
          <h1 className={`${styles.title} reveal`}>
            観たもの、読んだもの、
            <br />
            プレイしたもの。
            <br />
            全部ひとつの棚に。
          </h1>
          <p className={`${styles.subtitle} reveal`}>
            アニメ、映画、ドラマ、本、漫画、ゲーム。ジャンルをまたいで作品を記録・振り返りできるアプリです。
          </p>
          <div className={`${styles.ctaRow} reveal`}>
            <Link className={styles.btnPrimary} to="/signup">
              無料で始める
            </Link>
            <span className={styles.note}>永久無料・カード不要</span>
          </div>
        </div>

        <div className={`${styles.deck} reveal`} aria-hidden="true">
          {HERO_CARD_SAMPLES.map((sample, i) => (
            <div key={sample.title} className={`${styles.card} ${CARD_POSITION_CLASSES[i]}`}>
              <div className={styles.cardMeta}>
                <span className={styles.cardMediaLabel}>
                  <span
                    className={styles.cardGenreDot}
                    style={{ background: MEDIA_COLOR_VAR[sample.mediaType] }}
                  />
                  {sample.mediaLabel}
                </span>
                <span>{sample.serial}</span>
              </div>
              <h4 className={styles.cardTitle}>{sample.title}</h4>
              <div className={styles.cardBar}>
                <span
                  className={styles.cardBarFill}
                  style={{ width: `${sample.progressPercent}%` }}
                />
              </div>
              <div className={styles.cardRating}>
                {sample.rating.toFixed(1)}
                <span className={styles.cardRatingMax}> / 10</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={`${styles.genres} reveal`} aria-hidden="true">
        <span className={`${styles.genreItem} ${styles.genreAnime}`}>アニメ</span>
        <span className={`${styles.genreItem} ${styles.genreMovie}`}>映画</span>
        <span className={`${styles.genreItem} ${styles.genreDrama}`}>ドラマ</span>
        <span className={`${styles.genreItem} ${styles.genreBook}`}>本</span>
        <span className={`${styles.genreItem} ${styles.genreManga}`}>漫画</span>
        <span className={`${styles.genreItem} ${styles.genreGame}`}>ゲーム</span>
      </div>
    </section>
  )
}
```

- [ ] **Step 3: 型チェック + lint**

```bash
cd frontend && npm run typecheck && npm run lint -- src/pages/LandingPage/sections/HeroSection.tsx
```

Expected: エラーなし。

- [ ] **Step 4: コミット**

```bash
git add frontend/src/pages/LandingPage/sections/HeroSection.tsx frontend/src/pages/LandingPage/sections/HeroSection.module.css
git commit -m "feat(landing-page): HeroSection を追加"
```

---

## Task 7: ProblemSection

**Files:**
- Create: `frontend/src/pages/LandingPage/sections/ProblemSection.tsx`
- Create: `frontend/src/pages/LandingPage/sections/ProblemSection.module.css`

- [ ] **Step 1: CSS Module を作成**

`frontend/src/pages/LandingPage/sections/ProblemSection.module.css`:

```css
.problem {
  background: var(--color-bg-paper);
  border-top: 1px solid var(--color-border-light);
  border-bottom: 1px solid var(--color-border-light);
  padding: 120px 48px;
  position: relative;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
}

.label {
  font-size: 12px;
  font-weight: var(--font-weight-medium);
  color: var(--color-text-muted);
  margin-bottom: 32px;
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.labelNum {
  font-family: var(--font-heading);
  font-size: 14px;
  color: var(--color-text);
  font-weight: var(--font-weight-medium);
}

.grid {
  display: grid;
  grid-template-columns: 1fr 1.3fr;
  gap: 80px;
  align-items: start;
}

.heading {
  font-family: var(--font-body);
  font-size: clamp(28px, 3.4vw, 48px);
  font-weight: var(--font-weight-bold);
  line-height: 1.5;
  letter-spacing: -0.01em;
  color: var(--color-text);
}

.body {
  font-size: 16px;
  line-height: 2;
  color: var(--color-text);
}

.body p + p {
  margin-top: 20px;
}

@media (max-width: 900px) {
  .problem {
    padding: 80px 24px;
  }
  .grid {
    grid-template-columns: 1fr;
    gap: 40px;
  }
}
```

- [ ] **Step 2: コンポーネントを実装**

`frontend/src/pages/LandingPage/sections/ProblemSection.tsx`:

```tsx
import styles from './ProblemSection.module.css'

export function ProblemSection() {
  return (
    <section className={styles.problem} id="problem">
      <div className={styles.container}>
        <div className={`${styles.label} reveal`}>
          <span className={styles.labelNum}>01</span>散らばる履歴
        </div>
        <div className={styles.grid}>
          <h2 className={`${styles.heading} reveal`}>
            観たドラマも、
            <br />
            読んだ本も、
            <br />
            プレイしたゲームも、
            <br />
            全部、別の場所。
          </h2>
          <div className={`${styles.body} reveal`}>
            <p>
              Netflix に視聴履歴、Kindle に読書履歴、Steam にプレイ時間。一つ一つは便利なのに、ジャンルをまたいで「自分が何を味わってきたか」を一箇所で振り返れる場所はありません。
            </p>
            <p>好きだった作品に、メディアをまたいで戻れる場所を。</p>
          </div>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 3: 型チェック + lint + コミット**

```bash
cd frontend && npm run typecheck && npm run lint -- src/pages/LandingPage/sections/ProblemSection.tsx
git add frontend/src/pages/LandingPage/sections/ProblemSection.tsx frontend/src/pages/LandingPage/sections/ProblemSection.module.css
git commit -m "feat(landing-page): ProblemSection を追加"
```

---

## Task 8: SolutionSection

**Files:**
- Create: `frontend/src/pages/LandingPage/sections/SolutionSection.tsx`
- Create: `frontend/src/pages/LandingPage/sections/SolutionSection.module.css`

- [ ] **Step 1: CSS Module を作成**

`frontend/src/pages/LandingPage/sections/SolutionSection.module.css`:

```css
.solution {
  padding: 120px 48px;
  background: var(--color-bg);
}

.container {
  max-width: 1200px;
  margin: 0 auto;
}

.label {
  font-size: 12px;
  font-weight: var(--font-weight-medium);
  color: var(--color-text-muted);
  margin-bottom: 32px;
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.labelNum {
  font-family: var(--font-heading);
  font-size: 14px;
  color: var(--color-text);
  font-weight: var(--font-weight-medium);
}

.heading {
  font-family: var(--font-body);
  font-size: clamp(30px, 3.8vw, 52px);
  font-weight: var(--font-weight-bold);
  line-height: 1.4;
  margin-bottom: 72px;
  max-width: 760px;
  letter-spacing: -0.01em;
  color: var(--color-text);
}

.grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1px;
  background: var(--color-border-light);
  border: 1px solid var(--color-border-light);
}

.feature {
  background: var(--color-bg);
  padding: 48px 44px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.featureNum {
  font-family: var(--font-heading);
  font-size: 13px;
  font-weight: var(--font-weight-medium);
  color: var(--color-text-muted);
}

.featureTitle {
  font-family: var(--font-body);
  font-size: 22px;
  font-weight: var(--font-weight-bold);
  line-height: 1.5;
  color: var(--color-text);
}

.featureBody {
  font-size: 15px;
  color: var(--color-text-muted);
  line-height: 1.9;
}

@media (max-width: 900px) {
  .solution {
    padding: 80px 24px;
  }
  .grid {
    grid-template-columns: 1fr;
  }
  .feature {
    padding: 40px 32px;
  }
}
```

- [ ] **Step 2: コンポーネントを実装**

`frontend/src/pages/LandingPage/sections/SolutionSection.tsx`:

```tsx
import styles from './SolutionSection.module.css'

type Feature = {
  num: string
  title: string
  body: string
}

const FEATURES: Feature[] = [
  {
    num: '01',
    title: '6 ジャンルをまとめて記録',
    body:
      'アニメ、映画、ドラマ、本、漫画、ゲーム。すべての作品を同じ使い心地で、一箇所に記録できます。',
  },
  {
    num: '02',
    title: '評価は 10 点満点で統一',
    body:
      'サービスごとに評価基準が違う問題をなくします。全作品を同じ尺度で並べられるので、過去の蓄積がそのまま比較可能な資産になります。',
  },
  {
    num: '03',
    title: 'いつでも振り返れるライブラリ',
    body:
      '「去年観たドラマってなんだっけ」にすぐ答えられます。タグや検索で、過去の記録に戻れます。',
  },
  {
    num: '04',
    title: 'シンプルで静かな UI',
    body: '派手な通知もランキング競争もありません。自分のペースで、落ち着いて使える場所です。',
  },
]

export function SolutionSection() {
  return (
    <section className={styles.solution} id="solution">
      <div className={styles.container}>
        <div className={`${styles.label} reveal`}>
          <span className={styles.labelNum}>02</span>できること
        </div>
        <h2 className={`${styles.heading} reveal`}>
          ジャンルの壁を越えて、作品を記録する。
        </h2>
        <div className={styles.grid}>
          {FEATURES.map((f) => (
            <div key={f.num} className={`${styles.feature} reveal`}>
              <div className={styles.featureNum}>{f.num}</div>
              <h3 className={styles.featureTitle}>{f.title}</h3>
              <p className={styles.featureBody}>{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 3: 型チェック + lint + コミット**

```bash
cd frontend && npm run typecheck && npm run lint -- src/pages/LandingPage/sections/SolutionSection.tsx
git add frontend/src/pages/LandingPage/sections/SolutionSection.tsx frontend/src/pages/LandingPage/sections/SolutionSection.module.css
git commit -m "feat(landing-page): SolutionSection を追加"
```

---

## Task 9: HowItWorksSection

**Files:**
- Create: `frontend/src/pages/LandingPage/sections/HowItWorksSection.tsx`
- Create: `frontend/src/pages/LandingPage/sections/HowItWorksSection.module.css`

- [ ] **Step 1: CSS Module を作成**

`frontend/src/pages/LandingPage/sections/HowItWorksSection.module.css`:

```css
.how {
  background: var(--color-bg-paper);
  border-top: 1px solid var(--color-border-light);
  border-bottom: 1px solid var(--color-border-light);
  padding: 120px 48px;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
}

.label {
  font-size: 12px;
  font-weight: var(--font-weight-medium);
  color: var(--color-text-muted);
  margin-bottom: 32px;
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.labelNum {
  font-family: var(--font-heading);
  font-size: 14px;
  color: var(--color-text);
  font-weight: var(--font-weight-medium);
}

.heading {
  font-family: var(--font-body);
  font-size: clamp(30px, 3.8vw, 52px);
  font-weight: var(--font-weight-bold);
  margin-bottom: 72px;
  letter-spacing: -0.01em;
  color: var(--color-text);
}

.steps {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 56px;
}

.step {
  position: relative;
}

.stepNum {
  font-family: var(--font-heading);
  font-size: 56px;
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
  line-height: 1;
  margin-bottom: 24px;
}

.stepTitle {
  font-family: var(--font-body);
  font-size: 22px;
  font-weight: var(--font-weight-bold);
  margin-bottom: 12px;
  padding-top: 16px;
  border-top: 1px solid var(--color-border);
  color: var(--color-text);
}

.stepBody {
  font-size: 15px;
  line-height: 1.9;
  color: var(--color-text-muted);
}

@media (max-width: 900px) {
  .how {
    padding: 80px 24px;
  }
  .steps {
    grid-template-columns: 1fr;
    gap: 48px;
  }
}
```

- [ ] **Step 2: コンポーネントを実装**

`frontend/src/pages/LandingPage/sections/HowItWorksSection.tsx`:

```tsx
import styles from './HowItWorksSection.module.css'

const STEPS = [
  {
    num: '1.',
    title: '探す',
    body:
      '作品のタイトルで検索して、自分の棚に加えます。アニメも本もゲームも、入り口は一つ。',
  },
  {
    num: '2.',
    title: '記録する',
    body:
      '観終わったら、読み終わったら、クリアしたら、評価とメモを残します。一言だけでも十分です。',
  },
  {
    num: '3.',
    title: '振り返る',
    body:
      'ライブラリや検索で、過去の作品にいつでも戻れます。ジャンルをまたいで、好きだったものを見返せます。',
  },
]

export function HowItWorksSection() {
  return (
    <section className={styles.how} id="how">
      <div className={styles.container}>
        <div className={`${styles.label} reveal`}>
          <span className={styles.labelNum}>03</span>使い方
        </div>
        <h2 className={`${styles.heading} reveal`}>三ステップで、ライブラリが育つ。</h2>
        <div className={styles.steps}>
          {STEPS.map((s) => (
            <div key={s.num} className={`${styles.step} reveal`}>
              <div className={styles.stepNum}>{s.num}</div>
              <h3 className={styles.stepTitle}>{s.title}</h3>
              <p className={styles.stepBody}>{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 3: 型チェック + lint + コミット**

```bash
cd frontend && npm run typecheck && npm run lint -- src/pages/LandingPage/sections/HowItWorksSection.tsx
git add frontend/src/pages/LandingPage/sections/HowItWorksSection.tsx frontend/src/pages/LandingPage/sections/HowItWorksSection.module.css
git commit -m "feat(landing-page): HowItWorksSection を追加"
```

---

## Task 10: ReflectSection

**Files:**
- Create: `frontend/src/pages/LandingPage/sections/ReflectSection.tsx`
- Create: `frontend/src/pages/LandingPage/sections/ReflectSection.module.css`

- [ ] **Step 1: CSS Module を作成**

`frontend/src/pages/LandingPage/sections/ReflectSection.module.css`:

```css
.reflect {
  padding: 120px 48px;
  background: var(--color-bg);
}

.container {
  max-width: 1200px;
  margin: 0 auto;
}

.label {
  font-size: 12px;
  font-weight: var(--font-weight-medium);
  color: var(--color-text-muted);
  margin-bottom: 32px;
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.labelNum {
  font-family: var(--font-heading);
  font-size: 14px;
  color: var(--color-text);
  font-weight: var(--font-weight-medium);
}

.grid {
  display: grid;
  grid-template-columns: 1fr 1.2fr;
  gap: 80px;
  align-items: start;
}

.heading {
  font-family: var(--font-body);
  font-size: clamp(28px, 3.4vw, 48px);
  font-weight: var(--font-weight-bold);
  line-height: 1.5;
  letter-spacing: -0.01em;
  color: var(--color-text);
}

.body {
  font-size: 16px;
  line-height: 2;
  color: var(--color-text);
}

.body p + p {
  margin-top: 20px;
}

@media (max-width: 900px) {
  .reflect {
    padding: 80px 24px;
  }
  .grid {
    grid-template-columns: 1fr;
    gap: 40px;
  }
}
```

- [ ] **Step 2: コンポーネントを実装**

`frontend/src/pages/LandingPage/sections/ReflectSection.tsx`:

```tsx
import styles from './ReflectSection.module.css'

export function ReflectSection() {
  return (
    <section className={styles.reflect}>
      <div className={styles.container}>
        <div className={`${styles.label} reveal`}>
          <span className={styles.labelNum}>04</span>数か月後、数年後に
        </div>
        <div className={styles.grid}>
          <h2 className={`${styles.heading} reveal`}>
            続けていると、
            <br />
            自分の好みが
            <br />
            見えてくる。
          </h2>
          <div className={`${styles.body} reveal`}>
            <p>
              記録を続けていると、ジャンルをまたいだ自分の好みが見えてきます。「去年一番よかったのは何だっけ」「最近こういうの観てるな」——過去の蓄積が、これからの作品選びのヒントになります。
            </p>
            <p>
              Recolly は、記録そのものよりも、振り返れるようになった後に価値が出るツールです。
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 3: 型チェック + lint + コミット**

```bash
cd frontend && npm run typecheck && npm run lint -- src/pages/LandingPage/sections/ReflectSection.tsx
git add frontend/src/pages/LandingPage/sections/ReflectSection.tsx frontend/src/pages/LandingPage/sections/ReflectSection.module.css
git commit -m "feat(landing-page): ReflectSection を追加"
```

---

## Task 11: CreatorNoteSection

**Files:**
- Create: `frontend/src/pages/LandingPage/sections/CreatorNoteSection.tsx`
- Create: `frontend/src/pages/LandingPage/sections/CreatorNoteSection.module.css`

- [ ] **Step 1: CSS Module を作成**

`frontend/src/pages/LandingPage/sections/CreatorNoteSection.module.css`:

```css
.creator {
  padding: 140px 48px;
  background: var(--color-bg);
}

.inner {
  max-width: 720px;
  margin: 0 auto;
}

.label {
  font-size: 12px;
  font-weight: var(--font-weight-medium);
  color: var(--color-text-muted);
  margin-bottom: 32px;
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.labelNum {
  font-family: var(--font-heading);
  font-size: 14px;
  color: var(--color-text);
  font-weight: var(--font-weight-medium);
}

.body {
  font-family: var(--font-body);
  font-size: 18px;
  line-height: 2;
  color: var(--color-text);
}

.body p + p {
  margin-top: 20px;
}

.signature {
  margin-top: 36px;
  font-size: 14px;
  color: var(--color-text-muted);
  font-weight: var(--font-weight-medium);
}

@media (max-width: 900px) {
  .creator {
    padding: 80px 24px;
  }
}
```

- [ ] **Step 2: コンポーネントを実装**

`frontend/src/pages/LandingPage/sections/CreatorNoteSection.tsx`:

```tsx
import styles from './CreatorNoteSection.module.css'

export function CreatorNoteSection() {
  return (
    <section className={styles.creator}>
      <div className={styles.inner}>
        <div className={`${styles.label} reveal`}>
          <span className={styles.labelNum}>05</span>なぜ作ったか
        </div>
        <div className={`${styles.body} reveal`}>
          <p>
            作者の IK です。好きな作品を振り返りたくなったとき、Netflix の視聴履歴を開き、Kindle のライブラリを開き、Steam のプレイ時間を見る——そんなことを何度もしていました。どれも便利なサービスです。
          </p>
          <p>
            でも、ジャンルをまたいで「自分が味わってきたもの」を一箇所で俯瞰する場所は、どこにもありませんでした。Recolly は、そのための場所として作りました。
          </p>
        </div>
        <div className={`${styles.signature} reveal`}>— IK, 作者</div>
      </div>
    </section>
  )
}
```

- [ ] **Step 3: 型チェック + lint + コミット**

```bash
cd frontend && npm run typecheck && npm run lint -- src/pages/LandingPage/sections/CreatorNoteSection.tsx
git add frontend/src/pages/LandingPage/sections/CreatorNoteSection.tsx frontend/src/pages/LandingPage/sections/CreatorNoteSection.module.css
git commit -m "feat(landing-page): CreatorNoteSection を追加"
```

---

## Task 12: PromiseSection

**Files:**
- Create: `frontend/src/pages/LandingPage/sections/PromiseSection.tsx`
- Create: `frontend/src/pages/LandingPage/sections/PromiseSection.module.css`

- [ ] **Step 1: CSS Module を作成**

`frontend/src/pages/LandingPage/sections/PromiseSection.module.css`:

```css
.promise {
  background: var(--color-text);
  color: var(--color-bg);
  padding: 130px 48px;
  position: relative;
}

.inner {
  max-width: 1200px;
  margin: 0 auto;
}

.label {
  font-size: 12px;
  font-weight: var(--font-weight-medium);
  color: var(--color-text-soft);
  margin-bottom: 32px;
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.labelNum {
  font-family: var(--font-heading);
  font-size: 14px;
  color: var(--color-bg);
  font-weight: var(--font-weight-medium);
}

.heading {
  font-family: var(--font-body);
  font-size: clamp(28px, 3.8vw, 48px);
  font-weight: var(--font-weight-bold);
  line-height: 1.4;
  margin-bottom: 40px;
  max-width: 780px;
  color: var(--color-bg);
}

.body {
  font-size: 16px;
  line-height: 2;
  color: #c8c4b8;
  max-width: 680px;
}

.body strong {
  color: var(--color-bg);
  font-weight: var(--font-weight-medium);
}

@media (max-width: 900px) {
  .promise {
    padding: 80px 24px;
  }
}
```

- [ ] **Step 2: コンポーネントを実装**

`frontend/src/pages/LandingPage/sections/PromiseSection.tsx`:

```tsx
import styles from './PromiseSection.module.css'

export function PromiseSection() {
  return (
    <section className={styles.promise}>
      <div className={styles.inner}>
        <div className={`${styles.label} reveal`}>
          <span className={styles.labelNum}>06</span>約束
        </div>
        <h2 className={`${styles.heading} reveal`}>
          基本機能は、これから先も無料で使えます。
        </h2>
        <div className={`${styles.body} reveal`}>
          <p>
            Recolly の<strong>記録・ライブラリ・検索・おすすめ</strong>
            は、これから先も無料で使えます。将来、詳細統計やデータエクスポートのような付加価値機能のみ有料化する可能性はありますが、あなたの日々の記録を人質にすることはありません。
          </p>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 3: 型チェック + lint + コミット**

```bash
cd frontend && npm run typecheck && npm run lint -- src/pages/LandingPage/sections/PromiseSection.tsx
git add frontend/src/pages/LandingPage/sections/PromiseSection.tsx frontend/src/pages/LandingPage/sections/PromiseSection.module.css
git commit -m "feat(landing-page): PromiseSection を追加"
```

---

## Task 13: FaqSection

**Files:**
- Create: `frontend/src/pages/LandingPage/sections/FaqSection.tsx`
- Create: `frontend/src/pages/LandingPage/sections/FaqSection.module.css`

- [ ] **Step 1: CSS Module を作成**

`frontend/src/pages/LandingPage/sections/FaqSection.module.css`:

```css
.faq {
  padding: 120px 48px;
  background: var(--color-bg);
}

.container {
  max-width: 1200px;
  margin: 0 auto;
}

.label {
  font-size: 12px;
  font-weight: var(--font-weight-medium);
  color: var(--color-text-muted);
  margin-bottom: 32px;
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.labelNum {
  font-family: var(--font-heading);
  font-size: 14px;
  color: var(--color-text);
  font-weight: var(--font-weight-medium);
}

.heading {
  font-family: var(--font-body);
  font-size: clamp(30px, 3.8vw, 48px);
  font-weight: var(--font-weight-bold);
  margin-bottom: 64px;
  letter-spacing: -0.01em;
  color: var(--color-text);
}

.list {
  max-width: 820px;
}

.item {
  border-top: 1px solid var(--color-border-light);
  padding: 32px 0;
  display: grid;
  grid-template-columns: 48px 1fr;
  gap: 24px;
  align-items: start;
}

.item:last-child {
  border-bottom: 1px solid var(--color-border-light);
}

.num {
  font-family: var(--font-heading);
  font-size: 14px;
  font-weight: var(--font-weight-medium);
  color: var(--color-text-muted);
  padding-top: 4px;
}

.q {
  font-family: var(--font-body);
  font-size: 18px;
  font-weight: var(--font-weight-bold);
  line-height: 1.55;
  margin-bottom: 14px;
  color: var(--color-text);
}

.a {
  font-size: 15px;
  line-height: 1.9;
  color: var(--color-text-muted);
  max-width: 640px;
}

@media (max-width: 900px) {
  .faq {
    padding: 80px 24px;
  }
  .item {
    grid-template-columns: 40px 1fr;
    gap: 16px;
  }
}
```

- [ ] **Step 2: コンポーネントを実装**

`frontend/src/pages/LandingPage/sections/FaqSection.tsx`:

```tsx
import styles from './FaqSection.module.css'

type Faq = {
  num: string
  q: string
  a: string
}

const FAQS: Faq[] = [
  {
    num: 'Q1',
    q: 'Netflix や Kindle のような視聴・読書サービスとは何が違いますか？',
    a:
      'Recolly は、視聴や読書そのものを提供するサービスではありません。既存の配信・電子書籍サービスで味わった作品を「まとめて記録し、振り返る」ための場所です。視聴や読書はこれまで通り既存のサービスで、記録と振り返りは Recolly で、という使い方になります。',
  },
  {
    num: 'Q2',
    q: '他のサービスの記録は Recolly に移行できますか？',
    a:
      '現状、エクスポート／インポート機能は対応していません。今後の検討事項として、ユーザーの声を見ながら判断していきます。',
  },
  {
    num: 'Q3',
    q: 'スマホと PC どちらでも使えますか？',
    a:
      '両方で使えます。PWA に対応しているので、スマホのホーム画面に追加すればアプリのように起動できます。',
  },
  {
    num: 'Q4',
    q: '記録は他の人に公開されますか？',
    a:
      'プロフィールの一部は公開ベースの設計になっています。将来、より細かく公開範囲を選べる非公開モードを追加する予定です。',
  },
]

export function FaqSection() {
  return (
    <section className={styles.faq} id="faq">
      <div className={styles.container}>
        <div className={`${styles.label} reveal`}>
          <span className={styles.labelNum}>07</span>よくある質問
        </div>
        <h2 className={`${styles.heading} reveal`}>よくある質問</h2>
        <div className={styles.list}>
          {FAQS.map((f) => (
            <div key={f.num} className={`${styles.item} reveal`}>
              <div className={styles.num}>{f.num}</div>
              <div>
                <div className={styles.q}>{f.q}</div>
                <p className={styles.a}>{f.a}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 3: 型チェック + lint + コミット**

```bash
cd frontend && npm run typecheck && npm run lint -- src/pages/LandingPage/sections/FaqSection.tsx
git add frontend/src/pages/LandingPage/sections/FaqSection.tsx frontend/src/pages/LandingPage/sections/FaqSection.module.css
git commit -m "feat(landing-page): FaqSection を追加"
```

---

## Task 14: FinalCtaSection

**Files:**
- Create: `frontend/src/pages/LandingPage/sections/FinalCtaSection.tsx`
- Create: `frontend/src/pages/LandingPage/sections/FinalCtaSection.module.css`

- [ ] **Step 1: CSS Module を作成**

`frontend/src/pages/LandingPage/sections/FinalCtaSection.module.css`:

```css
.ctaFinal {
  background: var(--color-bg-paper);
  padding: 160px 48px;
  text-align: center;
  border-top: 1px solid var(--color-border-light);
}

.container {
  max-width: 1200px;
  margin: 0 auto;
}

.heading {
  font-family: var(--font-body);
  font-size: clamp(28px, 4vw, 52px);
  font-weight: var(--font-weight-bold);
  line-height: 1.45;
  margin-bottom: 48px;
  letter-spacing: -0.01em;
  max-width: 820px;
  margin-left: auto;
  margin-right: auto;
  color: var(--color-text);
}

.btnPrimary {
  background: var(--color-text);
  color: var(--color-bg);
  padding: 18px 36px;
  border: none;
  font-family: var(--font-body);
  font-size: 15px;
  font-weight: var(--font-weight-medium);
  letter-spacing: 0.05em;
  cursor: pointer;
  text-decoration: none;
  display: inline-block;
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.btnPrimary::after {
  content: '→';
  margin-left: 12px;
  display: inline-block;
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.btnPrimary:hover {
  transform: translateY(-2px);
}

.btnPrimary:hover::after {
  transform: translateX(4px);
}

.note {
  margin-top: 28px;
  font-size: 13px;
  color: var(--color-text-muted);
}

@media (max-width: 900px) {
  .ctaFinal {
    padding: 80px 24px;
  }
}
```

- [ ] **Step 2: コンポーネントを実装**

`frontend/src/pages/LandingPage/sections/FinalCtaSection.tsx`:

```tsx
import { Link } from 'react-router-dom'
import styles from './FinalCtaSection.module.css'

export function FinalCtaSection() {
  return (
    <section className={styles.ctaFinal}>
      <div className={styles.container}>
        <h2 className={`${styles.heading} reveal`}>
          あなたの観たもの、読んだもの、プレイしたもの。
          <br />
          全部、ひとつの棚に。
        </h2>
        <Link className={`${styles.btnPrimary} reveal`} to="/signup">
          無料で始める
        </Link>
        <div className={`${styles.note} reveal`}>永久無料・カード不要</div>
      </div>
    </section>
  )
}
```

- [ ] **Step 3: 型チェック + lint + コミット**

```bash
cd frontend && npm run typecheck && npm run lint -- src/pages/LandingPage/sections/FinalCtaSection.tsx
git add frontend/src/pages/LandingPage/sections/FinalCtaSection.tsx frontend/src/pages/LandingPage/sections/FinalCtaSection.module.css
git commit -m "feat(landing-page): FinalCtaSection を追加"
```

---

## Task 15: LandingPage 本体 + 統合テスト — TDD

**Files:**
- Create: `frontend/src/pages/LandingPage/LandingPage.tsx`
- Create: `frontend/src/pages/LandingPage/LandingPage.module.css`
- Create: `frontend/src/pages/LandingPage/LandingPage.test.tsx`

- [ ] **Step 1: 統合テストを先に書く（RED）**

`frontend/src/pages/LandingPage/LandingPage.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { LandingPage } from './LandingPage'

// IntersectionObserver のスタブ（JSDOM には存在しない）
beforeAll(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    vi.fn(function (this: IntersectionObserver) {
      this.observe = vi.fn()
      this.unobserve = vi.fn()
      this.disconnect = vi.fn()
      this.takeRecords = vi.fn()
      this.root = null
      this.rootMargin = ''
      this.thresholds = []
      return this
    }),
  )
})

describe('LandingPage', () => {
  function renderPage() {
    return render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    )
  }

  it('ヒーロー見出しが表示される', () => {
    renderPage()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      /観たもの、読んだもの/,
    )
  })

  it('全セクションのラベル番号が表示される (01-07)', () => {
    renderPage()
    expect(screen.getByText('01')).toBeInTheDocument()
    expect(screen.getByText('02')).toBeInTheDocument()
    expect(screen.getByText('03')).toBeInTheDocument()
    expect(screen.getByText('04')).toBeInTheDocument()
    expect(screen.getByText('05')).toBeInTheDocument()
    expect(screen.getByText('06')).toBeInTheDocument()
    expect(screen.getByText('07')).toBeInTheDocument()
  })

  it('ヒーロー CTA と最終 CTA から /signup にリンクしている', () => {
    renderPage()
    const signupLinks = screen.getAllByRole('link', { name: /無料で始める/ })
    // ナビ + ヒーロー + 最終 CTA の少なくとも 3 個
    expect(signupLinks.length).toBeGreaterThanOrEqual(3)
    signupLinks.forEach((link) => expect(link).toHaveAttribute('href', '/signup'))
  })

  it('ナビに /login へのリンクがある', () => {
    renderPage()
    const loginLinks = screen.getAllByRole('link', { name: /ログイン/ })
    expect(loginLinks.some((link) => link.getAttribute('href') === '/login')).toBe(true)
  })

  it('Footer (contentinfo) が表示され、プライバシーポリシーへのリンクを含む', () => {
    renderPage()
    const footer = screen.getByRole('contentinfo')
    expect(footer).toBeInTheDocument()
    const privacyLink = screen.getByRole('link', { name: /プライバシーポリシー/ })
    expect(privacyLink).toHaveAttribute('href', '/privacy')
  })

  it('問題提示セクションで Netflix に言及している', () => {
    renderPage()
    expect(screen.getByText(/Netflix/)).toBeInTheDocument()
  })

  it('永久無料の宣言を含む', () => {
    renderPage()
    expect(
      screen.getByRole('heading', {
        name: /基本機能は、これから先も無料で使えます/,
      }),
    ).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: テストを実行して失敗を確認**

```bash
cd frontend && npm run test -- src/pages/LandingPage/LandingPage.test.tsx
```

Expected: `Cannot find module './LandingPage'` のエラー。

- [ ] **Step 3: LandingPage.module.css を作成**

`frontend/src/pages/LandingPage/LandingPage.module.css`:

```css
.root {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  background: var(--color-bg);
}

.main {
  flex: 1 1 auto;
}
```

- [ ] **Step 4: LandingPage.tsx を実装**

`frontend/src/pages/LandingPage/LandingPage.tsx`:

```tsx
import { Footer } from '../../components/ui/Footer/Footer'
import { useScrollReveal } from './hooks/useScrollReveal'
import { LandingNav } from './sections/LandingNav'
import { HeroSection } from './sections/HeroSection'
import { ProblemSection } from './sections/ProblemSection'
import { SolutionSection } from './sections/SolutionSection'
import { HowItWorksSection } from './sections/HowItWorksSection'
import { ReflectSection } from './sections/ReflectSection'
import { CreatorNoteSection } from './sections/CreatorNoteSection'
import { PromiseSection } from './sections/PromiseSection'
import { FaqSection } from './sections/FaqSection'
import { FinalCtaSection } from './sections/FinalCtaSection'
import './landingGlobal.css'
import styles from './LandingPage.module.css'

/**
 * ランディングページ。未ログインで `/` を訪問したユーザーに表示される。
 * ログイン済みは App.tsx の RootRoute で /dashboard にリダイレクトされるため
 * このコンポーネントは描画されない。
 *
 * Spec: docs/superpowers/specs/2026-04-14-landing-page-design.md
 */
export function LandingPage() {
  useScrollReveal()

  return (
    <div className={`landing-page ${styles.root}`}>
      <LandingNav />
      <main className={styles.main}>
        <HeroSection />
        <ProblemSection />
        <SolutionSection />
        <HowItWorksSection />
        <ReflectSection />
        <CreatorNoteSection />
        <PromiseSection />
        <FaqSection />
        <FinalCtaSection />
      </main>
      <Footer />
    </div>
  )
}
```

- [ ] **Step 5: テストを実行して PASS を確認**

```bash
cd frontend && npm run test -- src/pages/LandingPage/LandingPage.test.tsx
```

Expected: 全 7 テスト PASS。

- [ ] **Step 6: 型チェック + lint**

```bash
cd frontend && npm run typecheck && npm run lint -- src/pages/LandingPage/
```

Expected: エラーなし。

- [ ] **Step 7: コミット**

```bash
git add frontend/src/pages/LandingPage/LandingPage.tsx frontend/src/pages/LandingPage/LandingPage.module.css frontend/src/pages/LandingPage/LandingPage.test.tsx
git commit -m "feat(landing-page): LandingPage 本体と統合テストを追加

全 9 セクション (LandingNav + Hero + 01-07 + FinalCta) を並べ、
useScrollReveal hook で reveal アニメーションを発火する。
既存の Footer コンポーネントを再利用して導線を維持。"
```

---

## Task 16: RootRoute への変更 — TDD

**Files:**
- Modify: `frontend/src/App.tsx`（`RootRedirect` → `RootRoute`）
- Create: `frontend/src/rootRoute.test.tsx`

- [ ] **Step 1: 既存の `App.tsx` の RootRedirect を確認**

```bash
cd frontend && grep -n "RootRedirect\|function RootRedirect\|<RootRedirect" src/App.tsx
```

現状を把握する。

- [ ] **Step 2: テストを先に書く（RED）**

`frontend/src/rootRoute.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { beforeEach, beforeAll, describe, expect, it, vi } from 'vitest'

// LandingPage をモック（子の全テストを再実行しないため）
vi.mock('./pages/LandingPage/LandingPage', () => ({
  LandingPage: () => <div data-testid="landing-page-mock">LP</div>,
}))

// AuthContext をモック
vi.mock('./contexts/useAuth', () => ({
  useAuth: vi.fn(),
}))

import { useAuth } from './contexts/useAuth'
import { RootRoute } from './App'

beforeAll(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    vi.fn(function (this: IntersectionObserver) {
      this.observe = vi.fn()
      this.unobserve = vi.fn()
      this.disconnect = vi.fn()
      this.takeRecords = vi.fn()
      this.root = null
      this.rootMargin = ''
      this.thresholds = []
      return this
    }),
  )
})

describe('RootRoute', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReset()
  })

  function renderAtRoot() {
    return render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<RootRoute />} />
          <Route path="/dashboard" element={<div data-testid="dashboard">dashboard</div>} />
        </Routes>
      </MemoryRouter>,
    )
  }

  it('ロード中は「読み込み中...」を表示する', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: true,
    } as unknown as ReturnType<typeof useAuth>)

    renderAtRoot()
    expect(screen.getByText(/読み込み中/)).toBeInTheDocument()
  })

  it('未ログインなら LandingPage を描画する', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
    } as unknown as ReturnType<typeof useAuth>)

    renderAtRoot()
    await waitFor(() => {
      expect(screen.getByTestId('landing-page-mock')).toBeInTheDocument()
    })
  })

  it('ログイン済みなら /dashboard にリダイレクトする', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 1, username: 'test' },
      isAuthenticated: true,
      isLoading: false,
    } as unknown as ReturnType<typeof useAuth>)

    renderAtRoot()
    await waitFor(() => {
      expect(screen.getByTestId('dashboard')).toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 3: テストを実行して失敗を確認**

```bash
cd frontend && npm run test -- src/rootRoute.test.tsx
```

Expected: `'RootRoute' is not exported from './App'` のエラー（既存コードは `RootRedirect` で、`export` もされていない）。

- [ ] **Step 4: `App.tsx` の RootRedirect を修正**

`frontend/src/App.tsx` の変更:

1. `LandingPage` の lazy import を追加（既存 lazy import 群の一番下に追加）:

```tsx
const LandingPage = lazy(() =>
  import('./pages/LandingPage/LandingPage').then((m) => ({ default: m.LandingPage })),
)
```

2. `RootRedirect` 関数を以下で置き換え + `export` を追加:

```tsx
// 認証状態に応じてルートを分岐する。
// - 読み込み中: 読み込み中表示
// - ログイン済み: /dashboard へリダイレクト
// - 未ログイン: LandingPage を描画
export function RootRoute() {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) return <div className={appStyles.loading}>読み込み中...</div>

  if (isAuthenticated) return <Navigate to="/dashboard" replace />

  return <LandingPage />
}
```

3. `<Route path="/" element={<RootRedirect />} />` を以下に変更:

```tsx
<Route path="/" element={<RootRoute />} />
```

- [ ] **Step 5: テストを実行して PASS を確認**

```bash
cd frontend && npm run test -- src/rootRoute.test.tsx
```

Expected: 全 3 テスト PASS。

- [ ] **Step 6: 既存テスト全体が壊れていないか確認**

```bash
cd frontend && npm run test
```

Expected: 既存の全テストが PASS。`RootRedirect` を参照していたテストがあれば、新しい `RootRoute` に差し替える必要がある（現時点では無いはず）。

- [ ] **Step 7: 型チェック + lint**

```bash
cd frontend && npm run typecheck && npm run lint
```

Expected: エラーなし。

- [ ] **Step 8: コミット**

```bash
git add frontend/src/App.tsx frontend/src/rootRoute.test.tsx
git commit -m "feat(landing-page): RootRedirect を RootRoute に変更し LP を表示

未ログインで / にアクセスしたときに LandingPage を描画するよう変更。
ログイン済みは従来通り /dashboard にリダイレクト。LP は lazy() で
コード分割してバンドルサイズへの影響を最小化する。"
```

---

## Task 17: 最終全体検証

**Files:** なし（検証のみ）

- [ ] **Step 1: 全体テスト**

```bash
cd frontend && npm run test
```

Expected: 全テストが PASS（LandingPage の統合テスト 7 件、useScrollReveal 4 件、RootRoute 3 件を含む）。

- [ ] **Step 2: 型チェック**

```bash
cd frontend && npm run typecheck
```

Expected: エラーなし。

- [ ] **Step 3: lint**

```bash
cd frontend && npm run lint
```

Expected: エラーなし。

- [ ] **Step 4: プロダクションビルド**

```bash
cd frontend && npm run build
```

Expected: ビルド成功。`dist/assets/LandingPage-*.js` が独立した lazy チャンクとして出力される（確認ポイント）。

---

## Task 18: 動作確認

**Files:** なし

- [ ] **Step 1: 動作確認方法をユーザーに確認する**

`recolly-workflow` の Step 5 のゲート。AskUserQuestion で以下を質問:

1. 手動確認（ブラウザで操作する手順を案内）
2. Playwright MCP で自動確認

- [ ] **Step 2: 選択された方式で動作確認**

手動の場合の確認項目:

```bash
cd frontend && npm run dev
```

1. 未ログイン状態で `http://localhost:5173/` にアクセス → LandingPage が表示されること
2. ヒーローの主見出し「観たもの、読んだもの、プレイしたもの。全部ひとつの棚に。」が表示される
3. ヒーロー右側の 3 枚の作品カード（フリーレン / コンビニ人間 / Outer Wilds）が浮遊しながら表示される
4. ヒーロー下部のジャンル一覧（6 個の色ドット + ラベル）が表示される
5. スクロールしながら各セクション（01〜07 + 最終 CTA）がフェードインして表示される
6. ナビの「特徴」「使い方」「FAQ」アンカーが正しくスクロールする
7. 最終 CTA / ヒーロー CTA の「無料で始める」をクリック → `/signup` に遷移
8. ナビの「ログイン」をクリック → `/login` に遷移
9. フッターの「プライバシーポリシー」をクリック → `/privacy` に遷移
10. モバイルサイズ（375px 幅）でレイアウトが崩れず 1 カラムに折り畳まれる
11. ログイン状態で `/` にアクセス → `/dashboard` にリダイレクトされる

- [ ] **Step 3: PostHog `$pageview` の発火確認**

ブラウザの DevTools Network タブで `posthog.com/e/` へのリクエストが `/` アクセス時に発火することを確認。

- [ ] **Step 4: 不具合があれば該当 Task に戻って修正**

---

## Task 19: PR 作成・レビュー対応・マージ

**Files:** なし（Git 操作のみ）

- [ ] **Step 1: `superpowers:finishing-a-development-branch` スキルを起動**

- [ ] **Step 2: PR タイトルは Conventional Commits**

例: `feat(landing-page): ランディングページ (/) を新設`

- [ ] **Step 3: PR 本文に `Closes #149` を含める**

- [ ] **Step 4: 自動レビューの指摘に対応（必要なら）**

`recolly-git-rules` スキルの「レビュー対応のフィードバックループ」に従う。

- [ ] **Step 5: マージ判断は IK さん**

---

## Spec Coverage Check

| Spec 要件 | 対応タスク |
|---|---|
| `--color-bg-paper` 等の新規トークン (§5.1) | Task 1 |
| useScrollReveal hook (§4.3) | Task 2 |
| ヒーロー作品カード (§3.3) | Task 3, 6 |
| reveal グローバル CSS (§4.3 の実装判断) | Task 4 |
| ナビゲーション (§3.2) | Task 5 |
| ヒーロー (§3.3) | Task 6 |
| 問題提示 (§3.4) | Task 7 |
| ソリューション (§3.5) | Task 8 |
| How it works (§3.6) | Task 9 |
| 振り返り (§3.7) | Task 10 |
| Creator's Note (§3.8) | Task 11 |
| 永久無料 (§3.9) | Task 12 |
| FAQ (§3.10) | Task 13 |
| 最終 CTA (§3.11) | Task 14 |
| LandingPage 本体 + Footer 再利用 (§3.12, §4.3) | Task 15 |
| 統合テスト (§8.1) | Task 15 |
| RootRedirect → RootRoute (§4.2) | Task 16 |
| ルーティングテスト (§8.1) | Task 16 |
| 最終全体検証 | Task 17 |
| 手動 / Playwright 動作確認 (§8.2) | Task 18 |
| PostHog pageview 維持確認 (§9.3) | Task 18 |
| PR 作成 | Task 19 |

---

## Notes / 実装時の注意点

- **CSS Modules の `.reveal` 回避**: `.reveal` クラスと `.in` クラスはグローバル CSS で定義し、`className="reveal"` を文字列リテラルで直接指定する。CSS Modules のハッシュ化を回避するため。
- **IntersectionObserver は JSDOM にない**: テスト側で `vi.stubGlobal` で必ずスタブする。`LandingPage.test.tsx` と `rootRoute.test.tsx` の両方で必要。
- **既存テストへの影響**: `RootRedirect` という名前を参照している既存テストは無いはずだが、`grep -rn "RootRedirect" src/` で念のため確認する。
- **ダミー作品名の商標**: 実装段階ではモック通り「葬送のフリーレン」「コンビニ人間」「Outer Wilds」で進めるが、公開前（PR マージ前）に IK さんに再確認する。
- **`prefers-reduced-motion`**: hook 側と CSS 側の両方で対応している。両方とも必要。
- **Footer の再利用**: 既存 `components/ui/Footer/Footer` を import するだけで良い。LP 専用の Footer は作らない。
- **Nav 2 つ問題**: LandingPage は独自の `LandingNav` を使い、既存の `NavBar` は使わない。`AuthenticatedLayout` / `OptionalAuthLayout` も使わない。`/` は `RootRoute` 直下の独立したツリーとして扱う。
