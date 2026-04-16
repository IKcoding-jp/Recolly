import { renderHook, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useDashboard } from './useDashboard'

vi.mock('../lib/recordsApi', () => ({
  recordsApi: {
    getAll: vi.fn(),
    update: vi.fn(),
  },
}))

vi.mock('../lib/analytics/posthog', () => ({
  captureEvent: vi.fn(),
}))

import { recordsApi } from '../lib/recordsApi'
import { captureEvent } from '../lib/analytics/posthog'
import { ANALYTICS_EVENTS } from '../lib/analytics/events'

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

  it('handleAction: current_episodeがtotal_episodesに達している場合はAPIを呼ばない', async () => {
    const atLimitRecords = [
      {
        ...mockRecords[0],
        current_episode: 25,
        work: { ...mockRecords[0].work, total_episodes: 25 },
      },
    ]
    vi.mocked(recordsApi.getAll).mockResolvedValue({ records: atLimitRecords })
    const { result } = renderHook(() => useDashboard())
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    await act(async () => {
      await result.current.handleAction(atLimitRecords[0])
    })
    expect(recordsApi.update).not.toHaveBeenCalled()
    // current_episodeが変わっていないことも確認
    expect(result.current.records[0].current_episode).toBe(25)
  })

  it('handleAction: total_episodesがnullの場合は制限なくインクリメントできる', async () => {
    const noLimitRecords = [
      {
        ...mockRecords[0],
        current_episode: 100,
        work: { ...mockRecords[0].work, total_episodes: null },
      },
    ]
    vi.mocked(recordsApi.getAll).mockResolvedValue({ records: noLimitRecords })
    vi.mocked(recordsApi.update).mockResolvedValue({
      record: { ...noLimitRecords[0], current_episode: 101 },
    })
    const { result } = renderHook(() => useDashboard())
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    await act(async () => {
      await result.current.handleAction(noLimitRecords[0])
    })
    expect(recordsApi.update).toHaveBeenCalledWith(1, { current_episode: 101 })
  })

  it('エラー時にエラーメッセージを設定する', async () => {
    vi.mocked(recordsApi.getAll).mockRejectedValue(new Error('Network error'))
    const { result } = renderHook(() => useDashboard())
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    expect(result.current.error).toBe('記録の取得に失敗しました')
  })

  describe('analytics 発火', () => {
    it('アニメ +1話 で episode_progress_updated が発火する', async () => {
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
      expect(captureEvent).toHaveBeenCalledWith(ANALYTICS_EVENTS.EPISODE_PROGRESS_UPDATED, {
        media_type: 'anime',
        increment_type: 'episode',
        new_value: 13,
      })
      expect(captureEvent).not.toHaveBeenCalledWith(
        ANALYTICS_EVENTS.RECORD_STATUS_CHANGED,
        expect.anything(),
      )
    })

    it('漫画 +1巻 で increment_type=volume の episode_progress_updated が発火する', async () => {
      const mangaRecords = [
        {
          ...mockRecords[0],
          id: 2,
          current_episode: 3,
          work: { ...mockRecords[0].work, id: 20, media_type: 'manga', total_episodes: 10 },
        },
      ]
      vi.mocked(recordsApi.getAll).mockResolvedValue({ records: mangaRecords })
      vi.mocked(recordsApi.update).mockResolvedValue({
        record: { ...mangaRecords[0], current_episode: 4 },
      })
      const { result } = renderHook(() => useDashboard())
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
      await act(async () => {
        await result.current.handleAction(mangaRecords[0])
      })
      expect(captureEvent).toHaveBeenCalledWith(ANALYTICS_EVENTS.EPISODE_PROGRESS_UPDATED, {
        media_type: 'manga',
        increment_type: 'volume',
        new_value: 4,
      })
    })

    it('+1話 で自動 completed になった場合は record_status_changed も発火する', async () => {
      const lastEpisodeRecords = [
        {
          ...mockRecords[0],
          current_episode: 24,
          work: { ...mockRecords[0].work, total_episodes: 25 },
        },
      ]
      vi.mocked(recordsApi.getAll).mockResolvedValue({ records: lastEpisodeRecords })
      vi.mocked(recordsApi.update).mockResolvedValue({
        record: { ...lastEpisodeRecords[0], current_episode: 25, status: 'completed' },
      })
      const { result } = renderHook(() => useDashboard())
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
      await act(async () => {
        await result.current.handleAction(lastEpisodeRecords[0])
      })
      expect(captureEvent).toHaveBeenCalledWith(
        ANALYTICS_EVENTS.EPISODE_PROGRESS_UPDATED,
        expect.any(Object),
      )
      expect(captureEvent).toHaveBeenCalledWith(ANALYTICS_EVENTS.RECORD_STATUS_CHANGED, {
        media_type: 'anime',
        from_status: 'watching',
        to_status: 'completed',
      })
    })

    it('話数のないメディア（book）の完了アクションで record_status_changed のみ発火する', async () => {
      const bookRecords = [
        {
          ...mockRecords[0],
          id: 3,
          current_episode: 0,
          work: {
            ...mockRecords[0].work,
            id: 30,
            media_type: 'book',
            total_episodes: null,
          },
        },
      ]
      vi.mocked(recordsApi.getAll).mockResolvedValue({ records: bookRecords })
      vi.mocked(recordsApi.update).mockResolvedValue({
        record: { ...bookRecords[0], status: 'completed' },
      })
      const { result } = renderHook(() => useDashboard())
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
      await act(async () => {
        await result.current.handleAction(bookRecords[0])
      })
      expect(captureEvent).toHaveBeenCalledWith(ANALYTICS_EVENTS.RECORD_STATUS_CHANGED, {
        media_type: 'book',
        from_status: 'watching',
        to_status: 'completed',
      })
      expect(captureEvent).not.toHaveBeenCalledWith(
        ANALYTICS_EVENTS.EPISODE_PROGRESS_UPDATED,
        expect.anything(),
      )
    })

    it('API 失敗時はイベントを発火しない', async () => {
      vi.mocked(recordsApi.getAll).mockResolvedValue({ records: mockRecords })
      vi.mocked(recordsApi.update).mockRejectedValue(new Error('boom'))
      const { result } = renderHook(() => useDashboard())
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
      await act(async () => {
        await result.current.handleAction(mockRecords[0])
      })
      expect(captureEvent).not.toHaveBeenCalledWith(
        ANALYTICS_EVENTS.EPISODE_PROGRESS_UPDATED,
        expect.anything(),
      )
      expect(captureEvent).not.toHaveBeenCalledWith(
        ANALYTICS_EVENTS.RECORD_STATUS_CHANGED,
        expect.anything(),
      )
    })
  })
})
