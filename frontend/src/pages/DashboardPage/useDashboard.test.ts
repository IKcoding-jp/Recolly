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
