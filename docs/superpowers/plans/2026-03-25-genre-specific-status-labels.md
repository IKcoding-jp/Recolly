# ジャンル別ステータスラベル対応 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ステータスラベル（視聴中/視聴完了/視聴予定）をジャンルに応じた表現に変更する

**Architecture:** `mediaTypeUtils.ts` にステータスラベル取得関数を集約し、各コンポーネントのハードコードされたラベルを置き換える。バックエンドは変更なし。

**Tech Stack:** TypeScript / React / Vitest + React Testing Library

**Spec:** `docs/superpowers/specs/2026-03-25-genre-specific-status-labels-design.md`

---

### Task 1: ユーティリティ関数の追加（getStatusLabel / getStatusOptions）

**Files:**
- Modify: `frontend/src/lib/mediaTypeUtils.ts`
- Modify: `frontend/src/lib/mediaTypeUtils.test.ts`

- [ ] **Step 1: getStatusLabel のテストを書く**

```typescript
// mediaTypeUtils.test.ts に追記
import { getStatusLabel, getStatusOptions, /* 既存のimport */ } from './mediaTypeUtils'

describe('getStatusLabel', () => {
  // 映像系（anime / movie / drama）
  it('アニメの watching は「視聴中」を返す', () => {
    expect(getStatusLabel('watching', 'anime')).toBe('視聴中')
  })
  it('映画の completed は「視聴完了」を返す', () => {
    expect(getStatusLabel('completed', 'movie')).toBe('視聴完了')
  })
  it('ドラマの plan_to_watch は「視聴予定」を返す', () => {
    expect(getStatusLabel('plan_to_watch', 'drama')).toBe('視聴予定')
  })

  // 読み物系（book / manga）
  it('本の watching は「読書中」を返す', () => {
    expect(getStatusLabel('watching', 'book')).toBe('読書中')
  })
  it('漫画の completed は「読了」を返す', () => {
    expect(getStatusLabel('completed', 'manga')).toBe('読了')
  })
  it('本の plan_to_watch は「読書予定」を返す', () => {
    expect(getStatusLabel('plan_to_watch', 'book')).toBe('読書予定')
  })

  // ゲーム
  it('ゲームの watching は「プレイ中」を返す', () => {
    expect(getStatusLabel('watching', 'game')).toBe('プレイ中')
  })
  it('ゲームの completed は「プレイ完了」を返す', () => {
    expect(getStatusLabel('completed', 'game')).toBe('プレイ完了')
  })
  it('ゲームの plan_to_watch は「プレイ予定」を返す', () => {
    expect(getStatusLabel('plan_to_watch', 'game')).toBe('プレイ予定')
  })

  // 共通（on_hold / dropped はジャンル問わず同じ）
  it('on_hold はジャンル問わず「一時停止」を返す', () => {
    expect(getStatusLabel('on_hold', 'anime')).toBe('一時停止')
    expect(getStatusLabel('on_hold', 'book')).toBe('一時停止')
    expect(getStatusLabel('on_hold', 'game')).toBe('一時停止')
  })
  it('dropped はジャンル問わず「中断」を返す', () => {
    expect(getStatusLabel('dropped', 'anime')).toBe('中断')
    expect(getStatusLabel('dropped', 'book')).toBe('中断')
    expect(getStatusLabel('dropped', 'game')).toBe('中断')
  })

  // 汎用（mediaType 未指定）
  it('mediaType 未指定の watching は「進行中」を返す', () => {
    expect(getStatusLabel('watching')).toBe('進行中')
  })
  it('mediaType 未指定の completed は「完了」を返す', () => {
    expect(getStatusLabel('completed')).toBe('完了')
  })
  it('mediaType 未指定の plan_to_watch は「予定」を返す', () => {
    expect(getStatusLabel('plan_to_watch')).toBe('予定')
  })
  it('mediaType が null の場合も汎用ラベルを返す', () => {
    expect(getStatusLabel('watching', null as unknown as undefined)).toBe('進行中')
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `cd frontend && npx vitest run src/lib/mediaTypeUtils.test.ts`
Expected: FAIL — `getStatusLabel is not a function`

- [ ] **Step 3: getStatusLabel を実装する**

```typescript
// mediaTypeUtils.ts に追記

import type { MediaType, RecordStatus } from './types'

// ジャンル別ステータスラベル定義
const STATUS_LABELS: Record<
  RecordStatus,
  { video: string; reading: string; game: string; generic: string }
> = {
  watching: { video: '視聴中', reading: '読書中', game: 'プレイ中', generic: '進行中' },
  completed: { video: '視聴完了', reading: '読了', game: 'プレイ完了', generic: '完了' },
  plan_to_watch: { video: '視聴予定', reading: '読書予定', game: 'プレイ予定', generic: '予定' },
  on_hold: { video: '一時停止', reading: '一時停止', game: '一時停止', generic: '一時停止' },
  dropped: { video: '中断', reading: '中断', game: '中断', generic: '中断' },
}

// メディアタイプからラベルグループを特定するマッピング
const MEDIA_TYPE_GROUP: Record<MediaType, 'video' | 'reading' | 'game'> = {
  anime: 'video',
  movie: 'video',
  drama: 'video',
  book: 'reading',
  manga: 'reading',
  game: 'game',
}

/** ジャンルに応じたステータスラベルを返す。mediaType 未指定時は汎用ラベル */
export function getStatusLabel(status: RecordStatus, mediaType?: MediaType | null): string {
  const group = mediaType ? MEDIA_TYPE_GROUP[mediaType] : null
  return STATUS_LABELS[status][group ?? 'generic']
}
```

- [ ] **Step 4: テストがパスすることを確認**

Run: `cd frontend && npx vitest run src/lib/mediaTypeUtils.test.ts`
Expected: ALL PASS

- [ ] **Step 5: getStatusOptions のテストを書く**

```typescript
// mediaTypeUtils.test.ts に追記
describe('getStatusOptions', () => {
  it('mediaType 未指定時は汎用ラベルの配列を返す', () => {
    const options = getStatusOptions()
    expect(options[0]).toEqual({ value: null, label: 'すべて' })
    expect(options[1]).toEqual({ value: 'watching', label: '進行中' })
    expect(options[2]).toEqual({ value: 'completed', label: '完了' })
  })

  it('anime 指定時は映像系ラベルの配列を返す', () => {
    const options = getStatusOptions('anime')
    expect(options[1]).toEqual({ value: 'watching', label: '視聴中' })
    expect(options[2]).toEqual({ value: 'completed', label: '視聴完了' })
  })

  it('book 指定時は読み物系ラベルの配列を返す', () => {
    const options = getStatusOptions('book')
    expect(options[1]).toEqual({ value: 'watching', label: '読書中' })
    expect(options[2]).toEqual({ value: 'completed', label: '読了' })
  })

  it('常に6つのオプション（すべて + 5ステータス）を返す', () => {
    expect(getStatusOptions()).toHaveLength(6)
    expect(getStatusOptions('game')).toHaveLength(6)
  })
})
```

- [ ] **Step 6: テストが失敗することを確認**

Run: `cd frontend && npx vitest run src/lib/mediaTypeUtils.test.ts`
Expected: FAIL — `getStatusOptions is not a function`

- [ ] **Step 7: getStatusOptions を実装する**

```typescript
// mediaTypeUtils.ts に追記

// ステータスの表示順序
const STATUS_ORDER: RecordStatus[] = ['watching', 'completed', 'on_hold', 'dropped', 'plan_to_watch']

/** ステータスフィルター用のオプション配列を返す（「すべて」付き） */
export function getStatusOptions(
  mediaType?: MediaType | null,
): { value: RecordStatus | null; label: string }[] {
  return [
    { value: null, label: 'すべて' },
    ...STATUS_ORDER.map((status) => ({
      value: status,
      label: getStatusLabel(status, mediaType),
    })),
  ]
}
```

- [ ] **Step 8: テストがパスすることを確認**

Run: `cd frontend && npx vitest run src/lib/mediaTypeUtils.test.ts`
Expected: ALL PASS

- [ ] **Step 9: コミット**

```bash
git add frontend/src/lib/mediaTypeUtils.ts frontend/src/lib/mediaTypeUtils.test.ts
git commit -m "feat: getStatusLabel / getStatusOptions ユーティリティ関数を追加"
```

---

### Task 2: StatusSelector に mediaType prop を追加

**Files:**
- Modify: `frontend/src/components/ui/StatusSelector/StatusSelector.tsx`
- Modify: `frontend/src/components/ui/StatusSelector/StatusSelector.test.tsx`

- [ ] **Step 1: テストを更新する**

既存テストの `'視聴中'` 等のハードコードラベルをそのまま残しつつ（デフォルト動作の確認）、mediaType 指定時のテストを追加する。

```typescript
// StatusSelector.test.tsx を以下に書き換え
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StatusSelector } from './StatusSelector'

describe('StatusSelector', () => {
  it('mediaType 未指定時は汎用ラベルで表示される', () => {
    render(<StatusSelector value="watching" onChange={() => {}} />)
    expect(screen.getByRole('button', { name: '進行中' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '完了' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '一時停止' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '中断' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '予定' })).toBeInTheDocument()
  })

  it('anime 指定時は映像系ラベルで表示される', () => {
    render(<StatusSelector value="watching" onChange={() => {}} mediaType="anime" />)
    expect(screen.getByRole('button', { name: '視聴中' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '視聴完了' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '視聴予定' })).toBeInTheDocument()
  })

  it('book 指定時は読み物系ラベルで表示される', () => {
    render(<StatusSelector value="watching" onChange={() => {}} mediaType="book" />)
    expect(screen.getByRole('button', { name: '読書中' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '読了' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '読書予定' })).toBeInTheDocument()
  })

  it('game 指定時はゲーム用ラベルで表示される', () => {
    render(<StatusSelector value="watching" onChange={() => {}} mediaType="game" />)
    expect(screen.getByRole('button', { name: 'プレイ中' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'プレイ完了' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'プレイ予定' })).toBeInTheDocument()
  })

  it('現在の値がアクティブ表示される', () => {
    render(<StatusSelector value="watching" onChange={() => {}} mediaType="anime" />)
    const button = screen.getByRole('button', { name: '視聴中' })
    expect(button.className).toContain('active')
  })

  it('ボタンクリックで onChange が呼ばれる', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()
    render(<StatusSelector value="watching" onChange={handleChange} mediaType="anime" />)
    await user.click(screen.getByRole('button', { name: '視聴完了' }))
    expect(handleChange).toHaveBeenCalledWith('completed')
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `cd frontend && npx vitest run src/components/ui/StatusSelector/StatusSelector.test.tsx`
Expected: FAIL — 汎用ラベル「進行中」等が見つからない

- [ ] **Step 3: StatusSelector を更新する**

```typescript
// StatusSelector.tsx を以下に書き換え
import type { MediaType, RecordStatus } from '../../../lib/types'
import { getStatusLabel } from '../../../lib/mediaTypeUtils'
import styles from './StatusSelector.module.css'

type StatusSelectorProps = {
  value: RecordStatus
  onChange: (status: RecordStatus) => void
  mediaType?: MediaType
}

const STATUS_VALUES: RecordStatus[] = [
  'watching',
  'completed',
  'on_hold',
  'dropped',
  'plan_to_watch',
]

export function StatusSelector({ value, onChange, mediaType }: StatusSelectorProps) {
  return (
    <div className={styles.container}>
      {STATUS_VALUES.map((status) => {
        const label = getStatusLabel(status, mediaType)
        return (
          <button
            key={status}
            type="button"
            className={`${styles.pill} ${value === status ? styles.active : ''}`}
            onClick={() => onChange(status)}
            aria-label={label}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: テストがパスすることを確認**

Run: `cd frontend && npx vitest run src/components/ui/StatusSelector/StatusSelector.test.tsx`
Expected: ALL PASS

- [ ] **Step 5: コミット**

```bash
git add frontend/src/components/ui/StatusSelector/StatusSelector.tsx frontend/src/components/ui/StatusSelector/StatusSelector.test.tsx
git commit -m "feat: StatusSelector にジャンル別ステータスラベルを対応"
```

---

### Task 3: StatusFilter に mediaType prop を追加

**Files:**
- Modify: `frontend/src/components/StatusFilter/statusOptions.ts`
- Modify: `frontend/src/components/StatusFilter/StatusFilter.tsx`
- Modify: `frontend/src/components/StatusFilter/StatusFilter.test.tsx`

- [ ] **Step 1: テストを更新する**

```typescript
// StatusFilter.test.tsx を以下に書き換え
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StatusFilter } from './StatusFilter'

describe('StatusFilter', () => {
  it('mediaType 未指定時は汎用ラベルで表示される', () => {
    render(<StatusFilter value={null} onChange={() => {}} />)
    expect(screen.getByRole('button', { name: 'すべて' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '進行中' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '完了' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '一時停止' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '中断' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '予定' })).toBeInTheDocument()
  })

  it('anime 指定時は映像系ラベルで表示される', () => {
    render(<StatusFilter value={null} onChange={() => {}} mediaType="anime" />)
    expect(screen.getByRole('button', { name: '視聴中' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '視聴完了' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '視聴予定' })).toBeInTheDocument()
  })

  it('book 指定時は読み物系ラベルで表示される', () => {
    render(<StatusFilter value={null} onChange={() => {}} mediaType="book" />)
    expect(screen.getByRole('button', { name: '読書中' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '読了' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '読書予定' })).toBeInTheDocument()
  })

  it('value が null のとき「すべて」がアクティブ', () => {
    render(<StatusFilter value={null} onChange={() => {}} />)
    expect(screen.getByRole('button', { name: 'すべて' }).className).toContain('active')
  })

  it('value が watching のとき対応ラベルがアクティブ', () => {
    render(<StatusFilter value="watching" onChange={() => {}} mediaType="anime" />)
    expect(screen.getByRole('button', { name: '視聴中' }).className).toContain('active')
  })

  it('ステータスボタンクリックで onChange が呼ばれる', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()
    render(<StatusFilter value={null} onChange={handleChange} mediaType="anime" />)
    await user.click(screen.getByRole('button', { name: '視聴中' }))
    expect(handleChange).toHaveBeenCalledWith('watching')
  })

  it('「すべて」クリックで null が渡される', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()
    render(<StatusFilter value="watching" onChange={handleChange} />)
    await user.click(screen.getByRole('button', { name: 'すべて' }))
    expect(handleChange).toHaveBeenCalledWith(null)
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `cd frontend && npx vitest run src/components/StatusFilter/StatusFilter.test.tsx`
Expected: FAIL — 汎用ラベルが見つからない

- [ ] **Step 3: statusOptions.ts を更新する**

`getStatusOptions` を再エクスポートし、後方互換性のため `STATUS_OPTIONS` も一時的に残す（Task 8 で削除）。

```typescript
// statusOptions.ts を以下に書き換え
// ステータスフィルタの選択肢を動的に生成する
import { getStatusOptions } from '../../lib/mediaTypeUtils'

export { getStatusOptions }

// 後方互換: LibraryPage が Task 8 で getStatusOptions に移行するまで残す
export const STATUS_OPTIONS = getStatusOptions()
```

- [ ] **Step 4: StatusFilter.tsx を更新する**

```typescript
// StatusFilter.tsx を以下に書き換え
import type { MediaType, RecordStatus } from '../../lib/types'
import { getStatusOptions } from './statusOptions'
import styles from './StatusFilter.module.css'

type StatusFilterProps = {
  value: RecordStatus | null
  onChange: (status: RecordStatus | null) => void
  mediaType?: MediaType | null
}

export function StatusFilter({ value, onChange, mediaType }: StatusFilterProps) {
  const options = getStatusOptions(mediaType)

  return (
    <div className={styles.container}>
      {options.map((option) => (
        <button
          key={option.value ?? 'all'}
          type="button"
          className={`${styles.pill} ${value === option.value ? styles.active : ''}`}
          onClick={() => onChange(option.value)}
          aria-label={option.label}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 5: テストがパスすることを確認**

Run: `cd frontend && npx vitest run src/components/StatusFilter/StatusFilter.test.tsx`
Expected: ALL PASS

- [ ] **Step 6: コミット**

```bash
git add frontend/src/components/StatusFilter/statusOptions.ts frontend/src/components/StatusFilter/StatusFilter.tsx frontend/src/components/StatusFilter/StatusFilter.test.tsx
git commit -m "feat: StatusFilter にジャンル別ステータスラベルを対応"
```

---

### Task 4: RecordListItem のステータスバッジをジャンル別に変更

**Files:**
- Modify: `frontend/src/components/RecordListItem/RecordListItem.tsx`
- Modify: `frontend/src/components/RecordListItem/RecordListItem.test.tsx`

- [ ] **Step 1: テストを更新する**

既存テストの mock は `media_type: 'anime'` なので「視聴中」のままで正しい。本のテストケースを追加する。

```typescript
// RecordListItem.test.tsx の既存テスト「ステータスバッジが表示される」はそのまま残す（anime = 視聴中）
// 以下のテストを追加:

it('本のステータスバッジは「読書中」と表示される', () => {
  const bookRecord: UserRecord = {
    ...mockRecord,
    work: { ...mockRecord.work, media_type: 'book', total_episodes: null },
  }
  renderWithRouter(bookRecord)
  expect(screen.getByText('読書中')).toBeInTheDocument()
})

it('ゲームの completed は「プレイ完了」と表示される', () => {
  const gameRecord: UserRecord = {
    ...mockRecord,
    status: 'completed',
    work: { ...mockRecord.work, media_type: 'game', total_episodes: null },
  }
  renderWithRouter(gameRecord)
  expect(screen.getByText('プレイ完了')).toBeInTheDocument()
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `cd frontend && npx vitest run src/components/RecordListItem/RecordListItem.test.tsx`
Expected: FAIL — 「読書中」「プレイ完了」が見つからない（現状は全て「視聴〇〇」）

- [ ] **Step 3: RecordListItem を更新する**

`STATUS_LABELS` 定数を削除し、`getStatusLabel()` を使用する。

```typescript
// RecordListItem.tsx の変更点:
// 1. import に追加: import { getStatusLabel } from '../../lib/mediaTypeUtils'
// 2. STATUS_LABELS 定数（9-15行目）を削除
// 3. 46行目の {STATUS_LABELS[record.status]} を {getStatusLabel(record.status, work.media_type)} に変更
```

変更後の RecordListItem.tsx:
```typescript
import { Link } from 'react-router-dom'
import type { UserRecord } from '../../lib/types'
import { getStatusLabel } from '../../lib/mediaTypeUtils'
import styles from './RecordListItem.module.css'

type RecordListItemProps = {
  record: UserRecord
}

export function RecordListItem({ record }: RecordListItemProps) {
  const { work } = record
  const hasRating = record.rating !== null
  const hasEpisodes = work.total_episodes !== null

  const progressPercent =
    hasEpisodes && work.total_episodes > 0
      ? Math.min((record.current_episode / work.total_episodes) * 100, 100)
      : 0

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
        <div className={styles.header}>
          <h3 className={styles.title}>{work.title}</h3>
          <span className={`${styles.badge} ${styles[record.status]}`}>
            {getStatusLabel(record.status, work.media_type)}
          </span>
        </div>

        <div className={styles.meta}>
          {hasRating && (
            <span className={styles.rating}>
              <span className={styles.star}>★</span>
              <span>{record.rating}</span>
            </span>
          )}

          {hasEpisodes && (
            <div className={styles.progress}>
              <span className={styles.progressText}>
                {record.current_episode} / {work.total_episodes}話
              </span>
              <div className={styles.progressBar}>
                <div className={styles.progressFill} style={{ width: `${progressPercent}%` }} />
              </div>
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}
```

- [ ] **Step 4: テストがパスすることを確認**

Run: `cd frontend && npx vitest run src/components/RecordListItem/RecordListItem.test.tsx`
Expected: ALL PASS

- [ ] **Step 5: コミット**

```bash
git add frontend/src/components/RecordListItem/RecordListItem.tsx frontend/src/components/RecordListItem/RecordListItem.test.tsx
git commit -m "feat: RecordListItem のステータスバッジをジャンル別に変更"
```

---

### Task 5: RecordModal の mediaType prop 型変更 + StatusSelector 連携

**Files:**
- Modify: `frontend/src/components/RecordModal/RecordModal.tsx`
- Modify: `frontend/src/components/RecordModal/RecordModal.test.tsx`

- [ ] **Step 1: テストを更新する**

RecordModal の `mediaType` prop を `MediaType` 型に変更する。表示用ラベルは別途 `mediaTypeLabel` prop で渡す。

```typescript
// RecordModal.test.tsx を以下に書き換え
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RecordModal } from './RecordModal'

describe('RecordModal', () => {
  const defaultProps = {
    isOpen: true,
    title: '進撃の巨人',
    mediaType: 'anime' as const,
    mediaTypeLabel: 'アニメ',
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    isLoading: false,
  }

  it('作品タイトルが表示される', () => {
    render(<RecordModal {...defaultProps} />)
    expect(screen.getByText('進撃の巨人を記録')).toBeInTheDocument()
  })

  it('メディアタイプラベルが表示される', () => {
    render(<RecordModal {...defaultProps} />)
    expect(screen.getByText('アニメ')).toBeInTheDocument()
  })

  it('anime 指定時は映像系ステータスラベルが表示される', () => {
    render(<RecordModal {...defaultProps} />)
    expect(screen.getByRole('button', { name: '視聴中' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '視聴完了' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '視聴予定' })).toBeInTheDocument()
  })

  it('book 指定時は読み物系ステータスラベルが表示される', () => {
    render(
      <RecordModal {...defaultProps} mediaType="book" mediaTypeLabel="本" />,
    )
    expect(screen.getByRole('button', { name: '読書中' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '読了' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '読書予定' })).toBeInTheDocument()
  })

  it('評価入力が表示される', () => {
    render(<RecordModal {...defaultProps} />)
    expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument()
  })

  it('記録するボタンでonConfirmが呼ばれる', async () => {
    const user = userEvent.setup()
    const handleConfirm = vi.fn()
    render(<RecordModal {...defaultProps} onConfirm={handleConfirm} />)
    await user.click(screen.getByRole('button', { name: '記録する' }))
    expect(handleConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'plan_to_watch', rating: null }),
    )
  })

  it('キャンセルボタンでonCancelが呼ばれる', async () => {
    const user = userEvent.setup()
    const handleCancel = vi.fn()
    render(<RecordModal {...defaultProps} onCancel={handleCancel} />)
    await user.click(screen.getByRole('button', { name: 'キャンセル' }))
    expect(handleCancel).toHaveBeenCalled()
  })

  it('isOpen=false のとき何も表示しない', () => {
    const { container } = render(<RecordModal {...defaultProps} isOpen={false} />)
    expect(container.innerHTML).toBe('')
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `cd frontend && npx vitest run src/components/RecordModal/RecordModal.test.tsx`
Expected: FAIL — 新しいprop構成がコンポーネントと一致しない

- [ ] **Step 3: RecordModal を更新する**

```typescript
// RecordModal.tsx を以下に書き換え
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
  const [status, setStatus] = useState<RecordStatus>('plan_to_watch')
  const [rating, setRating] = useState<number | null>(null)

  if (!isOpen) return null

  const handleConfirm = () => {
    onConfirm({ status, rating })
  }

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h3 className={styles.title}>{title}を記録</h3>
        <p className={styles.meta}>{mediaTypeLabel}</p>

        <div className={styles.section}>
          <label className={styles.label}>ステータス</label>
          <StatusSelector value={status} onChange={setStatus} mediaType={mediaType} />
        </div>

        <div className={styles.section}>
          <label className={styles.label}>評価（任意）</label>
          <RatingInput value={rating} onChange={setRating} />
        </div>

        <div className={styles.actions}>
          <Button variant="secondary" onClick={onCancel}>
            キャンセル
          </Button>
          <Button variant="primary" onClick={handleConfirm} disabled={isLoading}>
            {isLoading ? '記録中...' : '記録する'}
          </Button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: テストがパスすることを確認**

Run: `cd frontend && npx vitest run src/components/RecordModal/RecordModal.test.tsx`
Expected: ALL PASS

- [ ] **Step 5: コミット**

```bash
git add frontend/src/components/RecordModal/RecordModal.tsx frontend/src/components/RecordModal/RecordModal.test.tsx
git commit -m "feat: RecordModal の mediaType prop を MediaType 型に変更"
```

---

### Task 6: SearchPage の RecordModal 呼び出しを更新

**Files:**
- Modify: `frontend/src/pages/SearchPage/SearchPage.tsx`

- [ ] **Step 1: SearchPage を更新する**

`frontend/src/pages/SearchPage/SearchPage.tsx` の168-175行目を変更。RecordModal に `mediaType`（`MediaType` 型）と `mediaTypeLabel`（表示用）を分けて渡す。

変更箇所（168-175行目）:
```typescript
// 変更前:
<RecordModal
  isOpen={modalWork !== null}
  title={modalWork?.title ?? ''}
  mediaType={modalWork ? getGenreLabel(modalWork.media_type) : ''}
  onConfirm={handleConfirmRecord}
  onCancel={() => setModalWork(null)}
  isLoading={loadingId !== null}
/>

// 変更後:
<RecordModal
  isOpen={modalWork !== null}
  title={modalWork?.title ?? ''}
  mediaType={modalWork?.media_type ?? 'anime'}
  mediaTypeLabel={modalWork ? getGenreLabel(modalWork.media_type) : ''}
  onConfirm={handleConfirmRecord}
  onCancel={() => setModalWork(null)}
  isLoading={loadingId !== null}
/>
```

- [ ] **Step 2: 型エラーがないことを確認**

Run: `cd frontend && npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 3: 全テストがパスすることを確認**

Run: `cd frontend && npx vitest run`
Expected: ALL PASS

- [ ] **Step 4: コミット**

```bash
git add frontend/src/pages/SearchPage/SearchPage.tsx
git commit -m "feat: SearchPage の RecordModal 呼び出しをジャンル別対応"
```

---

### Task 7: WorkDetailPage に mediaType を StatusSelector に渡す

**Files:**
- Modify: `frontend/src/pages/WorkDetailPage/WorkDetailPage.tsx`

- [ ] **Step 1: WorkDetailPage を更新する**

81行目の StatusSelector に `mediaType` prop を追加する。

```typescript
// 変更前（81行目）:
<StatusSelector value={record.status} onChange={handleStatusChange} />

// 変更後:
<StatusSelector value={record.status} onChange={handleStatusChange} mediaType={work.media_type} />
```

- [ ] **Step 2: 型エラーがないことを確認**

Run: `cd frontend && npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 3: コミット**

```bash
git add frontend/src/pages/WorkDetailPage/WorkDetailPage.tsx
git commit -m "feat: WorkDetailPage の StatusSelector にジャンル別ラベルを対応"
```

---

### Task 8: LibraryPage にジャンル別ステータスフィルターを対応

**Files:**
- Modify: `frontend/src/pages/LibraryPage/LibraryPage.tsx`

- [ ] **Step 1: LibraryPage を更新する**

3つの変更:
1. `STATUS_OPTIONS` の import を `getStatusOptions` に変更
2. StatusFilter に `mediaType` prop を渡す
3. モバイル用チップのラベルを動的に取得

```typescript
// 変更1: import（5行目）
// 変更前:
import { STATUS_OPTIONS } from '../../components/StatusFilter/statusOptions'
// 変更後:
import { getStatusOptions } from '../../components/StatusFilter/statusOptions'

// 変更2: statusLabel の取得（46行目付近）
// 変更前:
const statusLabel = findLabel(STATUS_OPTIONS, status) ?? 'すべて'
// 変更後:
const statusOptions = getStatusOptions(mediaType)
const statusLabel = findLabel(statusOptions, status) ?? 'すべて'

// 変更3: StatusFilter に mediaType を渡す（72行目）
// 変更前:
<StatusFilter value={status} onChange={setStatus} />
// 変更後:
<StatusFilter value={status} onChange={setStatus} mediaType={mediaType} />
```

- [ ] **Step 2: statusOptions.ts から後方互換の STATUS_OPTIONS を削除する**

Task 3 で一時的に残した `STATUS_OPTIONS` を削除する。

```typescript
// statusOptions.ts を以下に書き換え（最終形）
// ステータスフィルタの選択肢を動的に生成する
export { getStatusOptions } from '../../lib/mediaTypeUtils'
```

- [ ] **Step 3: 型エラーがないことを確認**

Run: `cd frontend && npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 4: 全テストがパスすることを確認**

Run: `cd frontend && npx vitest run`
Expected: ALL PASS

- [ ] **Step 5: コミット**

```bash
git add frontend/src/pages/LibraryPage/LibraryPage.tsx frontend/src/components/StatusFilter/statusOptions.ts
git commit -m "feat: LibraryPage のステータスフィルターをジャンル別に対応"
```

---

### Task 9: 最終確認

- [ ] **Step 1: 全テストがパスすることを確認**

Run: `cd frontend && npx vitest run`
Expected: ALL PASS

- [ ] **Step 2: 型チェックがパスすることを確認**

Run: `cd frontend && npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 3: ESLint がパスすることを確認**

Run: `cd frontend && npx eslint src/`
Expected: エラーなし
