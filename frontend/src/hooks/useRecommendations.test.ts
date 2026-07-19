import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useRecommendations } from './useRecommendations'
import { recommendationsApi } from '../lib/recommendationsApi'
import type { RecommendationResponse } from '../types/recommendation'

vi.mock('../lib/recommendationsApi')

const POLL_INTERVAL_MS = 5000

const makeResponse = (analyzedAt: string): RecommendationResponse => ({
  recommendation: {
    analysis: null,
    analyzed_at: analyzedAt,
    record_count: 6,
  },
  status: 'ready',
})

describe('useRecommendations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('更新後、analyzed_atが変わるまでは旧データのreadyを無視してポーリングを続ける', async () => {
    vi.mocked(recommendationsApi.get).mockResolvedValue(makeResponse('2026-07-19T10:00:00Z'))
    vi.mocked(recommendationsApi.refresh).mockResolvedValue({ message: '', status: 'processing' })

    const { result } = renderHook(() => useRecommendations())
    await act(async () => {})
    expect(result.current.status).toBe('ready')

    await act(async () => {
      await result.current.refresh()
    })
    expect(result.current.status).toBe('generating')

    // ジョブ完了前はAPIが旧analyzed_atのreadyを返すが、完了扱いにしない
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS)
    })
    expect(result.current.status).toBe('generating')

    // analyzed_atが更新されたら新データを反映して完了
    vi.mocked(recommendationsApi.get).mockResolvedValue(makeResponse('2026-07-19T10:02:00Z'))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS)
    })
    expect(result.current.status).toBe('ready')
    expect(result.current.data?.analyzed_at).toBe('2026-07-19T10:02:00Z')
  })

  it('初回生成（既存データなし）は最初のreadyで完了する', async () => {
    vi.mocked(recommendationsApi.get)
      .mockResolvedValueOnce({ recommendation: null, status: 'generating' })
      .mockResolvedValue(makeResponse('2026-07-19T10:00:00Z'))

    const { result } = renderHook(() => useRecommendations())
    await act(async () => {})
    expect(result.current.status).toBe('generating')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS)
    })
    expect(result.current.status).toBe('ready')
    expect(result.current.data?.analyzed_at).toBe('2026-07-19T10:00:00Z')
  })

  it('上限回数までにanalyzed_atが変わらなければ打ち切って旧データ表示に戻しエラーを出す', async () => {
    vi.mocked(recommendationsApi.get).mockResolvedValue(makeResponse('2026-07-19T10:00:00Z'))
    vi.mocked(recommendationsApi.refresh).mockResolvedValue({ message: '', status: 'processing' })

    const { result } = renderHook(() => useRecommendations())
    await act(async () => {})
    await act(async () => {
      await result.current.refresh()
    })

    // 上限（60回×5秒=5分）までポーリングしても変化なし
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 60)
    })
    expect(result.current.status).toBe('ready')
    expect(result.current.error).toBeTruthy()
    expect(result.current.data?.analyzed_at).toBe('2026-07-19T10:00:00Z')
  })
})
