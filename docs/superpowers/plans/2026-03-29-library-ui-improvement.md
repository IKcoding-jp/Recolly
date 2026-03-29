# マイライブラリ UI/UX改善 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** マイライブラリページのフィルタUIをドロップダウンに変更し、記録追加モーダルのレイアウトをカード風グリッド配置に改善する

**Architecture:** フィルタUIはネイティブ`<select>`要素を使い、3つのドロップダウンを横並びに配置。モーダルはCSSグリッドでステータス・評価を均等配置し、グレー背景カードで各セクションを区切る。既存のURL状態管理（useSearchParams）とAPI呼び出しはそのまま維持。

**Tech Stack:** React 19 / TypeScript / CSS Modules / Vitest + React Testing Library

**Issue:** #75
**Spec:** `docs/superpowers/specs/2026-03-29-library-ui-improvement-design.md`

---

## ファイル構成

### 変更するファイル

| ファイル | 変更内容 |
|---------|---------|
| `frontend/src/pages/LibraryPage/LibraryPage.tsx` | フィルタUIをドロップダウンに変更、モバイル折りたたみ削除 |
| `frontend/src/pages/LibraryPage/LibraryPage.module.css` | フィルタ関連スタイルを全面書き換え |
| `frontend/src/pages/LibraryPage/LibraryPage.test.tsx` | ドロップダウンに合わせてテスト更新 |
| `frontend/src/components/RecordModal/RecordModal.tsx` | カード風レイアウト、デフォルトステータス変更 |
| `frontend/src/components/RecordModal/RecordModal.module.css` | グリッド・カード・中央揃えスタイル |
| `frontend/src/components/RecordModal/RecordModal.test.tsx` | デフォルトステータス変更のテスト更新 |
| `frontend/src/components/ui/StatusSelector/StatusSelector.tsx` | グリッドレイアウト用CSS class変更 |
| `frontend/src/components/ui/StatusSelector/StatusSelector.module.css` | 3列グリッド + 角丸四角スタイル |
| `frontend/src/components/ui/RatingInput/RatingInput.tsx` | グリッドレイアウト用構造変更 |
| `frontend/src/components/ui/RatingInput/RatingInput.module.css` | 5列グリッドスタイル |

### 削除しないファイル

StatusFilter、MediaTypeFilter、SortSelectorコンポーネントは**検索ページ等で使われている可能性**があるため、このタスクでは削除しない。LibraryPageからのimportを外すだけにする。

---

## Task 1: RecordModal — デフォルトステータス変更 + テスト更新

**Files:**
- Modify: `frontend/src/components/RecordModal/RecordModal.test.tsx`
- Modify: `frontend/src/components/RecordModal/RecordModal.tsx`

- [ ] **Step 1: テストのデフォルトステータス期待値を変更**

`RecordModal.test.tsx` の51行目を変更する:

```typescript
// 変更前
expect(handleConfirm).toHaveBeenCalledWith(
  expect.objectContaining({ status: 'plan_to_watch', rating: null }),
)

// 変更後
expect(handleConfirm).toHaveBeenCalledWith(
  expect.objectContaining({ status: 'watching', rating: null }),
)
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `cd frontend && npx vitest run src/components/RecordModal/RecordModal.test.tsx`
Expected: FAIL — `status: 'plan_to_watch'` が返るため不一致

- [ ] **Step 3: デフォルトステータスを変更**

`RecordModal.tsx` の27行目を変更する:

```typescript
// 変更前
const [status, setStatus] = useState<RecordStatus>('plan_to_watch')

// 変更後
const [status, setStatus] = useState<RecordStatus>('watching')
```

- [ ] **Step 4: テストを実行してパスを確認**

Run: `cd frontend && npx vitest run src/components/RecordModal/RecordModal.test.tsx`
Expected: ALL PASS

- [ ] **Step 5: コミット**

```bash
git add frontend/src/components/RecordModal/RecordModal.tsx frontend/src/components/RecordModal/RecordModal.test.tsx
git commit -m "feat: 記録モーダルのデフォルトステータスをwatchingに変更 (#75)"
```

---

## Task 2: StatusSelector — グリッドレイアウト + 角丸四角スタイル

**Files:**
- Modify: `frontend/src/components/ui/StatusSelector/StatusSelector.module.css`

- [ ] **Step 1: StatusSelectorのCSSをグリッドレイアウトに変更**

`StatusSelector.module.css` を以下に置き換える:

```css
.container {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.pill {
  font-family: var(--font-body);
  font-size: var(--font-size-meta);
  font-weight: var(--font-weight-medium);
  padding: var(--spacing-sm) var(--spacing-xs);
  border: var(--border-width) var(--border-style) var(--color-border-light);
  border-radius: 6px;
  background: var(--color-bg-white);
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all var(--transition-fast);
  text-align: center;
}

.pill:hover {
  border-color: var(--color-border);
  color: var(--color-text);
}

.pill.active {
  background: var(--color-text);
  color: var(--color-bg-white);
  border-color: var(--color-text);
}
```

変更点: `display: flex; flex-wrap: wrap;` → `display: grid; grid-template-columns: repeat(3, 1fr);`、`border-radius: 999px` → `border-radius: 6px`、`text-align: center` 追加

- [ ] **Step 2: 既存テストが壊れていないか確認**

Run: `cd frontend && npx vitest run src/components/RecordModal/RecordModal.test.tsx`
Expected: ALL PASS（スタイルのみの変更なのでテストに影響なし）

- [ ] **Step 3: コミット**

```bash
git add frontend/src/components/ui/StatusSelector/StatusSelector.module.css
git commit -m "feat: StatusSelectorを3列グリッド+角丸四角スタイルに変更 (#75)"
```

---

## Task 3: RatingInput — 5列グリッドレイアウト

**Files:**
- Modify: `frontend/src/components/ui/RatingInput/RatingInput.module.css`
- Modify: `frontend/src/components/ui/RatingInput/RatingInput.tsx`

- [ ] **Step 1: RatingInputのCSSをグリッドレイアウトに変更**

`RatingInput.module.css` を以下に置き換える:

```css
.container {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.buttons {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 6px;
}

.button {
  height: 36px;
  border: var(--border-width) var(--border-style) var(--color-border-light);
  border-radius: 4px;
  background: var(--color-bg-white);
  color: var(--color-text-muted);
  font-family: var(--font-body);
  font-size: var(--font-size-meta);
  font-weight: var(--font-weight-bold);
  cursor: pointer;
  transition: all var(--transition-fast);
  text-align: center;
}

.button:hover {
  border-color: var(--color-border);
  color: var(--color-text);
}

.button.active {
  background: var(--color-text);
  color: var(--color-bg-white);
  border-color: var(--color-text);
}

.display {
  font-family: var(--font-body);
  font-size: var(--font-size-body);
  font-weight: var(--font-weight-bold);
  color: var(--color-text);
}
```

変更点: `.container` を `flex-direction: column` に（displayを下に）、`.buttons` を `display: grid; grid-template-columns: repeat(5, 1fr);` に、`.button` の `width: 2rem` を削除して `height: 36px` に

- [ ] **Step 2: RatingInput.tsxのレイアウト構造を変更**

`RatingInput.tsx` の `display` 部分を `buttons` の外に出す（container が column flexbox になるため）:

```tsx
import styles from './RatingInput.module.css'

type RatingInputProps = {
  value: number | null
  onChange: (rating: number | null) => void
}

const RATINGS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const

export function RatingInput({ value, onChange }: RatingInputProps) {
  const handleClick = (rating: number) => {
    onChange(rating === value ? null : rating)
  }

  return (
    <div className={styles.container}>
      <div className={styles.buttons}>
        {RATINGS.map((rating) => (
          <button
            key={rating}
            type="button"
            className={`${styles.button} ${value !== null && rating <= value ? styles.active : ''}`}
            onClick={() => handleClick(rating)}
            aria-label={String(rating)}
          >
            {rating}
          </button>
        ))}
      </div>
      {value !== null && <span className={styles.display}>{value} / 10</span>}
    </div>
  )
}
```

変更点: `.container` が元々 `display: flex; align-items: center; gap` でボタンとdisplayが横並びだったが、`flex-direction: column` で縦並びに変更。JSXの構造は同じ（`display` は既に `buttons` の外にある）。

- [ ] **Step 3: テストを実行してパスを確認**

Run: `cd frontend && npx vitest run src/components/RecordModal/RecordModal.test.tsx`
Expected: ALL PASS

- [ ] **Step 4: コミット**

```bash
git add frontend/src/components/ui/RatingInput/RatingInput.module.css frontend/src/components/ui/RatingInput/RatingInput.tsx
git commit -m "feat: RatingInputを5列グリッドレイアウトに変更 (#75)"
```

---

## Task 4: RecordModal — カード風レイアウトに変更

**Files:**
- Modify: `frontend/src/components/RecordModal/RecordModal.module.css`
- Modify: `frontend/src/components/RecordModal/RecordModal.tsx`

- [ ] **Step 1: RecordModal.module.cssをカード風レイアウトに変更**

`RecordModal.module.css` を以下に置き換える:

```css
.overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.modal {
  background: var(--color-bg-white);
  border-radius: 10px;
  padding: 28px;
  max-width: 400px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
}

.header {
  text-align: center;
  margin-bottom: var(--spacing-lg);
}

.title {
  font-family: var(--font-body);
  font-size: 18px;
  font-weight: var(--font-weight-bold);
  color: var(--color-text);
  margin: 0 0 var(--spacing-xs) 0;
}

.meta {
  font-family: var(--font-body);
  font-size: var(--font-size-meta);
  color: var(--color-text-muted);
  margin: 0;
}

.card {
  background: #f8f8f8;
  border-radius: 8px;
  padding: 14px;
  margin-bottom: 12px;
}

.label {
  display: block;
  font-family: var(--font-body);
  font-size: var(--font-size-meta);
  color: var(--color-text-muted);
  margin-bottom: var(--spacing-sm);
}

.actions {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-lg);
}
```

変更点:
- `.header` 追加（中央揃え）
- `.meta` から `margin-bottom` を削除（headerが管理）
- `.section` → `.card`（グレー背景 + 角丸 + パディング）
- `.actions` を `flex-direction: column`（フル幅縦並び）
- `.modal` の `padding` を `28px` に、`border-radius` を `10px` に

- [ ] **Step 2: RecordModal.tsxのJSX構造を更新**

`RecordModal.tsx` を以下に置き換える:

```tsx
import { useState } from 'react'
import type { MediaType, RecordStatus } from '../../lib/types'
import { StatusSelector } from '../ui/StatusSelector/StatusSelector'
import { RatingInput } from '../ui/RatingInput/RatingInput'
import { Button } from '../ui/Button/Button'
import styles from './RecordModal.module.css'

type RecordModalProps = {
  isOpen: boolean
  title: string
  mediaType: MediaType
  mediaTypeLabel: string
  onConfirm: (data: { status: RecordStatus; rating: number | null }) => void
  onCancel: () => void
  isLoading: boolean
}

export function RecordModal({
  isOpen,
  title,
  mediaType,
  mediaTypeLabel,
  onConfirm,
  onCancel,
  isLoading,
}: RecordModalProps) {
  const [status, setStatus] = useState<RecordStatus>('watching')
  const [rating, setRating] = useState<number | null>(null)

  if (!isOpen) return null

  const handleConfirm = () => {
    onConfirm({ status, rating })
  }

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3 className={styles.title}>{title}を記録</h3>
          <p className={styles.meta}>{mediaTypeLabel}</p>
        </div>

        <div className={styles.card}>
          <label className={styles.label}>ステータス</label>
          <StatusSelector value={status} onChange={setStatus} mediaType={mediaType} />
        </div>

        <div className={styles.card}>
          <label className={styles.label}>評価（任意）</label>
          <RatingInput value={rating} onChange={setRating} />
        </div>

        <div className={styles.actions}>
          <Button variant="primary" onClick={handleConfirm} disabled={isLoading}>
            {isLoading ? '記録中...' : '記録する'}
          </Button>
          <Button variant="secondary" onClick={onCancel}>
            キャンセル
          </Button>
        </div>
      </div>
    </div>
  )
}
```

変更点:
- `styles.section` → `styles.card`
- タイトル+メタを `styles.header` で囲む
- ボタン順序: primary（記録する）が先、secondary（キャンセル）が後
- デフォルトステータスは Task 1 で既に `watching` に変更済み

- [ ] **Step 3: テストを実行してパスを確認**

Run: `cd frontend && npx vitest run src/components/RecordModal/RecordModal.test.tsx`
Expected: ALL PASS

- [ ] **Step 4: コミット**

```bash
git add frontend/src/components/RecordModal/RecordModal.tsx frontend/src/components/RecordModal/RecordModal.module.css
git commit -m "feat: 記録モーダルをカード風グリッドレイアウトに改善 (#75)"
```

---

## Task 5: LibraryPage — フィルタUIをドロップダウンに変更 + テスト更新

**Files:**
- Modify: `frontend/src/pages/LibraryPage/LibraryPage.test.tsx`
- Modify: `frontend/src/pages/LibraryPage/LibraryPage.tsx`
- Modify: `frontend/src/pages/LibraryPage/LibraryPage.module.css`

- [ ] **Step 1: テストをドロップダウンUIに合わせて書き換え**

`LibraryPage.test.tsx` を以下に置き換える:

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { LibraryPage } from './LibraryPage'
import { recordsApi } from '../../lib/recordsApi'
import type { UserRecord } from '../../lib/types'

vi.mock('../../lib/recordsApi')

vi.mock('../../lib/tagsApi', () => ({
  tagsApi: {
    getAll: vi.fn().mockResolvedValue({ tags: [] }),
  },
}))

const mockRecord: UserRecord = {
  id: 1,
  work_id: 10,
  status: 'watching',
  rating: 8,
  current_episode: 12,
  rewatch_count: 0,
  started_at: '2026-01-15',
  completed_at: null,
  created_at: '2026-01-15T10:00:00Z',
  work: {
    id: 10,
    title: '進撃の巨人',
    media_type: 'anime',
    description: null,
    cover_image_url: null,
    total_episodes: 24,
    external_api_id: null,
    external_api_source: null,
    metadata: {},
    created_at: '2026-01-01T00:00:00Z',
  },
}

function renderPage(initialEntries = ['/library?status=watching']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <LibraryPage />
    </MemoryRouter>,
  )
}

describe('LibraryPage', () => {
  beforeEach(() => {
    vi.mocked(recordsApi.getAll).mockResolvedValue({
      records: [mockRecord],
      meta: { current_page: 1, total_pages: 1, total_count: 1, per_page: 20 },
    })
  })

  it('記録一覧が表示される', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('進撃の巨人')).toBeInTheDocument()
    })
  })

  it('マイライブラリのタイトルが表示される', () => {
    renderPage()
    expect(screen.getByText('マイライブラリ')).toBeInTheDocument()
  })

  it('デフォルトで status=watching でAPIを呼ぶ', async () => {
    renderPage()
    await waitFor(() => {
      expect(recordsApi.getAll).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'watching' }),
      )
    })
  })

  it('記録0件でフィルタ中のメッセージが表示される', async () => {
    vi.mocked(recordsApi.getAll).mockResolvedValue({
      records: [],
      meta: { current_page: 1, total_pages: 0, total_count: 0, per_page: 20 },
    })
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('条件に一致する記録がありません')).toBeInTheDocument()
    })
  })

  it('ステータスドロップダウンが表示される', () => {
    renderPage()
    const statusSelect = screen.getByLabelText('ステータス')
    expect(statusSelect).toBeInTheDocument()
    expect(statusSelect.tagName).toBe('SELECT')
  })

  it('ジャンルドロップダウンが表示される', () => {
    renderPage()
    const mediaTypeSelect = screen.getByLabelText('ジャンル')
    expect(mediaTypeSelect).toBeInTheDocument()
    expect(mediaTypeSelect.tagName).toBe('SELECT')
  })

  it('並び替えドロップダウンが表示される', () => {
    renderPage()
    const sortSelect = screen.getByLabelText('並び替え')
    expect(sortSelect).toBeInTheDocument()
    expect(sortSelect.tagName).toBe('SELECT')
  })

  it('ステータス変更でAPIが再呼び出しされる', async () => {
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('進撃の巨人')).toBeInTheDocument()
    })
    const statusSelect = screen.getByLabelText('ステータス')
    await user.selectOptions(statusSelect, 'completed')
    await waitFor(() => {
      expect(recordsApi.getAll).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'completed' }),
      )
    })
  })
})
```

変更点:
- ピルボタンのクリックテスト → ドロップダウンの`selectOptions`テストに変更
- 「絞り込み」ボタンのテスト → 削除（モバイル折りたたみ機能を廃止するため）
- 3つのドロップダウンの存在確認テストを追加

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `cd frontend && npx vitest run src/pages/LibraryPage/LibraryPage.test.tsx`
Expected: FAIL — まだピルボタンUIのため、`getByLabelText('ステータス')` が見つからない

- [ ] **Step 3: LibraryPage.tsxをドロップダウンUIに書き換え**

`LibraryPage.tsx` を以下に置き換える:

```tsx
import { useNavigate } from 'react-router-dom'
import { SectionTitle } from '../../components/ui/SectionTitle/SectionTitle'
import { getStatusOptions } from '../../components/StatusFilter/statusOptions'
import { MEDIA_TYPE_OPTIONS } from '../../components/MediaTypeFilter/mediaTypeOptions'
import { SORT_OPTIONS } from '../../components/SortSelector/sortOptions'
import type { SortOption } from '../../components/SortSelector/sortOptions'
import type { RecordStatus, MediaType } from '../../lib/types'
import { RecordListItem } from '../../components/RecordListItem/RecordListItem'
import { Pagination } from '../../components/ui/Pagination/Pagination'
import { Button } from '../../components/ui/Button/Button'
import { useLibrary } from './useLibrary'
import styles from './LibraryPage.module.css'

export function LibraryPage() {
  const navigate = useNavigate()
  const {
    records,
    totalPages,
    isLoading,
    error,
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
  } = useLibrary()

  const handleTagToggle = (tagName: string) => {
    const next = selectedTags.includes(tagName)
      ? selectedTags.filter((t) => t !== tagName)
      : [...selectedTags, tagName]
    setTags(next)
  }

  // 空状態の判定: status=all かつ mediaType=null のときのみガイド表示
  const isUnfilteredEmpty = status === null && mediaType === null

  const handleGoToSearch = () => {
    navigate('/search')
  }

  const statusOptions = getStatusOptions(mediaType)

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value
    setStatus(value === 'all' ? null : (value as RecordStatus))
  }

  const handleMediaTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value
    setMediaType(value === 'all' ? null : (value as MediaType))
  }

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSort(e.target.value as SortOption)
  }

  return (
    <div className={styles.page}>
      <SectionTitle>マイライブラリ</SectionTitle>

      {/* フィルタ: ドロップダウン3つ横並び */}
      <div className={styles.filters}>
        <div className={styles.filterItem}>
          <label htmlFor="status-filter" className={styles.filterLabel}>
            ステータス
          </label>
          <select
            id="status-filter"
            className={styles.filterSelect}
            value={status ?? 'all'}
            onChange={handleStatusChange}
          >
            {statusOptions.map((option) => (
              <option key={option.value ?? 'all'} value={option.value ?? 'all'}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.filterItem}>
          <label htmlFor="media-type-filter" className={styles.filterLabel}>
            ジャンル
          </label>
          <select
            id="media-type-filter"
            className={styles.filterSelect}
            value={mediaType ?? 'all'}
            onChange={handleMediaTypeChange}
          >
            {MEDIA_TYPE_OPTIONS.map((option) => (
              <option key={option.value ?? 'all'} value={option.value ?? 'all'}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.filterItem}>
          <label htmlFor="sort-filter" className={styles.filterLabel}>
            並び替え
          </label>
          <select
            id="sort-filter"
            className={styles.filterSelect}
            value={sort}
            onChange={handleSortChange}
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* タグフィルタ（タグが存在する場合のみ表示） */}
      {allTags.length > 0 && (
        <div className={styles.tagFilter}>
          <div className={styles.tagFilterLabel}>タグ</div>
          <div className={styles.tagChips}>
            {allTags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                className={`${styles.tagChip} ${selectedTags.includes(tag.name) ? styles.tagChipSelected : ''}`}
                onClick={() => handleTagToggle(tag.name)}
              >
                {tag.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <div className={styles.error}>{error}</div>}

      {isLoading && <div className={styles.loading}>読み込み中...</div>}

      {!isLoading && !error && records.length === 0 && (
        <div className={styles.empty}>
          {!isUnfilteredEmpty ? (
            <p className={styles.emptyText}>条件に一致する記録がありません</p>
          ) : (
            <div className={styles.emptyGuide}>
              <svg
                className={styles.emptyIcon}
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
                <path d="M8 7h6" />
                <path d="M8 11h4" />
              </svg>
              <p className={styles.emptyTitle}>作品を探して記録しましょう</p>
              <Button variant="primary" onClick={handleGoToSearch}>
                作品を検索する
              </Button>
            </div>
          )}
        </div>
      )}

      {!isLoading && !error && records.length > 0 && (
        <>
          <div className={styles.list}>
            {records.map((record) => (
              <RecordListItem key={record.id} record={record} />
            ))}
          </div>
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  )
}
```

変更点:
- `StatusFilter`、`MediaTypeFilter`、`SortSelector` コンポーネントのimportを削除
- `useState(filtersOpen)` を削除
- `findLabel` ヘルパー関数を削除
- フィルタ部分をネイティブ `<select>` 要素3つの横並びに変更
- モバイル用 `filterSummary`、`filterToggle` を削除
- タグフィルタはフィルタセクションの外に移動（独立表示）
- 各 `<select>` に `<label>` を紐付け（`htmlFor` + `id`）

- [ ] **Step 4: LibraryPage.module.cssをドロップダウンUIに書き換え**

`LibraryPage.module.css` を以下に置き換える:

```css
.page {
  max-width: 600px;
  margin: 0 auto;
  padding: var(--spacing-xl) var(--spacing-md);
}

.filters {
  display: flex;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-md);
}

.filterItem {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.filterLabel {
  font-family: var(--font-body);
  font-size: 11px;
  color: var(--color-text-muted);
  letter-spacing: 0.3px;
}

.filterSelect {
  font-family: var(--font-body);
  font-size: var(--font-size-meta);
  padding: 6px 12px;
  border: var(--border-width) var(--border-style) var(--color-border-light);
  background: var(--color-bg-white);
  color: var(--color-text);
  cursor: pointer;
  min-height: 36px;
}

.filterSelect:hover {
  border-color: var(--color-border);
}

.filterSelect:focus {
  outline: 2px solid var(--color-text);
  outline-offset: 1px;
}

.list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.loading {
  text-align: center;
  padding: var(--spacing-3xl) 0;
  color: var(--color-text-muted);
  font-family: var(--font-body);
  font-size: var(--font-size-body);
}

.error {
  text-align: center;
  padding: var(--spacing-lg);
  color: var(--color-error);
  font-family: var(--font-body);
  font-size: var(--font-size-body);
}

.empty {
  text-align: center;
  padding: var(--spacing-3xl) 0;
}

.emptyText {
  font-family: var(--font-body);
  font-size: var(--font-size-body);
  color: var(--color-text-muted);
}

.emptyGuide {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md);
}

.emptyIcon {
  color: var(--color-text-muted);
  margin-bottom: var(--spacing-sm);
}

.emptyTitle {
  font-family: var(--font-body);
  font-size: var(--font-size-body);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
}

/* --- タグフィルタ --- */

.tagFilter {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  margin-bottom: var(--spacing-md);
}

.tagFilterLabel {
  font-family: var(--font-body);
  font-size: var(--font-size-meta);
  color: var(--color-text-muted);
}

.tagChips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
}

.tagChip {
  font-family: var(--font-body);
  font-size: var(--font-size-meta);
  padding: var(--spacing-xs) var(--spacing-sm);
  border: var(--border-width-thin) solid var(--color-border-light);
  border-radius: 999px;
  background: none;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.tagChip:hover {
  border-color: var(--color-border);
  color: var(--color-text);
}

.tagChipSelected {
  background: var(--color-text);
  color: var(--color-bg-white);
  border-color: var(--color-text);
}

.tagChipSelected:hover {
  color: var(--color-bg-white);
}

@media (max-width: 768px) {
  .page {
    max-width: 100%;
    padding: var(--spacing-md);
  }
}
```

変更点:
- `.filters` を `display: flex;` 横並びに（元は `flex-direction: column`）
- `.filterItem`、`.filterLabel`、`.filterSelect` を新規追加
- モバイル用 `.filterSummary`、`.filterChips`、`.chip`、`.chipMuted`、`.filterToggle`、`.filtersOpen` を全削除
- モバイル時の `.filters { display: none }` を削除（常時表示に）

- [ ] **Step 5: テストを実行してパスを確認**

Run: `cd frontend && npx vitest run src/pages/LibraryPage/LibraryPage.test.tsx`
Expected: ALL PASS

- [ ] **Step 6: ESLintを実行してパスを確認**

Run: `cd frontend && npx eslint src/pages/LibraryPage/ src/components/RecordModal/ src/components/ui/StatusSelector/ src/components/ui/RatingInput/`
Expected: エラーなし

- [ ] **Step 7: コミット**

```bash
git add frontend/src/pages/LibraryPage/LibraryPage.tsx frontend/src/pages/LibraryPage/LibraryPage.module.css frontend/src/pages/LibraryPage/LibraryPage.test.tsx
git commit -m "feat: ライブラリフィルタをドロップダウンUIに変更 (#75)"
```

---

## Task 6: 全体テスト + リンター確認

**Files:** なし（確認のみ）

- [ ] **Step 1: フロントエンド全テスト実行**

Run: `cd frontend && npx vitest run`
Expected: ALL PASS

- [ ] **Step 2: ESLint全体実行**

Run: `cd frontend && npx eslint src/`
Expected: エラーなし

- [ ] **Step 3: TypeScriptコンパイルチェック**

Run: `cd frontend && npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 4: 未使用importの確認**

`StatusFilter`、`MediaTypeFilter`、`SortSelector` コンポーネントが LibraryPage.tsx からimportされていないことを確認。これらのコンポーネント自体は検索ページ等で使われている可能性があるため削除しない。
