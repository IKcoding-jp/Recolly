# 検索結果カードのジャケットクリック記録化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 検索結果カード（`WorkCard`）の「記録する」ボタンを廃止し、カード全体のクリック（ジャケット＋ジャンル＋タイトル）で `RecordModal` を開けるようにする。記録済み作品はモーダルを開いた上でフォームを無効化する。あわせてグリッド列数・ホバー効果をライブラリ画面に揃える。

**Architecture:** `WorkCard` を `<button>` を持つカードから `role="button"` を持つクリック可能なカード（div）に作り替える。記録済み判定は既存の `recordedIds`（`SearchPage` が保持）をそのまま流用し、新たに `RecordModal` にも `alreadyRecorded` propとして渡す。`RecordModal` は `alreadyRecorded=true` のとき内部の `StatusSelector` / `RatingSlider` を無効化し、確定ボタンを disabled にする。グリッド列数は `SearchPage.module.css` / `SearchSkeleton.module.css` の両方をライブラリ（`LibraryPage.module.css`）のブレークポイントに合わせる。

**Tech Stack:** React 19 / TypeScript / Vite / Vitest + React Testing Library / CSS Modules

## Global Constraints

- `any` 型の使用禁止
- スタイル値は `tokens.css` の CSS変数のみ使用（ハードコード禁止）
- フォーム入力要素は共通コンポーネント（`StatusSelector` / `RatingSlider` 等）を使用、HTML の `<input>` 等を直接使わない
- コメントは日本語で「なぜ」を書く
- 1ファイル200行以内を目安
- 未使用の import・変数・関数を残さない
- 全機能にテスト必須（TDD: 失敗するテストを先に書いてから実装する）

---

## Task 1: StatusSelector に disabled prop を追加

**Files:**
- Modify: `frontend/src/components/ui/StatusSelector/StatusSelector.tsx`
- Test: `frontend/src/components/ui/StatusSelector/StatusSelector.test.tsx`

**Interfaces:**
- Consumes: なし（既存コンポーネント単体）
- Produces: `StatusSelectorProps.disabled?: boolean`（デフォルト `false`）。`true` のとき全ステータスボタンが `disabled` になる。Task 3 で `RecordModal` から利用する。

- [ ] **Step 1: 失敗するテストを書く**

`frontend/src/components/ui/StatusSelector/StatusSelector.test.tsx` の末尾（`describe` ブロック内、最後の `it` の後）に追加:

```tsx
  it('disabled指定時は全ボタンが無効化される', () => {
    render(<StatusSelector value="watching" onChange={() => {}} mediaType="anime" disabled />)
    expect(screen.getByRole('button', { name: '視聴中' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '視聴完了' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '視聴予定' })).toBeDisabled()
  })
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `cd frontend && npx vitest run src/components/ui/StatusSelector/StatusSelector.test.tsx`
Expected: FAIL（`disabled` prop が存在せず、ボタンが disabled にならないため `toBeDisabled()` が失敗する）

- [ ] **Step 3: 最小実装**

`frontend/src/components/ui/StatusSelector/StatusSelector.tsx` を以下に置き換える:

```tsx
import type { MediaType, RecordStatus } from '../../../lib/types'
import { getStatusLabel } from '../../../lib/mediaTypeUtils'
import styles from './StatusSelector.module.css'

type StatusSelectorProps = {
  value: RecordStatus
  onChange: (status: RecordStatus) => void
  mediaType?: MediaType
  disabled?: boolean
}

const STATUS_VALUES: RecordStatus[] = [
  'watching',
  'completed',
  'on_hold',
  'dropped',
  'plan_to_watch',
]

export function StatusSelector({
  value,
  onChange,
  mediaType,
  disabled = false,
}: StatusSelectorProps) {
  return (
    <div className={styles.container}>
      {STATUS_VALUES.map((status) => {
        const label = getStatusLabel(status, mediaType)
        return (
          <button
            key={status}
            type="button"
            className={`${styles.tab} ${value === status ? styles.active : ''}`}
            onClick={() => onChange(status)}
            aria-label={label}
            disabled={disabled}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `cd frontend && npx vitest run src/components/ui/StatusSelector/StatusSelector.test.tsx`
Expected: PASS（全テスト）

- [ ] **Step 5: コミット**

```bash
git add frontend/src/components/ui/StatusSelector/StatusSelector.tsx frontend/src/components/ui/StatusSelector/StatusSelector.test.tsx
git commit -m "feat: StatusSelectorにdisabled propを追加"
```

---

## Task 2: RatingSlider に disabled prop を追加

**Files:**
- Modify: `frontend/src/components/ui/RatingSlider/RatingSlider.tsx`
- Test: `frontend/src/components/ui/RatingSlider/RatingSlider.test.tsx`

**Interfaces:**
- Consumes: なし（既存コンポーネント単体）
- Produces: `RatingSliderProps.disabled?: boolean`（デフォルト `false`）。`true` のとき `<input type="range">` が `disabled` になる。Task 3 で `RecordModal` から利用する。

- [ ] **Step 1: 失敗するテストを書く**

`frontend/src/components/ui/RatingSlider/RatingSlider.test.tsx` の末尾に追加:

```tsx
  it('disabled指定時はスライダーが無効化される', () => {
    render(<RatingSlider value={5} onChange={() => {}} disabled />)
    expect(screen.getByRole('slider')).toBeDisabled()
  })
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `cd frontend && npx vitest run src/components/ui/RatingSlider/RatingSlider.test.tsx`
Expected: FAIL（`disabled` prop が存在せず `toBeDisabled()` が失敗する）

- [ ] **Step 3: 最小実装**

`frontend/src/components/ui/RatingSlider/RatingSlider.tsx` の型定義と関数シグネチャ、`<input>` を以下のように変更する（他の行は変更しない）:

```tsx
type RatingSliderProps = {
  value: number
  onChange: (value: number) => void
  mediaType?: MediaType
  disabled?: boolean
}

export function RatingSlider({ value, onChange, mediaType, disabled = false }: RatingSliderProps) {
```

`<input type="range" ...>` に `disabled={disabled}` を追加:

```tsx
        <input
          type="range"
          min="0"
          max="10"
          step="1"
          value={value}
          onChange={handleChange}
          disabled={disabled}
          className={styles.slider}
          style={
            {
              background: sliderBackground,
              '--genre-color': genreColor,
            } as React.CSSProperties
          }
        />
```

- [ ] **Step 4: テストが通ることを確認**

Run: `cd frontend && npx vitest run src/components/ui/RatingSlider/RatingSlider.test.tsx`
Expected: PASS（全テスト）

- [ ] **Step 5: コミット**

```bash
git add frontend/src/components/ui/RatingSlider/RatingSlider.tsx frontend/src/components/ui/RatingSlider/RatingSlider.test.tsx
git commit -m "feat: RatingSliderにdisabled propを追加"
```

---

## Task 3: RecordModal に alreadyRecorded prop を追加

**Files:**
- Modify: `frontend/src/components/RecordModal/RecordModal.tsx`
- Modify: `frontend/src/components/RecordModal/RecordModal.module.css`
- Test: `frontend/src/components/RecordModal/RecordModal.test.tsx`

**Interfaces:**
- Consumes: `StatusSelectorProps.disabled`（Task 1）、`RatingSliderProps.disabled`（Task 2）
- Produces: `RecordModalProps.alreadyRecorded?: boolean`（デフォルト `false`）。Task 6 で `SearchPage` から `recordedIds.has(workKey)` を渡す。

- [ ] **Step 1: 失敗するテストを書く**

`frontend/src/components/RecordModal/RecordModal.test.tsx` の末尾（最後の `it` ブロックの後、`describe` の閉じ括弧の前）に追加:

```tsx

  describe('alreadyRecorded=true のとき', () => {
    const alreadyRecordedProps = {
      isOpen: true,
      title: '進撃の巨人',
      mediaType: 'anime' as const,
      mediaTypeLabel: 'アニメ',
      onConfirm: vi.fn(),
      onCancel: vi.fn(),
      isLoading: false,
      alreadyRecorded: true,
    }

    it('案内文が表示される', () => {
      render(<RecordModal {...alreadyRecordedProps} />)
      expect(screen.getByText('この作品はすでに記録済みです')).toBeInTheDocument()
    })

    it('確定ボタンが「記録済み」表示でdisabledになる', () => {
      render(<RecordModal {...alreadyRecordedProps} />)
      expect(screen.getByRole('button', { name: '記録済み' })).toBeDisabled()
    })

    it('ステータス・評価の入力が無効化される', () => {
      render(<RecordModal {...alreadyRecordedProps} />)
      expect(screen.getByRole('button', { name: '視聴中' })).toBeDisabled()
      expect(screen.getByRole('slider')).toBeDisabled()
    })

    it('キャンセルボタンは操作可能', async () => {
      const user = userEvent.setup()
      const handleCancel = vi.fn()
      render(<RecordModal {...alreadyRecordedProps} onCancel={handleCancel} />)
      await user.click(screen.getByRole('button', { name: 'キャンセル' }))
      expect(handleCancel).toHaveBeenCalled()
    })
  })
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `cd frontend && npx vitest run src/components/RecordModal/RecordModal.test.tsx`
Expected: FAIL（`alreadyRecorded` prop が存在せず、案内文が表示されず、確定ボタンが「記録する」のまま disabled にならない）

- [ ] **Step 3: 最小実装**

`frontend/src/components/RecordModal/RecordModal.tsx` を以下に置き換える:

```tsx
import { useState } from 'react'
import type { MediaType, RecordStatus } from '../../lib/types'
import { StatusSelector } from '../ui/StatusSelector/StatusSelector'
import { RatingSlider } from '../ui/RatingSlider/RatingSlider'
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
  alreadyRecorded?: boolean
}

export function RecordModal({
  isOpen,
  title,
  mediaType,
  mediaTypeLabel,
  onConfirm,
  onCancel,
  isLoading,
  alreadyRecorded = false,
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

        {alreadyRecorded && (
          <p className={styles.alreadyRecordedNotice}>この作品はすでに記録済みです</p>
        )}

        <div className={styles.card}>
          <label className={styles.label}>ステータス</label>
          <StatusSelector
            value={status}
            onChange={setStatus}
            mediaType={mediaType}
            disabled={alreadyRecorded}
          />
        </div>

        <div className={styles.card}>
          <label className={styles.label}>評価（任意）</label>
          <RatingSlider
            value={rating ?? 0}
            onChange={(v) => setRating(v === 0 ? null : v)}
            disabled={alreadyRecorded}
          />
        </div>

        <div className={styles.actions}>
          <Button
            variant="primary"
            onClick={handleConfirm}
            disabled={isLoading || alreadyRecorded}
          >
            {alreadyRecorded ? '記録済み' : isLoading ? '記録中...' : '記録する'}
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

`frontend/src/components/RecordModal/RecordModal.module.css` の末尾に追加:

```css

.alreadyRecordedNotice {
  font-family: var(--font-body);
  font-size: var(--font-size-meta);
  color: var(--color-text-muted);
  text-align: center;
  margin: 0 0 var(--spacing-md) 0;
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `cd frontend && npx vitest run src/components/RecordModal/RecordModal.test.tsx`
Expected: PASS（既存テスト・新規テストとも全てPASS。既存の `defaultProps` は `alreadyRecorded` を渡していないためデフォルト値 `false` で従来通り動作する）

- [ ] **Step 5: コミット**

```bash
git add frontend/src/components/RecordModal/RecordModal.tsx frontend/src/components/RecordModal/RecordModal.module.css frontend/src/components/RecordModal/RecordModal.test.tsx
git commit -m "feat: RecordModalにalreadyRecorded propを追加"
```

---

## Task 4: WorkCard のボタンを廃止しカード全体をクリック可能にする

**Files:**
- Modify: `frontend/src/components/WorkCard/WorkCard.tsx`
- Modify: `frontend/src/components/WorkCard/WorkCard.module.css`
- Test: `frontend/src/components/WorkCard/WorkCard.test.tsx`

**Interfaces:**
- Consumes: なし
- Produces: `WorkCardProps`（`isLoading` を削除）。カード要素は `role="button"` `tabIndex={0}`。`aria-label` は未記録時 `` `${work.title}を記録する` ``、記録済み時 `` `${work.title}（記録済み）` ``。クリック・Enter/Spaceキーで `onRecord(work)` を呼ぶ（記録済みでも呼ぶ）。Task 6 で `SearchPage` から利用する。

- [ ] **Step 1: 失敗するテストを書く**

`frontend/src/components/WorkCard/WorkCard.test.tsx` を以下に置き換える:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WorkCard } from './WorkCard'
import type { SearchResult } from '../../lib/types'

const mockWork: SearchResult = {
  title: 'テスト作品',
  media_type: 'anime',
  description: 'テストの説明文',
  cover_image_url: 'https://example.com/cover.jpg',
  total_episodes: 12,
  external_api_id: '123',
  external_api_source: 'anilist',
  metadata: {},
}

describe('WorkCard', () => {
  it('作品タイトルが表示される', () => {
    render(<WorkCard work={mockWork} onRecord={vi.fn()} />)
    expect(screen.getByText('テスト作品')).toBeInTheDocument()
  })

  it('ジャンルラベルが表示される', () => {
    render(<WorkCard work={mockWork} onRecord={vi.fn()} />)
    expect(screen.getByText('アニメ')).toBeInTheDocument()
  })

  it('「記録する」ボタンは表示されない（カード全体がクリック対象のため）', () => {
    render(<WorkCard work={mockWork} onRecord={vi.fn()} />)
    expect(screen.queryByRole('button', { name: '記録する' })).not.toBeInTheDocument()
  })

  it('カードクリックでコールバックが呼ばれる', async () => {
    const onRecord = vi.fn()
    render(<WorkCard work={mockWork} onRecord={onRecord} />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'テスト作品を記録する' }))
    expect(onRecord).toHaveBeenCalledWith(mockWork)
  })

  it('Enterキーでコールバックが呼ばれる', async () => {
    const onRecord = vi.fn()
    render(<WorkCard work={mockWork} onRecord={onRecord} />)
    const user = userEvent.setup()
    screen.getByRole('button', { name: 'テスト作品を記録する' }).focus()
    await user.keyboard('{Enter}')
    expect(onRecord).toHaveBeenCalledWith(mockWork)
  })

  it('記録済みの場合はカードクリックでもコールバックが呼ばれる', async () => {
    const onRecord = vi.fn()
    render(<WorkCard work={mockWork} onRecord={onRecord} isRecorded />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'テスト作品（記録済み）' }))
    expect(onRecord).toHaveBeenCalledWith(mockWork)
  })

  it('記録済みの場合は「記録済み」と表示される', () => {
    render(<WorkCard work={mockWork} onRecord={vi.fn()} isRecorded />)
    expect(screen.getByText('記録済み')).toBeInTheDocument()
  })

  it('カバー画像が表示される', () => {
    render(<WorkCard work={mockWork} onRecord={vi.fn()} />)
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('src', 'https://example.com/cover.jpg')
  })

  it('記録済みの場合は「記録済み」がaction領域に表示される', () => {
    const { container } = render(<WorkCard work={mockWork} onRecord={vi.fn()} isRecorded />)
    const action = container.querySelector('[class*="action"]')
    expect(action?.textContent).toBe('記録済み')
  })

  it('説明文は表示しない（ADR-0044: 検索カードはジャケット・ジャンル・タイトルのみ）', () => {
    render(<WorkCard work={mockWork} onRecord={vi.fn()} />)
    expect(screen.queryByText('テストの説明文')).not.toBeInTheDocument()
  })

  it('カバー画像がない場合はプレースホルダーを表示する', () => {
    const { container } = render(
      <WorkCard work={{ ...mockWork, cover_image_url: null }} onRecord={vi.fn()} />,
    )
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(container.querySelector('[class*="coverPlaceholder"]')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `cd frontend && npx vitest run src/components/WorkCard/WorkCard.test.tsx`
Expected: FAIL（`role="button" name="テスト作品を記録する"` が存在しない。現状は「記録する」という名前のボタンが存在するため「表示されない」テストも失敗する）

- [ ] **Step 3: 最小実装**

`frontend/src/components/WorkCard/WorkCard.tsx` を以下に置き換える:

```tsx
import type { KeyboardEvent } from 'react'
import type { SearchResult, MediaType } from '../../lib/types'
import styles from './WorkCard.module.css'

type WorkCardProps = {
  work: SearchResult
  onRecord: (work: SearchResult) => void
  isRecorded?: boolean
}

const MEDIA_TYPE_LABELS: Record<MediaType, string> = {
  anime: 'アニメ',
  movie: '映画',
  drama: 'ドラマ',
  book: '本',
  manga: '漫画',
  game: 'ゲーム',
}

// ジャケット主体の縦型カード（ADR-0044）。カード全体のクリックで記録モーダルを開く
export function WorkCard({ work, onRecord, isRecorded = false }: WorkCardProps) {
  const handleClick = () => {
    onRecord(work)
  }

  // ボタンではなくdivをクリック対象にしているため、Enter/Spaceキー操作を自前で処理する
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onRecord(work)
    }
  }

  return (
    <div
      className={styles.card}
      role="button"
      tabIndex={0}
      aria-label={isRecorded ? `${work.title}（記録済み）` : `${work.title}を記録する`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <div className={styles.coverWrapper}>
        {work.cover_image_url ? (
          <img
            className={styles.cover}
            src={work.cover_image_url}
            alt={`${work.title}のカバー画像`}
            loading="lazy"
          />
        ) : (
          <div className={styles.coverPlaceholder} />
        )}
      </div>
      <div className={styles.info}>
        <span className={`${styles.genre} ${styles[work.media_type]}`}>
          {MEDIA_TYPE_LABELS[work.media_type]}
        </span>
        <h3 className={styles.title}>{work.title}</h3>
      </div>
      <div className={styles.action}>
        {isRecorded && <span className={styles.recorded}>記録済み</span>}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `cd frontend && npx vitest run src/components/WorkCard/WorkCard.test.tsx`
Expected: PASS（全テスト）

- [ ] **Step 5: ホバー効果をライブラリ（RecordCardItem）に揃える**

`frontend/src/components/WorkCard/WorkCard.module.css` の `.card` と `.card:hover` を以下に置き換える:

```css
.card {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm);
  /* グリッドセル全体を埋め、タイトル行数の差でカード高さがばらつかないようにする */
  height: 100%;
  background-color: var(--color-bg-white);
  border: var(--border-width-thin) var(--border-style) var(--color-border-light);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition:
    background-color var(--transition-fast),
    box-shadow var(--transition-fast),
    transform var(--transition-fast);
}

.card:hover {
  background-color: var(--color-bg);
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}
```

- [ ] **Step 6: テストが引き続き通ることを確認**

Run: `cd frontend && npx vitest run src/components/WorkCard/WorkCard.test.tsx`
Expected: PASS（CSSのみの変更のためテスト結果に影響なし）

- [ ] **Step 7: コミット**

```bash
git add frontend/src/components/WorkCard/WorkCard.tsx frontend/src/components/WorkCard/WorkCard.module.css frontend/src/components/WorkCard/WorkCard.test.tsx
git commit -m "feat: WorkCardの記録ボタンを廃止しカード全体をクリック可能にする"
```

---

## Task 5: SearchSkeleton の列数をライブラリに合わせる

**Files:**
- Modify: `frontend/src/components/SearchSkeleton/SearchSkeleton.tsx`
- Modify: `frontend/src/components/SearchSkeleton/SearchSkeleton.module.css`
- Test: `frontend/src/components/SearchSkeleton/SearchSkeleton.test.tsx`

**Interfaces:**
- Consumes: なし
- Produces: なし（`SearchPage` からは props なしで呼び出される既存の関係を維持）

- [ ] **Step 1: 失敗するテストを書く**

`frontend/src/components/SearchSkeleton/SearchSkeleton.test.tsx` の `toHaveLength(5)` を `toHaveLength(6)` に、テスト名も合わせて変更する:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SearchSkeleton } from './SearchSkeleton'

describe('SearchSkeleton', () => {
  it('スケルトンカードがグリッド1行分（6枚）レンダリングされる', () => {
    render(<SearchSkeleton />)
    const cards = screen.getAllByRole('status')
    expect(cards).toHaveLength(6)
  })

  it('各カードにaria-labelが設定されている', () => {
    render(<SearchSkeleton />)
    const cards = screen.getAllByRole('status')
    cards.forEach((card) => {
      expect(card).toHaveAttribute('aria-label', '読み込み中')
    })
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `cd frontend && npx vitest run src/components/SearchSkeleton/SearchSkeleton.test.tsx`
Expected: FAIL（`SKELETON_COUNT` が5のままのため `cards` の長さが5になり、期待値6と一致しない）

- [ ] **Step 3: 最小実装**

`frontend/src/components/SearchSkeleton/SearchSkeleton.tsx` を以下に置き換える（記録ボタンを廃止したため `buttonPlaceholder` も削除する）:

```tsx
import styles from './SearchSkeleton.module.css'

// グリッド1行分（PC6列）を埋める数
const SKELETON_COUNT = 6

// 各カードのシマー開始タイミングをずらすためのディレイ
const ANIMATION_DELAYS = ['0s', '0.1s', '0.2s', '0.3s', '0.4s', '0.5s']

// ジャケット主体の縦型カード（WorkCard）と同じ形のスケルトンをグリッド表示する
export function SearchSkeleton() {
  return (
    <div className={styles.container}>
      {Array.from({ length: SKELETON_COUNT }, (_, i) => (
        <div key={i} className={styles.card} role="status" aria-label="読み込み中">
          <div
            className={styles.coverPlaceholder}
            style={{ animationDelay: ANIMATION_DELAYS[i] }}
          />
          <div className={styles.info}>
            <div
              className={`${styles.line} ${styles.lineGenre}`}
              style={{ animationDelay: ANIMATION_DELAYS[i] }}
            />
            <div
              className={`${styles.line} ${styles.lineTitle}`}
              style={{ animationDelay: ANIMATION_DELAYS[i] }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
```

`frontend/src/components/SearchSkeleton/SearchSkeleton.module.css` を以下に置き換える（列数をライブラリ基準の6/4/3・ブレークポイントを1024px/768pxに変更し、`.buttonPlaceholder` を削除）:

```css
/* WorkCard の縦型カードと同じ形・同じグリッド列数のスケルトン（ライブラリ画面のグリッドに合わせる） */
.container {
  margin-top: var(--spacing-lg);
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: var(--spacing-md);
}

.card {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm);
  border: var(--border-width-thin) var(--border-style) var(--color-border-light);
  border-radius: var(--radius-md);
}

.coverPlaceholder {
  width: 100%;
  aspect-ratio: 2 / 3;
  border-radius: var(--radius-sm);
  background: linear-gradient(
    90deg,
    var(--color-border-light) 25%,
    var(--color-skeleton-highlight) 50%,
    var(--color-border-light) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

.info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.line {
  border-radius: var(--radius-sm);
  background: linear-gradient(
    90deg,
    var(--color-border-light) 25%,
    var(--color-skeleton-highlight) 50%,
    var(--color-border-light) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

.lineGenre {
  height: 10px;
  width: 50%;
}

.lineTitle {
  height: 14px;
  width: 85%;
}

@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

@media (max-width: 1024px) {
  .container {
    grid-template-columns: repeat(4, 1fr);
  }
}

@media (max-width: 768px) {
  .container {
    grid-template-columns: repeat(3, 1fr);
  }
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `cd frontend && npx vitest run src/components/SearchSkeleton/SearchSkeleton.test.tsx`
Expected: PASS（全テスト）

- [ ] **Step 5: コミット**

```bash
git add frontend/src/components/SearchSkeleton/SearchSkeleton.tsx frontend/src/components/SearchSkeleton/SearchSkeleton.module.css frontend/src/components/SearchSkeleton/SearchSkeleton.test.tsx
git commit -m "feat: SearchSkeletonの列数をライブラリのグリッドに合わせる"
```

---

## Task 6: SearchPage の統合（グリッドCSS・props配線・テスト更新）

**Files:**
- Modify: `frontend/src/pages/SearchPage/SearchPage.tsx`
- Modify: `frontend/src/pages/SearchPage/SearchPage.module.css`
- Test: `frontend/src/pages/SearchPage/SearchPage.test.tsx`

**Interfaces:**
- Consumes: `WorkCardProps`（Task 4、`isLoading` を渡さない）、`RecordModalProps.alreadyRecorded`（Task 3）
- Produces: なし（ページコンポーネント）

- [ ] **Step 1: 失敗するテストを書く**

`frontend/src/pages/SearchPage/SearchPage.test.tsx` を以下の3箇所修正する。

(a) 219行目付近の「連続で異なる作品を記録する際にステータス・評価がリセットされる」テスト内、ボタン取得部分を置き換える:

- 263〜265行目を置き換え:
```tsx
    // 作品Aのカードをクリック → RecordModal が開く
    await user.click(screen.getByRole('button', { name: '作品Aを記録する' }))
```
- 288〜290行目を置き換え:
```tsx
    // モーダル内の「記録する」をクリック
    await user.click(screen.getByRole('button', { name: '記録する' }))
```
- 297〜299行目を置き換え:
```tsx
    // 作品Bのカードをクリック → RecordModal が開く
    await user.click(screen.getByRole('button', { name: '作品Bを記録する' }))
```
- 315〜317行目を置き換え:
```tsx
    // 何も変更せずにそのまま「記録する」をクリック
    await user.click(screen.getByRole('button', { name: '記録する' }))
```

(b) 340行目「検索中にスケルトンUIとプログレスが表示される」テスト内:
```tsx
    await waitFor(() => {
      expect(screen.getAllByRole('status')).toHaveLength(6)
    })
```

(c) 627行目「検索結果から記録を作成したら record_created を media_type 付きで発火する」テスト内、661〜662行目を置き換え:
```tsx
    // 記録モーダルを開く
    await user.click(screen.getByRole('button', { name: 'テストアニメを記録する' }))
```
678〜679行目を置き換え:
```tsx
    // モーダル内の「記録する」をクリック
    await user.click(screen.getByRole('button', { name: '記録する' }))
```

(d) ファイル末尾（最後の `it` ブロックの後、`describe` の閉じ括弧の前）に新規テストを追加:
```tsx

  it('記録済みの作品カードをクリックするとモーダルは開くが確定できない', async () => {
    renderSearchPage()
    const user = userEvent.setup()

    // 検索API: アニメ作品 1 件を返す
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          results: [
            {
              title: 'テストアニメ',
              media_type: 'anime',
              description: 'アニメ説明',
              cover_image_url: null,
              total_episodes: 12,
              external_api_id: '1',
              external_api_source: 'anilist',
              metadata: {},
            },
          ],
        }),
    })

    const searchInput = await screen.findByPlaceholderText('作品を検索...')
    await user.type(searchInput, 'テスト')
    await user.keyboard('{Enter}')

    await waitFor(() => {
      expect(screen.getByText('テストアニメ')).toBeInTheDocument()
    })

    // 1回目のクリック: 記録APIが409を返す（既に他経路で記録済み）
    await user.click(screen.getByRole('button', { name: 'テストアニメを記録する' }))
    await waitFor(() => {
      expect(screen.getByText('テストアニメを記録')).toBeInTheDocument()
    })

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: () => Promise.resolve({ error: '既に記録済みです' }),
    })
    await user.click(screen.getByRole('button', { name: '記録する' }))

    // モーダルが閉じ、カードが「記録済み」表示になる
    await waitFor(() => {
      expect(screen.queryByText('テストアニメを記録')).not.toBeInTheDocument()
    })
    expect(screen.getByText('記録済み')).toBeInTheDocument()

    // 2回目のクリック: 記録済みカードをクリックしてもモーダルは開く
    await user.click(screen.getByRole('button', { name: 'テストアニメ（記録済み）' }))
    await waitFor(() => {
      expect(screen.getByText('テストアニメを記録')).toBeInTheDocument()
    })
    expect(screen.getByText('この作品はすでに記録済みです')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '記録済み' })).toBeDisabled()
  })
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `cd frontend && npx vitest run src/pages/SearchPage/SearchPage.test.tsx`
Expected: FAIL（`WorkCard` がまだ `role="button" name="...を記録する"` を持たず、`RecordModal` に `alreadyRecorded` が渡っていないため新規テストも失敗する）

- [ ] **Step 3: 実装**

`frontend/src/pages/SearchPage/SearchPage.tsx` の `WorkCard` 呼び出し（`isLoading` 行を削除）:

```tsx
                  <WorkCard
                    work={work}
                    onRecord={handleOpenModal}
                    isRecorded={recordedIds.has(workKey)}
                  />
```

`RecordModal` 呼び出しに `alreadyRecorded` を追加:

```tsx
      <RecordModal
        key={
          modalWork
            ? `${modalWork.external_api_source ?? 'manual'}:${modalWork.external_api_id ?? manualWorkId}`
            : 'closed'
        }
        isOpen={modalWork !== null}
        title={modalWork?.title ?? ''}
        mediaType={modalWork?.media_type ?? 'anime'}
        mediaTypeLabel={modalWork ? getGenreLabel(modalWork.media_type) : ''}
        onConfirm={handleConfirmRecord}
        onCancel={() => {
          setModalWork(null)
          setManualWorkId(null)
        }}
        isLoading={loadingId !== null}
        alreadyRecorded={
          modalWork
            ? recordedIds.has(`${modalWork.external_api_source}:${modalWork.external_api_id}`)
            : false
        }
      />
```

`frontend/src/pages/SearchPage/SearchPage.module.css` の `.results` グリッドをライブラリ基準に変更:

```css
/* ジャケット主体の縦型カードを並べるグリッド（ADR-0044）。列数はライブラリ画面のグリッドに合わせる */
.results {
  margin-top: var(--spacing-lg);
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: var(--spacing-md);
}

@media (max-width: 1024px) {
  .results {
    grid-template-columns: repeat(4, 1fr);
  }
}

@media (max-width: 768px) {
  .results {
    grid-template-columns: repeat(3, 1fr);
  }
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `cd frontend && npx vitest run src/pages/SearchPage/SearchPage.test.tsx`
Expected: PASS（全テスト）

- [ ] **Step 5: フロントエンド全体のテスト・lintを実行**

Run: `cd frontend && npm run test`
Expected: PASS（全テストスイート）

Run: `cd frontend && npm run lint`
Expected: エラーなし

- [ ] **Step 6: コミット**

```bash
git add frontend/src/pages/SearchPage/SearchPage.tsx frontend/src/pages/SearchPage/SearchPage.module.css frontend/src/pages/SearchPage/SearchPage.test.tsx
git commit -m "feat: SearchPageのグリッドをライブラリに揃えジャケットクリックで記録モーダルを開く"
```

---

## 完了条件

- [ ] 全タスクのテストがPASSしている
- [ ] `cd frontend && npm run test` が全体でPASSする
- [ ] `cd frontend && npm run lint` がエラーなしで通る
- [ ] `docs/superpowers/plans/2026-07-17-search-card-click-to-record.md`（本ファイル）のチェックボックスが全て完了している
