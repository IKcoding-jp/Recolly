# Analytics Tracking (PostHog Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recolly フロントエンドに PostHog を導入し、Phase 1 の 4 イベント（`$pageview` / `$identify` / `signup_completed` / `record_created`）を計測できる状態にする。

**Architecture:** `frontend/src/lib/analytics/` に PostHog の薄いラッパーを置き、各発火ポイントからそのラッパーを呼ぶ。PageView は React Router の `useLocation()` を監視して手動発火する。identify/reset は `AuthProvider` の `user` state 変化を `useEffect` で監視する方式で統一する。プライバシーポリシーページ `/privacy` を新設し、全レイアウトの末尾に Footer を挿入して `/privacy` リンクを常に露出する。

**Tech Stack:** `posthog-js` / React 19 / TypeScript / React Router 7 / Vitest + React Testing Library

**Spec:** `docs/superpowers/specs/2026-04-13-analytics-tracking-design.md`
**ADR:** `docs/adr/0041-プロダクト分析ツールにposthogを採用.md`
**Issue:** IKcoding-jp/Recolly#143

---

## 設計判断サマリ

| 判断事項 | 決定 | 理由 |
|---|---|---|
| pageview 発火方式 | SDK 初期化時に `capture_pageview: false`、全て手動発火 | SPA 初回と location 変化を一貫して扱うため。SDK の自動発火と二重送信を避ける |
| identify/reset 発火方式 | `AuthProvider` 内 `useEffect([user])` で user state を監視 | login / signup / OAuth complete / initial session 復帰 / logout の全パスで確実に発火する |
| record_created 呼び出し元 | 呼び出しページで明示 capture（`SearchPage`, `RecommendationsPage`） | 副作用を API ラッパーに隠さない。どの画面から発生したかが明示的になる |
| フッター適用範囲 | 全レイアウト（認証済 / オプショナル認証 / 非認証ページ）末尾に共通 Footer | `/privacy` をどの画面からも 1 クリックで辿れるようにするため（Cookie バナー非採用の代替露出） |
| 環境変数未設定時の挙動 | `init` 内で key/host が空なら何もしない（例外も投げない） | ローカル `.env.local` を空で起動するケースを壊さない |

---

## File Structure

**新規作成:**

- `frontend/src/lib/analytics/events.ts` — イベント名の定数定義（tagged union 型）
- `frontend/src/lib/analytics/posthog.ts` — PostHog 初期化 + ラッパー API
- `frontend/src/lib/analytics/posthog.test.ts` — ラッパーのユニットテスト
- `frontend/src/components/PageviewTracker/PageviewTracker.tsx` — `useLocation` を監視して `$pageview` を発火
- `frontend/src/components/PageviewTracker/PageviewTracker.test.tsx` — ページビュートラッカーのテスト
- `frontend/src/components/ui/Footer/Footer.tsx` — 共通フッターコンポーネント
- `frontend/src/components/ui/Footer/Footer.module.css` — フッターのスタイル
- `frontend/src/components/ui/Footer/Footer.test.tsx` — フッターのテスト
- `frontend/src/pages/PrivacyPage/PrivacyPage.tsx` — プライバシーポリシーページ
- `frontend/src/pages/PrivacyPage/PrivacyPage.module.css` — プライバシーポリシーページ用スタイル
- `frontend/src/pages/PrivacyPage/PrivacyPage.test.tsx` — プライバシーポリシーページのテスト

**修正:**

- `frontend/package.json` — `posthog-js` を dependencies に追加
- `frontend/src/main.tsx` — PostHog 初期化呼び出し
- `frontend/src/App.tsx` — `<PageviewTracker />` の配置 + `/privacy` ルート追加 + 各レイアウトに `<Footer />` 挿入
- `frontend/src/App.module.css` — フッター分のスペース調整
- `frontend/src/contexts/AuthContext.tsx` — `user` state 監視で identify/reset
- `frontend/src/contexts/AuthContext.test.tsx` — identify/reset の発火検証を追加
- `frontend/src/pages/SignUpPage/SignUpPage.tsx` — `signup_completed` 発火（method='email'）
- `frontend/src/pages/SignUpPage/SignUpPage.test.tsx` — 発火検証を追加
- `frontend/src/pages/OauthUsernamePage/OauthUsernamePage.tsx` — `signup_completed` 発火（method='google'）
- `frontend/src/pages/OauthUsernamePage/OauthUsernamePage.test.tsx`（存在確認して無ければ新規） — 発火検証
- `frontend/src/pages/SearchPage/SearchPage.tsx` — `record_created` 発火
- `frontend/src/pages/SearchPage/SearchPage.test.tsx` — 発火検証を追加
- `frontend/src/pages/RecommendationsPage/RecommendationsPage.tsx` — `record_created` 発火
- `frontend/src/pages/RecommendationsPage/RecommendationsPage.test.tsx`（存在確認） — 発火検証

---

## Task 1: `posthog-js` を依存に追加

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json`（自動更新）

- [ ] **Step 1: npm でインストール**

```bash
cd frontend && npm install posthog-js
```

Expected: `posthog-js` が `dependencies` に追加され、`package-lock.json` が更新される。

- [ ] **Step 2: インストール結果を確認**

```bash
cd frontend && grep -A 1 '"posthog-js"' package.json
```

Expected: `"posthog-js": "^1.x.x"` の形式で表示される。

- [ ] **Step 3: ビルドと型チェックが壊れていないこと**

```bash
cd frontend && npm run typecheck
```

Expected: エラーなし。

- [ ] **Step 4: コミット**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "chore(frontend): posthog-js を依存に追加"
```

---

## Task 2: イベント名の定数定義（`events.ts`）

**Files:**
- Create: `frontend/src/lib/analytics/events.ts`

- [ ] **Step 1: 定数ファイルを作成**

`frontend/src/lib/analytics/events.ts`:

```ts
/**
 * PostHog に送信するイベント名の定数定義。
 * 文字列リテラルの typo を防ぐため、発火側は必ずこの定数経由で指定する。
 * Spec: docs/superpowers/specs/2026-04-13-analytics-tracking-design.md 2.1 節
 */
export const ANALYTICS_EVENTS = {
  PAGEVIEW: '$pageview',
  SIGNUP_COMPLETED: 'signup_completed',
  RECORD_CREATED: 'record_created',
} as const

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS]

/** signup_completed のプロパティ */
export type SignupCompletedProps = {
  method: 'email' | 'google'
}

/** record_created のプロパティ */
export type RecordCreatedProps = {
  media_type: 'anime' | 'movie' | 'drama' | 'book' | 'manga' | 'game'
}
```

- [ ] **Step 2: 型チェックでエラーがないこと**

```bash
cd frontend && npm run typecheck
```

Expected: エラーなし。

- [ ] **Step 3: コミット**

```bash
git add frontend/src/lib/analytics/events.ts
git commit -m "feat(analytics): イベント名定数と型定義を追加"
```

---

## Task 3: PostHog ラッパー（`posthog.ts`）— テスト先行

**Files:**
- Create: `frontend/src/lib/analytics/posthog.test.ts`
- Create: `frontend/src/lib/analytics/posthog.ts`

- [ ] **Step 1: テストファイルを作成（failing test）**

`frontend/src/lib/analytics/posthog.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

// posthog-js をモック化。import されるより前に vi.mock を呼ぶ必要がある
vi.mock('posthog-js', () => ({
  default: {
    init: vi.fn(),
    identify: vi.fn(),
    reset: vi.fn(),
    capture: vi.fn(),
  },
}))

import posthog from 'posthog-js'
import {
  initAnalytics,
  identifyUser,
  resetAnalytics,
  captureEvent,
  capturePageview,
} from './posthog'

describe('analytics/posthog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('initAnalytics', () => {
    it('key と host が両方指定されたとき posthog.init を呼ぶ', () => {
      initAnalytics({ key: 'phc_test', host: 'https://us.i.posthog.com' })
      expect(posthog.init).toHaveBeenCalledWith('phc_test', {
        api_host: 'https://us.i.posthog.com',
        capture_pageview: false,
        persistence: 'localStorage+cookie',
      })
    })

    it('key が未設定なら posthog.init を呼ばない', () => {
      initAnalytics({ key: '', host: 'https://us.i.posthog.com' })
      expect(posthog.init).not.toHaveBeenCalled()
    })

    it('host が未設定なら posthog.init を呼ばない', () => {
      initAnalytics({ key: 'phc_test', host: '' })
      expect(posthog.init).not.toHaveBeenCalled()
    })

    it('key と host が undefined でも例外を投げない', () => {
      expect(() => initAnalytics({ key: undefined, host: undefined })).not.toThrow()
      expect(posthog.init).not.toHaveBeenCalled()
    })
  })

  describe('identifyUser', () => {
    it('未 init 状態でも例外を投げない', () => {
      expect(() =>
        identifyUser({
          id: 1,
          signup_method: 'email',
          signup_date: '2026-04-13T00:00:00Z',
        }),
      ).not.toThrow()
    })

    it('init 済みなら posthog.identify を distinct_id と $set プロパティ付きで呼ぶ', () => {
      initAnalytics({ key: 'phc_test', host: 'https://us.i.posthog.com' })
      identifyUser({
        id: 42,
        signup_method: 'google',
        signup_date: '2026-04-13T00:00:00Z',
      })
      expect(posthog.identify).toHaveBeenCalledWith('42', {
        signup_method: 'google',
        signup_date: '2026-04-13T00:00:00Z',
      })
    })
  })

  describe('resetAnalytics', () => {
    it('init 済みなら posthog.reset を呼ぶ', () => {
      initAnalytics({ key: 'phc_test', host: 'https://us.i.posthog.com' })
      resetAnalytics()
      expect(posthog.reset).toHaveBeenCalled()
    })

    it('未 init 状態でも例外を投げない', () => {
      expect(() => resetAnalytics()).not.toThrow()
    })
  })

  describe('captureEvent', () => {
    it('init 済みなら posthog.capture にイベント名とプロパティを渡す', () => {
      initAnalytics({ key: 'phc_test', host: 'https://us.i.posthog.com' })
      captureEvent('signup_completed', { method: 'email' })
      expect(posthog.capture).toHaveBeenCalledWith('signup_completed', { method: 'email' })
    })

    it('未 init 状態でも例外を投げない', () => {
      expect(() => captureEvent('signup_completed', { method: 'email' })).not.toThrow()
    })
  })

  describe('capturePageview', () => {
    it('init 済みなら $pageview を $current_url 付きで posthog.capture に渡す', () => {
      initAnalytics({ key: 'phc_test', host: 'https://us.i.posthog.com' })
      capturePageview('/dashboard')
      expect(posthog.capture).toHaveBeenCalledWith('$pageview', {
        $current_url: '/dashboard',
      })
    })

    it('未 init 状態でも例外を投げない', () => {
      expect(() => capturePageview('/dashboard')).not.toThrow()
    })
  })
})
```

- [ ] **Step 2: テストを走らせて fail することを確認**

```bash
cd frontend && npm run test -- src/lib/analytics/posthog.test.ts
```

Expected: `Cannot find module './posthog'` または類似のエラー。

- [ ] **Step 3: ラッパー本体を実装**

`frontend/src/lib/analytics/posthog.ts`:

```ts
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS, type AnalyticsEventName } from './events'

/**
 * PostHog のラッパー。
 * - 環境変数が未設定ならサイレントに何もしない（ローカル開発で .env.local が空でも壊さない）
 * - PostHog の init / capture が失敗しても Recolly 本体は継続動作する（例外は握りつぶして console.warn）
 * Spec: docs/superpowers/specs/2026-04-13-analytics-tracking-design.md 3.4 節
 */

let initialized = false

type InitOptions = {
  key: string | undefined
  host: string | undefined
}

export function initAnalytics({ key, host }: InitOptions): void {
  if (!key || !host) {
    // 環境変数未設定時は何もしない（開発環境で .env.local が無いケースを想定）
    return
  }
  try {
    posthog.init(key, {
      api_host: host,
      // SDK の自動 pageview は無効化し、React Router の location 変化時に手動発火する
      capture_pageview: false,
      persistence: 'localStorage+cookie',
    })
    initialized = true
  } catch (error) {
    console.warn('[analytics] PostHog init failed:', error)
  }
}

export type IdentifyPayload = {
  id: number
  signup_method: 'email' | 'google'
  signup_date: string
}

export function identifyUser(payload: IdentifyPayload): void {
  if (!initialized) return
  try {
    posthog.identify(String(payload.id), {
      signup_method: payload.signup_method,
      signup_date: payload.signup_date,
    })
  } catch (error) {
    console.warn('[analytics] identify failed:', error)
  }
}

export function resetAnalytics(): void {
  if (!initialized) return
  try {
    posthog.reset()
  } catch (error) {
    console.warn('[analytics] reset failed:', error)
  }
}

export function captureEvent<P extends Record<string, unknown>>(
  eventName: AnalyticsEventName,
  properties: P,
): void {
  if (!initialized) return
  try {
    posthog.capture(eventName, properties)
  } catch (error) {
    console.warn('[analytics] capture failed:', error)
  }
}

export function capturePageview(currentUrl: string): void {
  if (!initialized) return
  try {
    posthog.capture(ANALYTICS_EVENTS.PAGEVIEW, { $current_url: currentUrl })
  } catch (error) {
    console.warn('[analytics] pageview capture failed:', error)
  }
}

/** テスト用: 内部状態をリセットする（プロダクションコードからは呼ばない） */
export function __resetForTest(): void {
  initialized = false
}
```

- [ ] **Step 4: posthog.test.ts の beforeEach で `__resetForTest` を呼ぶよう更新**

`frontend/src/lib/analytics/posthog.test.ts` の import 行に `__resetForTest` を追加し、beforeEach を修正:

```ts
import {
  initAnalytics,
  identifyUser,
  resetAnalytics,
  captureEvent,
  capturePageview,
  __resetForTest,
} from './posthog'

// ...既存の describe 内
  beforeEach(() => {
    vi.clearAllMocks()
    __resetForTest()
  })
```

- [ ] **Step 5: テストが全部パスすることを確認**

```bash
cd frontend && npm run test -- src/lib/analytics/posthog.test.ts
```

Expected: 全テストが PASS。

- [ ] **Step 6: lint をかけてエラー無しを確認**

```bash
cd frontend && npm run lint -- src/lib/analytics/
```

Expected: エラーなし。

- [ ] **Step 7: コミット**

```bash
git add frontend/src/lib/analytics/posthog.ts frontend/src/lib/analytics/posthog.test.ts
git commit -m "feat(analytics): PostHog ラッパーとユニットテストを追加"
```

---

## Task 4: `main.tsx` で PostHog 初期化

**Files:**
- Modify: `frontend/src/main.tsx`

- [ ] **Step 1: `main.tsx` を修正**

`frontend/src/main.tsx`:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initAnalytics } from './lib/analytics/posthog'

// PostHog 初期化。環境変数が未設定ならサイレントに no-op（開発環境で .env.local が空でも壊さない）
initAnalytics({
  key: import.meta.env.VITE_POSTHOG_KEY as string | undefined,
  host: import.meta.env.VITE_POSTHOG_HOST as string | undefined,
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 2: 型チェックが通ることを確認**

```bash
cd frontend && npm run typecheck
```

Expected: エラーなし。

- [ ] **Step 3: 既存テスト全体がこけていないことを確認**

```bash
cd frontend && npm run test
```

Expected: 既存の全テストが PASS（この段階で新規追加したテストも含めて）。

- [ ] **Step 4: コミット**

```bash
git add frontend/src/main.tsx
git commit -m "feat(analytics): main.tsx で PostHog を初期化"
```

---

## Task 5: `PageviewTracker` コンポーネント — テスト先行

**Files:**
- Create: `frontend/src/components/PageviewTracker/PageviewTracker.test.tsx`
- Create: `frontend/src/components/PageviewTracker/PageviewTracker.tsx`

- [ ] **Step 1: テストファイルを作成（failing test）**

`frontend/src/components/PageviewTracker/PageviewTracker.test.tsx`:

```tsx
import { render } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../lib/analytics/posthog', () => ({
  capturePageview: vi.fn(),
}))

import { capturePageview } from '../../lib/analytics/posthog'
import { PageviewTracker } from './PageviewTracker'

function TestNavigator({ to }: { to: string }) {
  const navigate = useNavigate()
  return (
    <button type="button" onClick={() => navigate(to)}>
      go
    </button>
  )
}

describe('PageviewTracker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('初回マウント時に現在のパスで capturePageview を呼ぶ', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <PageviewTracker />
      </MemoryRouter>,
    )
    expect(capturePageview).toHaveBeenCalledWith('/dashboard')
  })

  it('location 変化で新しいパスを渡して capturePageview を再度呼ぶ', async () => {
    const { getByText } = render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <PageviewTracker />
        <Routes>
          <Route path="/dashboard" element={<TestNavigator to="/library" />} />
          <Route path="/library" element={<div>library</div>} />
        </Routes>
      </MemoryRouter>,
    )

    vi.mocked(capturePageview).mockClear()
    getByText('go').click()

    expect(capturePageview).toHaveBeenCalledWith('/library')
  })
})
```

- [ ] **Step 2: テストを走らせて fail することを確認**

```bash
cd frontend && npm run test -- src/components/PageviewTracker/PageviewTracker.test.tsx
```

Expected: `Cannot find module './PageviewTracker'` または類似のエラー。

- [ ] **Step 3: コンポーネント本体を実装**

`frontend/src/components/PageviewTracker/PageviewTracker.tsx`:

```tsx
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { capturePageview } from '../../lib/analytics/posthog'

/**
 * React Router の location 変化を監視して PostHog に $pageview を送る。
 * SDK の自動 pageview は無効化しているため、初回マウント時もここで手動発火する。
 * BrowserRouter の子孫として配置する必要がある（useLocation を使うため）。
 */
export function PageviewTracker(): null {
  const location = useLocation()

  useEffect(() => {
    capturePageview(location.pathname + location.search)
  }, [location.pathname, location.search])

  return null
}
```

- [ ] **Step 4: テストが全部パスすることを確認**

```bash
cd frontend && npm run test -- src/components/PageviewTracker/PageviewTracker.test.tsx
```

Expected: 全テスト PASS。

- [ ] **Step 5: テストのアサーションを pathname + search に合わせる**

`PageviewTracker.test.tsx` の `expect(capturePageview).toHaveBeenCalledWith('/dashboard')` が `'/dashboard'`（search 無し）で呼ばれる。search が無い場合は空文字連結なのでそのまま通る。念のため実行結果を確認する。

- [ ] **Step 6: コミット**

```bash
git add frontend/src/components/PageviewTracker/
git commit -m "feat(analytics): PageviewTracker コンポーネントを追加（SPA 遷移で \$pageview 発火）"
```

---

## Task 6: `App.tsx` に `PageviewTracker` を組み込む

**Files:**
- Modify: `frontend/src/App.tsx:143-258`（BrowserRouter の内側、AuthProvider の内側、Suspense の前に配置）

- [ ] **Step 1: `App.tsx` に import を追加**

`frontend/src/App.tsx` 上部に追加:

```tsx
import { PageviewTracker } from './components/PageviewTracker/PageviewTracker'
```

- [ ] **Step 2: `BrowserRouter` 内に `<PageviewTracker />` を配置**

`App()` 関数の `return` を以下に差し替え：

```tsx
  return (
    <BrowserRouter>
      <AuthProvider>
        <PageviewTracker />
        <AnimatePresence>
          {needRefresh && (
            <UpdatePrompt
              onRefresh={() => void updateServiceWorker(true)}
              onClose={() => setNeedRefresh(false)}
            />
          )}
        </AnimatePresence>
        <Suspense fallback={<div className={appStyles.loading}>読み込み中...</div>}>
          <Routes>
            {/* 既存のルート定義はそのまま */}
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  )
```

- [ ] **Step 3: 型チェック・既存テスト・lint を全て実行**

```bash
cd frontend && npm run typecheck && npm run lint && npm run test
```

Expected: 全て PASS。

- [ ] **Step 4: コミット**

```bash
git add frontend/src/App.tsx
git commit -m "feat(analytics): App.tsx に PageviewTracker を組み込む"
```

---

## Task 7: `AuthContext` で identify/reset — テスト先行

**Files:**
- Modify: `frontend/src/contexts/AuthContext.test.tsx`
- Modify: `frontend/src/contexts/AuthContext.tsx`

- [ ] **Step 1: 既存テストを確認し、mock 設定を調べる**

```bash
cd frontend && cat src/contexts/AuthContext.test.tsx | head -40
```

既存 mock パターンを把握する。

- [ ] **Step 2: テストに mock を追加して失敗テストを書く**

`frontend/src/contexts/AuthContext.test.tsx` の既存 `vi.mock` の近くに追加:

```ts
vi.mock('../lib/analytics/posthog', () => ({
  identifyUser: vi.fn(),
  resetAnalytics: vi.fn(),
}))
```

import 行に追加:

```ts
import { identifyUser, resetAnalytics } from '../lib/analytics/posthog'
```

describe 内に以下のテストを追加（既存 describe の末尾でよい）:

```tsx
describe('analytics integration', () => {
  it('ログイン成功時に identifyUser が呼ばれる', async () => {
    // 既存の login mock セットアップ（authApi.login が {user} を返すよう設定）を踏襲
    vi.mocked(authApi.login).mockResolvedValue({
      user: {
        id: 7,
        username: 'alice',
        email: 'alice@example.com',
        provider: 'email',
        created_at: '2026-04-01T00:00:00Z',
      } as User,
    })
    vi.mocked(authApi.getCurrentUser).mockRejectedValue(new Error('not logged in'))

    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.login('alice@example.com', 'secret')
    })

    await waitFor(() => {
      expect(identifyUser).toHaveBeenCalledWith({
        id: 7,
        signup_method: 'email',
        signup_date: '2026-04-01T00:00:00Z',
      })
    })
  })

  it('ログアウト時に resetAnalytics が呼ばれる', async () => {
    vi.mocked(authApi.getCurrentUser).mockResolvedValue({
      user: {
        id: 7,
        username: 'alice',
        email: 'alice@example.com',
        provider: 'google_oauth2',
        created_at: '2026-04-01T00:00:00Z',
      } as User,
    })
    vi.mocked(authApi.logout).mockResolvedValue(undefined)

    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
    })

    await waitFor(() => expect(result.current.user).not.toBeNull())

    await act(async () => {
      await result.current.logout()
    })

    await waitFor(() => {
      expect(resetAnalytics).toHaveBeenCalled()
    })
  })

  it('初回セッション復帰時に identifyUser が呼ばれる', async () => {
    vi.mocked(authApi.getCurrentUser).mockResolvedValue({
      user: {
        id: 99,
        username: 'bob',
        email: 'bob@example.com',
        provider: 'google_oauth2',
        created_at: '2026-03-15T00:00:00Z',
      } as User,
    })

    renderHook(() => useAuth(), {
      wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
    })

    await waitFor(() => {
      expect(identifyUser).toHaveBeenCalledWith({
        id: 99,
        signup_method: 'google',
        signup_date: '2026-03-15T00:00:00Z',
      })
    })
  })
})
```

> **注意:** `User` 型は `frontend/src/lib/types.ts` で定義されている。既存 AuthContext.test.tsx の import 行を確認し、`provider`, `created_at` の型が合うか調整すること。合わない場合は必要なフィールドだけ含めて `as unknown as User` でキャストして良い。

- [ ] **Step 3: テストを実行して失敗を確認**

```bash
cd frontend && npm run test -- src/contexts/AuthContext.test.tsx
```

Expected: 新規 3 テストが fail（`identifyUser` / `resetAnalytics` が呼ばれない）。

- [ ] **Step 4: `AuthContext.tsx` を修正**

`frontend/src/contexts/AuthContext.tsx` の `useEffect` と `logout` の近辺を以下のように変更：

- 既存 `useEffect(() => { authApi.getCurrentUser()... }, [])` はそのまま残す。
- 新規 `useEffect` を追加して `user` 変化を監視し、`identifyUser` / `resetAnalytics` を呼ぶ。
- ただし初期ロード中（`isLoading === true` かつ `user === null`）の reset は無駄なので、`isLoading` が false のタイミングで判定する。

差分:

```tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { authApi, ApiError } from '../lib/api'
import type { User } from '../lib/types'
import { AuthContext } from './authContextValue'
import { identifyUser, resetAnalytics } from '../lib/analytics/posthog'

// 省略...

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  // identify が1度発火したかを記録する（同じユーザーで何度も identify しないように）
  const lastIdentifiedIdRef = useRef<number | null>(null)

  // 初回ロード時にセッション確認
  useEffect(() => {
    authApi
      .getCurrentUser()
      .then((data) => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false))
  }, [])

  // user state の変化に応じて PostHog の identify / reset を発火
  useEffect(() => {
    if (isLoading) return
    if (user) {
      if (lastIdentifiedIdRef.current === user.id) return
      lastIdentifiedIdRef.current = user.id
      identifyUser({
        id: user.id,
        // provider が 'google_oauth2' ならば 'google'、それ以外は 'email' に寄せる
        signup_method: user.provider === 'google_oauth2' ? 'google' : 'email',
        signup_date: user.created_at,
      })
    } else if (lastIdentifiedIdRef.current !== null) {
      // 直前に identify していたユーザーがログアウトした場合のみ reset する
      lastIdentifiedIdRef.current = null
      resetAnalytics()
    }
  }, [user, isLoading])

  // 以降は既存コードのまま
```

> **注意:** `User` 型の `provider` 値が 'google_oauth2' で来るか 'google' で来るかは `lib/types.ts` 実装依存。実装時に確認し、テストの `provider` 値と一致させること。

- [ ] **Step 5: テストを実行して PASS を確認**

```bash
cd frontend && npm run test -- src/contexts/AuthContext.test.tsx
```

Expected: 全テスト PASS。

- [ ] **Step 6: 型チェック + lint**

```bash
cd frontend && npm run typecheck && npm run lint -- src/contexts/
```

Expected: エラーなし。

- [ ] **Step 7: コミット**

```bash
git add frontend/src/contexts/AuthContext.tsx frontend/src/contexts/AuthContext.test.tsx
git commit -m "feat(analytics): AuthContext で identify/reset を自動発火"
```

---

## Task 8: `SignUpPage` で `signup_completed` 発火 — テスト先行

**Files:**
- Modify: `frontend/src/pages/SignUpPage/SignUpPage.test.tsx`
- Modify: `frontend/src/pages/SignUpPage/SignUpPage.tsx`

- [ ] **Step 1: 既存の SignUpPage.test.tsx を確認**

```bash
cd frontend && head -60 src/pages/SignUpPage/SignUpPage.test.tsx
```

既存テストパターンを踏襲する。

- [ ] **Step 2: mock と失敗テストを追加**

`SignUpPage.test.tsx` に以下を追加:

```ts
vi.mock('../../lib/analytics/posthog', () => ({
  captureEvent: vi.fn(),
  identifyUser: vi.fn(),
  resetAnalytics: vi.fn(),
}))

import { captureEvent } from '../../lib/analytics/posthog'
```

新しい it ケースを追加:

```tsx
it('登録成功時に signup_completed イベントを method=email で発火する', async () => {
  // 既存の signup 成功パターンのテストと同じセットアップを行う
  // （authApi.signup のモック、navigate モック等）
  const user = userEvent.setup()
  // ... 既存の描画 + 入力ロジックと同じ
  // 例: フォームに値を入力して submit
  await user.click(screen.getByRole('button', { name: /アカウントを作成/ }))

  await waitFor(() => {
    expect(captureEvent).toHaveBeenCalledWith('signup_completed', { method: 'email' })
  })
})
```

> **注意:** 既存の成功パターンのテストをコピー&調整してよい。セットアップの詳細は既存テストを参考にする。

- [ ] **Step 3: テストを実行して失敗を確認**

```bash
cd frontend && npm run test -- src/pages/SignUpPage/SignUpPage.test.tsx
```

Expected: 新規テストが fail。

- [ ] **Step 4: `SignUpPage.tsx` を修正**

`SignUpPage.tsx` の `handleSubmit` 内を変更:

```tsx
import { captureEvent } from '../../lib/analytics/posthog'
import { ANALYTICS_EVENTS } from '../../lib/analytics/events'

// ...

const handleSubmit = async (e: FormEvent) => {
  e.preventDefault()
  setError('')

  if (password !== passwordConfirmation) {
    setError('パスワードが一致しません')
    return
  }

  setIsSubmitting(true)

  try {
    await signup(username, email, password, passwordConfirmation)
    // 登録完了イベント発火（method: email）
    captureEvent(ANALYTICS_EVENTS.SIGNUP_COMPLETED, { method: 'email' })
    navigate('/dashboard')
  } catch (err) {
    if (err instanceof ApiError) {
      setError(err.message)
    } else {
      setError('登録に失敗しました')
    }
  } finally {
    setIsSubmitting(false)
  }
}
```

- [ ] **Step 5: テストを実行して PASS を確認**

```bash
cd frontend && npm run test -- src/pages/SignUpPage/SignUpPage.test.tsx
```

Expected: 全テスト PASS。

- [ ] **Step 6: コミット**

```bash
git add frontend/src/pages/SignUpPage/
git commit -m "feat(analytics): SignUpPage で signup_completed を発火（method=email）"
```

---

## Task 9: `OauthUsernamePage` で `signup_completed` 発火 — テスト先行

**Files:**
- Modify or Create: `frontend/src/pages/OauthUsernamePage/OauthUsernamePage.test.tsx`
- Modify: `frontend/src/pages/OauthUsernamePage/OauthUsernamePage.tsx`

- [ ] **Step 1: 既存テストの有無を確認**

```bash
cd frontend && ls src/pages/OauthUsernamePage/
```

`OauthUsernamePage.test.tsx` が存在するか確認する。無ければ新規作成。

- [ ] **Step 2a: 既存テストがあればそこに mock とケースを追加**

既存ファイルに mock 追加:

```ts
vi.mock('../../lib/analytics/posthog', () => ({
  captureEvent: vi.fn(),
}))
import { captureEvent } from '../../lib/analytics/posthog'
```

新規 it ケースを追加:

```tsx
it('登録完了時に signup_completed イベントを method=google で発火する', async () => {
  // 既存の成功ケースと同じセットアップ（oauthApi.completeRegistration を成功レスポンスでモック）
  const user = userEvent.setup()
  // ... フォーム入力して submit
  await user.click(screen.getByRole('button', { name: /登録する/ }))

  await waitFor(() => {
    expect(captureEvent).toHaveBeenCalledWith('signup_completed', { method: 'google' })
  })
})
```

- [ ] **Step 2b: 既存テストが無い場合は最小限のテストファイルを新規作成**

`frontend/src/pages/OauthUsernamePage/OauthUsernamePage.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../lib/api', () => ({
  oauthApi: {
    completeRegistration: vi.fn(),
  },
  ApiError: class extends Error {
    constructor(
      message: string,
      public status: number,
    ) {
      super(message)
    }
  },
}))

vi.mock('../../contexts/useAuth', () => ({
  useAuth: () => ({
    setUser: vi.fn(),
  }),
}))

const navigateMock = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

vi.mock('../../lib/analytics/posthog', () => ({
  captureEvent: vi.fn(),
}))

import { oauthApi } from '../../lib/api'
import { captureEvent } from '../../lib/analytics/posthog'
import { OauthUsernamePage } from './OauthUsernamePage'

describe('OauthUsernamePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('登録完了時に signup_completed イベントを method=google で発火する', async () => {
    vi.mocked(oauthApi.completeRegistration).mockResolvedValue({
      user: {
        id: 1,
        username: 'alice',
        email: 'alice@example.com',
        email_missing: false,
        provider: 'google_oauth2',
        created_at: '2026-04-13T00:00:00Z',
      },
    } as Awaited<ReturnType<typeof oauthApi.completeRegistration>>)

    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <OauthUsernamePage />
      </MemoryRouter>,
    )

    await user.type(screen.getByLabelText(/ユーザー名/), 'alice')
    await user.click(screen.getByRole('button', { name: /登録する/ }))

    await waitFor(() => {
      expect(captureEvent).toHaveBeenCalledWith('signup_completed', { method: 'google' })
    })
  })
})
```

- [ ] **Step 3: テストを実行して失敗を確認**

```bash
cd frontend && npm run test -- src/pages/OauthUsernamePage/OauthUsernamePage.test.tsx
```

Expected: 新規テストが fail。

- [ ] **Step 4: `OauthUsernamePage.tsx` を修正**

`handleSubmit` を以下のように変更:

```tsx
import { captureEvent } from '../../lib/analytics/posthog'
import { ANALYTICS_EVENTS } from '../../lib/analytics/events'

// ...

const handleSubmit = async (e: FormEvent) => {
  e.preventDefault()
  setError('')
  setIsSubmitting(true)

  try {
    const response = await oauthApi.completeRegistration(username)
    setUser(response.user)
    // OAuth 新規登録完了イベント発火
    captureEvent(ANALYTICS_EVENTS.SIGNUP_COMPLETED, { method: 'google' })

    if (response.user.email_missing) {
      navigate('/auth/email-setup', { replace: true })
    } else {
      navigate('/dashboard', { replace: true })
    }
  } catch (err) {
    if (err instanceof ApiError) {
      setError(err.message)
    } else {
      setError('登録に失敗しました')
    }
  } finally {
    setIsSubmitting(false)
  }
}
```

- [ ] **Step 5: テストを実行して PASS を確認**

```bash
cd frontend && npm run test -- src/pages/OauthUsernamePage/OauthUsernamePage.test.tsx
```

Expected: 全テスト PASS。

- [ ] **Step 6: コミット**

```bash
git add frontend/src/pages/OauthUsernamePage/
git commit -m "feat(analytics): OauthUsernamePage で signup_completed を発火（method=google）"
```

---

## Task 10: `SearchPage` で `record_created` 発火 — テスト先行

**Files:**
- Modify: `frontend/src/pages/SearchPage/SearchPage.test.tsx`
- Modify: `frontend/src/pages/SearchPage/SearchPage.tsx`

- [ ] **Step 1: 既存の SearchPage.test.tsx を確認**

```bash
cd frontend && grep -n "recordsApi.create\|handleConfirmRecord\|describe\|it(" src/pages/SearchPage/SearchPage.test.tsx | head -40
```

既存の記録作成成功ケースのセットアップを把握する。

- [ ] **Step 2: mock とテストケース追加**

`SearchPage.test.tsx`:

```ts
vi.mock('../../lib/analytics/posthog', () => ({
  captureEvent: vi.fn(),
}))
import { captureEvent } from '../../lib/analytics/posthog'
```

新規 it ケース追加（既存の「検索結果から記録を作成する」テストのすぐ近く）:

```tsx
it('検索結果から記録を作成したら record_created を media_type 付きで発火する', async () => {
  // 既存の成功ケースのセットアップを流用（recordsApi.createFromSearchResult のモック等）
  // 検索 → モーダル → 記録確定 まで実行
  await waitFor(() => {
    expect(captureEvent).toHaveBeenCalledWith('record_created', { media_type: 'anime' })
  })
})
```

> **注意:** 既存テストが media_type='anime' の作品を使っているかを確認し、値を合わせる。

- [ ] **Step 3: テストを実行して失敗を確認**

```bash
cd frontend && npm run test -- src/pages/SearchPage/SearchPage.test.tsx
```

Expected: 新規テストが fail。

- [ ] **Step 4: `SearchPage.tsx` の `handleConfirmRecord` を修正**

```tsx
import { captureEvent } from '../../lib/analytics/posthog'
import { ANALYTICS_EVENTS } from '../../lib/analytics/events'

// ...

const handleConfirmRecord = async (data: { status: RecordStatus; rating: number | null }) => {
  if (!modalWork) return

  try {
    if (manualWorkId) {
      // 手動登録作品: work_idで直接Record作成
      setLoadingId('manual')
      await recordsApi.createFromWorkId(manualWorkId, data)
      captureEvent(ANALYTICS_EVENTS.RECORD_CREATED, {
        media_type: modalWork.media_type,
      })
      setManualWorkId(null)
    } else {
      // 検索結果作品: 既存のフロー
      const workKey = `${modalWork.external_api_source}:${modalWork.external_api_id}`
      setLoadingId(workKey)
      await recordsApi.createFromSearchResult(modalWork, data)
      captureEvent(ANALYTICS_EVENTS.RECORD_CREATED, {
        media_type: modalWork.media_type,
      })
      setRecordedIds((prev) => new Set(prev).add(workKey))
    }
    setModalWork(null)
  } catch (err) {
    // エラー時は capture しない（成功時のみ計測）
    if (err instanceof ApiError) {
      setError(err.message)
      if (err.status === 409 && modalWork) {
        const workKey = `${modalWork.external_api_source}:${modalWork.external_api_id}`
        setRecordedIds((prev) => new Set(prev).add(workKey))
        setModalWork(null)
      }
    }
  } finally {
    setLoadingId(null)
  }
}
```

> **型の注意:** `modalWork.media_type` が spec の union 型 (`'anime' | 'movie' | ...`) と一致することを確認する。`SearchResult.media_type` が同じ union なら型エラーは出ない。異なる場合は `as` で明示キャストする。

- [ ] **Step 5: テストを実行して PASS を確認**

```bash
cd frontend && npm run test -- src/pages/SearchPage/SearchPage.test.tsx
```

Expected: 全テスト PASS。

- [ ] **Step 6: 型チェック**

```bash
cd frontend && npm run typecheck
```

Expected: エラーなし。

- [ ] **Step 7: コミット**

```bash
git add frontend/src/pages/SearchPage/
git commit -m "feat(analytics): SearchPage で record_created を発火"
```

---

## Task 11: `RecommendationsPage` で `record_created` 発火 — テスト先行

**Files:**
- Modify or Create: `frontend/src/pages/RecommendationsPage/RecommendationsPage.test.tsx`
- Modify: `frontend/src/pages/RecommendationsPage/RecommendationsPage.tsx`

- [ ] **Step 1: 既存テストを確認**

```bash
cd frontend && ls src/pages/RecommendationsPage/
```

- [ ] **Step 2: mock とテストを追加（既存ファイルがあれば追記、無ければ新規作成）**

既存ファイルがあれば以下 mock を追加:

```ts
vi.mock('../../lib/analytics/posthog', () => ({
  captureEvent: vi.fn(),
}))
import { captureEvent } from '../../lib/analytics/posthog'
```

新規 it ケース:

```tsx
it('レコメンドから記録を作成したら record_created を media_type 付きで発火する', async () => {
  // recommend された作品の media_type を含んだ mock を用意
  // 記録確定フローを実行
  await waitFor(() => {
    expect(captureEvent).toHaveBeenCalledWith('record_created', { media_type: 'anime' })
  })
})
```

既存テストが無ければ、SearchPage のテスト構造を参考に最小限のテストファイルを作成する。

- [ ] **Step 3: テストを実行して失敗を確認**

```bash
cd frontend && npm run test -- src/pages/RecommendationsPage/RecommendationsPage.test.tsx
```

Expected: 新規テストが fail。

- [ ] **Step 4: `RecommendationsPage.tsx` の `handleConfirmRecord` を修正**

```tsx
import { captureEvent } from '../../lib/analytics/posthog'
import { ANALYTICS_EVENTS } from '../../lib/analytics/events'

// ...

const handleConfirmRecord = async (recordData: {
  status: RecordStatus
  rating: number | null
}) => {
  if (!modalWork) return

  const workKey = `${modalWork.external_api_source}:${modalWork.external_api_id}`
  setRecordingId(workKey)

  try {
    await recordsApi.createFromSearchResult(
      {
        title: modalWork.title,
        media_type: modalWork.media_type as MediaType,
        description: modalWork.description,
        cover_image_url: modalWork.cover_url,
        total_episodes: null,
        external_api_id: modalWork.external_api_id,
        external_api_source: modalWork.external_api_source,
        metadata: modalWork.metadata,
      },
      recordData,
    )
    captureEvent(ANALYTICS_EVENTS.RECORD_CREATED, {
      media_type: modalWork.media_type as MediaType,
    })
    setRecordedIds((prev) => new Set(prev).add(workKey))
    setModalWork(null)
  } catch {
    // エラーハンドリングはRecordModal側で表示
  } finally {
    setRecordingId(null)
  }
}
```

- [ ] **Step 5: テストを実行して PASS を確認**

```bash
cd frontend && npm run test -- src/pages/RecommendationsPage/RecommendationsPage.test.tsx
```

Expected: 全テスト PASS。

- [ ] **Step 6: コミット**

```bash
git add frontend/src/pages/RecommendationsPage/
git commit -m "feat(analytics): RecommendationsPage で record_created を発火"
```

---

## Task 12: プライバシーポリシーページ — テスト先行

**Files:**
- Create: `frontend/src/pages/PrivacyPage/PrivacyPage.test.tsx`
- Create: `frontend/src/pages/PrivacyPage/PrivacyPage.tsx`
- Create: `frontend/src/pages/PrivacyPage/PrivacyPage.module.css`

- [ ] **Step 1: テストを作成**

`frontend/src/pages/PrivacyPage/PrivacyPage.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { PrivacyPage } from './PrivacyPage'

describe('PrivacyPage', () => {
  it('タイトルが表示される', () => {
    render(
      <MemoryRouter>
        <PrivacyPage />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { name: /プライバシーポリシー/ })).toBeInTheDocument()
  })

  it('PostHog を使用していることを明記している', () => {
    render(
      <MemoryRouter>
        <PrivacyPage />
      </MemoryRouter>,
    )
    expect(screen.getByText(/PostHog/)).toBeInTheDocument()
  })

  it('PII を送信しない方針を明記している', () => {
    render(
      <MemoryRouter>
        <PrivacyPage />
      </MemoryRouter>,
    )
    expect(screen.getByText(/感想本文|パスワード|メールアドレス/)).toBeInTheDocument()
  })

  it('opt-out の方法について言及している', () => {
    render(
      <MemoryRouter>
        <PrivacyPage />
      </MemoryRouter>,
    )
    expect(screen.getByText(/計測を拒否|opt-out|オプトアウト/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: テストを実行して失敗を確認**

```bash
cd frontend && npm run test -- src/pages/PrivacyPage/PrivacyPage.test.tsx
```

Expected: `Cannot find module './PrivacyPage'`。

- [ ] **Step 3: ページ本体を実装**

`frontend/src/pages/PrivacyPage/PrivacyPage.tsx`:

```tsx
import { Typography } from '../../components/ui/Typography/Typography'
import { Divider } from '../../components/ui/Divider/Divider'
import styles from './PrivacyPage.module.css'

/**
 * プライバシーポリシーページ (/privacy)
 * Cookie 同意バナーは実装しない方針のため、計測内容をこのページで明示する。
 * Spec: docs/superpowers/specs/2026-04-13-analytics-tracking-design.md 4 節
 */
export function PrivacyPage() {
  return (
    <div className={styles.page}>
      <div className={styles.content}>
        <Typography variant="h1">プライバシーポリシー</Typography>
        <Divider />

        <section className={styles.section}>
          <Typography variant="h2">1. 取得する情報</Typography>
          <p>
            Recolly（以下「本サービス」）では、サービスの改善と利用状況の把握のため、
            以下の情報を自動的に取得します。
          </p>
          <ul>
            <li>ページの閲覧履歴（どの画面を開いたか）</li>
            <li>操作イベント（新規登録、記録作成など）</li>
            <li>ログイン状態（ログイン中のユーザー内部 ID）</li>
            <li>アクセスしたブラウザ・デバイス情報</li>
          </ul>
        </section>

        <section className={styles.section}>
          <Typography variant="h2">2. 利用する解析ツール</Typography>
          <p>
            本サービスは解析ツールとして <strong>PostHog</strong> を利用しています。
            PostHog は世界中で利用されているプロダクト分析ツールで、
            本サービスの改善のためにイベントデータを収集します。
          </p>
        </section>

        <section className={styles.section}>
          <Typography variant="h2">3. 送信しない情報（匿名性の担保）</Typography>
          <p>以下の情報は PostHog に送信しません:</p>
          <ul>
            <li>メールアドレス</li>
            <li>パスワード</li>
            <li>作品の感想本文</li>
            <li>掲示板のコメント本文</li>
            <li>プロフィールの自己紹介文</li>
          </ul>
        </section>

        <section className={styles.section}>
          <Typography variant="h2">4. 計測を拒否する方法（オプトアウト）</Typography>
          <p>
            計測を拒否したい場合は、ブラウザのプライバシー設定で Cookie / localStorage を
            拒否することで PostHog のトラッキングを無効化できます。
            本サービスは計測を無効化していても基本機能をご利用いただけます。
          </p>
        </section>

        <section className={styles.section}>
          <Typography variant="h2">5. 利用目的</Typography>
          <ul>
            <li>サービスの利用状況を把握し、機能改善に活用するため</li>
            <li>ユーザーの継続率・離脱ポイントを分析し、体験を改善するため</li>
            <li>不具合の発見と修正のため</li>
          </ul>
        </section>

        <section className={styles.section}>
          <Typography variant="h2">6. お問い合わせ</Typography>
          <p>
            本ポリシーに関するお問い合わせは、本サービスの GitHub リポジトリ経由で受け付けています。
          </p>
        </section>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: CSS を作成**

`frontend/src/pages/PrivacyPage/PrivacyPage.module.css`:

```css
.page {
  min-height: 100%;
  padding: var(--spacing-xl) var(--spacing-md);
}

.content {
  max-width: 720px;
  margin: 0 auto;
  color: var(--color-text);
}

.section {
  margin-top: var(--spacing-xl);
}

.section p {
  margin: var(--spacing-md) 0;
  line-height: 1.8;
}

.section ul {
  margin: var(--spacing-md) 0;
  padding-left: var(--spacing-lg);
  line-height: 1.8;
}
```

- [ ] **Step 5: テスト実行して PASS を確認**

```bash
cd frontend && npm run test -- src/pages/PrivacyPage/PrivacyPage.test.tsx
```

Expected: 全テスト PASS。

- [ ] **Step 6: コミット**

```bash
git add frontend/src/pages/PrivacyPage/
git commit -m "feat(analytics): プライバシーポリシーページ /privacy を追加"
```

---

## Task 13: `App.tsx` に `/privacy` ルートを追加

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: lazy import と Route を追加**

`frontend/src/App.tsx` の lazy import 一覧に追加:

```tsx
const PrivacyPage = lazy(() =>
  import('./pages/PrivacyPage/PrivacyPage').then((m) => ({ default: m.PrivacyPage })),
)
```

`<Routes>` 内の適切な位置（非認証でアクセス可能な `/login` の近く）に追加:

```tsx
<Route
  path="/privacy"
  element={
    <OptionalAuthLayout>
      <PrivacyPage />
    </OptionalAuthLayout>
  }
/>
```

- [ ] **Step 2: 型チェック + lint**

```bash
cd frontend && npm run typecheck && npm run lint
```

Expected: エラーなし。

- [ ] **Step 3: 全テスト実行**

```bash
cd frontend && npm run test
```

Expected: 全テスト PASS。

- [ ] **Step 4: コミット**

```bash
git add frontend/src/App.tsx
git commit -m "feat(analytics): /privacy ルートを App.tsx に追加"
```

---

## Task 14: `Footer` コンポーネント — テスト先行

**Files:**
- Create: `frontend/src/components/ui/Footer/Footer.test.tsx`
- Create: `frontend/src/components/ui/Footer/Footer.tsx`
- Create: `frontend/src/components/ui/Footer/Footer.module.css`

- [ ] **Step 1: テスト作成**

`frontend/src/components/ui/Footer/Footer.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { Footer } from './Footer'

describe('Footer', () => {
  it('プライバシーポリシーへのリンクを含む', () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>,
    )
    const link = screen.getByRole('link', { name: /プライバシーポリシー/ })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/privacy')
  })

  it('Recolly のブランド表記を含む', () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>,
    )
    expect(screen.getByText(/Recolly/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: テストが fail することを確認**

```bash
cd frontend && npm run test -- src/components/ui/Footer/Footer.test.tsx
```

Expected: `Cannot find module './Footer'`。

- [ ] **Step 3: コンポーネント本体を実装**

`frontend/src/components/ui/Footer/Footer.tsx`:

```tsx
import { Link } from 'react-router-dom'
import styles from './Footer.module.css'

/**
 * 全ページ共通のフッター。
 * プライバシーポリシーへの導線を常に露出するために配置する。
 */
export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <span className={styles.brand}>© Recolly</span>
        <nav className={styles.nav}>
          <Link to="/privacy" className={styles.link}>
            プライバシーポリシー
          </Link>
        </nav>
      </div>
    </footer>
  )
}
```

- [ ] **Step 4: CSS を作成**

`frontend/src/components/ui/Footer/Footer.module.css`:

```css
.footer {
  border-top: 1px solid var(--color-border);
  background: var(--color-bg-white);
  padding: var(--spacing-md) var(--spacing-lg);
  margin-top: auto;
}

.inner {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
  font-size: var(--font-size-label);
  color: var(--color-text-muted);
}

.brand {
  font-weight: var(--font-weight-medium);
}

.nav {
  display: flex;
  gap: var(--spacing-md);
}

.link {
  color: var(--color-text-muted);
  text-decoration: none;
  transition: var(--transition-base);
}

.link:hover {
  color: var(--color-text);
  text-decoration: underline;
}
```

> **注意:** 使用している CSS 変数（`--color-border`, `--color-bg-white`, `--color-text-muted`, `--font-size-label`, `--font-weight-medium`, `--transition-base` 等）は `frontend/src/styles/tokens.css` で定義済みのものだけ使う。無い場合は tokens.css に追加する。

- [ ] **Step 5: 使用しているトークンが tokens.css に存在するか確認**

```bash
cd frontend && grep -E "color-border|color-bg-white|color-text-muted|font-size-label|font-weight-medium|transition-base" src/styles/tokens.css
```

Expected: 全て定義済み。無いものがあれば tokens.css に追加する。

- [ ] **Step 6: テストが PASS することを確認**

```bash
cd frontend && npm run test -- src/components/ui/Footer/Footer.test.tsx
```

Expected: 全テスト PASS。

- [ ] **Step 7: コミット**

```bash
git add frontend/src/components/ui/Footer/
git commit -m "feat(analytics): Footer コンポーネントにプライバシーポリシーリンクを追加"
```

---

## Task 15: `Footer` を全レイアウトに組み込む

**Files:**
- Modify: `frontend/src/App.tsx`（`AuthenticatedLayout` / `OptionalAuthLayout` 内に `<Footer />` を挿入）
- Modify: `frontend/src/App.module.css`（レイアウトを flex にして footer を最下部に固定）

- [ ] **Step 1: `App.tsx` の `AuthenticatedLayout` に Footer を追加**

```tsx
import { Footer } from './components/ui/Footer/Footer'

// ...

function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth()

  if (!user) return <div className={appStyles.loading}>読み込み中...</div>

  return (
    <div className={appStyles.layoutRoot}>
      <NavBar user={user} onLogout={() => void logout()} />
      <div className={appStyles.authenticatedContent}>{children}</div>
      <Footer />
      <BottomTabBar />
    </div>
  )
}
```

- [ ] **Step 2: `OptionalAuthLayout` にも同様に追加**

```tsx
function OptionalAuthLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, logout } = useAuth()

  if (isLoading) return <div className={appStyles.loading}>読み込み中...</div>

  if (user) {
    return (
      <div className={appStyles.layoutRoot}>
        <NavBar user={user} onLogout={() => void logout()} />
        <div className={appStyles.authenticatedContent}>{children}</div>
        <Footer />
        <BottomTabBar />
      </div>
    )
  }

  return (
    <div className={appStyles.layoutRoot}>
      <nav className={appStyles.publicNav}>
        <Link to="/login" className={appStyles.logo}>
          Recolly
        </Link>
        <Link to="/login" className={appStyles.loginLink}>
          ログイン
        </Link>
      </nav>
      <div className={appStyles.authenticatedContent}>{children}</div>
      <Footer />
    </div>
  )
}
```

- [ ] **Step 3: `App.module.css` に `layoutRoot` クラスを追加**

`frontend/src/App.module.css` の末尾に追加:

```css
.layoutRoot {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
}
```

- [ ] **Step 4: 既存の MemoryRouter ベースのページテストが壊れないことを確認**

```bash
cd frontend && npm run test
```

Expected: 既存全テスト PASS。Footer の追加で壊れるテストがあればそれは `AuthenticatedLayout` をモックしていないはず。個別ページのテストはレイアウトを経由しないので基本影響しない。

- [ ] **Step 5: 型チェック + lint**

```bash
cd frontend && npm run typecheck && npm run lint
```

Expected: エラーなし。

- [ ] **Step 6: コミット**

```bash
git add frontend/src/App.tsx frontend/src/App.module.css
git commit -m "feat(analytics): 認証済/オプショナル認証レイアウトに Footer を組み込む"
```

---

## Task 16: 非認証ページ（LoginPage / SignUpPage / PasswordNewPage / PasswordEditPage / OauthUsernamePage / EmailPromptPage）にも Footer を追加

**Files:**
- Modify: 上記 6 ページの JSX

これらは `authForm.module.css` 等の独自レイアウトを使っていて `AuthenticatedLayout` を経由しないため、ページ側で `<Footer />` を挿入する必要がある。

- [ ] **Step 1: 対象ページの現状を把握**

```bash
cd frontend && grep -l "authForm.module" src/pages/
```

Expected: Login / SignUp / PasswordNew / PasswordEdit / OauthUsername ページがヒット。

- [ ] **Step 2: `LoginPage.tsx` に Footer を追加**

```tsx
import { Footer } from '../../components/ui/Footer/Footer'

// return の最外 div を差し替え
return (
  <>
    <div className={styles.page}>
      {/* 既存の中身 */}
    </div>
    <Footer />
  </>
)
```

同様のパターンで `SignUpPage.tsx`, `PasswordNewPage.tsx`, `PasswordEditPage.tsx`, `OauthUsernamePage.tsx`, `EmailPromptPage.tsx` にも `<Footer />` を追加する。

- [ ] **Step 3: `authForm.module.css` の `page` クラスが画面いっぱいを占有していないか確認**

```bash
cd frontend && grep -A 10 "\.page" src/styles/authForm.module.css
```

`page` が `min-height: 100vh` 等で画面いっぱいなら Footer が画面外に押し出される。必要なら `min-height: 100vh` を `min-height: auto` に変え、外側の wrapper で flex にする。

- [ ] **Step 4: 該当ページのテストが壊れていないことを確認**

```bash
cd frontend && npm run test -- src/pages/LoginPage src/pages/SignUpPage src/pages/PasswordNewPage src/pages/PasswordEditPage src/pages/OauthUsernamePage src/pages/EmailPromptPage
```

Expected: 全 PASS。Footer は Link を使っているので、テスト側で MemoryRouter / BrowserRouter が無いと link が壊れる可能性がある。既存テストが Router を wrap していなければ追加する。

- [ ] **Step 5: lint + 型チェック**

```bash
cd frontend && npm run typecheck && npm run lint
```

Expected: エラーなし。

- [ ] **Step 6: コミット**

```bash
git add frontend/src/pages/LoginPage/ frontend/src/pages/SignUpPage/ frontend/src/pages/PasswordNewPage/ frontend/src/pages/PasswordEditPage/ frontend/src/pages/OauthUsernamePage/ frontend/src/pages/EmailPromptPage/ frontend/src/styles/authForm.module.css
git commit -m "feat(analytics): 非認証ページに Footer を追加"
```

---

## Task 17: 最終全体検証

**Files:** なし（検証のみ）

- [ ] **Step 1: 全体テスト実行**

```bash
cd frontend && npm run test
```

Expected: 全テスト PASS。

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

Expected: ビルド成功。バンドルサイズのログを見て posthog-js が含まれている（+ 約 40KB gzipped）ことを確認。

- [ ] **Step 5: バックエンド（念のため）の lint + test が通ることを確認**

```bash
cd backend && bundle exec rubocop && bundle exec rspec
```

Expected: エラーなし（このタスクは frontend 限定だが、念のため確認）。

- [ ] **Step 6: 完了コミット（検証系で差分が無ければ不要）**

このタスクは検証のみなので基本的に新規コミットは発生しない。差分が出ていたら push 前に確認する。

---

## Task 18: 動作確認

**Files:** なし

- [ ] **Step 1: 動作確認方法をユーザーに確認する**

`recolly-workflow` の Step 5 のゲート。AskUserQuestion で以下を質問:

1. 手動確認（ブラウザ操作手順を案内）
2. Playwright MCP で自動確認

- [ ] **Step 2: 選択された方式で動作確認**

手動の場合: 開発サーバーを起動し、以下のフローをユーザーに実行してもらう。

```bash
cd frontend && npm run dev
```

確認項目:
1. `/login` ページを開き、フッターに「プライバシーポリシー」リンクが表示される
2. リンクをクリックして `/privacy` が開く
3. 新規登録（email）を実行し、PostHog Live events ページで `signup_completed` が届いているか
4. ログイン後にダッシュボードで pageview が届くか
5. 記録を作成して `record_created` + `media_type` が届くか
6. ログアウトして reset が発火するか（PostHog 側で識別が解除される）

Playwright の場合: 同等のフローを自動テストで実行し、ネットワークタブで PostHog へのリクエストを検証する。

- [ ] **Step 3: 不具合があれば該当 Task に戻って修正**

---

## Task 19: PR 作成・レビュー対応・マージ

**Files:** なし（Git 操作のみ）

- [ ] **Step 1: `superpowers:finishing-a-development-branch` スキルを起動**

```text
superpowers:finishing-a-development-branch を発動する
```

スキルの指示に従って push → PR 作成 → 自動レビュー待ち → 対応 → マージ。

- [ ] **Step 2: PR タイトルは Conventional Commits**

例: `feat(analytics): PostHog でプロダクト分析基盤を導入（Phase 1）`

- [ ] **Step 3: PR 本文に Issue #143 をリンク**

`Closes #143` を含める。

- [ ] **Step 4: 自動レビューの指摘に対応（必要なら）**

`recolly-git-rules` スキルの「レビュー対応のフィードバックループ」に従う。

- [ ] **Step 5: マージ判断は IK さん**

IK さんがマージボタンを押す。

---

## Spec Coverage Check

| Spec 要件 | 対応タスク |
|---|---|
| posthog-js 依存追加 (§3.1) | Task 1 |
| 環境変数未設定時の no-op (§3.4) | Task 3 |
| `$pageview` 自動発火 + SPA 対応 (§3.7) | Task 5, 6 |
| `$identify` ログイン成功時発火 (§3.5) | Task 7 |
| `reset` ログアウト時 (§3.5) | Task 7 |
| `signup_completed` email (§3.5) | Task 8 |
| `signup_completed` OAuth (§3.5) | Task 9 |
| `record_created` + `media_type` (§3.5) | Task 10, 11 |
| プライバシーポリシーページ `/privacy` (§4.4) | Task 12, 13 |
| フッターからリンク (§4.4) | Task 14, 15, 16 |
| ユニットテスト (§5.1) | Task 3, 5, 12, 14 |
| 統合テスト (§5.2) | Task 7, 8, 9, 10, 11 |
| 手動検証 (§5.3) | Task 18 |
| 失敗時にも本体動作継続 (§6.2) | Task 3（try/catch） |

---

## Notes / 実装時の注意点

- PostHog の `init` は 1 回だけ呼ぶこと（`main.tsx` で起動時に 1 回）。React StrictMode では `useEffect` が 2 回走るが、`main.tsx` の `initAnalytics` は component の useEffect ではないので影響しない。
- 開発環境で `.env.local` が空のケースを壊さないこと（`initAnalytics` が no-op）。
- `posthog-js` のバージョンは最新を使う。将来的な API 変更には ADR-0041 の影響セクションに追記する形で対応する。
- テストは `vi.mock('posthog-js')` で完全にモック化し、実際のネットワーク通信は発生させない。
- `React.StrictMode` の 2 重マウントで `capturePageview` が 2 回呼ばれる可能性があるが、これは開発環境限定なので本番には影響しない。気になる場合は初回マウントフラグで抑制する。
