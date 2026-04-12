# 評価スライダー デバウンス/楽観的更新 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** スライダー・エピソード・再視聴の3ハンドラーにデバウンス+楽観的更新を適用し、連続操作時のAPI呼び出しを1回に抑える

**Architecture:** `useDebouncedRecordUpdate` カスタムフックを新規作成。楽観的に即座にローカルstateを更新し、300msデバウンス後にAPIを1回呼ぶ。API失敗時はスナップショットにロールバック。`useWorkDetail` の3ハンドラーをこのフックに差し替える。

**Tech Stack:** React 19, TypeScript, Vitest, React Testing Library

---

## ファイル構成

| 種別 | ファイル | 役割 |
|------|---------|------|
| 新規 | `frontend/src/hooks/useDebouncedRecordUpdate.ts` | デバウンス + 楽観的更新フック |
| 新規 | `frontend/src/hooks/useDebouncedRecordUpdate.test.ts` | フック単体テスト |
| 変更 | `frontend/src/pages/WorkDetailPage/useWorkDetail.ts` | 3ハンドラーを新フックに切り替え |
| 変更 | `frontend/src/pages/WorkDetailPage/WorkDetailPage.test.tsx` | デバウンス挙動に合わせてテスト更新 |

---

### Task 1: `useDebouncedRecordUpdate` フックのテストを書く

**Files:**
- Create: `frontend/src/hooks/useDebouncedRecordUpdate.test.ts`

- [ ] **Step 1: テストファイルを作成する**

```typescript
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../lib/recordsApi', () => ({
  recordsApi: {
    update: vi.fn(),
  },
}))

import { recordsApi } from '../lib/recordsApi'
import { useDebouncedRecordUpdate } from './useDebouncedRecordUpdate'
import type { UserRecord } from '../lib/types'

const mockRecord: UserRecord = {
  id: 1,
  work_id: 10,
  status: 'watching',
  rating: 5,
  current_episode: 3,
  rewatch_count: 1,
  review_text: null,
  visibility: 'private_record',
  started_at: null,
  completed_at: null,
  created_at: '2026-01-01T00:00:00Z',
  work: {
    id: 10,
    title: 'テスト作品',
    media_type: 'anime',
    description: null,
    cover_image_url: null,
    total_episodes: 12,
    external_api_id: null,
    external_api_source: null,
    metadata: {},
    last_synced_at: null,
    created_at: '2026-01-01T00:00:00Z',
  },
}

describe('useDebouncedRecordUpdate', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(recordsApi.update).mockResolvedValue({
      record: { ...mockRecord, rating: 8 },
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('楽観的更新: 呼び出し直後にsetStateが実行される', () => {
    const setState = vi.fn()
    const { result } = renderHook(() =>
      useDebouncedRecordUpdate({ record: mockRecord, setState }),
    )

    act(() => {
      result.current({ rating: 8 })
    })

    // setStateが即座に呼ばれる（楽観的更新）
    expect(setState).toHaveBeenCalledTimes(1)
    // APIはまだ呼ばれていない
    expect(recordsApi.update).not.toHaveBeenCalled()
  })

  it('デバウンス: 300ms後にAPIが1回だけ呼ばれる', async () => {
    const setState = vi.fn()
    const { result } = renderHook(() =>
      useDebouncedRecordUpdate({ record: mockRecord, setState }),
    )

    act(() => {
      result.current({ rating: 6 })
      result.current({ rating: 7 })
      result.current({ rating: 8 })
    })

    // 300ms経過前はAPIが呼ばれない
    expect(recordsApi.update).not.toHaveBeenCalled()

    // 300ms経過
    await act(async () => {
      vi.advanceTimersByTime(300)
    })

    // APIは最後の値（8）で1回だけ呼ばれる
    expect(recordsApi.update).toHaveBeenCalledTimes(1)
    expect(recordsApi.update).toHaveBeenCalledWith(1, { rating: 8 })
  })

  it('API成功時: サーバーレスポンスでstateを確定する', async () => {
    const setState = vi.fn()
    const { result } = renderHook(() =>
      useDebouncedRecordUpdate({ record: mockRecord, setState }),
    )

    act(() => {
      result.current({ rating: 8 })
    })

    await act(async () => {
      vi.advanceTimersByTime(300)
    })

    // setState が2回呼ばれる: 1回目=楽観的更新、2回目=API成功後の確定
    expect(setState).toHaveBeenCalledTimes(2)
  })

  it('API失敗時: 操作前の値にロールバックする', async () => {
    vi.mocked(recordsApi.update).mockRejectedValue(new Error('Network error'))
    const setState = vi.fn()
    const { result } = renderHook(() =>
      useDebouncedRecordUpdate({ record: mockRecord, setState }),
    )

    act(() => {
      result.current({ rating: 8 })
    })

    await act(async () => {
      vi.advanceTimersByTime(300)
    })

    // setState が2回呼ばれる: 1回目=楽観的更新、2回目=ロールバック
    expect(setState).toHaveBeenCalledTimes(2)
    // 2回目のsetStateコールバックを取得して、ロールバックを検証
    const rollbackFn = setState.mock.calls[1][0]
    const stateWithOptimistic = {
      record: { ...mockRecord, rating: 8 },
      isLoading: false,
      isDeleting: false,
      showDeleteDialog: false,
    }
    const rolledBack = rollbackFn(stateWithOptimistic)
    expect(rolledBack.record.rating).toBe(5) // 元の値に戻る
  })

  it('recordがnullの場合は何もしない', () => {
    const setState = vi.fn()
    const { result } = renderHook(() =>
      useDebouncedRecordUpdate({ record: null, setState }),
    )

    act(() => {
      result.current({ rating: 8 })
    })

    expect(setState).not.toHaveBeenCalled()
  })

  it('current_episodeもデバウンスされる', async () => {
    const setState = vi.fn()
    vi.mocked(recordsApi.update).mockResolvedValue({
      record: { ...mockRecord, current_episode: 6 },
    })
    const { result } = renderHook(() =>
      useDebouncedRecordUpdate({ record: mockRecord, setState }),
    )

    act(() => {
      result.current({ current_episode: 4 })
      result.current({ current_episode: 5 })
      result.current({ current_episode: 6 })
    })

    await act(async () => {
      vi.advanceTimersByTime(300)
    })

    expect(recordsApi.update).toHaveBeenCalledTimes(1)
    expect(recordsApi.update).toHaveBeenCalledWith(1, { current_episode: 6 })
  })

  it('delayMsでデバウンス時間をカスタマイズできる', async () => {
    const setState = vi.fn()
    const { result } = renderHook(() =>
      useDebouncedRecordUpdate({ record: mockRecord, setState, delayMs: 500 }),
    )

    act(() => {
      result.current({ rating: 8 })
    })

    // 300ms時点ではまだ呼ばれない
    await act(async () => {
      vi.advanceTimersByTime(300)
    })
    expect(recordsApi.update).not.toHaveBeenCalled()

    // 500ms時点で呼ばれる
    await act(async () => {
      vi.advanceTimersByTime(200)
    })
    expect(recordsApi.update).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `cd frontend && npx vitest run src/hooks/useDebouncedRecordUpdate.test.ts`
Expected: FAIL（`useDebouncedRecordUpdate` モジュールが存在しないため）

- [ ] **Step 3: コミット**

```bash
git add frontend/src/hooks/useDebouncedRecordUpdate.test.ts
git commit -m "test(frontend): useDebouncedRecordUpdateの単体テストを追加 #124"
```

---

### Task 2: `useDebouncedRecordUpdate` フックを実装する

**Files:**
- Create: `frontend/src/hooks/useDebouncedRecordUpdate.ts`

- [ ] **Step 1: フックを実装する**

```typescript
import { useRef, useEffect, useCallback } from 'react'
import type { UserRecord } from '../lib/types'
import { recordsApi } from '../lib/recordsApi'

type DebouncedFields = Partial<
  Pick<UserRecord, 'rating' | 'current_episode' | 'rewatch_count'>
>

type WorkDetailState = {
  record: UserRecord | null
  isLoading: boolean
  isDeleting: boolean
  showDeleteDialog: boolean
}

type UseDebouncedRecordUpdateParams = {
  record: UserRecord | null
  setState: React.Dispatch<React.SetStateAction<WorkDetailState>>
  delayMs?: number
}

const DEBOUNCE_DELAY_MS = 300

export function useDebouncedRecordUpdate({
  record,
  setState,
  delayMs = DEBOUNCE_DELAY_MS,
}: UseDebouncedRecordUpdateParams): (params: DebouncedFields) => void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const snapshotRef = useRef<UserRecord | null>(null)

  // アンマウント時にタイマーをクリア
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
      }
    }
  }, [])

  const debouncedUpdate = useCallback(
    (params: DebouncedFields) => {
      if (!record) return

      // 初回呼び出し時にスナップショットを保存（連続操作の「操作前の値」）
      if (snapshotRef.current === null) {
        snapshotRef.current = record
      }

      // 楽観的更新: UIを即座に更新
      setState((prev) => {
        if (!prev.record) return prev
        return {
          ...prev,
          record: { ...prev.record, ...params },
        }
      })

      // 既存タイマーをキャンセル（デバウンスのリセット）
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
      }

      // 新しいタイマーをセット
      const snapshot = snapshotRef.current
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        snapshotRef.current = null

        recordsApi
          .update(record.id, params)
          .then((res) => {
            // API成功: サーバーレスポンスでstateを確定
            setState((prev) => {
              if (!prev.record) return prev
              return { ...prev, record: res.record }
            })
          })
          .catch(() => {
            // API失敗: スナップショットにロールバック
            setState((prev) => {
              if (!prev.record || !snapshot) return prev
              return { ...prev, record: snapshot }
            })
          })
      }, delayMs)
    },
    [record, setState, delayMs],
  )

  return debouncedUpdate
}
```

- [ ] **Step 2: テストを実行してパスを確認する**

Run: `cd frontend && npx vitest run src/hooks/useDebouncedRecordUpdate.test.ts`
Expected: 全テストPASS

- [ ] **Step 3: コミット**

```bash
git add frontend/src/hooks/useDebouncedRecordUpdate.ts
git commit -m "feat(frontend): useDebouncedRecordUpdateフックを実装 #124"
```

---

### Task 3: `useWorkDetail` を新フックに切り替える

**Files:**
- Modify: `frontend/src/pages/WorkDetailPage/useWorkDetail.ts`

- [ ] **Step 1: `useWorkDetail` に新フックをインポートし、3ハンドラーを差し替える**

変更内容:

1. `useDebouncedRecordUpdate` をインポートに追加
2. `WorkDetailState` 型をエクスポート（新フックが参照するため）
3. `useDebouncedRecordUpdate` を呼び出し、戻り値の `debouncedUpdate` を取得
4. `handleRatingChange`、`handleEpisodeChange`、`handleRewatchCountChange` を `debouncedUpdate` で書き換え

変更後の全体:

```typescript
import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { UserRecord, RecordStatus } from '../../lib/types'
import { recordsApi } from '../../lib/recordsApi'
import { worksApi } from '../../lib/worksApi'
import { useDebouncedRecordUpdate } from '../../hooks/useDebouncedRecordUpdate'

export type WorkDetailState = {
  record: UserRecord | null
  isLoading: boolean
  isDeleting: boolean
  showDeleteDialog: boolean
}

export function useWorkDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const hasValidId = !isNaN(Number(id))
  const [state, setState] = useState<WorkDetailState>({
    record: null,
    isLoading: hasValidId,
    isDeleting: false,
    showDeleteDialog: false,
  })

  useEffect(() => {
    const workId = Number(id)
    if (isNaN(workId)) return

    let cancelled = false
    const fetchRecord = async () => {
      try {
        const res = await recordsApi.getAll({ workId })
        if (!cancelled) {
          const record = res.records[0] ?? null
          setState((prev) => ({
            ...prev,
            record,
            isLoading: false,
          }))
          if (record?.work.external_api_source === 'anilist') {
            try {
              const syncRes = await worksApi.sync(record.work.id)
              if (!cancelled && syncRes.work) {
                setState((prev) => {
                  if (!prev.record) return prev
                  return {
                    ...prev,
                    record: { ...prev.record, work: syncRes.work },
                  }
                })
              }
            } catch {
              // sync失敗は無視
            }
          }
        }
      } catch {
        if (!cancelled) {
          setState((prev) => ({ ...prev, isLoading: false }))
        }
      }
    }
    void fetchRecord()
    return () => {
      cancelled = true
    }
  }, [id])

  // デバウンス不要のハンドラー用（ステータス変更・レビュー保存）
  const updateRecord = useCallback(
    async (params: {
      status?: RecordStatus
      rating?: number | null
      current_episode?: number
      review_text?: string | null
      rewatch_count?: number
    }) => {
      if (!state.record) return
      try {
        const res = await recordsApi.update(state.record.id, params)
        setState((prev) => ({ ...prev, record: res.record }))
      } catch {
        // エラー時は状態を変更しない
      }
    },
    [state.record],
  )

  // デバウンス付きハンドラー用（スライダー・エピソード・再視聴回数）
  const debouncedUpdate = useDebouncedRecordUpdate({
    record: state.record,
    setState,
  })

  const handleStatusChange = useCallback(
    (status: RecordStatus) => {
      void updateRecord({ status })
    },
    [updateRecord],
  )

  const handleRatingChange = useCallback(
    (rating: number | null) => {
      debouncedUpdate({ rating: rating ?? undefined })
    },
    [debouncedUpdate],
  )

  const handleEpisodeChange = useCallback(
    (episode: number) => {
      debouncedUpdate({ current_episode: episode })
    },
    [debouncedUpdate],
  )

  const handleReviewTextSave = useCallback(
    async (text: string) => {
      await updateRecord({ review_text: text })
    },
    [updateRecord],
  )

  const handleRewatchCountChange = useCallback(
    (count: number) => {
      debouncedUpdate({ rewatch_count: count })
    },
    [debouncedUpdate],
  )

  const openDeleteDialog = useCallback(() => {
    setState((prev) => ({ ...prev, showDeleteDialog: true }))
  }, [])

  const closeDeleteDialog = useCallback(() => {
    setState((prev) => ({ ...prev, showDeleteDialog: false }))
  }, [])

  const handleDelete = useCallback(async () => {
    if (!state.record) return
    setState((prev) => ({ ...prev, isDeleting: true }))
    try {
      await recordsApi.remove(state.record.id)
      if (window.history.length > 1) {
        navigate(-1)
      } else {
        navigate('/search')
      }
    } catch {
      setState((prev) => ({ ...prev, isDeleting: false }))
    }
  }, [state.record, navigate])

  const confirmDelete = useCallback(() => {
    void handleDelete()
  }, [handleDelete])

  return {
    record: state.record,
    isLoading: state.isLoading,
    isDeleting: state.isDeleting,
    showDeleteDialog: state.showDeleteDialog,
    handleStatusChange,
    handleRatingChange,
    handleEpisodeChange,
    handleReviewTextSave,
    handleRewatchCountChange,
    openDeleteDialog,
    closeDeleteDialog,
    confirmDelete,
  }
}
```

- [ ] **Step 2: テストを実行してパスを確認する**

Run: `cd frontend && npx vitest run src/hooks/useDebouncedRecordUpdate.test.ts src/pages/WorkDetailPage/WorkDetailPage.test.tsx`
Expected: 全テストPASS

- [ ] **Step 3: リンターを実行する**

Run: `cd frontend && npx eslint src/hooks/useDebouncedRecordUpdate.ts src/hooks/useDebouncedRecordUpdate.test.ts src/pages/WorkDetailPage/useWorkDetail.ts`
Expected: エラーなし

- [ ] **Step 4: コミット**

```bash
git add frontend/src/pages/WorkDetailPage/useWorkDetail.ts
git commit -m "refactor(frontend): useWorkDetailの3ハンドラーをデバウンス付きに切り替え #124"
```

---

### Task 4: `WorkDetailPage.test.tsx` をデバウンス挙動に合わせて更新する

**Files:**
- Modify: `frontend/src/pages/WorkDetailPage/WorkDetailPage.test.tsx`

- [ ] **Step 1: テストにfake timersとデバウンス待機を追加する**

既存テストの中で `recordsApi.update` の呼び出しを検証しているテストがある場合、`vi.useFakeTimers()` + `vi.advanceTimersByTime(300)` を追加する。

現在のテストは主に表示確認（`getByText`, `getByRole`）なので、デバウンスの影響を受けるのは `recordsApi.update` を間接的にトリガーする操作テスト。現在の `WorkDetailPage.test.tsx` にはスライダー操作のテストがないため、表示テストは変更不要。

テストが全てパスすることを確認する:

Run: `cd frontend && npx vitest run src/pages/WorkDetailPage/WorkDetailPage.test.tsx`
Expected: 全テストPASS

- [ ] **Step 2: 全テストスイートを実行する**

Run: `cd frontend && npx vitest run`
Expected: 全テストPASS

- [ ] **Step 3: コミット（テスト変更が必要だった場合のみ）**

```bash
git add frontend/src/pages/WorkDetailPage/WorkDetailPage.test.tsx
git commit -m "test(frontend): WorkDetailPageテストをデバウンス挙動に合わせて更新 #124"
```
