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
    vi.clearAllMocks()
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
    const { result } = renderHook(() => useDebouncedRecordUpdate({ record: mockRecord, setState }))

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
    const { result } = renderHook(() => useDebouncedRecordUpdate({ record: mockRecord, setState }))

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
    const { result } = renderHook(() => useDebouncedRecordUpdate({ record: mockRecord, setState }))

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
    const { result } = renderHook(() => useDebouncedRecordUpdate({ record: mockRecord, setState }))

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

  it('recordがnullの場合は何もしな���', () => {
    const setState = vi.fn()
    const { result } = renderHook(() => useDebouncedRecordUpdate({ record: null, setState }))

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
    const { result } = renderHook(() => useDebouncedRecordUpdate({ record: mockRecord, setState }))

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

  it('API応答中に新しい操作が来た場合、古いレスポンスは無視される', async () => {
    // 1回目のAPI呼び出しは解決を手動制御する
    let resolveFirst!: (value: { record: UserRecord }) => void
    vi.mocked(recordsApi.update).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve
        }),
    )

    const setState = vi.fn()
    const { result, rerender } = renderHook(
      ({ record }) => useDebouncedRecordUpdate({ record, setState }),
      { initialProps: { record: mockRecord } },
    )

    // 1回目: current_episode を 4 に変更
    act(() => {
      result.current({ current_episode: 4 })
    })

    // 300ms後にAPI呼び出し（レスポンスはまだ返らない）
    await act(async () => {
      vi.advanceTimersByTime(300)
    })
    expect(recordsApi.update).toHaveBeenCalledTimes(1)

    // 楽観的更新された record でフックを再レンダー
    const optimisticRecord = { ...mockRecord, current_episode: 4 }
    rerender({ record: optimisticRecord })

    // 2回目のAPIは即座に解決するようにモック
    vi.mocked(recordsApi.update).mockResolvedValueOnce({
      record: { ...mockRecord, current_episode: 5 },
    })

    // 2回目: API応答待ち中に +1 操作
    act(() => {
      result.current({ current_episode: 5 })
    })

    // 1回目のAPIレスポンスが到着（current_episode: 4）
    await act(async () => {
      resolveFirst({ record: { ...mockRecord, current_episode: 4 } })
    })

    // 古いレスポンスは無視されるべき → setStateで4に戻されない
    // setState呼び出し: 1回目=楽観的(4), 2回目=楽観的(5)
    // 1回目のAPI成功のsetStateは呼ばれない（世代が変わったため）
    const allSetStateCalls = setState.mock.calls
    // 最後のsetState呼び出しのコールバックを検証
    const lastCall = allSetStateCalls[allSetStateCalls.length - 1][0]
    if (typeof lastCall === 'function') {
      const result2 = lastCall({
        record: { ...mockRecord, current_episode: 5 },
        isLoading: false,
        isDeleting: false,
        showDeleteDialog: false,
      })
      // 5のままであること（4に戻らない）
      expect(result2.record.current_episode).toBe(5)
    }
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
