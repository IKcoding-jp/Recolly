# ライブラリ レイアウト切り替え機能 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** マイライブラリページにリスト/カード/コンパクトリストの3つのレイアウト切り替え機能を追加し、プロフィールの作品選択モーダルも修正する

**Architecture:** コンポーネント分離型。レイアウトごとに専用の表示コンポーネント（RecordCardItem, RecordCompactItem）を作成し、LibraryPageで切り替える。レイアウト設定はlocalStorageで永続化。バックエンドAPI変更なし

**Tech Stack:** React 19 / TypeScript / CSS Modules / Vitest + React Testing Library

---

## ファイル構成

### 新規作成

| ファイル | 責務 |
|---------|------|
| `frontend/src/hooks/useLayoutPreference.ts` | localStorage からレイアウト設定を読み書き |
| `frontend/src/hooks/useLayoutPreference.test.ts` | useLayoutPreference のテスト |
| `frontend/src/components/ui/LayoutSwitcher/LayoutSwitcher.tsx` | 切り替えボタンUI + 件数表示 |
| `frontend/src/components/ui/LayoutSwitcher/LayoutSwitcher.module.css` | LayoutSwitcher のスタイル |
| `frontend/src/components/ui/LayoutSwitcher/LayoutSwitcher.test.tsx` | LayoutSwitcher のテスト |
| `frontend/src/components/RecordCardItem/RecordCardItem.tsx` | カード表示用コンポーネント |
| `frontend/src/components/RecordCardItem/RecordCardItem.module.css` | カード表示用スタイル |
| `frontend/src/components/RecordCardItem/RecordCardItem.test.tsx` | RecordCardItem のテスト |
| `frontend/src/components/RecordCompactItem/RecordCompactItem.tsx` | コンパクトリスト用コンポーネント |
| `frontend/src/components/RecordCompactItem/RecordCompactItem.module.css` | コンパクトリスト用スタイル |
| `frontend/src/components/RecordCompactItem/RecordCompactItem.test.tsx` | RecordCompactItem のテスト |

### 既存変更

| ファイル | 変更内容 |
|---------|---------|
| `frontend/src/pages/LibraryPage/LibraryPage.tsx` | LayoutSwitcher 統合、レイアウト切り替え描画 |
| `frontend/src/pages/LibraryPage/LibraryPage.module.css` | カード・コンパクト用のコンテンツ幅・グリッドスタイル追加 |
| `frontend/src/pages/LibraryPage/useLibrary.ts` | `totalCount` を return に追加 |
| `frontend/src/components/FavoriteWorkSelector/FavoriteWorkSelector.module.css` | モーダルサイズ拡大・画像サイズ統一 |

---

## Task 1: useLayoutPreference フック

**Files:**
- Create: `frontend/src/hooks/useLayoutPreference.ts`
- Test: `frontend/src/hooks/useLayoutPreference.test.ts`

- [ ] **Step 1: テストファイルを作成**

```typescript
// frontend/src/hooks/useLayoutPreference.test.ts
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { useLayoutPreference } from './useLayoutPreference'

const STORAGE_KEY = 'recolly-library-layout'

describe('useLayoutPreference', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('localStorageに値がないときはlistを返す', () => {
    const { result } = renderHook(() => useLayoutPreference())
    expect(result.current.layout).toBe('list')
  })

  it('localStorageに保存された値を読み込む', () => {
    localStorage.setItem(STORAGE_KEY, 'card')
    const { result } = renderHook(() => useLayoutPreference())
    expect(result.current.layout).toBe('card')
  })

  it('setLayoutでレイアウトを変更しlocalStorageに保存する', () => {
    const { result } = renderHook(() => useLayoutPreference())

    act(() => {
      result.current.setLayout('compact')
    })

    expect(result.current.layout).toBe('compact')
    expect(localStorage.getItem(STORAGE_KEY)).toBe('compact')
  })

  it('不正な値がlocalStorageにある場合はlistにフォールバックする', () => {
    localStorage.setItem(STORAGE_KEY, 'invalid-value')
    const { result } = renderHook(() => useLayoutPreference())
    expect(result.current.layout).toBe('list')
  })
})
```

- [ ] **Step 2: テストを実行して失敗を確認**

```bash
docker compose exec frontend npx vitest run src/hooks/useLayoutPreference.test.ts
```

Expected: FAIL — `useLayoutPreference` が存在しない

- [ ] **Step 3: フックを実装**

```typescript
// frontend/src/hooks/useLayoutPreference.ts
import { useState, useCallback } from 'react'

export type LayoutType = 'list' | 'card' | 'compact'

const STORAGE_KEY = 'recolly-library-layout'
const VALID_LAYOUTS: LayoutType[] = ['list', 'card', 'compact']

function readLayout(): LayoutType {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored && VALID_LAYOUTS.includes(stored as LayoutType)) {
    return stored as LayoutType
  }
  return 'list'
}

export function useLayoutPreference() {
  const [layout, setLayoutState] = useState<LayoutType>(readLayout)

  const setLayout = useCallback((newLayout: LayoutType) => {
    setLayoutState(newLayout)
    localStorage.setItem(STORAGE_KEY, newLayout)
  }, [])

  return { layout, setLayout }
}
```

- [ ] **Step 4: テストを実行して全パスを確認**

```bash
docker compose exec frontend npx vitest run src/hooks/useLayoutPreference.test.ts
```

Expected: 4 tests PASS

- [ ] **Step 5: コミット**

```bash
git add frontend/src/hooks/useLayoutPreference.ts frontend/src/hooks/useLayoutPreference.test.ts
git commit -m "feat: useLayoutPreferenceフックを追加（localStorage永続化）"
```

---

## Task 2: LayoutSwitcher コンポーネント

**Files:**
- Create: `frontend/src/components/ui/LayoutSwitcher/LayoutSwitcher.tsx`
- Create: `frontend/src/components/ui/LayoutSwitcher/LayoutSwitcher.module.css`
- Test: `frontend/src/components/ui/LayoutSwitcher/LayoutSwitcher.test.tsx`

- [ ] **Step 1: テストファイルを作成**

```tsx
// frontend/src/components/ui/LayoutSwitcher/LayoutSwitcher.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { LayoutSwitcher } from './LayoutSwitcher'

describe('LayoutSwitcher', () => {
  it('件数を表示する', () => {
    render(
      <LayoutSwitcher
        currentLayout="list"
        totalCount={12}
        onLayoutChange={vi.fn()}
      />
    )
    expect(screen.getByText('12件の作品')).toBeInTheDocument()
  })

  it('3つのレイアウトボタンを表示する', () => {
    render(
      <LayoutSwitcher
        currentLayout="list"
        totalCount={5}
        onLayoutChange={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: 'リスト表示' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'カード表示' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'コンパクト表示' })).toBeInTheDocument()
  })

  it('選択中のレイアウトボタンにaria-pressed=trueが付く', () => {
    render(
      <LayoutSwitcher
        currentLayout="card"
        totalCount={5}
        onLayoutChange={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: 'リスト表示' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'カード表示' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'コンパクト表示' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('ボタンクリックでonLayoutChangeが呼ばれる', async () => {
    const user = userEvent.setup()
    const onLayoutChange = vi.fn()
    render(
      <LayoutSwitcher
        currentLayout="list"
        totalCount={5}
        onLayoutChange={onLayoutChange}
      />
    )

    await user.click(screen.getByRole('button', { name: 'カード表示' }))
    expect(onLayoutChange).toHaveBeenCalledWith('card')

    await user.click(screen.getByRole('button', { name: 'コンパクト表示' }))
    expect(onLayoutChange).toHaveBeenCalledWith('compact')
  })
})
```

- [ ] **Step 2: テストを実行して失敗を確認**

```bash
docker compose exec frontend npx vitest run src/components/ui/LayoutSwitcher/LayoutSwitcher.test.tsx
```

Expected: FAIL — `LayoutSwitcher` が存在しない

- [ ] **Step 3: コンポーネントを実装**

```tsx
// frontend/src/components/ui/LayoutSwitcher/LayoutSwitcher.tsx
import type { LayoutType } from '../../../hooks/useLayoutPreference'
import styles from './LayoutSwitcher.module.css'

type LayoutSwitcherProps = {
  currentLayout: LayoutType
  totalCount: number
  onLayoutChange: (layout: LayoutType) => void
}

const LAYOUT_OPTIONS: { type: LayoutType; label: string; icon: React.ReactNode }[] = [
  {
    type: 'list',
    label: 'リスト表示',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
        <line x1="1" y1="4" x2="17" y2="4" />
        <line x1="1" y1="9" x2="17" y2="9" />
        <line x1="1" y1="14" x2="17" y2="14" />
      </svg>
    ),
  },
  {
    type: 'card',
    label: 'カード表示',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="1" y="1" width="6" height="7" rx="1" />
        <rect x="11" y="1" width="6" height="7" rx="1" />
        <rect x="1" y="10" width="6" height="7" rx="1" />
        <rect x="11" y="10" width="6" height="7" rx="1" />
      </svg>
    ),
  },
  {
    type: 'compact',
    label: 'コンパクト表示',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
        <line x1="1" y1="3" x2="17" y2="3" />
        <line x1="1" y1="6.5" x2="17" y2="6.5" />
        <line x1="1" y1="10" x2="17" y2="10" />
        <line x1="1" y1="13.5" x2="17" y2="13.5" />
      </svg>
    ),
  },
]

export function LayoutSwitcher({ currentLayout, totalCount, onLayoutChange }: LayoutSwitcherProps) {
  return (
    <div className={styles.toolbar}>
      <span className={styles.count}>{totalCount}件の作品</span>
      <div className={styles.buttons}>
        {LAYOUT_OPTIONS.map(({ type, label, icon }) => (
          <button
            key={type}
            type="button"
            className={`${styles.button} ${currentLayout === type ? styles.active : ''}`}
            aria-label={label}
            aria-pressed={currentLayout === type}
            onClick={() => onLayoutChange(type)}
          >
            {icon}
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: スタイルを作成**

```css
/* frontend/src/components/ui/LayoutSwitcher/LayoutSwitcher.module.css */
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-sm) 0;
  margin-bottom: var(--spacing-md);
  border-bottom: 1px solid var(--color-border-light);
}

.count {
  font-family: var(--font-body);
  font-size: var(--font-size-meta);
  color: var(--color-text-muted);
}

.buttons {
  display: flex;
  gap: 4px;
}

.button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  min-height: 44px;
  min-width: 44px;
  padding: 0;
  border: 1px solid var(--color-border-light);
  border-radius: 6px;
  background: none;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.button:hover {
  border-color: var(--color-text);
  color: var(--color-text);
}

.active {
  background: var(--color-text);
  border-color: var(--color-text);
  color: var(--color-bg-white);
}
```

- [ ] **Step 5: テストを実行して全パスを確認**

```bash
docker compose exec frontend npx vitest run src/components/ui/LayoutSwitcher/LayoutSwitcher.test.tsx
```

Expected: 4 tests PASS

- [ ] **Step 6: コミット**

```bash
git add frontend/src/components/ui/LayoutSwitcher/
git commit -m "feat: LayoutSwitcherコンポーネントを追加"
```

---

## Task 3: RecordCardItem コンポーネント

**Files:**
- Create: `frontend/src/components/RecordCardItem/RecordCardItem.tsx`
- Create: `frontend/src/components/RecordCardItem/RecordCardItem.module.css`
- Test: `frontend/src/components/RecordCardItem/RecordCardItem.test.tsx`

**参照ファイル:**
- `frontend/src/lib/types.ts` — UserRecord, Work 型定義
- `frontend/src/lib/mediaTypeUtils.ts` — getStatusLabel 関数
- `frontend/src/components/RecordListItem/RecordListItem.tsx` — 既存の同種コンポーネント（props 形式を合わせる）

- [ ] **Step 1: テストファイルを作成**

```tsx
// frontend/src/components/RecordCardItem/RecordCardItem.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { RecordCardItem } from './RecordCardItem'
import type { UserRecord } from '../../lib/types'

// テスト用のモックデータ
const baseRecord: UserRecord = {
  id: 1,
  work_id: 10,
  status: 'completed',
  rating: 9,
  current_episode: 72,
  rewatch_count: 0,
  review_text: null,
  visibility: 'public_record',
  started_at: null,
  completed_at: null,
  created_at: '2026-01-01T00:00:00Z',
  work: {
    id: 10,
    title: 'NARUTO -ナルト-',
    media_type: 'manga',
    description: null,
    cover_image_url: 'https://example.com/naruto.jpg',
    total_episodes: 72,
    external_api_id: null,
    external_api_source: null,
    metadata: {},
    last_synced_at: null,
    created_at: '2026-01-01T00:00:00Z',
  },
}

function renderWithRouter(record: UserRecord) {
  return render(
    <MemoryRouter>
      <RecordCardItem record={record} />
    </MemoryRouter>
  )
}

describe('RecordCardItem', () => {
  it('作品タイトルを表示する', () => {
    renderWithRouter(baseRecord)
    expect(screen.getByText('NARUTO -ナルト-')).toBeInTheDocument()
  })

  it('カバー画像を表示する', () => {
    renderWithRouter(baseRecord)
    const img = screen.getByAltText('NARUTO -ナルト-のカバー画像')
    expect(img).toHaveAttribute('src', 'https://example.com/naruto.jpg')
  })

  it('カバー画像がない場合はプレースホルダーを表示する', () => {
    const recordWithoutCover = {
      ...baseRecord,
      work: { ...baseRecord.work, cover_image_url: null },
    }
    const { container } = renderWithRouter(recordWithoutCover)
    expect(container.querySelector('[class*="coverPlaceholder"]')).toBeInTheDocument()
  })

  it('評価を表示する', () => {
    renderWithRouter(baseRecord)
    expect(screen.getByText('9')).toBeInTheDocument()
    expect(screen.getByText('★')).toBeInTheDocument()
  })

  it('評価がnullのときは評価を表示しない', () => {
    const recordWithoutRating = { ...baseRecord, rating: null }
    renderWithRouter(recordWithoutRating)
    expect(screen.queryByText('★')).not.toBeInTheDocument()
  })

  it('ステータスバッジを表示する', () => {
    renderWithRouter(baseRecord)
    // manga + completed = '読了'
    expect(screen.getByText('読了')).toBeInTheDocument()
  })

  it('作品詳細ページへのリンクを生成する', () => {
    renderWithRouter(baseRecord)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/works/10')
  })
})
```

- [ ] **Step 2: テストを実行して失敗を確認**

```bash
docker compose exec frontend npx vitest run src/components/RecordCardItem/RecordCardItem.test.tsx
```

Expected: FAIL — `RecordCardItem` が存在しない

- [ ] **Step 3: コンポーネントを実装**

```tsx
// frontend/src/components/RecordCardItem/RecordCardItem.tsx
import { Link } from 'react-router-dom'
import type { UserRecord } from '../../lib/types'
import { getStatusLabel } from '../../lib/mediaTypeUtils'
import styles from './RecordCardItem.module.css'

type RecordCardItemProps = {
  record: UserRecord
}

export function RecordCardItem({ record }: RecordCardItemProps) {
  const { work } = record

  return (
    <Link to={`/works/${work.id}`} className={styles.card}>
      <div className={styles.coverWrapper}>
        {work.cover_image_url ? (
          <img
            className={styles.cover}
            src={work.cover_image_url}
            alt={`${work.title}のカバー画像`}
          />
        ) : (
          <div className={styles.coverPlaceholder} />
        )}
      </div>
      <div className={styles.info}>
        <h3 className={styles.title}>{work.title}</h3>
        <div className={styles.meta}>
          {record.rating !== null && (
            <span className={styles.rating}>
              <span className={styles.star}>★</span>
              <span>{record.rating}</span>
            </span>
          )}
          <span className={`${styles.badge} ${styles[record.status]}`}>
            {getStatusLabel(record.status, work.media_type)}
          </span>
        </div>
      </div>
    </Link>
  )
}
```

- [ ] **Step 4: スタイルを作成**

```css
/* frontend/src/components/RecordCardItem/RecordCardItem.module.css */
.card {
  display: flex;
  flex-direction: column;
  text-decoration: none;
  color: inherit;
  transition: opacity var(--transition-fast);
}

.card:hover {
  opacity: 0.8;
}

.coverWrapper {
  width: 100%;
  aspect-ratio: 2 / 3;
  border-radius: 4px;
  overflow: hidden;
  background-color: var(--color-border-light);
}

.cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.coverPlaceholder {
  width: 100%;
  height: 100%;
  background-color: var(--color-border-light);
}

.info {
  padding: var(--spacing-xs) 0;
}

.title {
  font-family: var(--font-body);
  font-size: var(--font-size-meta);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
  margin: 0;
  line-height: var(--line-height-tight);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.meta {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  margin-top: 2px;
  font-size: var(--font-size-meta);
}

.rating {
  display: flex;
  align-items: center;
  gap: 2px;
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
}

.star {
  color: var(--color-star, #f59e0b);
}

/* ステータスバッジ（RecordListItemと同じカラーを使用） */
.badge {
  font-size: 9px;
  font-weight: var(--font-weight-medium);
  padding: 0 var(--spacing-xs);
  border-radius: 9999px;
  white-space: nowrap;
}

.watching {
  background-color: var(--color-anime);
  color: var(--color-bg-white);
}

.completed {
  background-color: var(--color-game);
  color: var(--color-bg-white);
}

.on_hold {
  background-color: var(--color-book);
  color: var(--color-bg-white);
}

.dropped {
  background-color: var(--color-error);
  color: var(--color-bg-white);
}

.plan_to_watch {
  background-color: var(--color-border-light);
  color: var(--color-text);
}
```

- [ ] **Step 5: テストを実行して全パスを確認**

```bash
docker compose exec frontend npx vitest run src/components/RecordCardItem/RecordCardItem.test.tsx
```

Expected: 7 tests PASS

- [ ] **Step 6: コミット**

```bash
git add frontend/src/components/RecordCardItem/
git commit -m "feat: RecordCardItemコンポーネントを追加（カード表示用）"
```

---

## Task 4: RecordCompactItem コンポーネント

**Files:**
- Create: `frontend/src/components/RecordCompactItem/RecordCompactItem.tsx`
- Create: `frontend/src/components/RecordCompactItem/RecordCompactItem.module.css`
- Test: `frontend/src/components/RecordCompactItem/RecordCompactItem.test.tsx`

**参照ファイル:**
- `frontend/src/lib/types.ts` — UserRecord 型定義
- `frontend/src/lib/mediaTypeUtils.ts` — getStatusLabel 関数

- [ ] **Step 1: テストファイルを作成**

```tsx
// frontend/src/components/RecordCompactItem/RecordCompactItem.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { RecordCompactItem } from './RecordCompactItem'
import type { UserRecord } from '../../lib/types'

const baseRecord: UserRecord = {
  id: 1,
  work_id: 10,
  status: 'watching',
  rating: 8,
  current_episode: 5,
  rewatch_count: 0,
  review_text: null,
  visibility: 'public_record',
  started_at: null,
  completed_at: null,
  created_at: '2026-01-01T00:00:00Z',
  work: {
    id: 10,
    title: '進撃の巨人',
    media_type: 'anime',
    description: null,
    cover_image_url: null,
    total_episodes: 25,
    external_api_id: null,
    external_api_source: null,
    metadata: {},
    last_synced_at: null,
    created_at: '2026-01-01T00:00:00Z',
  },
}

function renderWithRouter(record: UserRecord) {
  return render(
    <MemoryRouter>
      <RecordCompactItem record={record} />
    </MemoryRouter>
  )
}

describe('RecordCompactItem', () => {
  it('タイトルを表示する', () => {
    renderWithRouter(baseRecord)
    expect(screen.getByText('進撃の巨人')).toBeInTheDocument()
  })

  it('ステータスバッジを表示する', () => {
    renderWithRouter(baseRecord)
    // anime + watching = '視聴中'
    expect(screen.getByText('視聴中')).toBeInTheDocument()
  })

  it('評価を表示する', () => {
    renderWithRouter(baseRecord)
    expect(screen.getByText('★')).toBeInTheDocument()
    expect(screen.getByText('8')).toBeInTheDocument()
  })

  it('評価がnullのときは評価を表示しない', () => {
    const recordWithoutRating = { ...baseRecord, rating: null }
    renderWithRouter(recordWithoutRating)
    expect(screen.queryByText('★')).not.toBeInTheDocument()
  })

  it('作品詳細ページへのリンクを生成する', () => {
    renderWithRouter(baseRecord)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/works/10')
  })
})
```

- [ ] **Step 2: テストを実行して失敗を確認**

```bash
docker compose exec frontend npx vitest run src/components/RecordCompactItem/RecordCompactItem.test.tsx
```

Expected: FAIL — `RecordCompactItem` が存在しない

- [ ] **Step 3: コンポーネントを実装**

```tsx
// frontend/src/components/RecordCompactItem/RecordCompactItem.tsx
import { Link } from 'react-router-dom'
import type { UserRecord } from '../../lib/types'
import { getStatusLabel } from '../../lib/mediaTypeUtils'
import styles from './RecordCompactItem.module.css'

type RecordCompactItemProps = {
  record: UserRecord
}

export function RecordCompactItem({ record }: RecordCompactItemProps) {
  const { work } = record

  return (
    <Link to={`/works/${work.id}`} className={styles.row}>
      <span className={styles.title}>{work.title}</span>
      <span className={styles.right}>
        {record.rating !== null && (
          <span className={styles.rating}>
            <span className={styles.star}>★</span>
            <span>{record.rating}</span>
          </span>
        )}
        <span className={`${styles.badge} ${styles[record.status]}`}>
          {getStatusLabel(record.status, work.media_type)}
        </span>
      </span>
    </Link>
  )
}
```

- [ ] **Step 4: スタイルを作成**

```css
/* frontend/src/components/RecordCompactItem/RecordCompactItem.module.css */
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

.title {
  font-family: var(--font-body);
  font-size: var(--font-size-label);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
  flex: 1;
}

.right {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex-shrink: 0;
}

.rating {
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: var(--font-size-meta);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
}

.star {
  color: var(--color-star, #f59e0b);
}

/* ステータスバッジ（RecordListItemと同じカラー） */
.badge {
  font-size: var(--font-size-meta);
  font-weight: var(--font-weight-medium);
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: 9999px;
  white-space: nowrap;
}

.watching {
  background-color: var(--color-anime);
  color: var(--color-bg-white);
}

.completed {
  background-color: var(--color-game);
  color: var(--color-bg-white);
}

.on_hold {
  background-color: var(--color-book);
  color: var(--color-bg-white);
}

.dropped {
  background-color: var(--color-error);
  color: var(--color-bg-white);
}

.plan_to_watch {
  background-color: var(--color-border-light);
  color: var(--color-text);
}
```

- [ ] **Step 5: テストを実行して全パスを確認**

```bash
docker compose exec frontend npx vitest run src/components/RecordCompactItem/RecordCompactItem.test.tsx
```

Expected: 5 tests PASS

- [ ] **Step 6: コミット**

```bash
git add frontend/src/components/RecordCompactItem/
git commit -m "feat: RecordCompactItemコンポーネントを追加（コンパクトリスト用）"
```

---

## Task 5: LibraryPage にレイアウト切り替えを統合

**Files:**
- Modify: `frontend/src/pages/LibraryPage/LibraryPage.tsx`
- Modify: `frontend/src/pages/LibraryPage/LibraryPage.module.css`
- Modify: `frontend/src/pages/LibraryPage/useLibrary.ts`

**参照ファイル:**
- `frontend/src/hooks/useLayoutPreference.ts` — Task 1 で作成
- `frontend/src/components/ui/LayoutSwitcher/LayoutSwitcher.tsx` — Task 2 で作成
- `frontend/src/components/RecordCardItem/RecordCardItem.tsx` — Task 3 で作成
- `frontend/src/components/RecordCompactItem/RecordCompactItem.tsx` — Task 4 で作成

- [ ] **Step 1: useLibrary に totalCount を追加**

`frontend/src/pages/LibraryPage/useLibrary.ts` の return 文に `totalCount` を追加する。

変更箇所: `return` オブジェクトに以下を追加:

```typescript
// 既存の return に追加
totalCount: state.meta?.total_count ?? 0,
```

つまり return 文を以下のように変更:

```typescript
  return {
    records: state.records,
    totalPages: state.meta?.total_pages ?? 1,
    totalCount: state.meta?.total_count ?? 0,  // 追加
    isLoading: state.isLoading,
    error: state.error,
    status,
    mediaType,
    sort,
    page,
    allTags,
    selectedTags,
    setStatus,
    setMediaType,
    setSort,
    setPage,
    setTags,
  }
```

- [ ] **Step 2: LibraryPage.tsx にレイアウト切り替えを統合**

`frontend/src/pages/LibraryPage/LibraryPage.tsx` を以下のように変更:

**追加するimport:**

```typescript
import { useLayoutPreference } from '../../hooks/useLayoutPreference'
import { LayoutSwitcher } from '../../components/ui/LayoutSwitcher/LayoutSwitcher'
import { RecordCardItem } from '../../components/RecordCardItem/RecordCardItem'
import { RecordCompactItem } from '../../components/RecordCompactItem/RecordCompactItem'
```

**useLibrary の分割代入に `totalCount` を追加:**

```typescript
const {
  records,
  totalPages,
  totalCount,  // 追加
  isLoading,
  error,
  // ... 残りは既存のまま
} = useLibrary()
```

**useLayoutPreference フックを呼び出す（useLibrary の下に追加）:**

```typescript
const { layout, setLayout } = useLayoutPreference()
```

**LayoutSwitcher をフィルター（タグチップ）の下、リスト表示の上に追加:**

タグフィルターセクションの後、error/loading/empty 表示の前に:

```tsx
{/* レイアウト切り替えツールバー */}
<LayoutSwitcher
  currentLayout={layout}
  totalCount={totalCount}
  onLayoutChange={setLayout}
/>
```

**リスト描画部分をレイアウトに応じて切り替え:**

既存の `.list` セクション内の `records.map` を以下に置き換え:

```tsx
{records.length > 0 && (
  <>
    <div className={
      layout === 'card' ? styles.cardGrid :
      layout === 'compact' ? styles.compactList :
      styles.list
    }>
      {records.map(record => {
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

**`.page` のクラスをレイアウトに応じて切り替え:**

最外部の `<div className={styles.page}>` を以下に変更:

```tsx
<div className={`${styles.page} ${layout === 'card' ? styles.pageWide : ''}`}>
```

- [ ] **Step 3: LibraryPage.module.css にカード・コンパクト用スタイルを追加**

`frontend/src/pages/LibraryPage/LibraryPage.module.css` に以下を追加:

```css
/* カード表示時のページ幅拡大 */
.pageWide {
  max-width: 1100px;
}

/* カード表示のグリッドレイアウト */
.cardGrid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
}

/* コンパクトリスト */
.compactList {
  margin-bottom: var(--spacing-lg);
}

/* レスポンシブ: カードグリッド */
@media (max-width: 1024px) {
  .cardGrid {
    grid-template-columns: repeat(4, 1fr);
  }
}

@media (max-width: 768px) {
  .cardGrid {
    grid-template-columns: repeat(3, 1fr);
    gap: var(--spacing-sm);
  }

  .pageWide {
    max-width: 100%;
  }
}
```

- [ ] **Step 4: テストを実行して全パスを確認**

```bash
docker compose exec frontend npx vitest run
```

Expected: 全テスト PASS（既存テスト + 新規テスト）

- [ ] **Step 5: リンター実行**

```bash
docker compose exec frontend npx eslint src/pages/LibraryPage/ src/hooks/useLayoutPreference.ts src/components/RecordCardItem/ src/components/RecordCompactItem/ src/components/ui/LayoutSwitcher/ --fix
```

Expected: エラーなし

- [ ] **Step 6: コミット**

```bash
git add frontend/src/pages/LibraryPage/ frontend/src/hooks/ frontend/src/components/RecordCardItem/ frontend/src/components/RecordCompactItem/ frontend/src/components/ui/LayoutSwitcher/
git commit -m "feat: LibraryPageにレイアウト切り替え機能を統合"
```

---

## Task 6: FavoriteWorkSelector モーダル修正

**Files:**
- Modify: `frontend/src/components/FavoriteWorkSelector/FavoriteWorkSelector.module.css`

**参照ファイル:**
- `frontend/src/components/FavoriteWorkSelector/FavoriteWorkSelector.tsx` — 現在のモーダル実装

- [ ] **Step 1: モーダルサイズ拡大・画像サイズ統一の CSS 変更**

`frontend/src/components/FavoriteWorkSelector/FavoriteWorkSelector.module.css` の以下を変更:

**`.modal` のサイズ変更:**

```css
/* 変更前 */
.modal {
  max-width: 520px;
  /* ... */
}

/* 変更後 */
.modal {
  max-width: 700px;
  /* 他はそのまま */
}
```

**`.workCover` に最大高さ制限を追加（画像がでかすぎる問題の修正）:**

現在の `.workCover` はすでに `aspect-ratio: 2 / 3` と `object-fit: cover` を持っているので、画像サイズの統一は既に対応済み。ただしモーダル拡大により4列グリッドの各セルが大きくなるので、5列に変更してバランスを取る:

```css
/* 変更前 */
.workGrid {
  grid-template-columns: repeat(4, 1fr);
  /* ... */
}

/* 変更後 */
.workGrid {
  grid-template-columns: repeat(5, 1fr);
  /* ... */
}
```

**モバイルのグリッド列数もバランス調整:**

```css
/* 変更前 */
@media (max-width: 768px) {
  .workGrid {
    grid-template-columns: repeat(3, 1fr);
  }
}

/* 変更後 — 3列のまま（変更不要） */
```

- [ ] **Step 2: ブラウザで動作確認用にコミット**

```bash
git add frontend/src/components/FavoriteWorkSelector/FavoriteWorkSelector.module.css
git commit -m "fix: 作品選択モーダルのサイズ拡大とグリッド列数調整"
```

---

## Task 7: PublicLibrary レイアウト整備

**Files:**
- Modify: `frontend/src/components/PublicLibrary/PublicLibrary.module.css`

**参照ファイル:**
- `frontend/src/components/PublicLibrary/PublicLibrary.tsx` — 公開ライブラリ実装
- `frontend/src/components/PublicLibrary/PublicLibrary.module.css` — 現在のスタイル

- [ ] **Step 1: 画像サイズ・間隔の統一**

`frontend/src/components/PublicLibrary/PublicLibrary.module.css` の `.grid` のガップを統一し、タブレットブレークポイントを追加:

```css
/* 変更前 */
.grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 16px;
  margin-bottom: var(--spacing-lg);
}

/* 変更後 */
.grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
}
```

タブレットブレークポイント（1024px）を追加:

```css
@media (max-width: 1024px) {
  .grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

/* 既存の768pxブレークポイントはそのまま */
@media (max-width: 768px) {
  .grid {
    grid-template-columns: repeat(3, 1fr);
    gap: var(--spacing-sm);
  }
  /* ... */
}
```

- [ ] **Step 2: テスト実行**

```bash
docker compose exec frontend npx vitest run
```

Expected: 全テスト PASS

- [ ] **Step 3: リンター実行**

```bash
docker compose exec frontend npx eslint src/ --fix && docker compose exec frontend npx prettier --write src/
```

Expected: エラーなし

- [ ] **Step 4: コミット**

```bash
git add frontend/src/components/PublicLibrary/PublicLibrary.module.css
git commit -m "fix: 公開ライブラリのグリッド間隔統一とレスポンシブ改善"
```
