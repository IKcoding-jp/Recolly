# ホーム画面修正 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** HomePageをPR #53以前の「はじめましょう」画面 + 進行中リスト表示に修正し、MyPageを統計のみにする

**Architecture:** HomePageで `useDashboard` を使い、進行中レコードの有無で `DashboardEmptyState` か `WatchingListItem` リストを出し分ける。MyPageは `useStatistics` のみ使用する。

**Tech Stack:** React 19, TypeScript, Vitest, React Testing Library

---

### Task 1: HomePageのテストを作成

**Files:**
- Create: `frontend/src/pages/HomePage/HomePage.test.tsx`

- [ ] **Step 1: テストファイルを作成**

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HomePage } from './HomePage'

vi.mock('../../contexts/useAuth', () => ({
  useAuth: () => ({
    user: {
      id: 1,
      username: 'testuser',
      email: 'test@example.com',
      avatar_url: null,
      bio: null,
      created_at: '2026-01-01',
      has_password: true,
      providers: [],
      email_missing: false,
    },
  }),
}))

vi.mock('../../lib/recordsApi', () => ({
  recordsApi: { getAll: vi.fn(), update: vi.fn() },
}))

import { recordsApi } from '../../lib/recordsApi'

const mockAnimeRecord = {
  id: 1,
  work_id: 10,
  status: 'watching' as const,
  rating: null,
  current_episode: 12,
  rewatch_count: 0,
  started_at: null,
  completed_at: null,
  created_at: '2026-01-01',
  work: {
    id: 10,
    title: '進撃の巨人',
    media_type: 'anime' as const,
    description: null,
    cover_image_url: null,
    total_episodes: 25,
    external_api_id: null,
    external_api_source: null,
    metadata: {},
    created_at: '2026-01-01',
  },
}

describe('HomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('進行中の記録があれば作品リストを表示する', async () => {
    vi.mocked(recordsApi.getAll).mockResolvedValue({ records: [mockAnimeRecord] })
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )
    await waitFor(() => {
      expect(screen.getByText('進撃の巨人')).toBeInTheDocument()
    })
    expect(screen.getByText('進行中')).toBeInTheDocument()
    expect(screen.getByText('12 / 25話')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+1話' })).toBeInTheDocument()
  })

  it('記録が0件のとき「はじめましょう」を表示する', async () => {
    vi.mocked(recordsApi.getAll).mockResolvedValue({ records: [] })
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )
    await waitFor(() => {
      expect(screen.getByText('はじめましょう')).toBeInTheDocument()
    })
    expect(screen.getByRole('link', { name: '作品を探す' })).toBeInTheDocument()
  })

  it('+1話ボタンで進捗が更新される', async () => {
    const user = userEvent.setup()
    vi.mocked(recordsApi.getAll).mockResolvedValue({ records: [mockAnimeRecord] })
    vi.mocked(recordsApi.update).mockResolvedValue({
      record: { ...mockAnimeRecord, current_episode: 13 },
    })
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )
    await waitFor(() => {
      expect(screen.getByText('進撃の巨人')).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: '+1話' }))
    expect(recordsApi.update).toHaveBeenCalledWith(1, { current_episode: 13 })
  })

  it('エラー時にエラーメッセージを表示する', async () => {
    vi.mocked(recordsApi.getAll).mockRejectedValue(new Error('fail'))
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )
    await waitFor(() => {
      expect(screen.getByText('記録の取得に失敗しました')).toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `cd D:/Dev/recolly && docker compose exec frontend npx vitest run src/pages/HomePage/HomePage.test.tsx`
Expected: FAIL（現在のHomePageには `useDashboard` や `DashboardEmptyState` がないため）

---

### Task 2: HomePageを書き換え

**Files:**
- Modify: `frontend/src/pages/HomePage/HomePage.tsx`
- Modify: `frontend/src/pages/HomePage/HomePage.module.css`

- [ ] **Step 1: HomePage.tsx を書き換え**

PR #53の内容（greeting + QUICK_ACTIONS + cards）を全て削除し、以下に置き換える:

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
      {!isLoading && records.length > 0 && (
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

- [ ] **Step 2: HomePage.module.css を書き換え**

PR #53のスタイル（greeting, cards, card, cardLabel, cardDescription）を全て削除し、以下に置き換える:

```css
.container {
  max-width: 800px;
  margin: var(--spacing-xl) auto;
  padding: 0 var(--spacing-xl);
}

.list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.loading {
  text-align: center;
  padding: var(--spacing-xl);
  color: var(--color-text-muted);
}

.error {
  text-align: center;
  padding: var(--spacing-md);
  color: var(--color-error);
  font-size: var(--font-size-body);
}

@media (max-width: 768px) {
  .container {
    max-width: 100%;
    padding: 0 var(--spacing-md);
    margin: var(--spacing-md) auto;
  }
}
```

- [ ] **Step 3: HomePageのテストがパスすることを確認**

Run: `cd D:/Dev/recolly && docker compose exec frontend npx vitest run src/pages/HomePage/HomePage.test.tsx`
Expected: PASS（4テスト全てパス）

- [ ] **Step 4: コミット**

```bash
git add frontend/src/pages/HomePage/HomePage.test.tsx frontend/src/pages/HomePage/HomePage.tsx frontend/src/pages/HomePage/HomePage.module.css
git commit -m "fix: HomePageをPR#53以前の「はじめましょう」+進行中リスト表示に修正"
```

---

### Task 3: MyPageを統計のみに修正

**Files:**
- Modify: `frontend/src/pages/MyPage/MyPage.tsx`
- Modify: `frontend/src/pages/MyPage/MyPage.test.tsx`
- Modify: `frontend/src/pages/MyPage/MyPage.module.css`

- [ ] **Step 1: MyPage.test.tsx を統計のみのテストに書き換え**

進行中リスト・空状態・+1話ボタン・エラーのテストを削除し、統計表示のテストのみ残す:

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MyPage } from './MyPage'

vi.mock('../../contexts/useAuth', () => ({
  useAuth: () => ({
    user: {
      id: 1,
      username: 'testuser',
      email: 'test@example.com',
      avatar_url: null,
      bio: null,
      created_at: '2026-01-01',
      has_password: true,
      providers: [],
      email_missing: false,
    },
  }),
}))

vi.mock('../../lib/statisticsApi', () => ({
  statisticsApi: {
    get: vi.fn().mockResolvedValue({
      by_genre: { anime: 3, movie: 1, drama: 0, book: 2, manga: 0, game: 0 },
      by_status: { watching: 2, completed: 3, on_hold: 1, dropped: 0, plan_to_watch: 0 },
      monthly_completions: [],
      totals: { episodes_watched: 48, volumes_read: 5 },
    }),
  },
}))

describe('MyPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('マイページのタイトルを表示する', async () => {
    render(
      <MemoryRouter>
        <MyPage />
      </MemoryRouter>,
    )
    await waitFor(() => {
      expect(screen.getByText('マイページ')).toBeInTheDocument()
    })
  })

  it('統計情報を表示する', async () => {
    render(
      <MemoryRouter>
        <MyPage />
      </MemoryRouter>,
    )
    await waitFor(() => {
      expect(screen.getByText('マイページ')).toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `cd D:/Dev/recolly && docker compose exec frontend npx vitest run src/pages/MyPage/MyPage.test.tsx`
Expected: FAIL（現在のMyPageが `recordsApi` をモックなしで呼ぶため）

- [ ] **Step 3: MyPage.tsx を統計のみに書き換え**

```tsx
import { SectionTitle } from '../../components/ui/SectionTitle/SectionTitle'
import { EmailPromptBanner } from '../../components/EmailPromptBanner/EmailPromptBanner'
import { StatsSummary } from '../../components/StatsSummary/StatsSummary'
import { useAuth } from '../../contexts/useAuth'
import { useStatistics } from '../../hooks/useStatistics'
import styles from './MyPage.module.css'

export function MyPage() {
  const { user } = useAuth()
  const { statistics, isLoading } = useStatistics()

  return (
    <div className={styles.container}>
      {user?.email_missing && <EmailPromptBanner />}
      <SectionTitle>マイページ</SectionTitle>
      {isLoading && <div className={styles.loading}>読み込み中...</div>}
      {!isLoading && statistics && <StatsSummary statistics={statistics} />}
    </div>
  )
}
```

- [ ] **Step 4: MyPage.module.css から不要なスタイルを削除**

`list` と `error` クラスを削除する（`loading` は残す）:

```css
.container {
  max-width: 800px;
  margin: var(--spacing-xl) auto;
  padding: 0 var(--spacing-xl);
}

.loading {
  text-align: center;
  padding: var(--spacing-xl);
  color: var(--color-text-muted);
}

@media (max-width: 768px) {
  .container {
    max-width: 100%;
    padding: 0 var(--spacing-md);
    margin: var(--spacing-md) auto;
  }
}
```

- [ ] **Step 5: MyPageのテストがパスすることを確認**

Run: `cd D:/Dev/recolly && docker compose exec frontend npx vitest run src/pages/MyPage/MyPage.test.tsx`
Expected: PASS（2テスト全てパス）

- [ ] **Step 6: フロントエンド全体テストを実行**

Run: `cd D:/Dev/recolly && docker compose exec frontend npx vitest run`
Expected: 全テストパス

- [ ] **Step 7: Lint確認**

Run: `cd D:/Dev/recolly && docker compose exec frontend npx prettier --check "src/pages/HomePage/**" "src/pages/MyPage/**" && docker compose exec frontend npx eslint "src/pages/HomePage/**" "src/pages/MyPage/**"`
Expected: エラーなし

- [ ] **Step 8: コミット**

```bash
git add frontend/src/pages/MyPage/MyPage.tsx frontend/src/pages/MyPage/MyPage.test.tsx frontend/src/pages/MyPage/MyPage.module.css
git commit -m "refactor: MyPageを統計情報のみに変更"
```
