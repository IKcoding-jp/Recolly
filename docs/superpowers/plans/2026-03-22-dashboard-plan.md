# ダッシュボード（リニューアル + ナビゲーション）実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ダッシュボードを進行中リスト+クイックアクションに刷新し、全ページ共通ナビゲーションバーを導入する

**Architecture:** NavBar（ロゴ+ナビ+UserMenu）をApp.tsxで認証済みページに共通表示。DashboardPageは useDashboard フックで watching 記録を取得し、WatchingListItem でジャンル別アクションボタン付きで表示する。新規APIは不要。

**Tech Stack:** React 19 / TypeScript / Vite / CSS Modules / Vitest + React Testing Library

**Spec:** `docs/superpowers/specs/2026-03-22-dashboard-design.md`

---

## ファイル構成

### 新規作成

| ファイル | 責務 |
|---------|------|
| `frontend/src/components/ui/NavBar/NavBar.tsx` | グローバルナビ（ロゴ+ナビリンク+UserMenu） |
| `frontend/src/components/ui/NavBar/NavBar.module.css` | NavBarスタイル |
| `frontend/src/components/ui/NavBar/NavBar.test.tsx` | NavBarテスト |
| `frontend/src/components/ui/UserMenu/UserMenu.tsx` | アバター+ドロップダウン |
| `frontend/src/components/ui/UserMenu/UserMenu.module.css` | UserMenuスタイル |
| `frontend/src/components/ui/UserMenu/UserMenu.test.tsx` | UserMenuテスト |
| `frontend/src/components/WatchingListItem/WatchingListItem.tsx` | 進行中リストの1行（カバー+タイトル+ジャンル+進捗+ボタン） |
| `frontend/src/components/WatchingListItem/WatchingListItem.module.css` | WatchingListItemスタイル |
| `frontend/src/components/WatchingListItem/WatchingListItem.test.tsx` | WatchingListItemテスト |
| `frontend/src/components/DashboardEmptyState/DashboardEmptyState.tsx` | 空状態（ジャンルピル+ステップガイド） |
| `frontend/src/components/DashboardEmptyState/DashboardEmptyState.module.css` | DashboardEmptyStateスタイル |
| `frontend/src/components/DashboardEmptyState/DashboardEmptyState.test.tsx` | DashboardEmptyStateテスト |
| `frontend/src/pages/DashboardPage/useDashboard.ts` | watching記録取得+進捗更新ロジック |
| `frontend/src/pages/DashboardPage/useDashboard.test.ts` | useDashboardテスト |
| `frontend/src/lib/mediaTypeUtils.ts` | ジャンル別ラベル・進捗テキストのマッピング |
| `frontend/src/lib/mediaTypeUtils.test.ts` | mediaTypeUtilsテスト |

### 変更

| ファイル | 変更内容 |
|---------|---------|
| `frontend/src/App.tsx` | NavBarを認証済みルートに共通表示する `AuthenticatedLayout` コンポーネントを追加 |
| `frontend/src/pages/DashboardPage/DashboardPage.tsx` | 全面書き換え（進行中リスト表示） |
| `frontend/src/pages/DashboardPage/DashboardPage.module.css` | 全面書き換え |
| `frontend/src/pages/DashboardPage/DashboardPage.test.tsx` | 全面書き換え |

---

## Task 1: ジャンル別ユーティリティ関数

**Files:**
- Create: `frontend/src/lib/mediaTypeUtils.ts`
- Test: `frontend/src/lib/mediaTypeUtils.test.ts`

- [ ] **Step 1: テストを書く**

```typescript
// frontend/src/lib/mediaTypeUtils.test.ts
import { describe, it, expect } from 'vitest'
import { getActionLabel, getProgressText } from './mediaTypeUtils'

describe('getActionLabel', () => {
  it('アニメは「+1話」を返す', () => {
    expect(getActionLabel('anime')).toBe('+1話')
  })

  it('ドラマは「+1話」を返す', () => {
    expect(getActionLabel('drama')).toBe('+1話')
  })

  it('漫画は「+1巻」を返す', () => {
    expect(getActionLabel('manga')).toBe('+1巻')
  })

  it('本は「読了」を返す', () => {
    expect(getActionLabel('book')).toBe('読了')
  })

  it('映画は「観た」を返す', () => {
    expect(getActionLabel('movie')).toBe('観た')
  })

  it('ゲームは「クリア」を返す', () => {
    expect(getActionLabel('game')).toBe('クリア')
  })
})

describe('getProgressText', () => {
  it('アニメで話数ありなら「12 / 25話」を返す', () => {
    expect(getProgressText('anime', 12, 25)).toBe('12 / 25話')
  })

  it('漫画で巻数ありなら「89 / 108巻」を返す', () => {
    expect(getProgressText('manga', 89, 108)).toBe('89 / 108巻')
  })

  it('映画は「—」を返す', () => {
    expect(getProgressText('movie', 0, null)).toBe('—')
  })

  it('ゲームは「プレイ中」を返す', () => {
    expect(getProgressText('game', 0, null)).toBe('プレイ中')
  })

  it('本は「読書中」を返す', () => {
    expect(getProgressText('book', 0, null)).toBe('読書中')
  })

  it('アニメでtotal_episodesがnullなら話数部分のみ表示', () => {
    expect(getProgressText('anime', 5, null)).toBe('5話')
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `docker compose run --rm frontend npx vitest run src/lib/mediaTypeUtils.test.ts`
Expected: FAIL — `getActionLabel` が未定義

- [ ] **Step 3: 実装**

```typescript
// frontend/src/lib/mediaTypeUtils.ts
import type { MediaType } from './types'

const ACTION_LABELS: Record<MediaType, string> = {
  anime: '+1話',
  drama: '+1話',
  manga: '+1巻',
  book: '読了',
  movie: '観た',
  game: 'クリア',
}

// 話数を持つメディアタイプ（+1ボタンで current_episode をインクリメント）
const EPISODE_MEDIA_TYPES: ReadonlySet<MediaType> = new Set(['anime', 'drama', 'manga'])

const UNIT_LABELS: Partial<Record<MediaType, string>> = {
  anime: '話',
  drama: '話',
  manga: '巻',
}

const FALLBACK_PROGRESS: Partial<Record<MediaType, string>> = {
  movie: '—',
  game: 'プレイ中',
  book: '読書中',
}

const GENRE_LABELS: Record<MediaType, string> = {
  anime: 'アニメ',
  movie: '映画',
  drama: 'ドラマ',
  book: '本',
  manga: '漫画',
  game: 'ゲーム',
}

export function getActionLabel(mediaType: MediaType): string {
  return ACTION_LABELS[mediaType]
}

export function getGenreLabel(mediaType: MediaType): string {
  return GENRE_LABELS[mediaType]
}

export function hasEpisodes(mediaType: MediaType): boolean {
  return EPISODE_MEDIA_TYPES.has(mediaType)
}

export function getProgressText(
  mediaType: MediaType,
  currentEpisode: number,
  totalEpisodes: number | null,
): string {
  if (!EPISODE_MEDIA_TYPES.has(mediaType)) {
    return FALLBACK_PROGRESS[mediaType] ?? '—'
  }

  const unit = UNIT_LABELS[mediaType] ?? '話'
  if (totalEpisodes) {
    return `${currentEpisode} / ${totalEpisodes}${unit}`
  }
  return `${currentEpisode}${unit}`
}
```

- [ ] **Step 4: テストがパスすることを確認**

Run: `docker compose run --rm frontend npx vitest run src/lib/mediaTypeUtils.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add frontend/src/lib/mediaTypeUtils.ts frontend/src/lib/mediaTypeUtils.test.ts
git commit -m "feat: ジャンル別ラベル・進捗テキストのユーティリティ関数を追加"
```

---

## Task 2: UserMenu コンポーネント

**Files:**
- Create: `frontend/src/components/ui/UserMenu/UserMenu.tsx`
- Create: `frontend/src/components/ui/UserMenu/UserMenu.module.css`
- Test: `frontend/src/components/ui/UserMenu/UserMenu.test.tsx`

**参考:** `frontend/src/contexts/AuthContext.tsx` の `User` 型、`useAuth` フック

- [ ] **Step 1: テストを書く**

```typescript
// frontend/src/components/ui/UserMenu/UserMenu.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { UserMenu } from './UserMenu'

const mockUser = {
  id: 1,
  username: 'IK',
  email: 'ik@example.com',
  avatar_url: null,
  bio: null,
  created_at: '2026-01-01',
}

describe('UserMenu', () => {
  it('イニシャルアバターを表示する', () => {
    render(<UserMenu user={mockUser} onLogout={vi.fn()} />)
    expect(screen.getByText('IK')).toBeInTheDocument()
  })

  it('クリックでドロップダウンを表示する', async () => {
    const user = userEvent.setup()
    render(<UserMenu user={mockUser} onLogout={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'ユーザーメニュー' }))

    expect(screen.getByText('ik@example.com')).toBeInTheDocument()
    expect(screen.getByText('ログアウト')).toBeInTheDocument()
    expect(screen.getByText('マイページ（準備中）')).toBeInTheDocument()
  })

  it('ログアウトをクリックするとonLogoutが呼ばれる', async () => {
    const user = userEvent.setup()
    const onLogout = vi.fn()
    render(<UserMenu user={mockUser} onLogout={onLogout} />)

    await user.click(screen.getByRole('button', { name: 'ユーザーメニュー' }))
    await user.click(screen.getByText('ログアウト'))

    expect(onLogout).toHaveBeenCalledOnce()
  })

  it('ドロップダウン外クリックで閉じる', async () => {
    const user = userEvent.setup()
    render(<UserMenu user={mockUser} onLogout={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'ユーザーメニュー' }))
    expect(screen.getByText('ik@example.com')).toBeInTheDocument()

    await user.click(document.body)
    expect(screen.queryByText('ik@example.com')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: テスト失敗を確認**

Run: `docker compose run --rm frontend npx vitest run src/components/ui/UserMenu/UserMenu.test.tsx`
Expected: FAIL

- [ ] **Step 3: CSSを作成**

```css
/* frontend/src/components/ui/UserMenu/UserMenu.module.css */
.container {
  position: relative;
}

.avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--color-text);
  color: var(--color-bg-white);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-body);
  font-weight: var(--font-weight-bold);
  cursor: pointer;
  border: none;
  padding: 0;
  transition: opacity var(--transition-fast);
}

.avatar:hover {
  opacity: 0.8;
}

.dropdown {
  position: absolute;
  top: 44px;
  right: 0;
  background: var(--color-bg-white);
  border: 1px solid var(--color-border-light);
  border-radius: 6px;
  padding: var(--spacing-xs) 0;
  min-width: 180px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  z-index: 100;
}

.header {
  padding: var(--spacing-sm) var(--spacing-md) var(--spacing-xs);
  font-size: var(--font-size-body);
  font-weight: var(--font-weight-bold);
  color: var(--color-text);
}

.email {
  padding: 0 var(--spacing-md) var(--spacing-sm);
  font-size: var(--font-size-meta);
  color: var(--color-text-muted);
}

.divider {
  border-top: 1px solid var(--color-border-light);
  margin: var(--spacing-xs) 0;
}

.item {
  display: block;
  width: 100%;
  padding: var(--spacing-sm) var(--spacing-md);
  font-size: var(--font-size-body);
  color: var(--color-text);
  background: none;
  border: none;
  text-align: left;
  cursor: pointer;
  font-family: inherit;
}

.item:hover {
  background: var(--color-bg);
}

.disabled {
  composes: item;
  color: var(--color-text-muted);
  cursor: default;
}

.disabled:hover {
  background: none;
}
```

- [ ] **Step 4: コンポーネントを実装**

```typescript
// frontend/src/components/ui/UserMenu/UserMenu.tsx
import { useState, useRef, useEffect } from 'react'
import type { User } from '../../../lib/types'
import styles from './UserMenu.module.css'

type UserMenuProps = {
  user: User
  onLogout: () => void
}

export function UserMenu({ user, onLogout }: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  // ユーザー名の先頭2文字をイニシャルとして使用
  const initials = user.username.slice(0, 2).toUpperCase()

  return (
    <div className={styles.container} ref={containerRef}>
      <button
        className={styles.avatar}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="ユーザーメニュー"
      >
        {initials}
      </button>
      {isOpen && (
        <div className={styles.dropdown}>
          <div className={styles.header}>{user.username}</div>
          <div className={styles.email}>{user.email}</div>
          <div className={styles.divider} />
          <div className={styles.disabled}>マイページ（準備中）</div>
          <div className={styles.divider} />
          <button className={styles.item} onClick={onLogout}>
            ログアウト
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 5: テストがパスすることを確認**

Run: `docker compose run --rm frontend npx vitest run src/components/ui/UserMenu/UserMenu.test.tsx`
Expected: PASS

- [ ] **Step 6: コミット**

```bash
git add frontend/src/components/ui/UserMenu/
git commit -m "feat: UserMenuコンポーネント（アバター+ドロップダウン）を追加"
```

---

## Task 3: NavBar コンポーネント

**Files:**
- Create: `frontend/src/components/ui/NavBar/NavBar.tsx`
- Create: `frontend/src/components/ui/NavBar/NavBar.module.css`
- Test: `frontend/src/components/ui/NavBar/NavBar.test.tsx`

**依存:** Task 2（UserMenu）

- [ ] **Step 1: テストを書く**

```typescript
// frontend/src/components/ui/NavBar/NavBar.test.tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import { NavBar } from './NavBar'

const mockUser = {
  id: 1,
  username: 'IK',
  email: 'ik@example.com',
  avatar_url: null,
  bio: null,
  created_at: '2026-01-01',
}

function renderNavBar(currentPath = '/dashboard') {
  return render(
    <MemoryRouter initialEntries={[currentPath]}>
      <NavBar user={mockUser} onLogout={vi.fn()} />
    </MemoryRouter>,
  )
}

describe('NavBar', () => {
  it('ロゴ「Recolly」を表示する', () => {
    renderNavBar()
    expect(screen.getByText('Recolly')).toBeInTheDocument()
  })

  it('有効なナビ項目をリンクとして表示する', () => {
    renderNavBar()
    expect(screen.getByRole('link', { name: 'ホーム' })).toHaveAttribute('href', '/dashboard')
    expect(screen.getByRole('link', { name: '検索' })).toHaveAttribute('href', '/search')
    expect(screen.getByRole('link', { name: 'ライブラリ' })).toHaveAttribute('href', '/library')
  })

  it('未実装のナビ項目はリンクではなくグレーアウトで表示する', () => {
    renderNavBar()
    expect(screen.getByText('コミュニティ')).toBeInTheDocument()
    expect(screen.getByText('おすすめ')).toBeInTheDocument()
    expect(screen.getByText('マイページ')).toBeInTheDocument()
    // リンクではないことを確認
    expect(screen.queryByRole('link', { name: 'コミュニティ' })).not.toBeInTheDocument()
  })

  it('現在のパスに対応するナビ項目がアクティブ状態になる', () => {
    renderNavBar('/library')
    const libraryLink = screen.getByRole('link', { name: 'ライブラリ' })
    expect(libraryLink.className).toContain('active')
  })

  it('UserMenuを表示する', () => {
    renderNavBar()
    expect(screen.getByRole('button', { name: 'ユーザーメニュー' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: テスト失敗を確認**

Run: `docker compose run --rm frontend npx vitest run src/components/ui/NavBar/NavBar.test.tsx`
Expected: FAIL

- [ ] **Step 3: CSSを作成**

```css
/* frontend/src/components/ui/NavBar/NavBar.module.css */
.nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-md) var(--spacing-xl);
  border-bottom: var(--border-width) solid var(--color-border);
  background: var(--color-bg);
}

.logo {
  font-family: var(--font-heading);
  font-weight: var(--font-weight-bold);
  font-size: 1.375rem;
  color: var(--color-text);
  text-decoration: none;
}

.right {
  display: flex;
  align-items: center;
  gap: var(--spacing-lg);
}

.links {
  display: flex;
  gap: var(--spacing-lg);
  align-items: center;
}

.link {
  font-size: var(--font-size-body);
  font-weight: var(--font-weight-bold);
  letter-spacing: 1.5px;
  text-transform: uppercase;
  color: var(--color-text);
  text-decoration: none;
  padding: var(--spacing-xs) 0;
}

.active {
  composes: link;
  border-bottom: var(--border-width) solid var(--color-border);
}

.disabled {
  font-size: var(--font-size-body);
  font-weight: var(--font-weight-bold);
  letter-spacing: 1.5px;
  text-transform: uppercase;
  color: var(--color-text-muted);
  cursor: default;
}

.menuSeparator {
  width: 1px;
  height: 20px;
  background: var(--color-border-light);
}
```

- [ ] **Step 4: コンポーネントを実装**

```typescript
// frontend/src/components/ui/NavBar/NavBar.tsx
import { Link, useLocation } from 'react-router-dom'
import type { User } from '../../../lib/types'
import { UserMenu } from '../UserMenu/UserMenu'
import styles from './NavBar.module.css'

type NavItem = {
  label: string
  path: string | null
}

const NAV_ITEMS: NavItem[] = [
  { label: 'ホーム', path: '/dashboard' },
  { label: '検索', path: '/search' },
  { label: 'ライブラリ', path: '/library' },
  { label: 'コミュニティ', path: null },
  { label: 'おすすめ', path: null },
  { label: 'マイページ', path: null },
]

type NavBarProps = {
  user: User
  onLogout: () => void
}

export function NavBar({ user, onLogout }: NavBarProps) {
  const { pathname } = useLocation()

  return (
    <nav className={styles.nav}>
      <Link to="/dashboard" className={styles.logo}>
        Recolly
      </Link>
      <div className={styles.right}>
        <div className={styles.links}>
          {NAV_ITEMS.map((item) =>
            item.path ? (
              <Link
                key={item.label}
                to={item.path}
                className={pathname === item.path ? styles.active : styles.link}
              >
                {item.label}
              </Link>
            ) : (
              <span key={item.label} className={styles.disabled}>
                {item.label}
              </span>
            ),
          )}
        </div>
        <div className={styles.menuSeparator} />
        <UserMenu user={user} onLogout={onLogout} />
      </div>
    </nav>
  )
}
```

- [ ] **Step 5: テストがパスすることを確認**

Run: `docker compose run --rm frontend npx vitest run src/components/ui/NavBar/NavBar.test.tsx`
Expected: PASS

- [ ] **Step 6: コミット**

```bash
git add frontend/src/components/ui/NavBar/
git commit -m "feat: NavBarコンポーネント（グローバルナビゲーション）を追加"
```

---

## Task 4: App.tsx にNavBarを統合

**Files:**
- Modify: `frontend/src/App.tsx`

**依存:** Task 3（NavBar）

- [ ] **Step 1: App.tsxを修正 — AuthenticatedLayoutを追加**

`ProtectedRoute` でラップされた各ページにNavBarを共通表示する `AuthenticatedLayout` コンポーネントを追加する。

```typescript
// frontend/src/App.tsx に追加するコンポーネント
import { NavBar } from './components/ui/NavBar/NavBar'

function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth()

  if (!user) return null

  return (
    <>
      <NavBar user={user} onLogout={() => void logout()} />
      {children}
    </>
  )
}
```

各 `ProtectedRoute` 内のページを `AuthenticatedLayout` でラップする:

```tsx
<Route
  path="/dashboard"
  element={
    <ProtectedRoute>
      <AuthenticatedLayout>
        <DashboardPage />
      </AuthenticatedLayout>
    </ProtectedRoute>
  }
/>
```

`/search`、`/library`、`/works/:id` も同様にラップする。

- [ ] **Step 2: ブラウザで動作確認**

Run: `docker compose up` でアプリを起動し、ログイン後に各ページでNavBarが表示されることを確認。
- ロゴ「Recolly」が左に表示
- ナビ項目6つが右に表示（3つ有効、3つグレーアウト）
- アバターが右端に表示
- ページ遷移でアクティブ状態が切り替わる

- [ ] **Step 3: コミット**

```bash
git add frontend/src/App.tsx
git commit -m "feat: App.tsxにNavBarを統合（全認証済みページで共通表示）"
```

---

## Task 5: WatchingListItem コンポーネント

**Files:**
- Create: `frontend/src/components/WatchingListItem/WatchingListItem.tsx`
- Create: `frontend/src/components/WatchingListItem/WatchingListItem.module.css`
- Test: `frontend/src/components/WatchingListItem/WatchingListItem.test.tsx`

**依存:** Task 1（mediaTypeUtils）
**参考:** `frontend/src/components/RecordListItem/` の構造

- [ ] **Step 1: テストを書く**

```typescript
// frontend/src/components/WatchingListItem/WatchingListItem.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import { WatchingListItem } from './WatchingListItem'
import type { UserRecord } from '../../lib/types'

const animeRecord: UserRecord = {
  id: 1,
  work_id: 10,
  status: 'watching',
  rating: null,
  current_episode: 12,
  rewatch_count: 0,
  started_at: null,
  completed_at: null,
  created_at: '2026-01-01',
  work: {
    id: 10,
    title: '進撃の巨人',
    media_type: 'anime',
    description: null,
    cover_image_url: 'https://example.com/cover.jpg',
    total_episodes: 25,
    external_api_id: null,
    external_api_source: null,
    metadata: {},
    created_at: '2026-01-01',
  },
}

const movieRecord: UserRecord = {
  ...animeRecord,
  id: 2,
  work_id: 20,
  current_episode: 0,
  work: {
    ...animeRecord.work,
    id: 20,
    title: 'インターステラー',
    media_type: 'movie',
    cover_image_url: null,
    total_episodes: null,
  },
}

function renderItem(record: UserRecord, onAction = vi.fn()) {
  return render(
    <MemoryRouter>
      <WatchingListItem record={record} onAction={onAction} />
    </MemoryRouter>,
  )
}

describe('WatchingListItem', () => {
  it('作品タイトルを表示する', () => {
    renderItem(animeRecord)
    expect(screen.getByText('進撃の巨人')).toBeInTheDocument()
  })

  it('ジャンルラベルを表示する', () => {
    renderItem(animeRecord)
    expect(screen.getByText('アニメ')).toBeInTheDocument()
  })

  it('進捗テキストを表示する', () => {
    renderItem(animeRecord)
    expect(screen.getByText('12 / 25話')).toBeInTheDocument()
  })

  it('アニメには「+1話」ボタンを表示する', () => {
    renderItem(animeRecord)
    expect(screen.getByRole('button', { name: '+1話' })).toBeInTheDocument()
  })

  it('映画には「観た」ボタンを表示する', () => {
    renderItem(movieRecord)
    expect(screen.getByRole('button', { name: '観た' })).toBeInTheDocument()
  })

  it('ボタンクリックでonActionが呼ばれる', async () => {
    const user = userEvent.setup()
    const onAction = vi.fn()
    renderItem(animeRecord, onAction)

    await user.click(screen.getByRole('button', { name: '+1話' }))
    expect(onAction).toHaveBeenCalledWith(animeRecord)
  })

  it('行クリックで作品詳細ページへのリンクになっている', () => {
    renderItem(animeRecord)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/works/10')
  })
})
```

- [ ] **Step 2: テスト失敗を確認**

Run: `docker compose run --rm frontend npx vitest run src/components/WatchingListItem/WatchingListItem.test.tsx`
Expected: FAIL

- [ ] **Step 3: CSSを作成**

```css
/* frontend/src/components/WatchingListItem/WatchingListItem.module.css */
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-border-light);
  border-radius: 6px;
  transition: background var(--transition-fast);
}

.row:hover {
  background: var(--color-bg);
}

.link {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  text-decoration: none;
  color: inherit;
  flex: 1;
  min-width: 0;
}

.cover {
  width: 40px;
  height: 56px;
  border-radius: 3px;
  flex-shrink: 0;
  object-fit: cover;
}

.coverPlaceholder {
  width: 40px;
  height: 56px;
  border-radius: 3px;
  flex-shrink: 0;
}

.info {
  min-width: 0;
}

.title {
  font-size: var(--font-size-body);
  font-weight: var(--font-weight-bold);
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.genre {
  font-size: var(--font-size-meta);
  font-weight: var(--font-weight-bold);
  letter-spacing: 1px;
  text-transform: uppercase;
  margin-top: 2px;
}

.progress {
  font-size: var(--font-size-label);
  color: var(--color-text-muted);
  margin-top: 2px;
}

.actionButton {
  width: 72px;
  padding: var(--spacing-xs) 0;
  background: var(--color-text);
  color: var(--color-bg-white);
  border: none;
  border-radius: 4px;
  font-size: var(--font-size-body);
  font-weight: var(--font-weight-bold);
  cursor: pointer;
  text-align: center;
  flex-shrink: 0;
  font-family: inherit;
  transition: opacity var(--transition-fast);
}

.actionButton:hover {
  opacity: 0.8;
}
```

- [ ] **Step 4: コンポーネントを実装**

```typescript
// frontend/src/components/WatchingListItem/WatchingListItem.tsx
import { Link } from 'react-router-dom'
import type { UserRecord } from '../../lib/types'
import { getActionLabel, getGenreLabel, getProgressText } from '../../lib/mediaTypeUtils'
import styles from './WatchingListItem.module.css'

// ジャンル別CSSカラー変数のマッピング
const GENRE_COLOR_VAR: Record<string, string> = {
  anime: 'var(--color-anime)',
  movie: 'var(--color-movie)',
  drama: 'var(--color-drama)',
  book: 'var(--color-book)',
  manga: 'var(--color-manga)',
  game: 'var(--color-game)',
}

type WatchingListItemProps = {
  record: UserRecord
  onAction: (record: UserRecord) => void
}

export function WatchingListItem({ record, onAction }: WatchingListItemProps) {
  const { work } = record
  const color = GENRE_COLOR_VAR[work.media_type]
  const progressText = getProgressText(
    work.media_type,
    record.current_episode,
    work.total_episodes,
  )

  return (
    <div className={styles.row}>
      <Link to={`/works/${work.id}`} className={styles.link}>
        {work.cover_image_url ? (
          <img src={work.cover_image_url} alt="" className={styles.cover} />
        ) : (
          <div className={styles.coverPlaceholder} style={{ background: color }} />
        )}
        <div className={styles.info}>
          <div className={styles.title}>{work.title}</div>
          <div className={styles.genre} style={{ color }}>
            {getGenreLabel(work.media_type)}
          </div>
          <div className={styles.progress}>{progressText}</div>
        </div>
      </Link>
      <button
        className={styles.actionButton}
        onClick={(e) => {
          e.preventDefault()
          onAction(record)
        }}
      >
        {getActionLabel(work.media_type)}
      </button>
    </div>
  )
}
```

- [ ] **Step 5: テストがパスすることを確認**

Run: `docker compose run --rm frontend npx vitest run src/components/WatchingListItem/WatchingListItem.test.tsx`
Expected: PASS

- [ ] **Step 6: コミット**

```bash
git add frontend/src/components/WatchingListItem/
git commit -m "feat: WatchingListItemコンポーネント（進行中リストの1行）を追加"
```

---

## Task 6: DashboardEmptyState コンポーネント

**Files:**
- Create: `frontend/src/components/DashboardEmptyState/DashboardEmptyState.tsx`
- Create: `frontend/src/components/DashboardEmptyState/DashboardEmptyState.module.css`
- Test: `frontend/src/components/DashboardEmptyState/DashboardEmptyState.test.tsx`

- [ ] **Step 1: テストを書く**

```typescript
// frontend/src/components/DashboardEmptyState/DashboardEmptyState.test.tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import { DashboardEmptyState } from './DashboardEmptyState'

describe('DashboardEmptyState', () => {
  it('「はじめましょう」の見出しを表示する', () => {
    render(
      <MemoryRouter>
        <DashboardEmptyState />
      </MemoryRouter>,
    )
    expect(screen.getByText('はじめましょう')).toBeInTheDocument()
  })

  it('6つのジャンルピルを表示する', () => {
    render(
      <MemoryRouter>
        <DashboardEmptyState />
      </MemoryRouter>,
    )
    expect(screen.getByText('アニメ')).toBeInTheDocument()
    expect(screen.getByText('映画')).toBeInTheDocument()
    expect(screen.getByText('ドラマ')).toBeInTheDocument()
    expect(screen.getByText('本')).toBeInTheDocument()
    expect(screen.getByText('漫画')).toBeInTheDocument()
    expect(screen.getByText('ゲーム')).toBeInTheDocument()
  })

  it('3つのステップを表示する', () => {
    render(
      <MemoryRouter>
        <DashboardEmptyState />
      </MemoryRouter>,
    )
    expect(screen.getByText('作品を探す')).toBeInTheDocument()
    expect(screen.getByText('記録する')).toBeInTheDocument()
    expect(screen.getByText('進捗を更新')).toBeInTheDocument()
  })

  it('検索ページへのリンクを表示する', () => {
    render(
      <MemoryRouter>
        <DashboardEmptyState />
      </MemoryRouter>,
    )
    const link = screen.getByRole('link', { name: '作品を探す' })
    expect(link).toHaveAttribute('href', '/search')
  })
})
```

- [ ] **Step 2: テスト失敗を確認**

Run: `docker compose run --rm frontend npx vitest run src/components/DashboardEmptyState/DashboardEmptyState.test.tsx`
Expected: FAIL

- [ ] **Step 3: CSS + コンポーネントを実装**

CSSとコンポーネントを作成する。ジャンルピルのスタイルは各ジャンルカラーの10%/30%透過で背景とボーダーを設定。3ステップは横並び、丸囲み番号付き。CTAは `Link` コンポーネントで `/search` へ。

スペックのセクション4を正確に再現すること。

- [ ] **Step 4: テストがパスすることを確認**

Run: `docker compose run --rm frontend npx vitest run src/components/DashboardEmptyState/DashboardEmptyState.test.tsx`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add frontend/src/components/DashboardEmptyState/
git commit -m "feat: DashboardEmptyStateコンポーネント（ジャンルピル+ステップガイド）を追加"
```

---

## Task 7: useDashboard フック

**Files:**
- Create: `frontend/src/pages/DashboardPage/useDashboard.ts`
- Test: `frontend/src/pages/DashboardPage/useDashboard.test.ts`

**参考:** `frontend/src/pages/LibraryPage/useLibrary.ts` のパターン

- [ ] **Step 1: テストを書く**

```typescript
// frontend/src/pages/DashboardPage/useDashboard.test.ts
import { renderHook, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useDashboard } from './useDashboard'

vi.mock('../../lib/recordsApi', () => ({
  recordsApi: {
    getAll: vi.fn(),
    update: vi.fn(),
  },
}))

import { recordsApi } from '../../lib/recordsApi'

const mockRecords = [
  {
    id: 1,
    work_id: 10,
    status: 'watching',
    rating: null,
    current_episode: 12,
    rewatch_count: 0,
    started_at: null,
    completed_at: null,
    created_at: '2026-01-01',
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
      created_at: '2026-01-01',
    },
  },
]

describe('useDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('watching状態の記録を取得する', async () => {
    vi.mocked(recordsApi.getAll).mockResolvedValue({ records: mockRecords })

    const { result } = renderHook(() => useDashboard())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(recordsApi.getAll).toHaveBeenCalledWith({ status: 'watching' })
    expect(result.current.records).toEqual(mockRecords)
  })

  it('handleAction: 話数ありメディアでcurrent_episodeをインクリメントする', async () => {
    vi.mocked(recordsApi.getAll).mockResolvedValue({ records: mockRecords })
    vi.mocked(recordsApi.update).mockResolvedValue({
      record: { ...mockRecords[0], current_episode: 13 },
    })

    const { result } = renderHook(() => useDashboard())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      await result.current.handleAction(mockRecords[0])
    })

    expect(recordsApi.update).toHaveBeenCalledWith(1, { current_episode: 13 })
  })

  it('エラー時にエラーメッセージを設定する', async () => {
    vi.mocked(recordsApi.getAll).mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() => useDashboard())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.error).toBe('記録の取得に失敗しました')
  })
})
```

- [ ] **Step 2: テスト失敗を確認**

Run: `docker compose run --rm frontend npx vitest run src/pages/DashboardPage/useDashboard.test.ts`
Expected: FAIL

- [ ] **Step 3: フックを実装**

```typescript
// frontend/src/pages/DashboardPage/useDashboard.ts
import { useState, useEffect, useCallback } from 'react'
import type { UserRecord } from '../../lib/types'
import { recordsApi } from '../../lib/recordsApi'
import { hasEpisodes } from '../../lib/mediaTypeUtils'

export function useDashboard() {
  const [records, setRecords] = useState<UserRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchRecords = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await recordsApi.getAll({ status: 'watching' })
      setRecords(data.records)
    } catch {
      setError('記録の取得に失敗しました')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchRecords()
  }, [fetchRecords])

  const handleAction = useCallback(async (record: UserRecord) => {
    const mediaType = record.work.media_type

    if (hasEpisodes(mediaType)) {
      // 楽観的UI: current_episodeをインクリメント
      const newEpisode = record.current_episode + 1
      setRecords((prev) =>
        prev.map((r) => (r.id === record.id ? { ...r, current_episode: newEpisode } : r)),
      )
      try {
        const { record: updated } = await recordsApi.update(record.id, {
          current_episode: newEpisode,
        })
        // 自動完了でstatusがcompletedに変わった場合、リストから除去
        if (updated.status === 'completed') {
          setRecords((prev) => prev.filter((r) => r.id !== record.id))
        }
      } catch {
        // ロールバック
        setRecords((prev) =>
          prev.map((r) =>
            r.id === record.id ? { ...r, current_episode: record.current_episode } : r,
          ),
        )
        setError('進捗の更新に失敗しました')
      }
    } else {
      // 話数なしメディア: statusをcompletedに変更
      try {
        await recordsApi.update(record.id, { status: 'completed' })
        setRecords((prev) => prev.filter((r) => r.id !== record.id))
      } catch {
        setError('ステータスの更新に失敗しました')
      }
    }
  }, [])

  return { records, isLoading, error, handleAction }
}
```

- [ ] **Step 4: テストがパスすることを確認**

Run: `docker compose run --rm frontend npx vitest run src/pages/DashboardPage/useDashboard.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add frontend/src/pages/DashboardPage/useDashboard.ts frontend/src/pages/DashboardPage/useDashboard.test.ts
git commit -m "feat: useDashboardフック（watching記録取得+進捗更新ロジック）を追加"
```

---

## Task 8: DashboardPage 書き換え

**Files:**
- Modify: `frontend/src/pages/DashboardPage/DashboardPage.tsx`（全面書き換え）
- Modify: `frontend/src/pages/DashboardPage/DashboardPage.module.css`（全面書き換え）
- Modify: `frontend/src/pages/DashboardPage/DashboardPage.test.tsx`（全面書き換え）

**依存:** Task 5, 6, 7

- [ ] **Step 1: テストを書く**

```typescript
// frontend/src/pages/DashboardPage/DashboardPage.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DashboardPage } from './DashboardPage'

vi.mock('../../lib/recordsApi', () => ({
  recordsApi: {
    getAll: vi.fn(),
    update: vi.fn(),
  },
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

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('進行中の記録を表示する', async () => {
    vi.mocked(recordsApi.getAll).mockResolvedValue({ records: [mockAnimeRecord] })

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('進撃の巨人')).toBeInTheDocument()
    })

    expect(screen.getByText('進行中')).toBeInTheDocument()
    expect(screen.getByText('12 / 25話')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+1話' })).toBeInTheDocument()
  })

  it('記録が0件のとき空状態を表示する', async () => {
    vi.mocked(recordsApi.getAll).mockResolvedValue({ records: [] })

    render(
      <MemoryRouter>
        <DashboardPage />
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
        <DashboardPage />
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
        <DashboardPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('記録の取得に失敗しました')).toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 2: テスト失敗を確認**

Run: `docker compose run --rm frontend npx vitest run src/pages/DashboardPage/DashboardPage.test.tsx`
Expected: FAIL（現在のDashboardPageは仮実装のため）

- [ ] **Step 3: CSSを書く**

```css
/* frontend/src/pages/DashboardPage/DashboardPage.module.css */
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
```

- [ ] **Step 4: DashboardPageを書き換え**

```typescript
// frontend/src/pages/DashboardPage/DashboardPage.tsx
import { SectionTitle } from '../../components/ui/SectionTitle/SectionTitle'
import { WatchingListItem } from '../../components/WatchingListItem/WatchingListItem'
import { DashboardEmptyState } from '../../components/DashboardEmptyState/DashboardEmptyState'
import { useDashboard } from './useDashboard'
import styles from './DashboardPage.module.css'

export function DashboardPage() {
  const { records, isLoading, error, handleAction } = useDashboard()

  return (
    <div className={styles.container}>
      <SectionTitle>進行中</SectionTitle>

      {isLoading && <div className={styles.loading}>読み込み中...</div>}

      {error && <div className={styles.error}>{error}</div>}

      {!isLoading && !error && records.length === 0 && <DashboardEmptyState />}

      {!isLoading && records.length > 0 && (
        <div className={styles.list}>
          {records.map((record) => (
            <WatchingListItem
              key={record.id}
              record={record}
              onAction={() => void handleAction(record)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 5: テストがパスすることを確認**

Run: `docker compose run --rm frontend npx vitest run src/pages/DashboardPage/DashboardPage.test.tsx`
Expected: PASS

- [ ] **Step 6: 全テスト実行**

Run: `docker compose run --rm frontend npm test`
Expected: 全テストPASS

- [ ] **Step 7: コミット**

```bash
git add frontend/src/pages/DashboardPage/
git commit -m "feat: DashboardPageを進行中リスト+クイックアクションに刷新"
```

---

## Task 9: 統合テスト + ブラウザ確認

**依存:** Task 1-8 全て

- [ ] **Step 1: 全テスト実行**

Run: `docker compose run --rm frontend npm test`
Expected: 全テストPASS

- [ ] **Step 2: lint実行**

Run: `docker compose run --rm frontend npm run lint`
Expected: エラーなし

- [ ] **Step 3: ブラウザで統合確認**

`docker compose up` でアプリを起動し、以下を確認:

1. ログイン後にNavBarが表示される
2. ナビ項目のクリックでページ遷移する
3. アクティブ状態が正しく切り替わる
4. グレーアウト項目はクリック不可
5. アバタークリックでドロップダウンが表示される
6. ドロップダウンからログアウトできる
7. ダッシュボードに進行中の作品が表示される（watching記録がある場合）
8. +1話ボタンで進捗が更新される
9. watching記録がない場合は空状態が表示される
10. 空状態の「作品を探す」ボタンで検索ページに遷移する

- [ ] **Step 4: 最終コミット（必要な場合のみ）**

統合確認で見つかった修正があればコミット。
