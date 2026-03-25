import { describe, it, expect, vi, beforeEach } from 'vitest'
import { statisticsApi } from './statisticsApi'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

beforeEach(() => {
  mockFetch.mockReset()
})

describe('statisticsApi', () => {
  describe('get', () => {
    it('正常系: 統計データを取得', async () => {
      const data = {
        by_genre: { anime: 10, movie: 5 },
        by_status: { watching: 3, completed: 12 },
        monthly_completions: [{ month: '2026-03', count: 5 }],
        totals: { episodes_watched: 120, volumes_read: 45 },
      }
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(data) })
      const result = await statisticsApi.get()
      expect(result.by_genre.anime).toBe(10)
      expect(result.totals.episodes_watched).toBe(120)
    })

    it('正しいエンドポイントを呼び出す', async () => {
      const data = {
        by_genre: {},
        by_status: {},
        monthly_completions: [],
        totals: { episodes_watched: 0, volumes_read: 0 },
      }
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(data) })
      await statisticsApi.get()
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/statistics'),
        expect.any(Object),
      )
    })

    it('エラー時にApiErrorをスローする', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: '認証が必要です' }),
      })
      await expect(statisticsApi.get()).rejects.toThrow('認証が必要です')
    })
  })
})
